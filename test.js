#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');

const _ = require('lodash');

const exec = require('./utils').exec;
const getSubFolders = require('./utils').getSubFolders;
const changeDir = require('./utils').changeDir;
const npmCache = require('./npmCache');

const repositoryDir = process.env['PWD'];
const ciDir = process.env['CI_FOLDER'];

process.chdir(ciDir);

/**
 * (1) Generate or retrieve the node_modules folder for this test
 */
var nodeModulesDir = npmCache(repositoryDir + '/package.json');

/**
 * (2) Read default test configuration
 */
var defaultTestConfig = require(repositoryDir + '/server/config/defaults/test');

/**
 * (3) Loop through all the configs
 */
for (var config of getSubFolders('configs')) {
  var testConfig = _.defaultsDeep(require('./configs/' + config + '/test'),
    _.cloneDeep(defaultTestConfig));

  /**
   * (4) Modify the config
   */
  exec('mkdir -p ' + repositoryDir + '/data/config');
  fs.writeFileSync(repositoryDir + '/data/config/test.json', JSON.stringify(testConfig));

  /**
   * (5) Start docker containers
   */
  changeDir('configs/' + config, () => {
    exec('rm -rf app');
    exec('cp -al ' + repositoryDir + ' app');
    exec('cp -al ' + nodeModulesDir + ' app/node_modules');
    exec('docker-compose up --build');
    exec('rm -rf app');
  });
}
