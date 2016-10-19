/**
 * Created by francesco on 2016-10-19.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');

const exec = require('./utils').exec;
const execRetry = require('./utils').execRetry;
const changeDir = require('./utils').changeDir;

const ciDir = process.env['CI_DIRECTORY'];

/**
 * Hash the bower.json file and look up if its bower_components was already cached.
 * If not, run bower install on this bower.json.
 *
 * Return the absolute path to the bower_components directory.
 *
 * @param {string} bowerJsonFile
 */
module.exports = (bowerJsonFile) => {
  // hash the bower.json file
  var data = fs.readFileSync(bowerJsonFile, 'utf8');
  var hashBowerJson = crypto.createHash('md5').update(data).digest('hex');

  // bucket containing the bower_components directory for this bower.json
  var directory = ciDir + '/tmp/bower-cache/' + hashBowerJson;

  try {
    // does this directory exist?
    fs.lstatSync(directory + '/bower_components');
  } catch(e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    // it doesn't exist so we have to run bower install for this bower.json

    exec('mkdir -p ' + directory);

    exec('cp ' + bowerJsonFile + ' ' + directory);

    changeDir(directory, () => {
      // we run bower install
      execRetry('bower install', 5);
    });
  }

  return directory + '/bower_components';
};
