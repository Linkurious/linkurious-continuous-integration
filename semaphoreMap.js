/**
 * LINKURIOUS CONFIDENTIAL
 * Copyright Linkurious SAS 2012 - 2016
 *
 * Created by francesco on 2016-12-20.
 */
'use strict';

const path = require('path');
const fs = require('fs');

// external libs
const _ = require('lodash');
const Promise = require('bluebird');
const lockfile = require('lockfile');

const LOCK_FILE_OPTS = {
  retries: 5, // 5 times
  wait: 1000, // 1 sec, timeout after which we give up to acquire the lock
  stale: 1000 // 1 sec, timeout after which the lockfile is considered freed
};

/**
 * Semaphore
 * @typedef  {Object} Semaphore
 * @property {function} acquire
 * @property {function} release
 */

class SemaphoreMap {
  /**
   * Create a collection of semaphores on file. The file is going to be a json file with a property
   * for each semaphore.
   *
   * @param {string} semFile path to the json file
   */
  constructor(semFile) {
    this.semFile = path.resolve(semFile);
    this.lockFile = this.semFile + '.lock';

    // we have 1 queue for each semaphore
    this.queues = new Map();
  }

  /**
   * Return a promise that resolves when the semaphore collection is ready.
   *
   * @returns {Promise} promise
   */
  init() {
    return this._underLock(() => {
      // create the file if it doesn't exist
      if (!fs.existsSync(this.semFile)) {
        fs.writeFileSync(this.semFile, JSON.stringify({}));
      }

      // watch the file for changes
      this.watcher = fs.watch(this.semFile, this._onSemFileChange.bind(this));
    });
  }

  /**
   * Stop watching on `this.semFile`.
   *
   * @returns {undefined}
   */
  close() {
    this.watcher.close();
  }

  /**
   * Create the semaphore if it doesn't exist.
   *
   * @param {string} semaphoreName key of the semaphore
   * @param {number} size          initial value for them semaphore
   * @returns {Promise} promise
   */
  create(semaphoreName, size) {
    return this._readSemFile(semaphores => {
      // if it doesn't exist in the json file
      if (semaphores[semaphoreName] === undefined || semaphores[semaphoreName] === null) {
        // initialize the new semaphore
        semaphores[semaphoreName] = size;
      }

      if (!this.queues.has(semaphoreName)) {
        this.queues.set(semaphoreName, []);
      }

      return semaphores;
    });
  }

  /**
   * @param {string} semaphoreName key of the semaphore
   * @returns {Promise} promise
   */
  acquire(semaphoreName) {
    return new Promise(resolve => {
      this._readSemFile(semaphores => {
        // if we can acquire the semaphore immediately
        if (semaphores[semaphoreName] > 0) {
          semaphores[semaphoreName]--;
          // we resolve immediately
          process.nextTick(resolve);
        } else {
          if (!this.queues.has(semaphoreName)) {
            this.queues.set(semaphoreName, []);
          }

          // otherwise we add the resolve function to the queue for this semaphore

          this.queues.get(semaphoreName).push(resolve);
        }
        return semaphores;
      });
    });
  }

  /**
   * @param {string} semaphoreName key of the semaphore
   * @returns {Promise} promise
   */
  release(semaphoreName) {
    return this._readSemFile(semaphores => {
      // we only increase value of the semaphore
      semaphores[semaphoreName]++;
      return semaphores;
    });
  }

  /**
   * Create the semaphore if it doesn't exist.
   * Return an object with 2 functions,`acquire` and `release`, that don't take any argument.
   *
   * @param {string} semaphoreName key of the semaphore
   * @param {number} size          initial value for them semaphore
   * @returns {Promise.<Semaphore>} promise
   */
  get(semaphoreName, size) {
    return this.create(semaphoreName, size).then(() => {
      return {
        acquire: this.acquire.bind(this, semaphoreName),
        release: this.release.bind(this, semaphoreName)
      };
    });
  }

  /**
   * Execute a synchronous function under file lock.
   *
   * @param {function} func function
   * @returns {Promise} promise
   * @private
   */
  _underLock(func) {
    return new Promise(resolve => {
      lockfile.lock(this.lockFile, LOCK_FILE_OPTS, () => {
        func();
        lockfile.unlock(this.lockFile, resolve);
      });
    });
  }

  /**
   * `func` is the function that takes in input the object containing all the semaphores and
   * returns the new object to be serialized in `this.semFile`.
   *
   * @param {function} func function
   * @returns {Promise} promise
   * @private
   */
  _readSemFile(func) {
    return this._underLock(() => {
      let semaphores = JSON.parse(fs.readFileSync(this.semFile));
      let newSemaphores = func(_.clone(semaphores));
      if (!_.isEqual(semaphores, newSemaphores)) {
        fs.writeFileSync(this.semFile, JSON.stringify(newSemaphores));
      }
    });
  }

  /**
   * @returns {undefined}
   * @private
   */
  _onSemFileChange() {
    this._readSemFile(semaphores => {
      // check if we can fire one of the function in this.queues
      for (let key of this.queues.keys()) {
        while (semaphores[key] > 0 && this.queues.get(key).length > 0) {
          semaphores[key]--;
          process.nextTick(this.queues.get(key).shift());
        }
      }
      return semaphores;
    });
  }
}

module.exports = SemaphoreMap;
