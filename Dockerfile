FROM ubuntu:16.04

# Install docker
RUN apt-get update && apt-get install -y docker.io

# Install stuff
RUN apt-get install -y curl git

# Install node.js
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash
RUN apt-get install -y nodejs

# Install other stuff
RUN npm install -g grunt
RUN npm install -g n
