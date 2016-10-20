#!/usr/bin/env node

/**
 * LINKURIOUS CONFIDENTIAL
 * Copyright Linkurious SAS 2012 - 2016
 *
 * Created by francesco on 2016-10-20.
 */
'use strict';

const changeDir = require('./utils').changeDir;
const exec = require('./utils').exec;

const ciDir = process.env['CI_DIRECTORY'];

/**
 * (1) This file is executed inside repositoryDir, we need to change directory to the CI
 */
process.chdir(ciDir);

// we assume this file is executed after `test_server.js` with the flag build
changeDir('tmp/linkurious-server', () => {
  exec('node script/release.js');
  exec('node script/release.js --starter-edition');
});
