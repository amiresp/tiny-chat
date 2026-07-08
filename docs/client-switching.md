# Client switching

The default web client is now the Ionic React workspace:

```bash
npm run dev -w @verdant/client-v2
```

Docker Compose also defaults to the Ionic client through `WEB_WORKSPACE`:

```bash
docker compose up -d server web
```

To temporarily run the legacy React client on the same Traefik/domain setup:

```bash
WEB_WORKSPACE=@verdant/client docker compose up -d --force-recreate web
```

To switch back to Ionic client v2:

```bash
WEB_WORKSPACE=@verdant/client-v2 docker compose up -d --force-recreate web
```

The backend, database, uploads volume, Traefik route, and public domain stay the same. Only the frontend workspace loaded by the `web` service changes.
