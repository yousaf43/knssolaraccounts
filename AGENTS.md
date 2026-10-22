
- Menu access is per member: a stored custom menu list replaces the role defaults; admins and Settings are always allowed. Why: lets admins tailor access without new roles.
- Keep Hostinger's Apache SPA fallback in public/.htaccess so Vite copies it into deployment output; Lovable hosting needs no redirect configuration.
- Invoice saves compensate completed inventory writes on document-write failure using saveWithRollback; this prevents failed saves from leaving stock deducted, but is not a database transaction.
- Proposal payback uses the shared DISCO tariff (one global row, refreshed by the electricity-tariff server function at most weekly, validated before saving); bill math lives in src/lib/electricityTariff.ts. Why: rates change often and every proposal should pick them up without code edits.
- Report 148 uses the isolated stockValuation helper for purchase average and remaining-stock FIFO average, aggregating merged product IDs and using bills only when PO history is absent; other reports retain their existing costing.
- Proposal topics start at page boundaries with printable-height cover dimensions and separate quotation terms; tables may continue with repeated headings. Why: variable content must not create blank pages or detached signatures.
