# Invoice → Ledger option + customer-wise Ledger section

## Kya banega

1. **Invoice form me "Add to Ledger" option**
   - Invoice create/edit form ke payment area me ek checkbox: **Add to Ledger**.
   - Checkbox on karte hi saath me ek **Account dropdown** khulega (Bank / Cash / Easypaisa etc. — wahi accounts jo Accounts page se aate hain, hardcoded list nahi).
   - Amount default invoice total (ya jo payment enter hui ho) hoga, user edit kar sakega; date invoice date; reference invoice number; description customer + invoice no.
   - Save karte hi us account me ek **incoming ledger entry** ban jayegi. Checkbox off = koi ledger entry nahi.
   - Invoice edit karke checkbox off kiya jaye to us invoice ki linked ledger entry hat jayegi; amount/account change ho to entry update ho jayegi (duplicate nahi banegi).

2. **Ledger ka alag section (Invoices page me naya tab)**
   - Invoices page me naya **Ledger** tab, existing tabs (Quotations / Sales Orders / Project Completed / Invoices / Returns / Receipts / All) ke saath.
   - Ye tab **customer-wise ledger** dikhayega — invoices ki list ke saath mix nahi hoga.
   - Layout:
     - Upar customer-wise summary: Customer, Total Invoiced, Total Received (ledger), Balance.
     - Customer pe click → uski detail ledger: Date, Invoice #, Description, Account, Debit (invoice), Credit (received), Running Balance.
   - Filters: customer search (match highlight ke saath), date range, account.
   - Print/Export wahi standard helpers use karenge jo baaki pages me hain (A4 portrait, centered K&S Solar Energy heading), aur date format dd-MM-yyyy.

## Technical notes

- Ledger entries wahi existing `ledger_entries` table use karengi (`useLedgerEntriesCloud`) — koi naya table nahi, taake Accounts page ke bank ledger aur balances automatically consistent rahein.
- Invoice ↔ ledger link entry ke `reference` field se hoga (invoice number), taake edit/delete pe entry dhoondh ke update/remove ki ja sake.
- `InvoiceForm` me naye props/state: `addToLedger` (boolean), `ledgerAccount`, `ledgerAmount`; `onSave` callback me ye values pass hongi.
- Ledger entry banane/hatane ka kaam `src/pages/Invoices.tsx` ke existing ledger helper (jo abhi advance payment/receipt ke liye entry banata hai) ke pattern par hoga — logic ek jagah rahega.
- Naya `LedgerTab` UI component `src/pages/Invoices.tsx` ke andar/ya alag component file me, existing `StickyPageHeader` + `TablePagination` (25/page) patterns follow karte hue.
- Invoice delete hone par uski ledger entry bhi remove hogi.
