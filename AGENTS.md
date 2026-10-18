
- Menu access is per member: a stored custom menu list replaces the role defaults; admins and Settings are always allowed. Why: lets admins tailor access without new roles.
- Proposal payback uses the shared DISCO tariff (one global row, refreshed by the electricity-tariff server function at most weekly, validated before saving); bill math lives in src/lib/electricityTariff.ts. Why: rates change often and every proposal should pick them up without code edits.
- Stock Valuation uses the isolated purchase-average helper; other reports retain FIFO costing. Why: valuation's requested costing method must not change sales-profit calculations.
- Proposal topics start at page boundaries with printable-height cover dimensions and separate quotation terms; tables may continue with repeated headings. Why: variable content must not create blank pages or detached signatures.
