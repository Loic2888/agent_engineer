FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
<<<<<<< HEAD
RUN npm ci
=======
RUN npm install
>>>>>>> 2c1d62c3fabcf807dbf85dc1033ab2ce2b94b59d

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
