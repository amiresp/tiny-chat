FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN test -d /app/node_modules
RUN npm run build -w @verdant/client

FROM nginx:1.27-alpine
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
