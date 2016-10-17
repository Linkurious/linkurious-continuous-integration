#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const exec = require('./utils').exec;
const changeDir = require('./utils').changeDir;
const npmCache = require('./npmCache');

const fs = require('fs');

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

/**
 * (3) Build the latest linkurious.js
 */
exec('rm -rf linkurious.js');
exec('git clone -b develop git@github.com:Linkurious/linkurious.js.git');

changeDir('linkurious.js', () => {
  var nodeModulesDir = npmCache(ciDir + '/linkurious.js/package.json');
  exec(`rm -rf node_modules; cp -al ${nodeModulesDir} node_modules`);
  exec('grunt build');
});

exec('echo ' + clientBranch);
