FROM ubuntu:16.04

# Install docker
RUN apt-get update && apt-get install -y docker.io

# Install stuff
RUN apt-get install -y curl git
RUN apt-get install -y build-essential
RUN apt-get install -y apt-utils
RUN apt-get install -y python
RUN apt-get install -y python-pip

# Install node.js
RUN curl -sL https://deb.nodesource.com/setup_7.x | bash
RUN apt-get install -y nodejs

# Install other stuff
RUN npm install -g grunt
RUN npm install -g n
RUN npm install -g typescript
RUN npm install -g bower
RUN apt-get install -y wget
RUN apt-get install -y zip unzip
RUN apt-get install -y redir
RUN apt-get install -y nano

# Install Java
RUN apt-get install -y software-properties-common # for add-apt-repository
RUN add-apt-repository -y ppa:webupd8team/java
RUN apt-get update
RUN echo oracle-java8-installer shared/accepted-oracle-license-v1-1 select true | /usr/bin/debconf-set-selections
RUN apt-get install -y oracle-java8-installer

# Install phantomjs
RUN apt-get install -y libfontconfig
RUN npm install -g phantomjs-prebuilt

# Install xvfb
RUN apt-get install -y xvfb

# Install chrome
RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN apt-get install -y gconf-service libasound2 libatk1.0-0 libcairo2 libcups2 libgconf-2-4 libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libappindicator1 fonts-liberation libxss1 libnss3 xdg-utils
RUN dpkg -i google-chrome*.deb

# Install docker-compose 1.9
RUN curl -L "https://github.com/docker/compose/releases/download/1.9.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
RUN chmod +x /usr/local/bin/docker-compose

# Set user linkurious as sudoer
RUN apt-get install -y sudo
RUN adduser --disabled-password --gecos '' linkurious --uid 1000
RUN echo "linkurious ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
RUN chown -R linkurious /usr/local/
RUN groupmod -g 999 docker # both host machine and container have a fixed gid of docker set to 999
RUN gpasswd -a linkurious docker
USER linkurious
