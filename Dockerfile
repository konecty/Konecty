FROM node:4.9-stretch

ARG VERSION

RUN echo $VERSION

RUN set -x \
	&& curl -SLf "https://github.com/Konecty/Konecty/releases/download/$VERSION/Konecty.tar.gz" -o Konecty.tar.gz \
	&& mkdir /app \
	&& tar -zxf Konecty.tar.gz -C /app \
	&& rm Konecty.tar.gz \
	&& cd /app/bundle/programs/server/ \
	&& export NODE_TLS_REJECT_UNAUTHORIZED=0 \
	&& npm install \
	&& npm cache clear

WORKDIR /app/bundle

ENV PORT=3000 \
	ROOT_URL=http://localhost:3000

EXPOSE 3000

CMD ["node", "main.js"]
