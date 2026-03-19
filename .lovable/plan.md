

## Data Export Feature

### Overview
Settings page mein ek "Export Data" section add karenge jahan se user apna tamam data download kar sake — JSON ya CSV format mein. Ye exported data phir cPanel ya kisi bhi external database mein import kiya ja sakta hai.

### What will be built

1. **Export Section in Settings**
   - Settings page mein ek naya "Data Export" tab/section
   - Two export formats: JSON (full backup, easy to re-import) and CSV (per-table, Excel/cPanel compatible)
   - Button to export all tables at once as a ZIP file

2. **Export Logic**
   - All 21 tables ka data fetch karenge (customers, inventory, invoices, sales_orders, etc.)
   - JSON export: Ek single JSON file with all tables' data
   - CSV export: Har table ka alag CSV file, sab ek ZIP mein download

3. **Tables included**
   - customers, suppliers, inventory, invoices, sales_orders, quotations, receipts, expenses, purchase_orders, bills, purchase_payments, stock_adjustments, accounts, ledger_entries, other_payments, other_receipts, transfers, reconcile_entries, solar_washing, activity_logs, user_settings

### Technical Details
- Client-side export using existing Supabase queries (no new edge function needed)
- Use JSZip library for creating ZIP archives with multiple CSV files
- CSV generation using manual string building (no extra library needed)
- JSON export as a single downloadable `.json` file
- All exports filtered by current user's `user_id`

### Files to modify
- `src/pages/Settings.tsx` — Add Export Data section with buttons
- New utility: `src/utils/exportData.ts` — Export logic (collect data, generate CSV/JSON, trigger download)
- `package.json` — Add `jszip` dependency for CSV ZIP export

