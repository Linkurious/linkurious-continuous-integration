#!/usr/bin/env node

/**
 * Created by francesco on 2016-12-02.
 */
'use strict';

// external libs
const _ = require('lodash');
const shortid = require('shortid');
const async = require('async');

// locals
const utils = require('./utils');

// constants
const ciDir = process.env['CI_DIRECTORY'];
const repositoryDir = process.env.PWD;

class Echidna {
  constructor(name, scripts, workspaceDir) {
    this.name = name;
    this.workspaceDir = workspaceDir;
    this.repositoryDir = workspaceDir + '/' + name;

    this.scripts = _.mapValues(scripts, (file, script) => {
      let _requireFile = this.workspaceDir + '/' + this.name + '/' + file;
      try {
        return require(_requireFile);
      } catch(e) {
        console.log(`WARNING: unable to add script "${script}" for project "${name}" because \
file "${_requireFile}" was not found`);
      }
    });

    utils.changeDir(this.repositoryDir, () => {
      this.branch = utils.getCurrentBranch();
    });
  }

  /**
   * @param {string} script     script to execute
   * @param {function} callback cb
   * @returns {undefined}
   */
  run(script, callback) {
    let func = this.scripts[script];
    // save cwd
    let currentWorkingDirectory = process.cwd();
    // set the repository directory as cwd
    process.chdir(this.repositoryDir);
    if (func) {
      func(this, () => {
        // restore previous cwd
        process.chdir(currentWorkingDirectory);
        callback();
      });
    } else {
      console.log(`skipping script "${script}" because it's not defined in echidna.json`);
      callback(1);
    }
  }

  /**
   * @param {string} repository Github style repository name (e.g: "Linkurious/linkurious-server")
   * @returns {Echidna} echidna object for the repository
   */
  get(repository) {
    utils.exec(`mkdir -p ${this.workspaceDir}/_tmp`, null, true);
    process.chdir(this.workspaceDir + '/_tmp');
  }

  get npm() {
    return 'TODO';
  }

  get node() {
    return 'TODO';
  }

  get bower() {
    return 'TODO';
  }

  get utils() {
    return utils;
  }

  /**
   * @param {string} path where to look for the echidna.json file
   * @return {object | undefined} object representation of the echidna.json file
   */
  static validateEchidnaJson(path) {
    const file = path + '/echidna.json';
    let echidnaJson;
    try {
      echidnaJson = require(file);
    } catch(e) {
      console.log(`"${file}" was not found`);
      return;
    }

    if (echidnaJson.name === undefined || echidnaJson.name === null) {
      console.log(`"${file}" requires a "name" field`);
      return;
    }

    if (!(echidnaJson.name.length > 0)) {
      console.log(`"name" field of "${file}" has to be non empty`);
      return;
    }

    if (echidnaJson.scripts === undefined || echidnaJson.scripts === null) {
      console.log(`"${file}" requires a "scripts" field`);
      return;
    }

    return echidnaJson;
  }

  /**
   * @returns {undefined}
   */
  static main() {
    /**
     * 1) read the echidna.json of the current project
     */
    let echidnaJson = Echidna.validateEchidnaJson(repositoryDir);
    if (!echidnaJson) {
      process.exit(1);
    }

    /**
     * 2) create a workspace directory
     */
    const workspaceDir = ciDir + '/workspaces/' + shortid.generate();
    utils.exec(`mkdir -p ${workspaceDir}`, null, true);

    /**
     * 3) copy the repository in the workspace
     */
    utils.exec(`cp -al ${repositoryDir} ${workspaceDir}/${echidnaJson.name}`, null, true);

    /**
     * 4) parse command line arguments (only double-dash arguments are taken into account)
     *
     * e.g.: ./echidna --build
     */
    const scriptsToRun = new Set();
    const commandLineArguments = _.filter(process.argv, arg => arg.indexOf('--') === 0)
      .map(arg => arg.slice(2));
    _.forEach(commandLineArguments, s => {
      scriptsToRun.add(s);
    });

    /**
     * 5) parse commit message arguments
     *
     * e.g.: '#892 solved issues [run:build]'
     */
    const commitMessage = utils.exec('git log -1 --pretty=%B', null, true);
    // flags are words prefixed with `run:` wrapped in square brackets, e.g.: '[run:build]'
    const commitFlags = commitMessage.match(/\[run:\w*]/g) || [];
    _.forEach(commitFlags, s => {
      scriptsToRun.add(s.substring(5, s.length - 1));
    });

    /**
     * 6) we first execute scripts coming from cla, then scripts coming from commits
     */
    const echidna = new Echidna(echidnaJson.name, echidnaJson.scripts, workspaceDir);
    const functionsToRun = Array.from(scriptsToRun).map(s => echidna.run.bind(echidna, s));

    async.series(functionsToRun, () => {
      /**
       * 7) delete the workspace directory
       */
      utils.exec(`rm -rf ${workspaceDir}`, null, true);
    });
  }
}

Echidna.main();
