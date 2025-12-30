FROM node:18-alpine

RUN mkdir -p /app
COPY ./dist /app
COPY ./src/private /app/private
COPY ./package.json /app
COPY ./yarn.lock /app

WORKDIR /app

RUN apk add --no-cache --update python3 python3-dev py3-pip make g++ libc6-compat curl rust cargo musl-dev && rm -rf /var/cache/apk/*

# Install uv (after Python3, before switching to non-root user)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    cp /root/.local/bin/uv /usr/local/bin/uv && \
    chmod +x /usr/local/bin/uv
ENV PATH="/usr/local/bin:$PATH"

# Note: maturin will be installed automatically by uv when building polars
# Rust and cargo are already installed above for building polars from source on Alpine

RUN yarn install --production --silent --non-interactive --frozen-lockfile

# Copy Python scripts (after copying dist and private)
COPY ./src/scripts/python /app/scripts/python

# Pre-build polars to cache the compilation (runs as root before switching user)
# This avoids compilation delay on first pivot request
# Note: This may take several minutes on first build, but subsequent builds will be faster
# Use printf instead of echo because BusyBox ash doesn't interpret \n in echo
RUN printf '{"jsonrpc":"2.0","method":"pivot","params":{"config":{"rows":[{"field":"_id"}],"values":[{"field":"_id","aggregator":"count"}]}}}\n{"_id":"test"}\n' | uv run --script /app/scripts/python/pivot_table.py 2>&1 | head -5 || true

RUN addgroup -g 1001 -S nodejs
RUN adduser -S konecty -u 1001 --ingroup nodejs

# Ensure konecty user can access Rust and build tools
RUN chown -R konecty:nodejs /app /home/konecty

USER konecty:nodejs 

ENV PORT=3000
ENV NODE_ENV=production
ENV NODE_ICU_DATA=/app/node_modules/full-icu

EXPOSE 3000

CMD ["node", "--max-http-header-size=65535", "server/main.js"]

