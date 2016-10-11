FROM elubow/titan-gremlin:latest

# Install dockerize (required for waiting on a tcp port)
RUN apt-get update && apt-get install -y wget
RUN wget https://github.com/jwilder/dockerize/releases/download/v0.1.0/dockerize-linux-amd64-v0.1.0.tar.gz
RUN tar -C /usr/local/bin -xzvf dockerize-linux-amd64-v0.1.0.tar.gz

COPY run.sh /run.sh

ENTRYPOINT ./run.sh
