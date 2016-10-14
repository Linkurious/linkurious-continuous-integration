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
  console.log('\x1b[36m', '> ' + cmd, '\x1b[0m');
  require('child_process').execSync(cmd,
    _.defaults(options, {stdio: [0, 1, 2], shell: '/bin/bash'}));
};

/**
 * Execute `cmd` asynchronously.
 *
 * @param {string} cmd
 * @param {object} [options]
 * @returns {ChildProcess}
 */
var execAsync = (cmd, options) => {
  console.log('\x1b[36m', '> ' + cmd, '\x1b[0m');
  return require('child_process').spawn(cmd,
    _.defaults(options, {shell: '/bin/bash'}));
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
 * Return the array of subdirectories.
 *
 * @param {string} srcDir
 * @returns {string[]}
 */
var getSubDirectories = srcDir => {
  return fs.readdirSync(srcDir).filter(file => {
    return fs.statSync(path.join(srcDir, file)).isDirectory();
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

/**
 * Delete all null properties from an object.
 *
 * @param {object} obj
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

module.exports = {exec, execAsync, execRetry, getSubDirectories, changeDir, deleteNullPropertiesDeep};
