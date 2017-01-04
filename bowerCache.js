/**
 * Created by francesco on 2016-10-19.
 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');

// locals
const utils = require('./utils');

const CI_DIR = '/ci';

const BUCKETS_ROOT_DIR = CI_DIR + '/tmp/bower-cache';

/**
 * TODO this code is 100% taken from npmCache.js. Avoid the duplication?
 */
class bowerCache {
  /**
   * @param {string} bowerJsonFile path to the bower.json file
   * @param {SemaphoreMap} semaphores semaphore collection
   */
  constructor(bowerJsonFile, semaphores) {
    this.bowerJsonFile = bowerJsonFile;
    try {
      this.bowerJsonData = require(bowerJsonFile);
    } catch(e) {
      // knowing if `this.bowerJsonData` is defined is enough
    }

    this.semaphores = semaphores;
  }

  /**
   * @return {boolean} whether it has or not a bower.json file
   */
  hasBowerJson() {
    return this.bowerJsonData !== undefined;
  }

  /**
   * Look in the global cache if the same `bower.json` file produced a previous
   * bower_components directory. If not, run bower install on this bower.json.
   *
   * @returns {Promise} promise
   */
  install() {
    return this.semaphores.get('_bower', 1).then(semaphore => {
      return semaphore.acquire().then(() => {

        if (!this.hasBowerJson()) {
          return;
        }

        const hashBowerJson = crypto.createHash('md5')
          .update(JSON.stringify(this.bowerJsonData)).digest('hex');

        const bucketDir = BUCKETS_ROOT_DIR + '/' + hashBowerJson;

        let bowerJsonDir = this.bowerJsonFile.substring(
          0, this.bowerJsonFile.lastIndexOf('/'));
        if (bowerJsonDir === '') { bowerJsonDir = '.'; }

        try {
          // does this directory exist?
          fs.lstatSync(bucketDir + '/bower_components');

          // copy from the bucket to the bowerJsonDir
          utils.exec(`cp -r ${bucketDir}/bower_components ${bowerJsonDir}/bower_components`, true);
        } catch(e) {
          if (e.code !== 'ENOENT') {
            throw e;
          }
          // it doesn't exist we have to run bower install for this bower.json

          utils.exec('mkdir -p ' + bucketDir, true);

          utils.changeDir(bowerJsonDir, () => {

            // TODO we remove the .bowerrc file because it screws with the directory destination. Find another fix
            utils.exec('rm .bowerrc', true);

            // we run bower install
            utils.execRetry('bower install', 5);

            // we copy the bower_components directory in our bucket
            utils.exec(`cp -r ${bowerJsonDir}/bower_components ${bucketDir}/bower_components`,
              true);

            // there is no need to copy from the bucket to the repository since bower_components
            // was installed there
          });
        }
      }).finally(() => {
        semaphore.release();
      });
    });
  }
}

module.exports = bowerCache;
