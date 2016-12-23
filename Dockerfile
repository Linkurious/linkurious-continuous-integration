FROM ubuntu:16.04

# Install docker
RUN apt-get update && apt-get install -y docker.io

# Install stuff
RUN apt-get install -y curl git
RUN apt-get install -y build-essential
RUN apt-get install -y python

# Install node.js
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash
RUN apt-get install -y nodejs

# Install other stuff
RUN npm install -g grunt
RUN npm install -g n
RUN apt-get install -y wget
RUN apt-get install -y unzip
RUN apt-get install -y nano

# Install phantomjs
RUN apt-get install -y libfontconfig
RUN npm install -g phantomjs-prebuilt

# Set user
RUN apt-get install -y sudo
RUN adduser --disabled-password --gecos '' linkurious --uid 1000
RUN echo "linkurious ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
USER linkurious
