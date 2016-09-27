FROM node:6.6

ARG ci_folder

RUN mkdir -p $ci_directory/app
WORKDIR $ci_directory/app

COPY app $ci_directory/app

CMD [ "node", "test/runMocha.js", "--jsonConfig" ]
