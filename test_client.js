#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const exec = require('./utils').exec;

const repositoryDir = process.env.PWD;
const ciDir = process.env['CI_DIRECTORY'];

var clientBranch = exec('git rev-parse --abbrev-ref HEAD', {stdio: null}).toString('utf8');

/**
 * (1) This file is executed inside repositoryDir, we need to change directory to the CI
 */
process.chdir(ciDir);

exec('echo ' + clientBranch);
