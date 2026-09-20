# Lively tabs and page transitions

## What will change
- Refresh the recent-tabs strip so active, inactive, opening, and closing states are clearer and visually polished.
- Make every sidebar and recent-tab page switch replay a noticeable live transition while keeping each page's data and scroll state intact.
- Add a restrained K&S blue/cyan motion accent during page opening, plus a short staggered reveal for the page's main sections.
- Preserve reduced-motion accessibility and keep the compact accounting workspace layout shown in the screenshot.

## Technical details
- Trigger route transitions directly from the active keep-alive page container, because a persistent CSS class does not reliably restart when previously mounted pages are shown again.
- Use semantic theme colors and existing shared controls; no business logic or stored data changes.
- Verify the tabs and transitions in the running desktop preview and confirm the latest build is successful.
