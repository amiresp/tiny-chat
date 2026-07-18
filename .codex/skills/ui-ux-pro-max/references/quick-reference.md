# Tiny Chat UI/UX Quick Reference

## Accessibility
- WCAG AA contrast for normal text.
- Visible focus states on every interactive element.
- ARIA labels for icon-only controls.
- Keyboard navigation order must match visual order.
- Respect reduced motion and text scaling.

## Interaction
- Minimum 44x44px touch target.
- 8px minimum separation between touch controls.
- Press feedback within 100ms.
- Loading and disabled states for async actions.
- Do not rely on hover or gestures alone.

## Performance
- Lazy-load non-critical media.
- Reserve media dimensions to prevent CLS.
- Debounce search/resize/input observers.
- Virtualize or progressively render large lists.
- Avoid repeated DOM injection and layout-thrashing observers.

## Visual system
- One consistent outline icon language.
- No emoji as structural/system icons.
- Semantic tokens for surface/text/border/primary/success/danger.
- Consistent radius, spacing and elevation scales.
- Light/dark modes designed as paired systems.

## Responsive
- Validate 375 / 768 / 1024 / 1440 widths.
- Mobile single-pane; tablet two-pane; desktop adaptive 3-column.
- No accidental horizontal scroll.
- Fixed navigation must reserve content space.
- Prefer one primary scroll container per screen.

## Motion
- 150–300ms transitions.
- Use transform/opacity instead of animating layout properties.
- Reduced-motion mode removes non-essential transitions.

## Forms / feedback
- Real labels, not placeholder-only forms.
- Inline validation and actionable error copy.
- Confirm destructive operations.
- Success/error toast with aria-live.

## Navigation
- Preserve back-stack, selected chat, scroll and filter state.
- Core screens are routes/views, not primary-navigation modals.
- Adaptive rail/sidebar on desktop and bottom navigation on mobile.
