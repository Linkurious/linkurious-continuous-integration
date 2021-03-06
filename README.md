# Echidna

Echidna is a collection of scripts and configuration files used to deploy an in house solution for Continuous Integration based on https://github.com/Strider-CD/strider.
Its purpose is to test Linkurious against various setups automatically.

## Requirements

- Ubuntu 16.04
- node.js
- git

## Installation

Run the `setupCI.js` script on your Ubuntu 16.04 machine. This script is going to setup *MongoDB*, *Docker*, *StriderCD*, *n*, *istanbul*, *nginx*, *PhantomJS* and *Java 8*.
It requires to be runned by a **sudoer**. At the end, it's going to ask you to create an admin user for the CI. It will also configure a new SSL certificate with https://letsencrypt.org.

## Configuration

First, we need to create a new Github OAuth Application.
When we have one, we can edit the `config.js` file to add the Client ID of the application under `githubClientId`.

Optionally, in `config.js` we can also configure SMTP for e-mail notifications.

## Run

Run the `runCI.js` script. It's going to ask for the Client Secret of the Github application.

## Setup the projects

After logging in the web interface, press `Setup Github`. Github is going to prompt you for credentials and ask to confirm permissions.
Following that, your Github repositories will appear in StriderCD.

Press `Add` and then `custom` on the project you want to configure.

#### Setup any project

First, check that the SSH key in the project settings is authorized to clone the repository.

In the branch `*`:
 - Add 3 active plugins: `Environment`, `Custom Scripts`, `Github Status`. The latter must be installed first by adding it under *Admin/Plugins* in the UI.
 - Under `Environment` add a variable `CI_DIRECTORY` with value the working directory name of this repository.
 - Under `Custom Scripts`, `Test` add `$CI_DIRECTORY/echidna.js --<scriptname>` (You can just call the script `"test"`).
 - Create in your project an `echidna.json` file containing a key `scripts`. `scripts` will be an object with the name of the scripts as the keys and the script paths as the values.
 - A script can be a shell script or an echidna script. An echidna script is a node module that exports just a function that returns a Promise and takes in input the `echidna` object.
 
 ## Why this name?
 Echidnas are cool:
 
 ![echidna](https://s-media-cache-ak0.pinimg.com/originals/8d/7f/7b/8d7f7bbb3e0109afcd7307df6c0724ec.jpg)
