#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');
const async = require('async');

const commander = require('commander');
const _ = require('lodash');

const exec = require('./utils').exec;
const execAsync = require('./utils').execAsync;
const getSubDirectories = require('./utils').getSubDirectories;
const changeDir = require('./utils').changeDir;
const deleteNullPropertiesDeep = require('./utils').deleteNullPropertiesDeep;
const npmCache = require('./npmCache');
const configuration = require('./config');

const repositoryDir = process.env.PWD;
const ciDir = process.env['CI_DIRECTORY'];

commander.option(
  '--build',
  'Build even if the commit message doesn\'t contain \'[build]\''
).parse(process.argv);

/**
 * (1) Detect client and server branch
 */
const serverBranch = exec('git rev-parse --abbrev-ref HEAD', {stdio: null}).toString('utf8')
  .replace('\n', '');
const clientBranch = exec('git ls-remote' +
  ' --heads git@github.com:Linkurious/linkurious-client.git ' +
  serverBranch + ' | wc -l', {stdio: null}).toString('utf8').indexOf('1') === 0
  ? serverBranch
  : 'develop';

// we read the last commit message to decide if we have to build or not
const commitMessage = exec('git log -1 --pretty=%B', {stdio: null}).toString('utf8');

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

  if (err) {
    process.exit(err);
  }

  // do the following steps only if we want to build
  if (commitMessage.indexOf('[build]') !== -1 || commander.build) {
    /**
     * (7) Copy the linkurious-server directory to tmp
     */
    exec('rm -rf tmp/linkurious-server');
    exec('cp -al ' + repositoryDir + ' tmp/linkurious-server');
    exec('rm -rf tmp/linkurious-server/node_modules');
    exec('cp -al ' + nodeModulesDir + ' tmp/linkurious-server/node_modules');

    /**
     * (8) Download the Linkurious Client and call the test_client.js plugin forcing the server branch
     */
    exec('rm -rf tmp/linkurious-client');
    changeDir('tmp', () => {
      exec('git clone git@github.com:Linkurious/linkurious-client.git --branch ' +
        clientBranch + ' --single-branch');

      changeDir('linkurious-client', () => {
        exec(ciDir + '/test_client.js --serverCI');
      });
    });

    /**
     * (9) Build LKE
     */
    changeDir('tmp/linkurious-server', () => {
      exec(`rm -rf node_modules; cp -al ${nodeModulesDir} node_modules`);
      exec('grunt lint');
      exec('grunt build');

      /**
       * (10) Upload the build remotely
       */
      changeDir('builds', () => {
        exec('zip -qr linkurious-windows linkurious-windows');
        exec('zip -qr linkurious-linux linkurious-linux');
        exec('zip -qr linkurious-osx linkurious-osx');

        var userAtHost = configuration.buildScpDestDir.split(':')[0];
        var baseDir = configuration.buildScpDestDir.split(':')[1];
        var branchDir = 's:' + serverBranch + '-c:' + clientBranch;

        var dir = baseDir + '/' + branchDir + '/' + new Date().toISOString();

        exec(`ssh -p ${configuration.buildScpPort} ${userAtHost} "mkdir -p '${dir}'"`);
        exec(`scp -P ${configuration.buildScpPort} ./*.zip ${userAtHost}:'${dir}'`);
      });
    });
  }
});
