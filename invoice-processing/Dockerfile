FROM node:20-alpine

WORKDIR /app

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --production

COPY . .

# Create runtime directories
RUN mkdir -p uploads data

EXPOSE 3000

CMD ["node", "src/index.js"]
