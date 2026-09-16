FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY index.html manifest.json service-worker.js browserconfig.xml favicon.ico ./site/
COPY css ./site/css
COPY fonts ./site/fonts
COPY i18n ./site/i18n
COPY icons ./site/icons
COPY img ./site/img
COPY js ./site/js
COPY sound ./site/sound
COPY find-scores.html tests.html ./site/

EXPOSE 3000
USER node
CMD ["node", "server.js"]
