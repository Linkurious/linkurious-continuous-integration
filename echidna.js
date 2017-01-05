#!/usr/bin/env node

/**
 * Created by francesco on 2016-12-02.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// external libs
const Promise = require('bluebird');
const _ = require('lodash');
const shortid = require('shortid');

// locals
const utils = require('./utils');
const npmCache = require('./npmCache');
const bowerCache = require('./bowerCache');
const SemaphoreMap = require('./semaphoreMap');
const configuration = require('./config');

// constants
const ciDir = process.env['IN_DOCKER'] ? '/ci' : process.env['CI_DIRECTORY'];
const rootRepositoryDir = process.env['IN_DOCKER'] ? '/repo' : process.env.PWD;

const semaphoreMap = new SemaphoreMap(ciDir + '/_semaphores.json');

// we use this global map to store the names of the cloned repositories in the workspace along with
// their branch names. Useful to generate the list of used branch in a test run
const clonedRepos = new Map();

class Echidna {
  /**
   *
   * @param {string} name                    project name (e.g.: 'linkurious-server'), it has to match the GitHub repository name
   * @param {string} workspaceDir            path to the workspace
   * @param {object} options                 options
   * @param {object} options.scripts     paths of script indexed by script name
   * @param {boolean} [options.npmIgnoreScripts=false] whether to call npm install with the flag --ignore-scripts
   * @param {number} [options.concurrency=1] number of same scripts that can run concurrently for this project
   */
  constructor(name, workspaceDir, options) {
    options = _.defaults(options, {concurrency: 1, npmIgnoreScripts: false});
    this.name = name;
    this.workspaceDir = workspaceDir;
    this.repositoryDir = workspaceDir + '/' + name;
    this.scriptPaths = options.scripts;
    this.concurrency = options.concurrency;
    this.npmIgnoreScripts = options.npmIgnoreScripts;
  }

  /**
   * @returns {Promise} promise
   */
  init() {
    utils.changeDir(this.repositoryDir, () => {
      this.branch = utils.getCurrentBranch();

      clonedRepos.set(this.name, this.branch);
    });

    return Promise.resolve().then(() => {
      // install dependencies (necessary for the scripts)
      if (this.npm.hasPackageJson()) {
        return this.npm.install({ignoreScripts: this.npmIgnoreScripts});
      }
    }).then(() => {
      if (this.bower.hasBowerJson()) {
        return this.bower.install();
      }
    }).then(() => {
      // load scripts
      this.scripts = _.mapValues(this.scriptPaths, file => {
        // if the script is a .js file (end with '.js', no advanced checks)
        if (file.lastIndexOf('.js') === file.length - 3) {
          return utils.changeDir(this.repositoryDir, () => {
            return require(path.resolve(file));
          });
        } else {
          // not a .js file, fallback to 'utils.exec(file)'
          return () => {
            return new Promise(resolve => {
              utils.exec(file);
              resolve();
            });
          };
        }
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

    // set the repository directory as cwd
    process.chdir(this.repositoryDir);

    if (func) {
      console.log(`Running script \x1b[32m${script}\x1b[0m for project ` +
          `\x1b[32m${this.name}\x1b[0m, branch \x1b[32m${this.branch}\x1b[0m`);
      // the semaphore name includes both the project name and the script name
      const semaphoreName = '_run:' + this.name + '_' + script;

      return semaphoreMap.get(semaphoreName, this.concurrency).then(semaphore => {
        return semaphore.acquire().then(() => {
          return func(this).then(() => {
            // restore previous cwd
            process.chdir(currentWorkingDirectory);
          });
        }).finally(() => {
          semaphore.release();
        });
      });
    } else {
      return Promise.reject(new Error(script + 'is not defined in echidna.json'));
    }
  }

  /**
   * @param {string} repository Github style name (e.g: "Linkurious/linkurious-server")
   * @param {object} [options] options
   * @param {boolean} [options.npmIgnoreScripts=false] whether to call npm install with the flag --ignore-scripts
   * @returns {Promise.<Echidna>} echidna object of the newly cloned repository
   */
  get(repository, options) {
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
          utils.exec(`cp -a ${tmpRepositoryDir} ${this.workspaceDir}/${projectName}`, true);

          // remove the temporary directory
          utils.exec('rm -rf _tmp', true);
        }
      }).finally(() => {
        semaphore.release();
      });
    }).then(() => {
      // read the echidna.json file
      const echidnaJson = Echidna.validateEchidnaJson(this.workspaceDir + '/' + projectName, true);

      const echidna = new Echidna(projectName, this.workspaceDir, _.defaults(options, echidnaJson));

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
        semaphoreMap
      );
    }
    return this._npm;
  }

  /**
   * @returns {bowerCache} bowerCache of the current project
   */
  get bower() {
    if (!this._bower) {
      this._bower = new bowerCache(
        this.repositoryDir + '/bower.json',
        semaphoreMap
      );
    }
    return this._bower;
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
   * Return the path of the ci directory in the host OS. This is needed to allow mounting volumes
   * in secondary docker containers. Secondary docker container are spawned from the main docker
   * container on the host system, so their mounting points have to be relative to it.
   *
   * @returns {string} path of the ci directory in the host system
   */
  get ciDirHost() {
    return process.env['CI_DIRECTORY'];
  }

  /**
   * @returns {string} path of the workspace directory in the host system
   */
  get workspaceDirHost() {
    return this.ciDirHost + '/workspaces/' + this.workspaceDir.split('/').slice(-1)[0];
  }

  /**
   * @param {string} path where to look for the echidna.json file
   * @param {boolean} [dontThrow=false] whether to throw an error if the file doesn't exist
   * @returns {object | undefined} object representation of the echidna.json file
   */
  static validateEchidnaJson(path, dontThrow) {
    const file = path + '/echidna.json';
    let echidnaJson;
    try {
      echidnaJson = require(file);
    } catch(e) {
      if (!dontThrow) {
        throw new Error(`"${file}" was not found`);
      } else {
        return {
          scripts: {}
        };
      }
    }

    if (echidnaJson.scripts === undefined || echidnaJson.scripts === null) {
      throw new Error(`"${file}" requires a "scripts" field`);
    }

    return echidnaJson;
  }

  /**
   * @returns {Promise} promise
   */
  static main() {
    /**
     * 1) set CWD to the repository
     */
    process.chdir(rootRepositoryDir);

    /**
     * 2) read the echidna.json of the current project
     */
    const echidnaJson = Echidna.validateEchidnaJson(rootRepositoryDir);

    /**
     * 3) get Github style repository name
     */
    const projectName = utils.getRepositoryName().split('/')[1];

    /**
     * 4) create a workspace directory
     */
    const workspaceDir = ciDir + '/workspaces/' + shortid.generate();
    utils.exec(`mkdir -p ${workspaceDir}`, true);

    /**
     * 5) copy the repository in the workspace
     */
    utils.exec(`cp -a ${rootRepositoryDir} ${workspaceDir}/${projectName}`, true);

    /**
     * 6) parse command line arguments (only double-dash arguments are taken into account)
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
     * 7) parse commit message arguments
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
     * 8) we first execute scripts coming from cla, then scripts coming from commits
     */
    const echidna = new Echidna(projectName, workspaceDir, echidnaJson);

    // register a SIGINT/SIGTERM handler
    const exit = err => {
      if (err) {
        console.log('\x1b[31m' + err + '\x1b[0m');
      }

      // delete the workspace directory
      utils.exec(`rm -rf ${workspaceDir}`, true);

      // close semaphores
      return semaphoreMap.close().then(() => {
        if (err) {
          process.exit(1);
        }
      });
    };
    process.on('SIGINT', exit);
    process.on('SIGTERM', exit);

    return Promise.resolve().then(() => {
      return semaphoreMap.init();
    }).then(() => {
      return echidna.init();
    }).then(() => {
      return Promise.map(Array.from(scriptsToRun), s => echidna.run(s), {concurrency: 1})
        .return().then(() => {
          // upload the content of `_to_dev_` remotely
          if (fs.existsSync(workspaceDir + '/_to_dev_')) {
            let userAtHost = configuration.scpDestDir.split(':')[0];
            let baseDir = configuration.scpDestDir.split(':')[1];
            // TODO generate a proper name
            let branchDir = 'tmp_name_branches';
            let dir = baseDir + '/' + branchDir + '/' + new Date().toISOString();
            let port = configuration.scpPort;
            utils.exec(`ssh -p ${port} ${userAtHost} "mkdir -p '${dir}'"`, true);
            utils.exec(`scp -P ${port} ${workspaceDir}/_to_dev_/* ${userAtHost}:'${dir}'`, true);
          }
        }).then(exit);
    }).catch(err => {
      return exit(err);
    });
  }

  /**
   * Run itself in a docker container.
   * @returns {undefined}
   */
  static dockerize() {
    if (process.env['IN_DOCKER']) {
      Echidna.main();
    } else {
      const cla = _.filter(process.argv, arg => arg.indexOf('--') === 0).join(' ');

      utils.exec('docker run -v /var/run/docker.sock:/var/run/docker.sock' +
        ` -v ${rootRepositoryDir}:/repo` +
        ` -v ${ciDir}:/ci` +
        ' -v ~/.ssh:/home/linkurious/.ssh' +
        ` echidna sh -c "env IN_DOCKER=1 CI_DIRECTORY=$CI_DIRECTORY /ci/echidna.js ${cla}"`);
    }
  }
}

Echidna.dockerize();
