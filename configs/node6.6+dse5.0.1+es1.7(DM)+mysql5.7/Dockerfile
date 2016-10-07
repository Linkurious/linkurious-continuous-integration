FROM node:6.6

ARG ci_directory

RUN mkdir -p $ci_directory/app
WORKDIR $ci_directory/app

COPY app $ci_directory/app

CMD sleep 30; node test/runMocha.js --jsonConfig
