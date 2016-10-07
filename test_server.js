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
  if (program.filter && !config.match(new RegExp(program.filter, 'g'))) {
    // if we have a filter, and the filter doesn't match, we skip this configuration
    continue;
  }

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
    exec('docker rm -f $(docker ps -a -q) 2>/dev/null || true');

    // we prepare a directory with the src code and the node_modules directory
    exec('rm -rf app');
    exec(`cp -al ${repositoryDir} app`);
    exec(`cp -al ${nodeModulesDir} app/node_modules`);
    exec('docker-compose build');
    exec('docker-compose run --rm linkurious');

    // we remove untagged docker images to clean up disk space
    exec('docker rmi $(docker images | grep \'^<none>\' | awk \'{print $3}\') 2>/dev/null || true');
  });
}
