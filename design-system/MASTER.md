# Tiny Chat — Master Design System

## Product intent
Tiny Chat is a fast real-time messaging product. The interface must feel calm, immediate, lightweight and premium. The experience should borrow the information density and familiarity of mature messaging apps without copying their visual identity.

## Experience principles
1. Conversation first: chat content and composer always dominate visual hierarchy.
2. Calm density: compact enough for messaging, never cramped.
3. Predictable navigation: rail/list/conversation on desktop; single-pane on mobile.
4. Immediate feedback: every action responds visually within 100ms.
5. One visual language: Lucide-style outline icons, consistent 2px stroke, no emoji system icons.
6. Accessibility by default: 44px targets, keyboard navigation, focus-visible, semantic labels.
7. Theme parity: every component has deliberate light and dark values.

## Breakpoints
- Compact phone: < 480px
- Mobile / large phone: 480–767px
- Tablet: 768–1023px
- Desktop: 1024–1439px
- Wide desktop: >=1440px

## Layout
### Mobile
Single pane. Top app bar + content + contextual composer. Top-level bottom navigation only on list-level screens.

### Tablet
Two panes: chat list 320px + active screen.

### Desktop
Three panes: 72px navigation rail + 336px chat list + flexible conversation.

## Spacing scale
4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

## Radius scale
- xs 8px
- sm 12px
- md 16px
- lg 20px
- xl 28px
- pill 999px

## Icon scale
- sm 16px
- md 20px
- lg 24px
All icon buttons: minimum hit area 44x44px.

## Typography
System/Inter stack. Body text 14–16px depending on density, never below 12px for supporting metadata. Heading weights 600–750. Message text 14px desktop, 15px mobile. Line-height 1.45–1.6.

## Light theme tokens
- canvas #F5F7FA
- surface #FFFFFF
- surface-subtle #F0F4F7
- surface-elevated #FFFFFF
- text-primary #0B1720
- text-secondary #60717D
- border #DDE6EC
- primary #09B8D5
- primary-strong #078EAA
- primary-soft #E6F9FC
- success #22B66D
- danger #E5484D
- focus #0891B2

## Dark theme tokens
- canvas #0A1015
- surface #111A21
- surface-subtle #17232C
- surface-elevated #1A2730
- text-primary #F5F9FB
- text-secondary #91A3AF
- border #273640
- primary #20CAE2
- primary-strong #50D5E8
- primary-soft rgba(32,202,226,.12)
- success #38C981
- danger #FF6369
- focus #67E8F9

## Messaging
Received bubbles use surface-elevated and a subtle border. Sent bubbles use a restrained teal tonal gradient; avoid saturated neon blocks. Bubble max width 66% desktop / 86% mobile. Metadata must never compete with message copy. Reply preview uses a 3px primary accent line. Reactions float below bubble with clear hit targets.

## Navigation
Desktop rail uses icon + label. Active item uses a soft primary state layer and a 3px indicator. Chat list keeps search at top, filter chips below, then rows. Mobile bottom nav maximum 4 items: Chats, Discover, Contacts, Settings.

## Lists
Chat row target >=72px. Avatar 48–52px. Name, preview and timestamp form a strict 2-row hierarchy. Unread badge is compact but >=20px. Preserve row height while media/status loads.

## Composer
Floating visual treatment without detaching from layout. Attachment / emoji / mic / send controls all 44px targets. Textarea grows until a sensible max height, then internally scrolls. Emoji picker is keyboard-dismissable and never blocks the composer completely.

## Settings / Profile / Admin
Use full pages, not primary-navigation bottom sheets. One primary scroll container. Sticky/fixed headers reserve their height. Admin uses clear sections, descriptive danger actions and searchable management lists.

## Motion
Fast 160ms hover/press, 220ms surface transitions, 280ms route-level transitions. Transform and opacity only. Respect prefers-reduced-motion.

## Anti-patterns
- No duplicated navigation items.
- No emoji as navigation/system icons.
- No arbitrary icon sizes.
- No hard-coded dark-only styling in light mode.
- No fixed overlays that cover chat list or composer.
- No bottom-sheet primary navigation.
- No nested scroll traps.
- No invisible focus state.
