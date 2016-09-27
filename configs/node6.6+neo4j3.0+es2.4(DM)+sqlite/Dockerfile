FROM node:6.6

ARG ci_folder

RUN mkdir -p $ci_folder/tmp_app
WORKDIR $ci_folder/tmp_app

COPY app $ci_folder/tmp_app

CMD [ "node", "test/runMocha.js", "--jsonConfig" ]
