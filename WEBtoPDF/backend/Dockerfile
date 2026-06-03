FROM node:20-alpine

RUN apk add --no-cache chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/src ./src
COPY frontend ./frontend

RUN mkdir -p uploads

EXPOSE 3002
CMD ["node", "src/index.js"]
