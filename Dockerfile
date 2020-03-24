FROM node:4.9-stretch

ARG DOCKER_TAG
ARG BUILD_RFC3339
ARG COMMIT
ARG VERSION
ARG DOCKER_TAG


RUN echo $BUILD_RFC3339
RUN echo $COMMIT
RUN echo $VERSION
RUN echo $DOCKER_TAG


RUN set -x \
	&& curl -SLf "https://github.com/Konecty/Konecty/releases/download/$DOCKER_TAG/Konecty.tar.gz" -o Konecty.tar.gz \
	&& mkdir /app \
	&& tar -zxf Konecty.tar.gz -C /app \
	&& rm Konecty.tar.gz \
	&& cd /app/bundle/programs/server/ \
	&& npm install \
	&& npm cache clear

WORKDIR /app/bundle

ENV PORT=3000 \
	ROOT_URL=http://localhost:3000

EXPOSE 3000

CMD ["node", "--max-old-space-size=4096", "main.js"]
