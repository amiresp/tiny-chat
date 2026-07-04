# Verdant Chat feature status

Updated: 2026-07-05

## Completed

- Registration and login with 60-day sliding sessions
- First registered account becomes administrator
- Direct chat creation with the peer name and avatar
- Immediate new-chat display through the API response and `chat:new`
- Group creation (basic, one selected member during creation)
- RSS channel creation and refresh on open
- RSS article cards with enclosure image, author and publication date
- RSS sharing with selected users or every active user
- Text messages through Socket.IO
- Unread message badges per chat
- Mark messages as read when a chat is opened
- Peer online status and last-seen display
- Emoji picker
- File uploads up to 50 MB
- Voice recording and upload
- Image, video and audio previews
- Offline message queue and IndexedDB cache
- Connected / connecting / offline state
- HTML chat export
- Message and file retention cleanup
- Responsive web/PWA interface
- Independent scrolling for chat list and message area
- Traefik deployment on `https://chat.evaonline.ir`
- Windows Electron production URL
- Android native API/socket production origin
- User profile interface
  - profile image upload
  - display name
  - username
  - mobile
  - hide online status and last seen
  - change password
- Administration interface
  - overview statistics
  - online users and connection counts
  - user search
  - ban/unban users
  - chat list
  - inspect chat messages
- GitHub Actions validation for server modules and client build

## Partially completed

- Message delivery/read state
  - read receipts are stored and unread counts work
  - delivered/read indicators are not yet rendered inside message bubbles
- Group management
  - owner and membership records exist
  - add/remove members, multi-select creation and group settings UI are missing
- Chat search
  - server message-search endpoint exists
  - chat search interface is missing
- Administration
  - users, chats, online sessions, banning and message inspection are implemented
  - role editing and audit logs are missing
- Native clients
  - Android and Windows runtime URLs are configured
  - fresh APK/EXE builds are still required
  - iOS project and signing workflow do not exist yet

## Missing

- Delivered/read indicators in message bubbles
- Multi-member group creation
- Group member management
- Owner group deletion for all members
- In-chat message search UI
- Push notifications
- Admin role management
- Admin activity/audit log
- iOS Capacitor project and build workflow
- Automated API and browser interaction tests
