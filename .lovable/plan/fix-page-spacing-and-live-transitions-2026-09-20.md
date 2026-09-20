# Fix page spacing and live transitions

## Changes
- Remove the incorrect sticky offset inside the already-separated content scroller, eliminating the large top gap across affected menus.
- Replace the route-only animation trigger with a reliable replay mechanism for every menu navigation.
- Add consistent entrance motion for page-internal tabs, forms, dialogs, sheets, dropdowns, and newly opened panels while preserving reduced-motion accessibility.
- Verify the app build and inspect desktop/mobile page geometry for unwanted gaps or overflow.

## Technical details
- Keep pages mounted so their state remains intact; restart animations without remounting or clearing forms.
- Use the existing semantic theme tokens and shared layout/motion styles.
