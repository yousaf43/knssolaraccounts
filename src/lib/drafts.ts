// Lightweight local draft store.
// Drafts are auto-saved while a document is being created/edited so that an
// accidental tab close, refresh or crash never loses work.

export type DraftKind = "invoice" | "quotation" | "sales-order";

export type Draft = {
  /** Stable id, e.g. "invoice:new" or "invoice:<documentId>" */
  id: string;
  kind: DraftKind;
  /** Short human label, e.g. "INV-012" */
  label: string;
  /** Secondary line, e.g. "Ali Traders • PKR 45,000" */
  summary: string;
  /** Serialized form state */
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

import { scopedKey, subscribeStorageScope } from "@/lib/storageScope";

const STORAGE_BASE = "kns.drafts.v1";
const storageKey = () => scopedKey(STORAGE_BASE);
const EVENT = "kns-drafts-changed";
const MAX_DRAFTS = 50;

export const draftKindLabels: Record<DraftKind, string> = {
  invoice: "Invoice",
  quotation: "Quotation",
  "sales-order": "Sales Order",
};

function readAll(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is Draft =>
        !!d && typeof d.id === "string" && typeof d.kind === "string" && !!d.data,
    );
  } catch {
    // Corrupted storage should never break the app.
    return [];
  }
}

function writeAll(drafts: Draft[]) {
  if (typeof window === "undefined") return;
  const trimmed = [...drafts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_DRAFTS);
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(trimmed));
  } catch {
    // Quota exceeded: drop the oldest half and retry once.
    try {
      window.localStorage.setItem(
        storageKey(),
        JSON.stringify(trimmed.slice(0, Math.ceil(trimmed.length / 2))),
      );
    } catch {
      /* give up silently — drafts are best-effort */
    }
  }
  window.dispatchEvent(new Event(EVENT));
}

export function listDrafts(): Draft[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDraft(id: string): Draft | null {
  return readAll().find((d) => d.id === id) || null;
}

export function saveDraft(input: {
  id: string;
  kind: DraftKind;
  label: string;
  summary: string;
  data: Record<string, unknown>;
}): void {
  const all = readAll();
  const now = new Date().toISOString();
  const existing = all.find((d) => d.id === input.id);
  const next: Draft = {
    ...input,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  writeAll([next, ...all.filter((d) => d.id !== input.id)]);
}

export function deleteDraft(id: string): void {
  const all = readAll();
  if (!all.some((d) => d.id === id)) return;
  writeAll(all.filter((d) => d.id !== id));
}

export function clearDrafts(): void {
  writeAll([]);
}

/** Subscribe to draft changes (same tab + other tabs). */
export function subscribeDrafts(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === storageKey()) cb();
  };
  const unsubScope = subscribeStorageScope(cb);
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    unsubScope();
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
