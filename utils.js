/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');

/**
 * Execute `cmd` synchronously.
 *
 * @param {string} cmd       command to execute
 * @param {object} [options] options to pass to child_process.execSync
 * @returns {Buffer|String}  stdout from the command
 */
var exec = (cmd, options) => {
  console.log('\x1b[32m$ \x1b[0m' + cmd);
  return require('child_process').execSync(cmd,
    _.defaults(options, {stdio: [0, 1, 2], shell: '/bin/bash'}));
};

/**
 * Execute `cmd` asynchronously.
 *
 * @param {string} cmd       command to execute
 * @param {object} [options] options to pass to child_process.exec
 * @returns {ChildProcess}   ChildProcess
 */
var execAsync = (cmd, options) => {
  console.log('\x1b[32m$ \x1b[0m' + cmd);
  return require('child_process').exec(cmd,
    _.defaults(options, {shell: '/bin/bash'}));
};

/**
 * Execute `nRetry` times `cmd` synchronously.
 *
 * @param {string} cmd       command to execute
 * @param {number} nRetry    number of retries before throwing an error
 * @param {object} [options] options to pass to child_process.execSync
 * @returns {Buffer|String}  stdout from the command
 */
var execRetry = (cmd, nRetry, options) => {
  if (nRetry <= 0) {
    return exec(cmd, options);
  } else {
    try {
      return exec(cmd, options);
    } catch(e) {
      return execRetry(cmd, nRetry - 1, options);
    }
  }
};

/**
 * Return the array of subdirectories.
 *
 * @param {string} srcDir root directory
 * @returns {string[]}    subdirectories
 */
var getSubDirectories = srcDir => {
  return fs.readdirSync(srcDir).filter(file => {
    return fs.statSync(path.join(srcDir, file)).isDirectory();
  });
};

/**
 * Execute a function under another directory.
 *
 * @param {string} dir    directory
 * @param {function} func function to execute under `dir`
 * @returns {undefined}
 */
var changeDir = (dir, func) => {
  var currentDir = process.cwd();
  process.chdir(dir);
  func();
  process.chdir(currentDir);
};

/**
 * Delete all null properties from an object recursively.
 *
 * @param {object} obj object
 * @returns {undefined}
 */
var deleteNullPropertiesDeep = obj => {
  for (var key of Object.keys(obj)) {
    if (obj[key] === null) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      deleteNullPropertiesDeep(obj[key]);
    }
  }
};

module.exports = {exec, execAsync, execRetry, getSubDirectories, changeDir,
  deleteNullPropertiesDeep};
