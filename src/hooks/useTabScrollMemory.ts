import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const KEY = "tab-scroll-v1";

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

/**
 * Remembers the scroll position of every visited route so re-opening a tab
 * resumes exactly where the user left off.
 */
export function useTabScrollMemory() {
  const location = useLocation();
  const navType = useNavigationType();
  const path = location.pathname;

  // Save continuously while on the page (and on unmount / route change).
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setTabScroll(path, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      setTabScroll(path, window.scrollY);
    };
  }, [path]);

  // Restore on entering the route.
  useEffect(() => {
    const y = getTabScroll(path);
    if (navType === "PUSH" && y === 0) return;
    let tries = 0;
    const tick = () => {
      window.scrollTo(0, y);
      if (++tries < 8) window.setTimeout(tick, 60);
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
