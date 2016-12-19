/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

// internal libs
const fs = require('fs');
const path = require('path');

// external libs
const _ = require('lodash');

/**
 * Execute `cmd` synchronously.
 *
 * @param {string} cmd        command to execute
 * @param {boolean} [silent]  whether to not print output to stdout/err but return it instead
 * @param {object} [options]  options to pass to child_process.execSync
 * @returns {Buffer | String} stdout from the command
 */
const exec = (cmd, silent, options) => {
  if (silent) {
    return require('child_process').execSync(cmd,
      _.defaults(options, {stdio: null, encoding: 'utf8'}));
  } else {
    console.log('\x1b[32m$ \x1b[0m' + cmd);
    return require('child_process').execSync(cmd,
      _.defaults(options, {stdio: [0, 1, 2], shell: '/bin/bash'}));
  }
};

/**
 * Execute `cmd` asynchronously.
 *
 * @param {string} cmd       command to execute
 * @param {object} [options] options to pass to child_process.exec
 * @returns {ChildProcess}   ChildProcess
 */
const execAsync = (cmd, options) => {
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
const execRetry = (cmd, nRetry, options) => {
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
const getSubDirectories = srcDir => {
  return fs.readdirSync(srcDir).filter(file => {
    return fs.statSync(path.join(srcDir, file)).isDirectory();
  });
};

/**
 * Execute a synchronous function under another directory.
 *
 * @param {string} dir    directory
 * @param {function} func function to execute under `dir`
 * @returns {undefined}
 */
const changeDir = (dir, func) => {
  const currentDir = process.cwd();
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
const deleteNullPropertiesDeep = obj => {
  for (let key of Object.keys(obj)) {
    if (obj[key] === null) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      deleteNullPropertiesDeep(obj[key]);
    }
  }
};

/**
 * Return the name of the current branch in the current working directory.
 *
 * @returns {string} name of the current branch
 */
const getCurrentBranch = () => {
  const currentBranch = exec('git rev-parse --abbrev-ref HEAD', null, true);

  if (currentBranch.indexOf('HEAD') !== -1) { // we are in a detached head
    const gitBranchOutput = exec('git branch', null, true).split('\n');
    if (gitBranchOutput.length !== 3) {
      console.log('\x1b[31mCritical error: impossible to detect branch name among these:\x1b[0m');
      exec('git branch');
      process.exit(1);
    }
    if (gitBranchOutput[0].indexOf('* (HEAD detached at') !== -1) {
      // we use the second line
      currentBranch = gitBranchOutput[1];
    } else {
      // we use the first line
      currentBranch = gitBranchOutput[0];
    }
  }

  return currentBranch.replace(/[\s]+/g, '');
};

module.exports = {exec, execAsync, execRetry, getSubDirectories, changeDir,
  deleteNullPropertiesDeep, getCurrentBranch};
