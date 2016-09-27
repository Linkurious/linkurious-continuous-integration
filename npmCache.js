/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');

const exec = require('./utils').exec;
const execRetry = require('./utils').execRetry;
const changeDir = require('./utils').changeDir;

const ciDir = process.env['CI_FOLDER'];

/**
 * Hash the package.json file and look up if its node_modules folder was already cached.
 * If not, run npm install on this package.json.
 * Return the path to the node_modules folder. These node_modules folders will be generated in the
 * path $CI_FOLDER/tmp_app.
 *
 * @param {string} packageJsonFile
 */
module.exports = packageJsonFile => {
  var data = fs.readFileSync(packageJsonFile, 'utf8');

  // hash the package.json file
  var hashPackageJson = crypto.createHash('md5').update(data).digest('hex');
  var directory = ciDir + '/npm-cache/' + hashPackageJson;

  try {
    fs.lstatSync(directory + '/node_modules');
  } catch(e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    // if the node_modules directory does not exist, run npm install on this package.json
    // we assume that the npm install that generated this node_modules has exited correctly
    exec('mkdir -p ' + directory);

    // we want to call npm install always on the same directory. This way when we copy the
    // node_modules folder to the docker containers we don't break absolute paths inside the
    // various package.json. This folder is $CI_FOLDER/tmp_app
    exec(`rm -rf ${ciDir}/tmp_app`);
    exec(`mkdir -p ${ciDir}/tmp_app`);

    exec('cp ' + packageJsonFile + ' ' + ciDir + '/tmp_app');

    changeDir(ciDir + '/tmp_app', () => {
      execRetry('npm install', 5);
      exec('cp -r ' + ciDir + '/tmp_app/node_modules ' + directory + '/node_modules');
    });
  }

  return directory + '/node_modules';
};
