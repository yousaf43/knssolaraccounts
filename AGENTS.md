
- Menu access is per member: a stored custom menu list replaces the role defaults; admins and Settings are always allowed. Why: lets admins tailor access without new roles.
- Proposal payback uses the shared DISCO tariff (one global row, refreshed by the electricity-tariff server function at most weekly, validated before saving); bill math lives in src/lib/electricityTariff.ts. Why: rates change often and every proposal should pick them up without code edits.
