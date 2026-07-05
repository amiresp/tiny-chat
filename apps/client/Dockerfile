ARG DEPS_IMAGE=tiny-chat-deps:node22
FROM ${DEPS_IMAGE} AS build

WORKDIR /app

COPY apps/client apps/client

RUN npm run build -w @verdant/client

FROM nginx:1.27-alpine

COPY --from=build /app/apps/client/dist /usr/share/nginx/html
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
