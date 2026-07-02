# Verdant Chat

A self-hosted cross-platform chat application with a React PWA, Electron Windows client, Capacitor Android client, Node.js/Express API, Socket.IO realtime transport, SQLite/Drizzle persistence, and IndexedDB offline cache.

## Included

- Direct chats, owner-managed groups, unread/read delivery states, search, presence and optional last-seen privacy.
- Text, emoji, files up to 50 MB, voice recording, image/video previews.
- RSS channels refreshed when opened and shareable by adding members.
- Offline message queue: `queued → sending → sent → delivered → read → failed`.
- HTML chat export in the PWA.
- The first registered account becomes administrator. Admin endpoints expose users/chats and account banning.
- Sliding 60-day sessions, refreshed on authenticated use.
- Messages expire after 30 days. Uploaded files expire after 7 days while their message remains marked as expired.
- Chats hidden by a user are removed from that user's membership after 7 days.

> Administrative message access means this project is not end-to-end encrypted. Use TLS and protect administrator credentials.

## Run with Docker

```bash
cp .env.example .env
# Set a strong JWT_SECRET and CLIENT_ORIGIN.
docker compose up --build -d
```

Open `http://localhost:8080`. The API health endpoint is `/health` through the server container.

## Local development

```bash
npm install
npm run dev
```

Client: `http://localhost:5173` — API: `http://localhost:3001`.

## Windows and Android builds

Run the **Build clients** workflow manually, or push a `v*` tag. It uploads an unsigned Windows NSIS/portable build and a debug APK. Windows may show an unknown-publisher warning and Android may require enabling installation from unknown sources.

## Production notes

- Put the web container behind HTTPS; microphone recording and PWA installation require a secure context outside localhost.
- Back up the `verdant-data` Docker volume. Upload files are intentionally ephemeral.
- For a public deployment, add rate limiting, antivirus scanning, CSP, audit logs, and a dedicated reverse proxy/WAF.
