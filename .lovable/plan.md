# Serial numbers from scanned PDF

## What you will get
1. **Upload scanned PDF / photo** on the Serial Numbers tab. Before saving, the form asks:
   - Category (Panel, Inverter, Battery, Motor, Other)
   - **Brand** (required) and **Watt** (required for panels)
2. AI reads the scanned pages (works for CamScanner/photo PDFs, not only text PDFs) and lists every serial number found, one by one.
3. You review the list: remove wrong ones, fix a number, add missing ones. Then **Save** — each serial is saved separately with its brand and watt. Duplicates are skipped and shown.
4. **Making a warranty:** in each serial box, as you type, a dropdown shows matching **available** serials (same category, brand and watt as the item). Pick one to add it. You can also type the full number.
5. **Used once = locked:** a serial used in one warranty can never be picked again (hidden from the dropdown and blocked by the database). It becomes free again only if that warranty is deleted or the serial is removed from it.
6. Serial list shows Brand, Watt, Status (Available / Used in WAR-xxxx) with search and filters.

## Technical details
- New authenticated edge function `serial-extract`: receives rendered page images (pdf.js in browser, max ~10 pages), calls the shared company AI provider (Gemini vision with Groq/OpenRouter fallback via existing helpers), returns a validated, de-duplicated serial array. Deploy to both Cloud and the external backend.
- `SerialStock.tsx`: make brand required (stored in existing `brand_model`), watt required for panels; replace text-only PDF parsing with image OCR; editable review list.
- `Warranties.tsx`: dropdown filters by category + brand + watt, excludes used serials, live search while typing.
- Existing database trigger keeps the one-time-use lock; add a test for the matching filter.
