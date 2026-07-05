ARG DEPS_IMAGE=tiny-chat-deps:node22
FROM ${DEPS_IMAGE}

WORKDIR /app

COPY apps/server apps/server

RUN mkdir -p /app/data /app/storage/uploads \
    && node -e "require.resolve('express'); require.resolve('better-sqlite3'); require.resolve('drizzle-orm'); require.resolve('argon2')"

EXPOSE 3001

CMD ["npm","run","start","-w","@verdant/server"]
