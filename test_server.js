#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');
const async = require('async');

const _ = require('lodash');

const exec = require('./utils').exec;
const execAsync = require('./utils').execAsync;
const getSubDirectories = require('./utils').getSubDirectories;
const changeDir = require('./utils').changeDir;
const deleteNullPropertiesDeep = require('./utils').deleteNullPropertiesDeep;
const npmCache = require('./npmCache');

const repositoryDir = process.env.PWD;
const ciDir = process.env['CI_DIRECTORY'];

/**
 * (1) Detect client and server branch
 */
const serverBranch = exec('git rev-parse --abbrev-ref HEAD', {stdio: null}).toString('utf8')
  .replace('\n', '');
const clientBranch = exec('git ls-remote' +
  ' --heads git@github.com:Linkurious/linkurious-client.git ' +
  serverBranch + ' | wc -l', {stdio: null}).toString('utf8') === '1'
  ? serverBranch
  : 'develop';


/**
 * (2) This file is executed inside repositoryDir, we need to change directory to the CI
 */
process.chdir(ciDir);

// ensure code coverage directory exists
const coverageDir = ciDir + '/tmp/coverages';
exec(`mkdir -p ${coverageDir}`);

const packageJsonFile = repositoryDir + '/package.json';
/**
 * (3) Retrieve the node and npm version from the package.json file
 */
const packageJsonData = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));

// We have to use this version of node in the Dockerfiles
const nodeVersion = packageJsonData.engines.node;

// We have to switch to this version of npm to generate the node_modules directory
const npmVersion = packageJsonData.engines.npm;

/**
 * (4) Generate or retrieve the node_modules directory for this test
 */
const nodeModulesDir = npmCache(packageJsonFile, nodeVersion, npmVersion);

/**
 * (5) Read default test configuration
 */
const defaultTestConfig = require(repositoryDir + '/server/config/defaults/test');

/**
 * (6) Loop through all the configs
 */
// we remove all the existing docker containers
exec('docker rm -f $(docker ps -a -q) 2>/dev/null || true');

async.each(getSubDirectories('configs'), (config, callback) => {
  return callback();
  // we merge the default test configuration with the particular one for this run
  let testConfig = _.defaultsDeep(require('./configs/' + config + '/test'),
    _.cloneDeep(defaultTestConfig));

  // we remove null properties because we used null to delete properties from the default config
  deleteNullPropertiesDeep(testConfig);

  changeDir('configs/' + config, () => {
    // we generate the Dockerfile based on the node version
    exec('sed -e \'s/{node_version}/' + nodeVersion + '/g\' Dockerfile.template > Dockerfile');

    // we prepare a directory with the src code, the node_modules directory and test.json
    exec('rm -rf app');
    exec(`cp -al ${repositoryDir} app`);
    exec(`cp -al ${nodeModulesDir} app/node_modules`);
    exec('mkdir -p app/data/config');
    fs.writeFileSync('app/data/config/test.json', JSON.stringify(testConfig));
  });

  let dockerBuildRun = execAsync('docker-compose build; docker-compose run --rm linkurious',
    {cwd: ciDir + '/configs/' + config});

  let output = '';

  dockerBuildRun.stdout.on('data', data => {
    output += data;
  });

  dockerBuildRun.stderr.on('data', data => {
    output += '\x1b[31m' + data + '\x1b[0m';
  });

  dockerBuildRun.on('close', code => {
    if (code !== 0) {
      console.log('\x1b[41m$' + config + ` was unsuccessful (exited with code ${code}).\x1b[0m`);
      console.log(output);

      return callback(code);
    } else {
      console.log('\x1b[42m$' + config + ' was successful.\x1b[0m');

      // copy the code coverage for this config to the main code coverage directory
      changeDir('configs/' + config, () => {
        exec(`cp -R coverage/. '${coverageDir}/${config}'`);
      });

      return callback();
    }
  });
}, err => {
  // we remove all the existing docker containers
  exec('docker rm -f $(docker ps -a -q) 2>/dev/null || true');
  // we remove untagged docker images to clean up disk space
  exec('docker rmi $(docker images | grep \'^<none>\' | awk \'{print $3}\') 2>/dev/null || true');

  /**
   * (7) Copy the linkurious-server directory to tmp
   */
  exec('rm -rf tmp/linkurious-server');
  exec('cp -al ' + repositoryDir + ' tmp/linkurious-server');
  exec('rm -rf tmp/linkurious-server/node_modules');
  exec('cp -al ' + nodeModulesDir + ' tmp/linkurious-server/node_modules');

  /**
   * (8) Call the test_client.js plugin forcing to use this branch
   */
  // download the Linkurious Client first
  exec('rm -rf tmp/linkurious-client');
  changeDir('tmp', () => {
    exec('git clone git@github.com:Linkurious/linkurious-client.git --branch ' +
      clientBranch + ' --single-branch');

    changeDir('linkurious-client', () => {
      exec(ciDir + '/test_client.js --serverCI');
    });
  });

  /**
   * (9) Call grunt build
   */
  changeDir('tmp/linkurious-server', () => {
    exec(`rm -rf node_modules; cp -al ${nodeModulesDir} node_modules`);
    exec('grunt lint');
    exec('grunt build');
  });

  process.exit(err ? err : 0);
});
