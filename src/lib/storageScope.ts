// Per-account (company/user) scope for browser-local data.
// Prevents one tenant's local data (drafts, tabs, ...) from leaking into
// another account signed in on the same browser.

const SCOPE_EVENT = "kns-storage-scope-changed";

let currentScope = "guest";

export function setStorageScope(scope: string | null | undefined) {
  const next = scope || "guest";
  if (next === currentScope) return;
  currentScope = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SCOPE_EVENT));
  }
}

export function getStorageScope(): string {
  return currentScope;
}

/** Build a storage key namespaced to the active account. */
export function scopedKey(base: string): string {
  return `${base}::${currentScope}`;
}

export function subscribeStorageScope(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(SCOPE_EVENT, cb);
  return () => window.removeEventListener(SCOPE_EVENT, cb);
}
