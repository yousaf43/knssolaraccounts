# Complete Reports Audit and Repair

## Goal
Make every listed report accurate, distinct, filterable, printable, and consistent with the software’s accounting, sales, inventory, and payment rules.

## Work plan

### 1. Build shared report foundations
- Centralize safe date parsing/range filtering, ID deduplication, normalized customer/supplier/product matching, approved-sale logic, old-balance exclusion, return handling, and payment allocation.
- Make date filters inclusive and year-aware, and ensure all totals use the same filtered rows shown on screen.
- Keep reports restricted to Main Inventory and preserve negative stock quantities.

### 2. Repair sales and receivables reports
- Validate reports 028, 029, 034, 037, 084, 085, 088, 235, 236, and 200–203.
- Remove duplicate invoices/customers, calculate outstanding from receipts plus embedded payments, distinguish paid/unpaid correctly, exclude pending/draft/cancelled sales, and treat returns and old balance correctly.
- Repair product/category drilldowns, multi-product selection, bundle component handling, search/category/type filters, costs, quantities, document numbers, and totals.

### 3. Replace purchase placeholders with real reports
- Implement reports 040–043, 090–091, 210–211, and 272 using actual bills and purchase orders rather than the current generic monthly sales/expense chart.
- Add supplier grouping, unpaid balances, bill detail, product purchase quantities/rates, date/search filters, and reconciled totals.

### 4. Repair financial, cash, bank, and tax reports
- Implement report-specific Trial Balance, General Ledger, Day Book, Cash Book, Bank Book, Reconciliation, receipts summary, tax reports, Balance Sheet, nominal/expense reports, and cash-flow analytics.
- Remove generic placeholder outputs and use actual accounts, ledger entries, receipts, bills, and expenses where the database contains the required data.
- Align P&L/Income Statement formulas with approved sales, returns, inventory cost price, old-balance treatment, and selected tax percentages.

### 5. Repair inventory and asset reports
- Validate reports 078, 080, 082, 083, 148, 173, 180, 230–232, 244, 366, 381, 383, and A01–A03.
- Correct out-of-stock logic for zero and negative quantities, low-stock logic, product identity/deduplication, weighted purchase cost, valuation totals, stock movement, aging, dead stock, and adjustment history.
- Connect asset reports to persisted asset data instead of the current empty in-memory list.

### 6. Standardize report UX and exports
- Give every tabular report sequential Sr #, matching search/filter highlighting, empty state, footer totals, and stable responsive widths.
- Ensure sorting never corrupts accounting statement order and reindexes serial numbers after sort.
- Make Print/PDF/CSV export the active report and active filters—not the current generic monthly dataset—and preserve the on-screen columns/totals on A4.

### 7. Verification
- Add focused tests for shared formulas and edge cases: duplicates, pending invoices, returns, overpayments, old balance, negative stock, date boundaries, bundles, and filtered totals.
- Exercise every report code in the running preview, check browser errors, and verify representative desktop and print layouts.
- Produce a final checklist showing each report as repaired, verified, or explicitly marked unavailable when no supporting database data exists.

## Technical notes
- Most changes will be isolated to reporting helpers/components and `Reports.tsx`; backend schema changes are not planned unless a report requires data that the current database does not store.
- The current audit already found major shared defects: many report codes render generic placeholder charts instead of their named report, date charts ignore years, several filters are not consistently applied to charts/exports, unpaid logic relies on status rather than calculated balance, and CSV/PDF exports currently export monthly sales data regardless of the open report.
