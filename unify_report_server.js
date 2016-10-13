/**
 * LINKURIOUS CONFIDENTIAL
 * Copyright Linkurious SAS 2012 - 2016
 *
 * Created by francesco on 2016-10-13.
 */
'use strict';

const exec = require('./utils').exec;
const changeDir = require('./utils').changeDir;

const configuration = require('./config');
const repositoryDir = process.env['PWD'];
const ciDir = process.env['CI_DIRECTORY'];
const coverageDir = ciDir + '/coverages';

/**
 * (8) Generate unified code coverage report and upload it
 */
// the app directory (with an absolute path) is required by istanbul to do its job
exec(`rm -rf /app/*; cp -a ${repositoryDir}/. /app`);

changeDir(`${coverageDir}`, () => {
  exec(`istanbul report --root .`);
  exec(`scp -r coverage ${configuration.coverageScpDestDir}/${new Date().toISOString()}
     -p ${configuration.coverageScpPort}`);
});
