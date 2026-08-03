/**
 * Shared flexible search helpers.
 *
 * Goals:
 *  - Multi-word ("token") search: every token must match somewhere in the record,
 *    in any order and across different fields ("lith 100 ah" -> "Lithium Battery 100Ah").
 *  - Punctuation / separator tolerant: "prd0012" matches "PRD-0012",
 *    "100 ah" matches "100Ah".
 */

/** Lowercase + collapse whitespace. */
export function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Lowercase and strip every non-alphanumeric character (separator-insensitive form). */
export function squash(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Split a query into search tokens. Returns [] for an empty query. */
export function tokenize(query: string | null | undefined): string[] {
  return normalize(query).split(" ").filter(Boolean);
}

/**
 * True when every token in `tokens` is found in the given fields.
 * Empty token list always matches (no filter applied).
 */
export function matchesTokens(tokens: string[], ...fields: unknown[]): boolean {
  if (tokens.length === 0) return true;
  const plain = fields.map(normalize).filter(Boolean).join(" ");
  const squashed = squash(plain);
  return tokens.every((t) => {
    if (plain.includes(t)) return true;
    const st = squash(t);
    return st.length > 0 && squashed.includes(st);
  });
}

/** Convenience: tokenize `query` and match against `fields`. */
export function matchesQuery(query: string | null | undefined, ...fields: unknown[]): boolean {
  return matchesTokens(tokenize(query), ...fields);
}
