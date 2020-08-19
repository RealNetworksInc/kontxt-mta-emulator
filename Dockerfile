FROM node:12

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt -y update && \
    apt -y install vim \
    telnet

RUN npm ci --only=production

COPY ./ .

EXPOSE 10025

CMD [ "node", "server.js" ]
