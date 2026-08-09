import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  deleteDraft,
  listDrafts,
  saveDraft,
  subscribeDrafts,
  type Draft,
  type DraftKind,
} from "@/lib/drafts";

type Options<T extends Record<string, unknown>> = {
  id: string;
  kind: DraftKind;
  label: string;
  summary: string;
  data: T;
  /** Skip saving when the form is still untouched / empty. */
  isEmpty: boolean;
  /** Disable autosave entirely (e.g. after a successful save). */
  enabled?: boolean;
};

/**
 * Debounced autosave of a form's state into the local draft store.
 * Returns `discard` so callers can drop the draft once the document is saved
 * or explicitly abandoned.
 */
export function useFormDraft<T extends Record<string, unknown>>({
  id,
  kind,
  label,
  summary,
  data,
  isEmpty,
  enabled = true,
}: Options<T>) {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const discardedRef = useRef(false);
  // Keep the latest meta/data in a ref so the flush-on-unload handler is cheap.
  const latest = useRef({ id, kind, label, summary, data, isEmpty, enabled });
  latest.current = { id, kind, label, summary, data, isEmpty, enabled };

  const serialized = JSON.stringify(data);

  const flush = useCallback(() => {
    const cur = latest.current;
    if (!cur.enabled || cur.isEmpty || discardedRef.current) return;
    saveDraft({
      id: cur.id,
      kind: cur.kind,
      label: cur.label,
      summary: cur.summary,
      data: cur.data,
    });
    setSavedAt(new Date().toISOString());
  }, []);

  // Debounced save on every change.
  useEffect(() => {
    if (!enabled || isEmpty || discardedRef.current) return;
    const t = window.setTimeout(flush, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, isEmpty, flush]);

  // Save immediately if the tab is closed/hidden mid-edit.
  useEffect(() => {
    const onLeave = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush]);

  const discard = useCallback(() => {
    discardedRef.current = true;
    deleteDraft(latest.current.id);
    setSavedAt(null);
  }, []);

  return { savedAt, discard, flush };
}

/** Reactive list of all stored drafts. */
export function useDrafts(): Draft[] {
  const [snapshot, setSnapshot] = useState<Draft[]>(() => listDrafts());
  useEffect(() => subscribeDrafts(() => setSnapshot(listDrafts())), []);
  return snapshot;
}
