FROM node:20-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends default-jre-headless curl \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g firebase-tools
COPY firebase.json /firebase.json
EXPOSE 9099 4000
CMD ["firebase","emulators:start","--only","auth", \
     "--project","demo-taxforward","--config","/firebase.json"]
