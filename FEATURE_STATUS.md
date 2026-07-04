# Verdant Chat feature status

Updated: 2026-07-05

## Completed

- Registration and login with 60-day sliding sessions
- First registered account becomes administrator
- Direct chat creation
- Group creation (basic, one selected member during creation)
- RSS channel creation and refresh on open
- Text messages through Socket.IO
- Emoji picker
- File uploads up to 50 MB
- Voice recording and upload
- Image, video and audio previews
- Offline message queue and IndexedDB cache
- Connected / connecting / offline state
- HTML chat export
- Message and file retention cleanup
- Responsive web/PWA interface
- Traefik deployment on `https://chat.evaonline.ir`
- Windows Electron production URL
- Android native API/socket production origin
- Direct-chat peer name and avatar response
- Immediate new-chat display through API response and `chat:new`
- User profile interface
  - display name
  - username
  - mobile
  - hide last seen
  - change password
- Administration interface
  - overview statistics
  - user search
  - ban/unban users
  - chat list
  - inspect chat messages

## Partially completed

- Presence and last seen
  - server events exist
  - privacy setting exists
  - chat UI does not yet show peer presence/last seen
- Message delivery/read state
  - database table and socket event exist
  - unread counters and read/delivered UI are not implemented
- Group management
  - owner and membership records exist
  - add/remove members, multi-select creation and group settings UI are missing
- Chat search
  - server message-search endpoint exists
  - chat search interface is missing
- RSS sharing
  - a generic member endpoint exists
  - sharing an RSS channel with users/groups has no UI
- Administration
  - core users/chats/ban/message inspection is implemented
  - role editing, audit log and online-user reporting are missing
- Native clients
  - Android and Windows runtime URLs are configured
  - fresh APK/EXE builds are still required
  - iOS project and signing workflow do not exist yet

## Missing

- Unread badges per chat
- Delivered/read indicators in message bubbles
- Peer online/last-seen display
- Multi-member group creation
- Group member management
- Owner group deletion for all members
- User/group sharing for RSS channels
- In-chat message search UI
- Profile avatar upload
- Push notifications
- Admin role management
- Admin activity/audit log
- iOS Capacitor project and build workflow
- Automated frontend/backend test suite
