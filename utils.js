/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const _ = require('lodash');

const fs = require('fs');
const path = require('path');

/**
 * Execute `cmd` synchronously.
 *
 * @param {string} cmd
 * @param {object} [options]
 */
var exec = (cmd, options) => {
  console.log('\x1b[31m', '> ' + cmd, '\x1b[0m');
  require('child_process').execSync(cmd,
    _.defaults(options, {stdio: [0, 1, 2], shell: '/bin/bash'}));
  console.log('');
};

/**
 * Execute `nRetry` times `cmd` synchronously.
 *
 * @param {string} cmd
 * @param {number} nRetry
 * @param {object} [options]
 */
var execRetry = (cmd, nRetry, options) => {
  if (nRetry <= 0) {
    return exec(cmd, options);
  } else {
    try {
      return exec(cmd, options);
    } catch (e) {
      return execRetry(cmd, nRetry - 1, options);
    }
  }
};

/**
 * Return the array of sub-folders.
 *
 * @param {string} srcFolder
 * @returns {string[]}
 */
var getSubFolders = (srcFolder) => {
  return fs.readdirSync(srcFolder).filter(file => {
    return fs.statSync(path.join(srcFolder, file)).isDirectory();
  });
};

/**
 * Execute a function under another directory.
 *
 * @param {string} dir
 * @param {function} func
 */
var changeDir = (dir, func) => {
  var currentDir = process.cwd();
  process.chdir(dir);
  func();
  process.chdir(currentDir);
};

module.exports = {exec, execRetry, getSubFolders, changeDir};
