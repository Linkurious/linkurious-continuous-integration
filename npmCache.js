/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');

// locals
const utils = require('./utils');

const ciDir = '/ci';

const BUCKETS_ROOT_DIR = ciDir + '/tmp/npm-cache';

class npmCache {
  /**
   * @param {string} packageJsonFile    path to the package.json file
   * @param {string} nodeModulesDir     destination path of npm install
   * @param {SemaphoreMap} semaphores   semaphore collection
   */
  constructor(packageJsonFile, nodeModulesDir, semaphores) {
    this.packageJsonFile = packageJsonFile;
    try {
      this.packageJsonData = require(packageJsonFile);
    } catch(e) {
      // knowing if `this.packageJsonData` is defined is enough
    }
    this.nodeModulesDir = nodeModulesDir;

    this.semaphores = semaphores;
  }

  /**
   * @return {boolean} whether it has or not a package.json file
   */
  hasPackageJson() {
    return this.packageJsonData !== undefined;
  }

  /**
   * @returns {string | undefined} node version if defined
   */
  get nodeVersion() {
    if (this.packageJsonData && this.packageJsonData.engines) {
      return this.packageJsonData.engines.node;
    }
  }

  /**
   * @returns {string | undefined} npm version if defined
   */
  get npmVersion() {
    if (this.packageJsonData && this.packageJsonData.engines) {
      return this.packageJsonData.engines.npm;
    }
  }

  /**
   * Set globally a node binary of version `nodeVersion`.
   *
   * @param {string} [nodeVersion=this.nodeVersion] node version to use
   * @returns {undefined}
   */
  setNodeVersion(nodeVersion) {
    nodeVersion = nodeVersion || this.nodeVersion;

    if (!nodeVersion) {
      return; // desired version is not specified, system version is ok
    }

    utils.exec(`n ${nodeVersion}`, true);
  }

  /**
   * Set globally a npm binary of version `npmVersion`.
   *
   * @param {string} [npmVersion=this.npmVersion] npm version to use
   * @returns {undefined}
   */
  setNpmVersion(npmVersion) {
    npmVersion = npmVersion || this.npmVersion;

    if (!npmVersion) {
      return;
    }

    utils.exec(`npm install -g npm@${npmVersion}`);
  }

  /**
   * Implicitly set the desired node and npm version.
   * Look in the global cache if the same `package.json` file produced a previous
   * node_modules directory. If not, run npm install on this package.json.
   *
   * Create and populate `this.nodeModulesDir` with the result of npm install.
   * @param {object} [options] options
   * @param {boolean} [options.ignoreScripts=false] whether to call npm install with the flag --ignore-scripts
   * @returns {Promise} promise
   */
  install(options) {
    // Note: technically we could have a semaphore per bucket instead of a global one,
    // is it really necessary though?
    return this.semaphores.get('_npm', 1).then(semaphore => {
      return semaphore.acquire().then(() => {
        options = options || {};

        if (!this.hasPackageJson()) {
          return;
        }

        // install desired npm version
        this.setNodeVersion();
        this.setNpmVersion();

        const hashPackageJson = crypto.createHash('md5')
          .update(JSON.stringify(this.packageJsonData)).digest('hex');

        const bucketDir = BUCKETS_ROOT_DIR + '/' + hashPackageJson;

        let packageJsonDir = this.packageJsonFile.substring(
          0, this.packageJsonFile.lastIndexOf('/'));

        if (packageJsonDir === '') { packageJsonDir = '.'; }

        try {
          // does this directory exist?
          fs.lstatSync(bucketDir + '/node_modules');

          // copy from the bucket to the packageJsonDir
          utils.exec(`cp -r ${bucketDir}/node_modules ${packageJsonDir}/node_modules`, true);
        } catch(e) {
          if (e.code !== 'ENOENT') {
            throw e;
          }
          // it doesn't exist we have to run npm install for this package.json

          utils.exec('mkdir -p ' + bucketDir, true);

          utils.changeDir(packageJsonDir, () => {
            let flags = '';

            if (options.ignoreScripts) {
              flags += ' --ignore-scripts';
            }

            // we run npm install (the right node version is in /usr/local/bin)
            utils.execRetry('npm install' + flags, 5);

            // we copy the node_modules directory in our bucket
            utils.exec(`cp -r ${packageJsonDir}/node_modules ${bucketDir}/node_modules`, true);

            // there is no need to copy from the bucket to the repository since node_modules
            // was created there
          });
        }
      }).finally(() => {
        semaphore.release();
      });
    });
  }
}

module.exports = npmCache;
