#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-22.
 */
'use strict';

const exec = require('child_process').execSync;
const rl = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const config = require('./config');

rl.question('GitHub Client Secret: ', clientSecret => {
  exec('npm start >> strider.log 2>&1 & disown', {
    env:
      Object.assign({
        'SERVER_NAME': config.serverName,
        'PLUGIN_GITHUB_APP_ID': config.githubClientId,
        'PLUGIN_GITHUB_APP_SECRET': clientSecret
      }, process.env),
    cwd: process.cwd() + '/strider',
    shell: '/bin/bash'});
  rl.close();
});
