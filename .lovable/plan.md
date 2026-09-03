# Profit & Loss by Project / Site / Installation

## Goal
The real purpose of "Profit & Loss by Invoice" is to see how much profit or loss each **project / site / installation** made. Upgrade report **130 – Profit & Loss (By Invoice)** into a full **Profit & Loss by Project** report.

## Changes (all in `src/pages/Reports.tsx`)

1. **Rename report 130** to "Profit & Loss (By Project)" and add a view switcher inside it:
   - **By Project** (new default) — groups all invoices by `projectName`.
   - **By Invoice** — the existing per-invoice view (kept as-is, plus a Project column).

2. **By Project view** — one row per project/site:
   - Columns: Sr #, Project/Site Name, Customer, Invoices (# of invoices), Sales, Discount, Cost of Sales, Profit / Loss, Margin %.
   - Invoices with no project name grouped under "— No Project —".
   - Returns/credit notes count negative (same rules as current by-invoice view).
   - Profit in green, loss in red, bold.
   - Each project row is **expandable/clickable** to drill down into that project's invoices (per-invoice sales, cost, profit).
   - Footer totals: total projects, invoices, sales, cost, profit, overall margin.

3. **Filters** (on top of existing date range, sales-tax %, search, customer, profit/loss filters):
   - **Project search** — type a project/site name to filter.
   - **Sort**: by profit (high→low), loss first, or date.
   - Existing "Profitable only / Loss-making only" filter works per-project in the By Project view.

4. **Print / PDF** — the project table prints with the centered company heading like other reports; expanded project details are included in print output.

## Calculation rules (unchanged, verified in existing code)
- Approved invoices only (pending/draft/cancelled excluded); returns negative.
- Old-balance items excluded from sales/cost (P&L-safe).
- Cost = main-inventory `costPrice`, falling back to weighted average purchase-order cost (`getAvgCost`).
- Sales shown excluding sales tax when a tax % is set; discounts shown separately.

## Notes
- No database changes needed — invoices already store `project_name`.
- Only English UI labels (no Roman Urdu), consistent with the rest of the app.
