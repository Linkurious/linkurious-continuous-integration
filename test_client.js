#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const exec = require('./utils').exec;
const changeDir = require('./utils').changeDir;
const npmCache = require('./npmCache');
const bowerCache = require('./bowerCache');

const repositoryDir = process.env.PWD;
const ciDir = process.env['CI_DIRECTORY'];

/**
 * (1) Detect client and server branch
 */
const clientBranch = exec('git rev-parse --abbrev-ref HEAD', {stdio: null}).toString('utf8')
  .replace('\n', '');
const serverBranch = exec('git ls-remote' +
  ' --heads git@github.com:Linkurious/linkurious-server.git ' +
  clientBranch + ' | wc -l', {stdio: null}).toString('utf8') === '1'
  ? clientBranch
  : 'develop';

/**
 * (2) This file is executed inside repositoryDir, we need to change directory to the CI
 */
process.chdir(ciDir);

exec('mkdir -p test');
changeDir('tmp', () => {
  /**
   * (3) Build the latest linkurious.js
   */
  exec('rm -rf linkurious.js');
  exec('git clone git@github.com:Linkurious/linkurious.js.git --branch develop --single-branch');

  changeDir('linkurious.js', () => {
    var nodeModulesDir = npmCache(ciDir + '/tmp/linkurious.js/package.json');
    exec(`rm -rf node_modules; cp -al ${nodeModulesDir} node_modules`);
    exec('grunt build');
  });

  /**
   * (4) Download the latest Linkurious Server at the branch `serverBranch`
   */
  exec('rm -rf linkurious-server');
  exec('git clone git@github.com:Linkurious/linkurious-server.git --branch ' +
    serverBranch + ' --single-branch');

  changeDir('linkurious-server', () => {
    var nodeModulesDir = npmCache(ciDir + '/tmp/linkurious-server/package.json');
    exec(`rm -rf node_modules; cp -al ${nodeModulesDir} node_modules`);
  });
});

/**
 * (5) Link the linkurious-server directory
 */
changeDir(repositoryDir + '/..', () => {
  // in this directory, grunt build expects to find the linkurious-server directory
  exec('rm -rf linkurious-server');
  exec('cp -al ' + ciDir + '/tmp/linkurious-server linkurious-server');
});

/**
 * (6) Install Linkurious Client dependencies
 */
changeDir(repositoryDir, () => {
  var nodeModulesDir = npmCache(repositoryDir + '/package.json');
  exec(`rm -rf node_modules; cp -al ${nodeModulesDir} node_modules`);
  var bowerComponentsDir = bowerCache(repositoryDir + '/bower.json');
  exec(`cp -al ${bowerComponentsDir}/. src/vendor`);
  exec('cp -al ' + ciDir + '/tmp/linkurious.js src/vendor');

  // TODO start neo4j and elasticsearch via docker
  /**
   * (7) Call grunt build
   */
  exec('grunt build');
});
