FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY node_modules ./node_modules
COPY apps/server apps/server

RUN test -d /app/node_modules \
    && test -f /app/node_modules/.package-lock.json \
    && node -e "require.resolve('express'); require.resolve('better-sqlite3'); require.resolve('drizzle-orm')" \
    && mkdir -p /app/data /app/storage/uploads

EXPOSE 3001

CMD ["npm","run","start","-w","@verdant/server"]
