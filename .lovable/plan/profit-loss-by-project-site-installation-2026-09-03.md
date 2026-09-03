# Profit & Loss by Project / Site / Installation

## Goal
See exactly how much profit or loss each **project / site / installation** made — including material cost AND project expenses like labor pay.

## Part 1 — Link expenses to projects (new)

1. **Database migration**: add a `project_name` (text, nullable) column to the `expenses` table. No other schema change.
2. **Expenses page** (`src/pages/Expenses.tsx`):
   - Add a **Project / Site** field in the Add/Edit Expense form — a combobox with free text, suggesting existing project names already used on invoices (so "Site A" is spelled consistently).
   - Show the project name as a badge in the expenses table.
   - Optional filter by project.
3. Existing expenses without a project stay as general/overhead expenses — they are NOT forced into projects.

## Part 2 — Report 130 becomes "Profit & Loss (By Project)"

All in `src/pages/Reports.tsx`:

1. Rename report 130 and add a view switcher: **By Project** (default) | **By Invoice** (existing view, plus a Project column).

2. **By Project view** — one row per project/site (invoices grouped by `projectName`):
   - Columns: Sr #, Project/Site, Customer, Invoices (#), Sales, Discount, Material Cost, **Project Expenses** (labor etc.), **Net Profit / Loss**, Margin %.
   - `Net Profit = Sales (ex-tax, after discount) − Material Cost − Project Expenses`
   - Expandable row: drill down into the project's invoices AND its expense entries (date, description, amount).
   - Invoices with no project grouped under "— No Project —"; general expenses (no project) shown separately as "Unallocated / Overhead" so nothing is hidden.
   - Footer totals for every column.

3. **Filters**: date range (shared), project search, customer filter, Profitable only / Loss-making only, sort by profit or loss. Sales-tax % input kept.

4. **Print / PDF**: prints the project table (and expanded details) with the centered company heading, same as other reports.

## Calculation rules (verified against existing code)
- Approved invoices only; returns count negative. Old-balance lines excluded from sales/cost.
- Material cost = main-inventory `costPrice` (fallback: weighted average purchase cost).
- Project expenses = expenses whose `project_name` matches the project, within the date range.

## Notes
- One small migration (add column + nothing else — grants/RLS already cover expenses).
- English-only UI labels.
