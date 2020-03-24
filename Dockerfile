FROM node:12

ARG VERSION

RUN set -x \
	&& curl -SLf "https://github.com/Konecty/Konecty/releases/download/$VERSION/Konecty.tar.gz" -o Konecty.tar.gz \
	&& mkdir /app \
	&& tar -zxf Konecty.tar.gz -C /app \
	&& rm Konecty.tar.gz \
	&& cd /app/bundle/programs/server/ \
	&& npm install

WORKDIR /app/bundle

ENV PORT=3000 \
	ROOT_URL=http://localhost:3000

EXPOSE 3000

CMD ["node", "--max-old-space-size=4096", "--max-http-header-size=65535", "main.js"]
