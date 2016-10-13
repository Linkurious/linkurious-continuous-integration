#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');

const _ = require('lodash');
const program = require('commander');

const exec = require('./utils').exec;
const getSubDirectories = require('./utils').getSubDirectories;
const changeDir = require('./utils').changeDir;
const deleteNullPropertiesDeep = require('./utils').deleteNullPropertiesDeep;
const npmCache = require('./npmCache');
const configuration = require('./config');

const repositoryDir = process.env['PWD'];
const ciDir = process.env['CI_DIRECTORY'];

program.option(
  '--filter <filter>',
  'Test only the configs that match this regex'
).parse(process.argv);

/**
 * (1) This file is executed inside repositoryDir, we need to change directory to the CI
 */
process.chdir(ciDir);

// ensure code coverage directory is clean
const coverageDir = ciDir + '/coverages';
exec(`rm -rf ${coverageDir}; mkdir -p ${coverageDir}`);

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
for (let config of getSubDirectories('configs')) {
  if (program.filter && !config.match(new RegExp(program.filter, 'g'))) {
    // if we have a filter, and the filter doesn't match, we skip this configuration
    continue;
  }

  // we merge the default test configuration with the particular one for this run
  let testConfig = _.defaultsDeep(require('./configs/' + config + '/test'),
    _.cloneDeep(defaultTestConfig));

  // we remove null properties because we used null to delete properties from the default config
  deleteNullPropertiesDeep(testConfig);

  /**
   * (6) Modify the configuration file for this run
   */
  exec(`mkdir -p ${repositoryDir}/data/config`);
  fs.writeFileSync(`${repositoryDir}/data/config/test.json`, JSON.stringify(testConfig));

  /**
   * (7) Start docker containers
   */
  changeDir('configs/' + config, () => {
    // at each test we remove all the docker containers
    exec('docker rm -f $(docker ps -a -q) 2>/dev/null || true');

    // we generate the Dockerfile based on the node version
    exec('sed -e \'s/{node_version}/' + nodeVersion + '/g\' Dockerfile.template > Dockerfile');

    // ensure the coverage folder exists
    exec(`rm -rf coverage; mkdir -p coverage`);

    // we prepare a directory with the src code and the node_modules directory
    exec('rm -rf app');
    exec(`cp -al ${repositoryDir} app`);
    exec(`cp -al ${nodeModulesDir} app/node_modules`);
    exec('docker-compose build');
    exec('docker-compose run --rm linkurious');

    // copy the code coverage for this config to the main code coverage directory
    exec(`cp -R coverage '${coverageDir}/${config}'`);

    // we remove untagged docker images to clean up disk space
    exec('docker rmi $(docker images | grep \'^<none>\' | awk \'{print $3}\') 2>/dev/null || true');
  });

  /**
   * (8) Generate unified code coverage report and upload it
   */
  // the app directory is required by istanbul to do its job
  exec(`cp -al ${repositoryDir} ${coverageDir}/app`);

  changeDir(`${coverageDir}`, () => {
    exec(`istanbul report --root .`);
    exec(`scp -r coverage ${configuration.coverageScpDestDir}/${new Date().toISOString()}
     -p ${configuration.coverageScpPort}`);
  });
}
