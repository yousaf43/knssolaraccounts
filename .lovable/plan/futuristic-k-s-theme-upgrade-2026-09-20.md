# Futuristic K&S Theme Upgrade

## Goal
Refresh the entire authenticated website with a polished futuristic K&S Solar look while keeping every existing workflow, page, and business rule unchanged.

## Visual update
- Refine the light and dark palettes around clean solar blue, cyan accents, crisp neutral surfaces, and clearer contrast.
- Replace the current decorative background with a restrained technical grid and subtle light treatment.
- Upgrade shared surfaces, tables, forms, tabs, buttons, top bar, and sidebar using consistent borders, depth, and focus states.
- Keep the interface compact and professional for accounting work; avoid decorative clutter and oversized rounded cards.

## Motion and navigation
- Add a more distinctive page-opening transition whenever a sidebar menu or recent tab is opened.
- Animate page headings and primary content groups in a short staggered sequence.
- Improve sidebar active-state movement, menu icon feedback, dropdowns, dialogs, sheets, and tab transitions.
- Keep motion fast and preserve reduced-motion accessibility.

## Shared layout polish
- Give the app shell a cleaner framed workspace on desktop and edge-to-edge layout on mobile.
- Improve the top search bar, account controls, recent tabs, sidebar branding, and active navigation treatment.
- Preserve the existing mobile sidebar behavior, dark mode, keep-alive page state, and all current routes.

## Technical details
- Update semantic theme tokens and shared styles in the global stylesheet.
- Update the app shell, sidebar, recent tabs, and shared button styling rather than rewriting individual pages.
- Remove the remote font import that can break stylesheet compilation; use the existing local/system font stack.
- Verify the preview build and inspect desktop and mobile layouts for overlap or clipping.
