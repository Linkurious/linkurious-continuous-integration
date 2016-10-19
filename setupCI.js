#!/usr/bin/env node

/**
 * Created by francesco on 2016-09-21.
 */
'use strict';

const exec = require('./utils').exec;
const execRetry = require('./utils').execRetry;
const changeDir = require('./utils').changeDir;

/**
 * This script assume to be run on Ubuntu 16.04 x64 with node.js and git installed.
 * The user that runs this script has to be a sudoer.
 * It has to be run from its directory.
 *
 * A logout/login of the current user is necessary to make the user logged in the docker group.
 */

/**
 * (1) Configure APT for both MongoDB, Docker and Java
 */
exec('sudo apt-get install -y software-properties-common python-software-properties');
// MongoDB
exec('sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927');
exec('echo "deb http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.2 multiverse" |' +
  ' sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list');
// Docker
exec('sudo apt-key adv --keyserver hkp://p80.pool.sks-keyservers.net:80' +
  ' --recv-keys 58118E89F3A912897C070ADBF76221572C52609D');
exec('echo "deb https://apt.dockerproject.org/repo ubuntu-xenial main" |' +
  ' sudo tee /etc/apt/sources.list.d/docker.list');
// Java
exec('sudo add-apt-repository ppa:webupd8team/java');

exec('sudo apt-get update');

/**
 * (2) Install and start MongoDB
 * https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/
 */
exec('sudo apt-get install -y mongodb-org');
exec('sudo cp mongod.service /lib/systemd/system/mongod.service');
exec('sudo service mongod start');

/**
 * (3) Install and start Docker
 * We also add the user to the docker group
 * https://docs.docker.com/engine/installation/linux/ubuntulinux/
 */
exec('sudo apt-get install -y docker-engine docker-compose');
exec('sudo gpasswd -a ${USER} docker');
exec('sudo service docker start');
exec('sudo apt-get install -y python-pip');
exec('sudo mv /usr/bin/docker-compose /usr/bin/docker-compose1.5');
exec('pip install docker-compose');

/**
 * (4) Install StriderCD and create admin user
 */
exec('git clone https://github.com/Strider-CD/strider.git');
changeDir('strider', () => {
  execRetry('npm install', 5);
  exec('./bin/strider addUser');
});

/**
 * (5) Install n and setup directory permissions for changing node and npm version without sudo
 */
exec('sudo npm install -g n');

// Necessary to run n without sudo
exec('sudo chown -R ${USER} /usr/local');

// Necessary to change npm version globally without sudo
exec('sudo chown -R ${USER} /usr/lib/node_modules');

/**
 * (6) Install istanbul
 */
exec('sudo npm install -g istanbul');
exec('sudo mkdir /app');
// necessary directory for istanbul to merge the reports (the code will end up here)
exec('sudo chown -R ${USER} /app');

/**
 * (7) Install Nginx and setup SSL certificate
 */
exec('sudo apt-get install -y nginx');
exec('sudo apt-get install -y letsencrypt');
exec('sudo cp nginx_sites_available /etc/nginx/sites-available/default');
exec('sudo letsencrypt certonly --standalone -d ci.linkurio.us');
exec('sudo cp renew_cert.sh /etc/cron.daily');

/**
 * (8) Install Grunt
 */
exec('sudo npm install -g grunt');

/**
 * (9) Install Bower
 */
exec('sudo npm install -g bower');

/**
 * (10) Install Java 8
 */
exec('sudo apt-get install oracle-java8-installer');

exec('echo Please re-login');
