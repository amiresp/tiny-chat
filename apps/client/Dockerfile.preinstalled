FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY node_modules ./node_modules
COPY apps/client apps/client
RUN test -d /app/node_modules && test -f /app/node_modules/.package-lock.json && npm run build -w @verdant/client
FROM nginx:1.27-alpine
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
