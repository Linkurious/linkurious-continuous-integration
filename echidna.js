#!/usr/bin/env node

/**
 * Created by francesco on 2016-12-02.
 */
'use strict';

// external libs
const Promise = require('bluebird');
const _ = require('lodash');
const shortid = require('shortid');

// locals
const utils = require('./utils');
const npmCache = require('./npmCache');
const semaphoreMap = new require('./semaphoreMap')('./semaphoreMap.json');

// constants
const ciDir = process.env['CI_DIRECTORY'];
const rootRepositoryDir = process.env.PWD;

class Echidna {
  constructor(name, scriptPaths, workspaceDir) {
    this.name = name;
    this.workspaceDir = workspaceDir;
    this.repositoryDir = workspaceDir + '/' + name;
    this.scriptPaths = scriptPaths;
  }

  /**
   * @returns {Promise} promise
   */
  init() {
    utils.changeDir(this.repositoryDir, () => {
      this.branch = utils.getCurrentBranch();
    });

    // directory containing desired node and npm (etc.) binaries
    this.binDir = this.repositoryDir + '/_bin';
    utils.exec(`mkdir -p ${this.binDir}`, true);

    return Promise.resolve(() => {
      // install dependencies (necessary for the scripts)
      if (this.npm.hasPackageJson()) {
        return this.npm.install();
      }
    }).then(() => {
      // load scripts
      this.scripts = _.mapValues(this.scriptPaths, file => {
        const _requireFile = this.workspaceDir + '/' + this.name + '/' + file;
        return utils.changeDir(this.repositoryDir, () => {
          return require(_requireFile);
        });
      });
    });
  }

  /**
   * Run `script` on the current project.
   *
   * @param {string} script     script to execute
   * @returns {Promise} promise
   */
  run(script) {
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
      return func(this).then(() => {
        // restore previous cwd and PATH
        process.chdir(currentWorkingDirectory);
        process.env.PATH = pathEnv;
      });
    } else {
      return Promise.reject(new Error(script + 'is not defined in echidna.json'));
    }
  }

  /**
   * @param {string} repository Github style name (e.g: "Linkurious/linkurious-server")
   * @returns {Promise.<Echidna>} echidna object of the newly cloned repository
   */
  get(repository) {
    const projectName = repository.split('/')[1];

    return semaphoreMap.get('_get:' + repository, 1).then(semaphore => {
      return semaphore.acquire().then(() => {

        // if the project wasn't already cloned
        if (utils.getSubDirectories(this.repositoryDir).indexOf(projectName) === -1) {
          utils.exec(`mkdir -p ${this.workspaceDir}/_tmp`, true);

          // decide whether to match the branch or to use 'develop'
          const branch = utils.exec(`git ls-remote --heads git@github.com:${repository}.git "` +
            this.branch + '" | wc -l', true).indexOf('1') === 0
            ? this.branch
            : 'develop';

          // clone the repository in a temporary directory
          utils.changeDir(this.workspaceDir + '/_tmp', () => {
            utils.exec(`git clone git@github.com:${repository}.git --branch "` + branch +
              '" --single-branch', true);
          });
          const tmpRepositoryDir = this.workspaceDir + '/_tmp/' + projectName;

          // copy the repository in the workspace
          utils.exec(`cp -al ${tmpRepositoryDir} ${this.workspaceDir}/${projectName}`, true);

          // remove the temporary directory
          utils.exec('rm -rf _tmp', true);
        }
      }).finally(() => {
        semaphore.release();
      });
    }).then(() => {
      // read the echidna.json file
      const echidnaJson = Echidna.validateEchidnaJson(this.repositoryDir + '/' + projectName);

      const echidna = new Echidna(projectName, echidnaJson.scripts, this.workspaceDir);

      return echidna.init().return(echidna);
    });
  }

  /**
   * @returns {npmCache} npmCache of the current project
   */
  get npm() {
    if (!this._npm) {
      this._npm = new npmCache(
        this.repositoryDir + '/package.json',
        this.binDir,
        this.repositoryDir + '/node_modules',
        semaphoreMap
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
   * @returns {SemaphoreMap} the collection of semaphoreMap
   */
  get semaphores() {
    return semaphoreMap;
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
     * 2) get Github style repository name
     */
    const repositoryName = utils.getRepositoryName();

    /**
     * 3) create a workspace directory
     */
    const workspaceDir = ciDir + '/workspaces/' + shortid.generate();
    utils.exec(`mkdir -p ${workspaceDir}`, true);

    /**
     * 4) copy the repository in the workspace
     */
    utils.exec(`cp -al ${rootRepositoryDir} ${workspaceDir}/${repositoryName}`, true);

    /**
     * 5) parse command line arguments (only double-dash arguments are taken into account)
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
     * 6) parse commit message arguments
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
     * 7) we first execute scripts coming from cla, then scripts coming from commits
     */
    const echidna = new Echidna(repositoryName, echidnaJson.scripts, workspaceDir);

    return Promise.resolve().then(() => {
      return semaphoreMap.init();
    }).then(() => {
      return echidna.init();
    }).then(() => {
      return Promise.map(Array.from(scriptsToRun), s => echidna.run(s), {concurrency: 1});
    }).finally(() => {
      /**
       * 8) delete the workspace directory
       */
      utils.exec(`rm -rf ${workspaceDir}`, true);
    });
  }
}

Echidna.main();
