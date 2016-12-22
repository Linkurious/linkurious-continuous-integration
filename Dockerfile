FROM ubuntu:16.04

# Install docker
RUN apt-get update && apt-get install -y docker.io

# Install node.js
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash
RUN apt-get install -y nodejs
