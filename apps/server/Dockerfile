FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN npm install --omit=dev -w @verdant/server
COPY apps/server apps/server
RUN mkdir -p /app/data /app/storage/uploads
EXPOSE 3001
CMD ["npm","run","start","-w","@verdant/server"]
