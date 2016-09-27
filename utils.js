/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Execute `cmd` synchronously.
 *
 * @param {string} cmd
 */
var exec = cmd => {
  console.log('\x1b[31m', '> ' + cmd, '\x1b[0m');
  require('child_process').execSync(cmd, {stdio: [0, 1, 2], shell: '/bin/bash'});
  console.log('');
};

/**
 * Execute `nRetry` times `cmd` synchronously.
 *
 * @param {string} cmd
 * @param {number} nRetry
 */
var execRetry = (cmd, nRetry) => {
  if (nRetry <= 0) {
    return exec(cmd);
  } else {
    try {
      return exec(cmd);
    } catch (e) {
      return execRetry(cmd, nRetry - 1);
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
