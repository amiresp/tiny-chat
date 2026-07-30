# Client V2 refactor notes

## What changed

- Replaced the 15+ runtime enhancement entry scripts with one React entry point.
- Moved the former monolithic `main.jsx` into:
  - `src/app/App.jsx`
  - `src/app/useChatController.js`
  - `src/components/*`
  - `src/modals/*`
  - `src/hooks/*`
  - `src/lib/*`
- Kept the old implementation in `src/legacy/` only as a temporary migration reference. Nothing in that directory is loaded at runtime.
- Centralized chat/socket/upload/typing/voice state in `useChatController`.
- Merged Electron message notifications into the main Socket.IO connection.
- Removed runtime `window.fetch` monkey patches and `MutationObserver` UI mutation passes.

## Performance fixes

- One Socket.IO connection instead of several independent connections.
- Chat list refreshes are coalesced/throttled after socket events.
- Chat switching uses generation guards so stale requests cannot overwrite the newly selected chat.
- Search requests use generation guards to prevent out-of-order results.
- Typing state no longer performs a network request on every keypress.
- Draft writes to `localStorage` are debounced.
- Message merging de-duplicates socket/server responses by message/client id.
- Message rows use memoized React components.
- Image avatars and message images use lazy loading.
- Uploads use the server response directly when it contains the uploaded message, avoiding a full chat reload.
- Production chunks are split into React, Ionic and realtime vendor chunks.
- Removed service-worker runtime caching for private `/uploads/` media.

## UI fixes

- Removed invalid interactive media nested inside a `<button>` message bubble.
- Added responsive settings/media modal sizing.
- Added a React-native drag/drop overlay instead of global DOM listeners.
- Made the chat filter segment scrollable on narrow screens.
- Added visible Hidden chats as a normal filter instead of a secret triple-click behavior.
- Added proper hide/unhide and delete-chat actions to Chat Info.
- Fixed attachment links so generic files are actually openable/downloadable.
- Added safe focus states and reduced-motion handling.
- Reduced mobile composer spacing and improved message wrapping.

## Verification performed

- All active non-JSX JavaScript files pass `node --check`.
- All active JSX files pass TypeScript JSX parsing/transpilation diagnostics.
- Runtime static scan after refactor: 0 `MutationObserver`, 0 `window.fetch` overrides, 1 Socket.IO connection site, 1 module entry script.

## Build environment note

A full `npm run build` could not be executed in this sandbox because the provided `node_modules` only contained Vite cache files and the configured package registry did not provide the required Capacitor packages. Run `npm install` / `npm ci` in the project’s normal registry environment, then `npm run build`.

## Parity recovery pass

A second pass was completed after comparing the original runtime patch stack against the refactor. See `FEATURE_PARITY.md`.

Most importantly, desktop containment was changed to an explicit CSS Grid and Ionic page positioning is overridden only at the shell boundaries. This prevents the room page from rendering underneath the chat-list page.

Hidden chats again use the original discoverability model: they are omitted by default and triple-clicking the Tiny Chat title toggles hidden-chat reveal for the current browser session. The visible `Hidden` segment added by the first refactor has been removed.
