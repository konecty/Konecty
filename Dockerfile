FROM node:4.8-stretch

ENV KONECTY_VERSION 1.0.25

RUN set -x \
 && curl -SLf "https://github.com/Konecty/Konecty/releases/download/$KONECTY_VERSION/Konecty.tar.gz" -o Konecty.tar.gz \
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

CMD ["node", "main.js"]
