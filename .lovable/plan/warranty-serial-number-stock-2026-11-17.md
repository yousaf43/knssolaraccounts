# Warranty Serial Number Stock

## What you will get
1. **New "Serial Numbers" tab on the Warranties page**
   - Upload a serial sheet (PDF, photo or Excel/CSV). The software reads every serial number from it.
   - Before saving you choose a **Category** (Solar Panel, Inverter, Battery, Solar Pump/Motor, Other) and, for panels, the **Watt** (e.g. 585W, 620W). Brand/model and batch name are optional.
   - You see a preview list of the numbers found; you can remove wrong ones or type extra ones, then click Save.
   - Duplicate numbers (already in stock) are skipped and shown to you.
   - A list shows all saved serials with filters for category, watt and status (Available / Used), plus search. Each used serial shows which warranty (WAR-xxxx) it went into.

2. **Dropdown while making a warranty**
   - In the panel serial box (and inverter/battery/motor boxes), as you type, a dropdown shows matching **available** serials only — filtered by that item's category and, for panels, the chosen watt.
   - Pick one (or press Enter) to add it. Scanning/typing still works.
   - A serial already used in another warranty cannot be added; you get a message "Already used in WAR-xxxx".

3. **Lock after use**
   - When a warranty is saved, its serials are marked **Used** and linked to that warranty. No other warranty can save them — the database itself blocks it, so two people saving at the same time cannot both use one serial.
   - Editing the same warranty keeps its own serials. Removing a serial from a warranty, or deleting the warranty, makes the serial Available again.
   - Serials typed by hand that were never uploaded are also locked so they can't repeat in another warranty.

## Technical details
- New table `warranty_serials` (company_id, serial, category, watt, brand_model, batch_label, status, warranty_id, source file path, timestamps), unique on (company_id, normalized serial); GRANTs + company RLS like other tables.
- Security-definer RPC `assign_warranty_serials(warranty_id, items jsonb)` called on save: releases serials no longer on the warranty, claims new ones atomically, errors listing conflicts; trigger on warranty delete releases serials.
- Existing warranties' serials backfilled as Used so old certificates are protected.
- Extraction: PDF text via pdf.js (already installed); scanned PDFs/photos go through the existing shared AI provider (company Gemini key fallback) via a new authenticated `extract-serials` function; CSV/Excel parsed in browser.
- `SerialEntry` gets a combobox suggestion list; pages: `src/pages/Warranties.tsx`, new `src/components/warranty/SerialStock.tsx`, helper `src/lib/warrantySerials.ts` with tests (no reuse across warranties, release on removal, category/watt filtering).
- Migration and function deployed to both Lovable Cloud and your Hostinger database.
