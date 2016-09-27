/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');

const exec = require('./utils').exec;
const execRetry = require('./utils').execRetry;
const changeDir = require('./utils').changeDir;

const ciDir = process.env['CI_DIRECTORY'];

/**
 * Hash the package.json file and look up if its node_modules directory was already cached.
 * If not, run npm install on this package.json.
 *
 * Return the absolute path to the node_modules directory.
 * The node_modules directory will be generated in the path $CI_DIRECTORY/app. This is done to avoid
 * breaking absolute paths added by npm3 in the package.json files.
 *
 * @param {string} packageJsonFile
 */
module.exports = packageJsonFile => {
  // hash the package.json file
  var data = fs.readFileSync(packageJsonFile, 'utf8');
  var hashPackageJson = crypto.createHash('md5').update(data).digest('hex');

  // bucket containing the node_modules directory for this package.json
  var directory = ciDir + '/npm-cache/' + hashPackageJson;

  try {
    // does this directory exist?
    fs.lstatSync(directory + '/node_modules');
  } catch(e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    // it doesn't exist so we have to run npm install for this package.json

    exec('mkdir -p ' + directory);

    // we create the directory $CI_DIRECTORY/app
    exec(`rm -rf ${ciDir}/app && mkdir -p ${ciDir}/app`);

    // we copy the package.json in it
    exec(`cp ${packageJsonFile} ${ciDir}/app`);

    changeDir(ciDir + '/app', () => {
      // we run npm install
      execRetry('npm install', 5);

      // we copy the node_modules directory in our bucket
      exec(`cp -r ${ciDir}/app/node_modules ${directory}/node_modules`);
    });
  }

  return directory + '/node_modules';
};