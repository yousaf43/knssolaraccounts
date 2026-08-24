import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const KEY = "tab-state-v1";

type FieldMap = Record<string, string>;
type Saved = { fields: FieldMap; tabs: FieldMap };
type StateMap = Record<string, Saved>;

function read(): StateMap {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") as StateMap;
  } catch {
    return {};
  }
}

function write(map: StateMap) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Stable-ish identifier for an element within the page. */
function keyFor(el: Element, index: number) {
  const e = el as HTMLInputElement;
  const parts = [
    el.tagName.toLowerCase(),
    e.name || "",
    e.id || "",
    e.getAttribute("placeholder") || "",
    e.getAttribute("type") || "",
    e.getAttribute("aria-label") || "",
  ];
  const hasIdentity = parts.slice(1).some(Boolean);
  return hasIdentity ? parts.join("|") : `${parts.join("|")}#${index}`;
}

function isSensitive(el: Element) {
  const e = el as HTMLInputElement;
  const type = (e.getAttribute("type") || "").toLowerCase();
  return type === "password" || type === "file" || e.getAttribute("data-no-restore") === "true";
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter ? setter.call(el, value) : (el.value = value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function collect(): Saved {
  const root = document.getElementById("main-scroll") || document.body;
  const fields: FieldMap = {};
  root.querySelectorAll("input, textarea").forEach((el, i) => {
    if (isSensitive(el)) return;
    const input = el as HTMLInputElement;
    const key = keyFor(el, i);
    if (input.type === "checkbox" || input.type === "radio") {
      if (input.checked) fields[key] = "1";
    } else if (input.value) {
      fields[key] = input.value;
    }
  });

  const tabs: FieldMap = {};
  root.querySelectorAll('[role="tablist"]').forEach((list, i) => {
    const active = list.querySelector('[role="tab"][data-state="active"]') as HTMLElement | null;
    const value = active?.getAttribute("data-value") || active?.textContent?.trim();
    if (value) tabs[`tablist#${i}`] = value;
  });

  return { fields, tabs };
}

function isEmpty(s: Saved) {
  return Object.keys(s.fields).length === 0 && Object.keys(s.tabs).length === 0;
}

/** Merge so a not-yet-rendered field never loses its remembered value. */
function merge(prev: Saved | undefined, next: Saved): Saved {
  if (!prev) return next;
  return {
    fields: { ...prev.fields, ...next.fields },
    tabs: { ...prev.tabs, ...next.tabs },
  };
}

function restore(saved: Saved) {
  const root = document.getElementById("main-scroll") || document.body;

  // Restore the open tab/section first, then the fields inside it.
  root.querySelectorAll('[role="tablist"]').forEach((list, i) => {
    const want = saved.tabs?.[`tablist#${i}`];
    if (!want) return;
    const current = list.querySelector('[role="tab"][data-state="active"]') as HTMLElement | null;
    const currentVal = current?.getAttribute("data-value") || current?.textContent?.trim();
    if (currentVal === want) return;
    const target = Array.from(list.querySelectorAll('[role="tab"]')).find(
      (t) => (t.getAttribute("data-value") || t.textContent?.trim()) === want
    ) as HTMLElement | undefined;
    target?.click();
  });

  root.querySelectorAll("input, textarea").forEach((el, i) => {
    if (isSensitive(el)) return;
    const input = el as HTMLInputElement;
    const key = keyFor(el, i);
    const value = saved.fields?.[key];
    if (input.type === "checkbox" || input.type === "radio") {
      const want = value === "1";
      if (input.checked !== want && want) input.click();
      return;
    }
    if (value === undefined) return;
    if (input.value !== value && document.activeElement !== input) {
      setNativeValue(input as HTMLInputElement, value);
    }
  });
}

/**
 * Remembers what the user was doing on every route: typed text, filters,
 * checkboxes and the open tab/section — so re-opening a tab resumes the work.
 */
export function useTabStateMemory() {
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    const saved = read()[path];
    let restoring = !!saved && !isEmpty(saved);
    let saveTimer = 0;
    let restoreTimer = 0;

    const flush = () => {
      const map = read();
      const next = collect();
      // Never let an empty/half-rendered page erase what was remembered.
      map[path] = isEmpty(next) ? map[path] || next : merge(map[path], next);
      write(map);
    };

    const save = () => {
      if (restoring) return;
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(flush, 300);
    };

    document.addEventListener("input", save, true);
    document.addEventListener("change", save, true);
    document.addEventListener("click", save, true);

    // Keep re-applying while the route's async data renders more controls.
    if (restoring && saved) {
      const deadline = Date.now() + 6000;
      const tick = () => {
        restore(saved);
        if (Date.now() < deadline) {
          restoreTimer = window.setTimeout(tick, 250);
        } else {
          restoring = false;
        }
      };
      restoreTimer = window.setTimeout(tick, 100);
      // A real user interaction ends the restore phase early.
      const stop = () => {
        restoring = false;
        window.clearTimeout(restoreTimer);
      };
      document.addEventListener("pointerdown", stop, { once: true, capture: true });
      document.addEventListener("keydown", stop, { once: true, capture: true });
    }

    return () => {
      window.clearTimeout(saveTimer);
      window.clearTimeout(restoreTimer);
      document.removeEventListener("input", save, true);
      document.removeEventListener("change", save, true);
      document.removeEventListener("click", save, true);
      flush();
    };
  }, [path]);
}
