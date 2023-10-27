FROM node:18-alpine

RUN mkdir -p /app
COPY ./dist app
COPY ./src/private app/private
COPY ./package.json app
COPY ./yarn.lock app

WORKDIR /app

RUN apk add --no-cache --update python3 make g++ libc6-compat && rm -rf /var/cache/apk/*
RUN yarn install --production --silent --non-interactive --frozen-lockfile


RUN addgroup -g 1001 -S nodejs
RUN adduser -S konecty -u 1001

USER konecty
ENV PORT=3000
ENV NODE_ENV production
ENV NODE_ICU_DATA=/app/node_modules/full-icu

EXPOSE 3000

CMD ["node", "--max-http-header-size=65535", "server/main.js"]

