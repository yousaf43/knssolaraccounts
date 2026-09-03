import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { scopedKey } from "@/lib/storageScope";

const KEY_BASE = "tab-scroll-v1";

type ScrollMap = Record<string, number>;

function read(): ScrollMap {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") as ScrollMap;
  } catch {
    return {};
  }
}

function write(map: ScrollMap) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getTabScroll(path: string): number {
  return read()[path] ?? 0;
}

export function setTabScroll(path: string, y: number) {
  const map = read();
  map[path] = y;
  write(map);
}

function scroller(): HTMLElement | null {
  const el = document.getElementById("main-scroll");
  if (el && el.scrollHeight > el.clientHeight + 4) return el;
  return null;
}

function currentY() {
  const el = scroller();
  return el ? el.scrollTop : window.scrollY;
}

function scrollToY(y: number) {
  const el = scroller();
  if (el) el.scrollTop = y;
  window.scrollTo(0, y);
}

/**
 * Remembers the scroll position of every visited route so re-opening a tab
 * resumes exactly where the user left off. Restoration keeps retrying while
 * async data is still growing the page, and saving is paused meanwhile so an
 * empty page can't overwrite the remembered position.
 */
export function useTabScrollMemory() {
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const target = getTabScroll(path);
    let restoring = target > 0;
    let raf = 0;

    const onScroll = () => {
      if (restoring) return;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setTabScroll(path, currentY());
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const main = document.getElementById("main-scroll");
    main?.addEventListener("scroll", onScroll, { passive: true });

    // Any deliberate user gesture ends the restore phase immediately.
    const stopRestoring = () => {
      restoring = false;
    };
    window.addEventListener("wheel", stopRestoring, { passive: true });
    window.addEventListener("touchstart", stopRestoring, { passive: true });
    window.addEventListener("keydown", stopRestoring);

    let timer = 0;
    const deadline = Date.now() + 6000;
    const tick = () => {
      if (!restoring) return;
      scrollToY(target);
      if (Math.abs(currentY() - target) < 2 || Date.now() > deadline) {
        // Reached (or gave up) — keep nudging briefly, then resume saving.
        window.setTimeout(() => {
          restoring = false;
        }, 400);
        if (Date.now() > deadline) restoring = false;
        return;
      }
      timer = window.setTimeout(tick, 120);
    };
    if (restoring) tick();

    return () => {
      window.removeEventListener("scroll", onScroll);
      main?.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", stopRestoring);
      window.removeEventListener("touchstart", stopRestoring);
      window.removeEventListener("keydown", stopRestoring);
      window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
      const y = currentY();
      if (!restoring || y > 0) setTabScroll(path, y);
    };
  }, [path]);
}
