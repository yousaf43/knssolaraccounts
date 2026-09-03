# English-only UI + Profit & Loss by Invoice

## 1. Make all app text English

Replace the remaining Roman Urdu strings in the interface with English. Confirmed locations:

- `src/pages/Drafts.tsx` — page description, empty state ("No drafts yet"), delete confirmation text.
- `src/components/ReceiptForm.tsx` — FIFO allocation hint, "no pending invoices for this customer" message.
- `src/components/InvoiceForm.tsx` — ledger toggle helper text, "leave empty to use invoice total" hint.
- `src/pages/Settings.tsx` — export/SQL dump/migrate-in descriptions.
- `src/components/NexiaAssistant.tsx` — UI chrome only: greeting, suggestion chips, toasts, button labels, tooltips, error messages.

Nexia's answers stay bilingual as requested: the edge-function system prompts (`nexia-grok`, `ai-assistant`) are not changed, so it still replies in Roman Urdu when the user writes Roman Urdu.

## 2. Profit & Loss by Invoice

New report in the Reports list: **Profit & Loss (By Invoice)**, plus a "Summary / By Invoice" view switch inside the existing Income Statement report so both entry points show the same view and share the same date filters.

Table columns (one row per invoice):

| Sr # | Date | Invoice # | Customer | Sales | Discount | Cost of Sales | Gross Profit | Margin % |

- Sales, discount and cost use the same rules as the Income Statement: approved invoices only, old-balance lines excluded, returns shown as negatives, cost from main-inventory cost price with average purchase cost fallback.
- Footer totals row for Sales, Discount, Cost and Profit, with overall margin %.
- Filters: existing date range (plus custom from/to), customer filter, search by invoice number/customer, and a profit filter (All / Profitable / Loss-making).
- Sortable columns and Sr # re-indexing like other reports; print/PDF export via the standard `exportTablePrint` helper.

## Technical notes

- Work is contained in `src/pages/Reports.tsx`: add report code entry, a `ProfitLossByInvoice` component reusing the `lineCost` / `saleAmount` / `oldBalanceAmount` / `countsAsSale` helpers already used by `IncomeStatement`, and a view toggle in the Income Statement panel.
- Cost helper extracted so both the Income Statement and the new view compute identical figures — totals of the by-invoice table reconcile with the Income Statement's Net sales and Cost of sales for the same period.
