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
const npmCache = require('./npmCache');

// constants
const ciDir = process.env['CI_DIRECTORY'];
const rootRepositoryDir = process.env.PWD;

class Echidna {
  constructor(name, scripts, workspaceDir) {
    this.name = name;
    this.workspaceDir = workspaceDir;
    this.repositoryDir = workspaceDir + '/' + name;

    utils.changeDir(this.repositoryDir, () => {
      this.branch = utils.getCurrentBranch();
    });

    // directory containing desired node and npm (etc.) binaries
    this.binDir = this.repositoryDir + '/_bin';
    utils.exec(`mkdir -p ${this.binDir}`, true);

    // install dependencies (necessary for the scripts)
    /*if (this.npm.hasPackageJson()) {
      this.npm.install();
    }
*/
    this.scripts = _.mapValues(scripts, (file, script) => {
      const _requireFile = this.workspaceDir + '/' + this.name + '/' + file;
      try {
        return utils.changeDir(this.repositoryDir, () => {
          return require(_requireFile);
        });
      } catch(e) {
        console.log(e);
        throw new Error(`Unable to add script "${script}" for project "${name}" because \
file "${_requireFile}" was not found`);
      }
    });
  }

  /**
   * Run `script` on the current project.
   *
   * @param {string} script     script to execute
   * @param {function} callback cb
   * @returns {undefined}
   */
  run(script, callback) {
    const func = this.scripts[script];

    // save cwd
    const currentWorkingDirectory = process.cwd();
    // save current PATH environment variable
    const pathEnv = process.env.PATH;

    // set the repository directory as cwd
    process.chdir(this.repositoryDir);
    // add 'this.binDir' to PATH
    process.env.PATH = this.binDir + ':' + pathEnv;

    if (func) {
      console.log(`Running script \x1b[32m${script}\x1b[0m for project ` +
          `\x1b[32m${this.name}\x1b[0m, branch \x1b[32m${this.branch}\x1b[0m`);
      func(this, err => {
        // restore previous cwd and PATH
        process.chdir(currentWorkingDirectory);
        process.env.PATH = pathEnv;
        callback(err);
      });
    } else {
      console.log(`skipping script "${script}" because it's not defined in echidna.json`);
      callback(1);
    }
  }

  /**
   * @param {string} repository Github style name (e.g: "Linkurious/linkurious-server")
   * @returns {Echidna} echidna object of the newly cloned repository
   */
  get(repository) {
    const projectName = repository.split('/')[1];

    utils.exec(`mkdir -p ${this.workspaceDir}/_tmp`, true);

    // decide whether to match the branch or to use 'develop'
    const branchToUse = utils.exec(`git ls-remote --heads git@github.com:${repository}.git "` +
      this.branch + '" | wc -l', true).indexOf('1') === 0
      ? this.branch
      : 'develop';

    // clone the repository in a temporary directory
    utils.changeDir(this.workspaceDir + '/_tmp', () => {
      utils.exec(`git clone git@github.com:${repository}.git --branch "` + branchToUse +
        '" --single-branch', true);
    });
    const tmpRepositoryDir = this.workspaceDir + '/_tmp/' + projectName;

    // read the echidna.json file
    const echidnaJson = Echidna.validateEchidnaJson(tmpRepositoryDir);

    // copy the repository in the workspace
    utils.exec(`cp -al ${tmpRepositoryDir} ${this.workspaceDir}/${echidnaJson.name}`, true);

    // remove the temporary directory
    utils.exec('rm -rf _tmp', true);

    return new Echidna(echidnaJson.name, echidnaJson.scripts, this.workspaceDir);
  }

  /**
   * @returns {npmCache} npmCache of the current project
   */
  get npm() {
    if (!this._npm) {
      this._npm = new npmCache(
        this.repositoryDir + '/package.json',
        this.binDir,
        this.repositoryDir + '/node_modules'
      );
    }
    return this._npm;
  }

  /**
   * @returns {object} utils collection of function
   */
  get utils() {
    return utils;
  }

  /**
   * @param {string} path where to look for the echidna.json file
   * @returns {object | undefined} object representation of the echidna.json file
   */
  static validateEchidnaJson(path) {
    const file = path + '/echidna.json';
    let echidnaJson;
    try {
      echidnaJson = require(file);
    } catch(e) {
      throw new Error(`"${file}" was not found`);
    }

    if (echidnaJson.name === undefined || echidnaJson.name === null) {
      throw new Error(`"${file}" requires a "name" field`);
    }

    if (!(echidnaJson.name.length > 0)) {
      throw new Error(`"name" field of "${file}" has to be non empty`);
    }

    if (echidnaJson.scripts === undefined || echidnaJson.scripts === null) {
      throw new Error(`"${file}" requires a "scripts" field`);
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
    const echidnaJson = Echidna.validateEchidnaJson(rootRepositoryDir);

    /**
     * 2) create a workspace directory
     */
    const workspaceDir = ciDir + '/workspaces/' + shortid.generate();
    utils.exec(`mkdir -p ${workspaceDir}`, true);

    /**
     * 3) copy the repository in the workspace
     */
    utils.exec(`cp -al ${rootRepositoryDir} ${workspaceDir}/${echidnaJson.name}`, true);

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
    const commitMessage = utils.exec('git log -1 --pretty=%B', true);
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
      utils.exec(`rm -rf ${workspaceDir}`, true);
    });
  }
}

Echidna.main();
