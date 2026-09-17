# Improve Profit & Loss (By Invoice) Print Layout

## Changes
- Give the By Invoice report a dedicated print layout instead of the generic financial-statement print rules.
- Print on A4 landscape so all 12 columns fit without overlapping.
- Add a polished K&S Solar Energy header with report title, period, and tax note.
- Use fixed, balanced column widths; compact typography; right-aligned financial figures; alternating rows; and a prominent totals row.
- Remove interactive expand icons and editable controls from print while keeping saved operating-expense values visible.
- Keep invoice detail rows available on screen, but print the clean invoice summary table without broken nested-table formatting.

## Verification
- Open Report 130 / By Invoice and generate the print view.
- Check A4 landscape output for column overlap, clipping, readable totals, repeated headers across pages, and correct operating-expense values.
- Confirm the normal on-screen report remains unchanged and the app builds successfully.

## Technical details
- Add a report-specific class to the printable wrapper in `src/pages/Reports.tsx`.
- Extend `exportTablePrint` to detect that class and apply isolated landscape CSS before the existing generic panel rules.
