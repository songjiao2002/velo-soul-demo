FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node asr-realtime.mjs server.mjs static-assets.mjs chat-service.mjs speech-stream.mjs weather-service.mjs qr-cache.mjs bike-memory.mjs start.mjs ./
COPY --chown=node:node skills ./skills
COPY --chown=node:node vendor ./vendor
COPY --chown=node:node public ./public
ENV NODE_ENV=production
USER root
CMD ["node", "start.mjs"]
