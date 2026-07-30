# Feature parity audit

This audit compares the original `client-v2` runtime (including the DOM patch scripts loaded by the old `index.html`) with the refactored React client.

## Restored / preserved

| Original behavior | Current implementation |
| --- | --- |
| Active / archived chats | Native React chat list |
| Hidden chats excluded by default | Preserved |
| Triple-click app title to reveal hidden chats for the current session | Restored; there is no visible Hidden tab |
| Hide / unhide from chat/profile actions | Native ChatInfo action |
| Desktop navigation rail | Restored as React component |
| Mobile bottom navigation | Restored as React component |
| All / Private / Groups / RSS chat filters | Restored |
| Saved Messages navigation | Restored |
| Chat row last-message preview and timestamp | Restored |
| Online / last-seen presence in direct-chat rows | Restored and fed by the main socket |
| Contacts list | Restored |
| Contact search by username/mobile | Restored |
| Add/remove contact | Restored |
| Start direct chat from contacts | Restored |
| Profile/chat information | Preserved in ChatInfo; peer mobile/username, members and pinned message included |
| Add/remove direct-chat peer as contact | Restored in ChatInfo |
| Settings: profile | Preserved |
| Settings: appearance | Preserved |
| Auth-page light/dark/system theme switcher | Restored |
| Settings: privacy | Preserved |
| Settings: password/security | Preserved |
| Settings: active sessions/logout session | Preserved |
| Admin users + ban/unban | Preserved |
| Admin chats + permanent delete | Preserved |
| Direct delete-chat button in room header | Restored |
| Delete chat from info/profile | Preserved |
| Message reply/edit/copy/forward/save/pin/delete | Preserved |
| Clipboard fallback when Clipboard API is unavailable | Restored |
| Pinned-message banner / unpin | Preserved |
| Message search | Preserved |
| Media/files browser | Preserved |
| Click image to open media preview | Restored |
| Video preview/open action | Restored |
| Authenticated generic-file download fallback | Restored |
| Drag-and-drop upload | Preserved |
| Review attachment before upload | Restored |
| Voice recording/upload | Preserved |
| Custom audio UI, seek and single-audio playback | Restored |
| Audio waveform decoding | Restored lazily near viewport and cached |
| Emoji picker with groups/recent | Restored |
| Draft persistence | Preserved, debounced |
| Typing indicator | Preserved, network calls de-duplicated |
| Unread document title | Preserved |
| Unread favicon badge/blink while hidden | Restored |
| Electron new-message notification | Preserved on the single main socket |
| Presence updates | Restored on the single main socket |
| Ctrl/Cmd+K search | Preserved |
| Ctrl/Cmd+N new chat | Preserved |
| Ctrl/Cmd+/ shortcut help | Restored |
| PWA install prompt | Restored |
| Offline/online feedback | Preserved via app toast |
| URL chat/view persistence | Preserved/restored |
| Restore last chat | Preserved |
| Duplicate/stale message protection | Reimplemented in state merge/generation guards |
| Stale chat-switch request protection | Reimplemented without fetch monkey-patching |
| Deleted-message cleanup | Restored by omitting deleted bubbles |
| Reduced-motion support | Preserved |
| Error fallback | Reimplemented as React ErrorBoundary |

## Intentional internal changes

The original app implemented many of these features using `MutationObserver`, DOM mutation and repeated `window.fetch`/Socket.IO wrappers. The parity build keeps the user-facing behavior but implements it inside React/state whenever possible.

The old duplicate desktop rails (`telegram-ui`, `tiny-chat-premium`, `platform-ui`) are represented by one navigation rail instead of multiple competing DOM injectors.
