#!/usr/bin/env node

/**
 * Created by francesco on 2016-11-29.
 */
'use strict';

// 1) read the echidnafile.js for the current project
const repositoryDir = process.env.PWD;
const echidnafile = require(repositoryDir + '/echidnafile.js');

console.log(echidnafile);
