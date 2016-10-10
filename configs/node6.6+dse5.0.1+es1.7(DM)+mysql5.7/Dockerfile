FROM node:6.6

RUN mkdir -p /app
WORKDIR /app

COPY app /app

CMD sleep 30; node test/runMocha.js --jsonConfig
