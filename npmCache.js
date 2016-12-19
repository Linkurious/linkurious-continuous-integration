/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

// locals
const utils = require('./utils');

const ciDir = process.env['CI_DIRECTORY'];

class npmCache {
  /**
   * @param {string} packageJsonFile path to the package.json file
   * @param {string} binDir          desired path for binaries
   * @param {string} nodeModulesDir  destination path of npm install
   */
  constructor(packageJsonFile, binDir, nodeModulesDir) {
    this.packageJsonData = require(packageJsonFile);
    this.binDir = binDir;
    this.nodeModulesDir = nodeModulesDir;
  }

  /**
   * @return {string | undefined} node version if defined
   */
  get nodeVersion() {
    if (this.packageJsonData && this.packageJsonData.engines) {
      return this.packageJsonData.engines.node;
    }
  }

  /**
   * @return {string | undefined} npm version if defined
   */
  get npmVersion() {
    if (this.packageJsonData && this.packageJsonData.engines) {
      return this.packageJsonData.engines.npm;
    }
  }

  /**
   * Add in `this.binDir` a node binary of version `nodeVersion`.
   * @param {string} [nodeVersion=this.nodeVersion] node version to use
   */
  setNodeVersion(nodeVersion) {
    nodeVersion = nodeVersion || this.nodeVersion;

    // download node globally
    utils.exec(`n ${nodeVersion} -d`, true);
    const nodePath = utils.exec(`n bin ${nodeVersion}`, true).split('\n')[0];
    utils.exec(`cp -al ${nodePath} ${this.binDir}`, true);
  }

  /**
   * Add in `this.binDir` a npm binary of version `npmVersion`.
   * @param {string} [npmVersion=this.npmVersion] npm version to use
   */
  setNpmVersion(npmVersion) {
    npmVersion = npmVersion || this.npmVersion;

  }
}

module.exports = npmCache;

/**
 * First, switch to the right node and npm version.
 * Hash the package.json file and look up if its node_modules directory was already cached.
 * If not, run npm install on this package.json.
 *
 * Return the absolute path to the node_modules directory.
 *
 * @param {string} packageJsonFile  path to the package.json file
 * @param {string} [nodeVersion]    node version
 * @param {string} [npmVersion]     npm version
 * @param {boolean} [ignoreScripts] whether to call npm install with the flag --ignore-scripts
 * @returns {string} absolute       path to the node_modules directory

module.exports = (packageJsonFile, nodeVersion, npmVersion, ignoreScripts) => {
  // we install the desired node version
  if (nodeVersion) {
    exec('n ' + nodeVersion);
  }

  // we install the desired npm version
  if (npmVersion) {
    execRetry('export PATH=/usr/local/bin:${PATH}; npm install -g npm@' + npmVersion, 5);
  }

  // hash the package.json file
  var data = fs.readFileSync(packageJsonFile, 'utf8');
  var hashPackageJson = crypto.createHash('md5').update(data).digest('hex');

  // bucket containing the node_modules directory for this package.json
  var directory = ciDir + '/tmp/npm-cache/' + hashPackageJson;

  try {
    // does this directory exist?
    fs.lstatSync(directory + '/node_modules');
  } catch(e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    // it doesn't exist so we have to run npm install for this package.json

    exec('mkdir -p ' + directory);

    var packageJsonFolder = packageJsonFile.substring(0, packageJsonFile.lastIndexOf('/'));
    if (packageJsonFolder === '') { packageJsonFolder = '.'; }

    changeDir(packageJsonFolder, () => {
      var flags = '';

      if (ignoreScripts) {
        flags += ' --ignore-scripts';
      }

      // we run npm install (the right node version is in /usr/local/bin)
      execRetry('export PATH=/usr/local/bin:${PATH}; npm install' + flags, 5);

      // we copy the node_modules directory in our bucket
      exec(`cp -r ${packageJsonFolder}/node_modules ${directory}/node_modules`);
    });
  }

  return directory + '/node_modules';
};
*/
