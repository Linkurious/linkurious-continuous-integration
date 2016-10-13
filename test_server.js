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

const repositoryDir = process.env['PWD'];
const ciDir = process.env['CI_DIRECTORY'];

/**
 * (1) This file is executed inside repositoryDir, we need to change directory to the CI
 */
process.chdir(ciDir);

// ensure code coverage directory exists
const coverageDir = ciDir + '/coverages';
exec(`mkdir -p ${coverageDir}`);

const packageJsonFile = repositoryDir + '/package.json';
/**
 * (2) Retrieve the node and npm version from the package.json file
 */
const packageJsonData = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));

// We have to use this version of node in the Dockerfiles
const nodeVersion = packageJsonData.engines.node;

// We have to switch to this version of npm to generate the node_modules directory
const npmVersion = packageJsonData.engines.npm;

/**
 * (3) Generate or retrieve the node_modules directory for this test
 */
const nodeModulesDir = npmCache(packageJsonFile, nodeVersion, npmVersion);

/**
 * (4) Read default test configuration
 */
const defaultTestConfig = require(repositoryDir + '/server/config/defaults/test');

/**
 * (5) Loop through all the configs
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
    exec(`mkdir -p app/data/config`);
    fs.writeFileSync(`app/data/config/test.json`, JSON.stringify(testConfig));
  });

  execAsync('docker-compose build; docker-compose run --rm linkurious | sed s/^/\\x1b[0m/ >> myLogfile) 2>&1 | sed s/^/\\x1b[33m/',
    {cwd: ciDir + '/configs/' + config},
    (err, stdout, stderr) => {
      if (err) {
        console.log(stdout);
        return callback(err);
      }

      console.log(config + ' was successful.');

      // copy the code coverage for this config to the main code coverage directory
      changeDir('configs/' + config, () => {
        exec(`cp -R coverage '${coverageDir}/${config}'`);
      });

      callback();
    });

}, err => {
  // we remove all the existing docker containers
  exec('docker rm -f $(docker ps -a -q) 2>/dev/null || true');
  // we remove untagged docker images to clean up disk space
  exec('docker rmi $(docker images | grep \'^<none>\' | awk \'{print $3}\') 2>/dev/null || true');

  process.exit(err ? 1 : 0);
});
