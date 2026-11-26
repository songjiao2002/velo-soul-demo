FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node qr-images.mjs native-origin.mjs asr-realtime.mjs scribe-realtime.mjs server.mjs static-assets.mjs chat-service.mjs first-speech.mjs diary-service.mjs diary-closing.mjs speech-stream.mjs weather-service.mjs qr-cache.mjs bike-memory.mjs bike-reviews.mjs start.mjs ./
COPY --chown=node:node skills ./skills
COPY --chown=node:node voice-delivery.mjs character-reactions.mjs qwen-transport.mjs ./
COPY --chown=node:node assets/character-reactions ./assets/character-reactions
COPY --chown=node:node vendor ./vendor
COPY --chown=node:node public ./public
ENV NODE_ENV=production
USER root
CMD ["node", "start.mjs"]
