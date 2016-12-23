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
    this._acquiredSemaphores = new Map();
    this._isClosed = false;
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
   * Stop watching on `this.semFile`. We also release anything that was acquired by this process
   * but not released.
   *
   * @returns {Promise} promise
   */
  close() {
    this.watcher.close();
    // we have to release all semaphores in `this._acquiredSemaphores`
    // we use this._isClosed to avoid later releases to occur
    this._isClosed = true;

    let promises = [];

    for (let key of this._acquiredSemaphores.keys()) {
      let count = this._acquiredSemaphores.get(key);
      if (count > 0) {
        promises.push(this._releaseOnClose(key, count));
      }
    }

    return Promise.all(promises);
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
      if (this._isClosed) {
        return semaphores;
      }
      // if it doesn't exist in the json file
      if (semaphores[semaphoreName] === undefined || semaphores[semaphoreName] === null) {
        // initialize the new semaphore
        semaphores[semaphoreName] = size;
      } else {
        // the semaphore value is set to the minimum among current value and desired size
        semaphores[semaphoreName] = Math.min(semaphores[semaphoreName], size);
      }

      if (!this.queues.has(semaphoreName)) {
        this.queues.set(semaphoreName, []);
      }

      return semaphores;
    });
  }

  /**
   * Function used to count acquired semaphores in this process to ensure release on process exit.
   *
   * @param {string} semaphoreName key of the semaphore
   * @param {number} count         diff, positive or negative, to apply to the local counter
   * @returns {undefined}
   * @private
   */
  _countAcquiredSemaphore(semaphoreName, count) {
    if (!this._acquiredSemaphores.has(semaphoreName)) {
      this._acquiredSemaphores.set(semaphoreName, 0);
    }
    this._acquiredSemaphores.set(semaphoreName,
      this._acquiredSemaphores.get(semaphoreName) + count);
  }

  /**
   * @param {string} semaphoreName key of the semaphore
   * @returns {Promise} promise
   */
  acquire(semaphoreName) {
    return new Promise(resolve => {
      this._readSemFile(semaphores => {
        if (this._isClosed) {
          return semaphores;
        }
        // if we can acquire the semaphore immediately
        if (semaphores[semaphoreName] > 0) {
          semaphores[semaphoreName]--;
          this._countAcquiredSemaphore(semaphoreName, 1);

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
      if (this._isClosed) {
        return semaphores;
      }
      // we only increase value of the semaphore
      semaphores[semaphoreName]++;
      this._countAcquiredSemaphore(semaphoreName, -1);
      return semaphores;
    });
  }

  /**
   * @param {string} semaphoreName key of the semaphore
   * @param {number} count         how many releases for the same key
   * @returns {Promise} promise
   */
  _releaseOnClose(semaphoreName, count) {
    return this._readSemFile(semaphores => {
      // we only increase value of the semaphore
      semaphores[semaphoreName] += count;
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
      let filecontent = fs.readFileSync(this.semFile);
      let semaphores = JSON.parse(filecontent);
      let newSemaphores = func(_.clone(semaphores));
      if (!_.isEqual(semaphores, newSemaphores)) {
        let fd = fs.openSync(this.semFile, 'w');
        fs.writeFileSync(fd, JSON.stringify(newSemaphores));
        fs.fsyncSync(fd);
        fs.closeSync(fd);
      }
    });
  }

  /**
   * @returns {undefined}
   * @private
   */
  _onSemFileChange() {
    this._readSemFile(semaphores => {
      if (this._isClosed) {
        return semaphores;
      }
      // check if we can fire one of the function in this.queues
      for (let key of this.queues.keys()) {
        while (semaphores[key] > 0 && this.queues.get(key).length > 0) {
          semaphores[key]--;
          this._countAcquiredSemaphore(key, 1);
          process.nextTick(this.queues.get(key).shift());
        }
      }
      return semaphores;
    });
  }
}

module.exports = SemaphoreMap;
