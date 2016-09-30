#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');

const _ = require('lodash');

const exec = require('./utils').exec;
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

/**
 * (2) Generate or retrieve the node_modules directory for this test
 */
var nodeModulesDir = npmCache(repositoryDir + '/package.json');

/**
 * (3) Read default test configuration
 */
var defaultTestConfig = require(repositoryDir + '/server/config/defaults/test');

/**
 * (4) Loop through all the configs
 */
for (var config of getSubDirectories('configs')) {
  // we merge the default test configuration with the particular one for this run
  var testConfig = _.defaultsDeep(require('./configs/' + config + '/test'),
    _.cloneDeep(defaultTestConfig));

  // we remove null properties because we used null to delete properties from the default config
  deleteNullPropertiesDeep(testConfig);

  /**
   * (5) Modify the configuration file for this run
   */
  exec(`mkdir -p ${repositoryDir}/data/config`);
  fs.writeFileSync(`${repositoryDir}/data/config/test.json`, JSON.stringify(testConfig));

  /**
   * (6) Start docker containers
   */
  changeDir('configs/' + config, () => {
    // at each test we remove all the docker containers
    exec('docker kill $(docker ps -a -q) && docker rm $(docker ps -a -q)');

    // we prepare a directory with the src code and the node_modules directory
    exec('rm -rf app');
    exec(`cp -al ${repositoryDir} app`);
    exec(`cp -al ${nodeModulesDir} app/node_modules`);
    exec('docker-compose build');
    exec('docker-compose run --rm linkurious');
  });
}
