FROM node:22-bookworm-slim

RUN npm config set registry https://package-mirror.liara.ir/repository/npm/ --global

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm install --omit=dev -w @verdant/server --no-audit --no-fund \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/* /root/.npm

COPY apps/server apps/server

RUN mkdir -p /app/data /app/storage/uploads

EXPOSE 3001

CMD ["npm","run","start","-w","@verdant/server"]
