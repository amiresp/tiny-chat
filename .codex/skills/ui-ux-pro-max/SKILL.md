---
name: ui-ux-pro-max
description: Project-local UI/UX design intelligence for Tiny Chat, adapted from nextlevelbuilder/ui-ux-pro-max-skill.
source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
---

# UI/UX Pro Max — Tiny Chat Project Skill

Apply this skill to every UI/UX task in this repository.

## Priority order
1. Accessibility: WCAG AA contrast, visible focus, ARIA labels, keyboard navigation.
2. Touch and interaction: minimum 44x44 touch targets, 8px spacing, immediate pressed/loading feedback.
3. Performance: lazy media, avoid layout shift, debounce high-frequency events, preserve 60fps interactions.
4. Style consistency: one icon family, semantic tokens, consistent radii/elevation, no emoji as structural icons.
5. Responsive layout: mobile-first; validate at 375, 768, 1024, 1440 widths; no accidental horizontal scrolling.
6. Typography and color: semantic light/dark tokens, readable 16px mobile body copy, 1.5+ line height for prose.
7. Motion: 150–300ms micro-interactions; transform/opacity only; respect prefers-reduced-motion.
8. Forms and feedback: persistent labels, inline errors, clear loading/success/error states, destructive confirmation.
9. Navigation: predictable back behavior, deep-linkable screens, adaptive bottom-nav/sidebar, preserve page state.
10. Data/admin UI: dense but scannable tables/cards, clear status labels, accessible destructive actions.

## Tiny Chat-specific requirements
- Stack: Ionic React 8 + React 19 + Vite 6.
- Product: real-time messaging / productivity / social communication.
- Visual direction: premium minimal messaging UI, Telegram-level density with cleaner hierarchy and calmer surfaces.
- Brand: cyan/teal primary with restrained green success accent.
- Light and dark themes must be designed independently, never by simple inversion.
- Use Lucide-style outline SVG icons consistently; no emoji for navigation or system controls.
- Desktop: adaptive 3-column shell (navigation rail, chat list, conversation) at >=1024px.
- Tablet: 2-column shell; mobile: single-pane with top-level bottom navigation.
- All core views must be real routes/views rather than bottom sheets: chats, contacts, settings, profile/admin.
- Fixed headers/footers must never hide scrollable content.
- Chat composer, message actions, emoji picker, media preview, contacts and settings must remain keyboard accessible.

## Pre-delivery checklist
- No duplicated navigation items or injected duplicate controls.
- All icon-only buttons have aria-label/title.
- Interactive targets >=44px.
- Light and dark contrast verified independently.
- Mobile safe-area respected.
- Settings/profile/admin pages scroll correctly.
- No nested scroll traps.
- Back navigation returns to the prior chat/list state.
- Reduced motion supported.
- Destructive actions use explicit confirmation and danger styling.
