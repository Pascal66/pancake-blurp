FROM node:argon

# Create app directory
RUN mkdir -p /usr/src/burst-pool
WORKDIR /usr/src/burst-pool

# Install app dependencies
COPY package.json /usr/src/burst-pool/
RUN npm install

EXPOSE 80 4443 8124 8125

HEALTHCHECK --interval=1m --timeout=5s \

CMD [ "npm", "start" ]
