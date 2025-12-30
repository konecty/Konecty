FROM node:18-alpine

RUN mkdir -p /app
COPY ./dist app
COPY ./src/private app/private
COPY ./package.json app
COPY ./yarn.lock app

WORKDIR /app

RUN apk add --no-cache --update python3 make g++ libc6-compat curl && rm -rf /var/cache/apk/*

# Install uv (after Python3, before switching to non-root user)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    cp /root/.local/bin/uv /usr/local/bin/uv && \
    chmod +x /usr/local/bin/uv
ENV PATH="/usr/local/bin:$PATH"

RUN yarn install --production --silent --non-interactive --frozen-lockfile

# Copy Python scripts (after copying dist and private)
COPY ./src/scripts/python app/scripts/python

RUN addgroup -g 1001 -S nodejs
RUN adduser -S konecty -u 1001 --ingroup nodejs

USER konecty:nodejs 

ENV PORT=3000
ENV NODE_ENV production
ENV NODE_ICU_DATA=/app/node_modules/full-icu

EXPOSE 3000

CMD ["node", "--max-http-header-size=65535", "server/main.js"]

