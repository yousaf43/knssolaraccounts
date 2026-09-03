import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { scopedKey, subscribeStorageScope } from "@/lib/storageScope";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/invoices": "Invoices",
  "/customers": "Customers",
  "/purchases": "Purchases",
  "/expenses": "Expenses",
  "/inventory": "Inventory",
  "/store-inventory": "Store Inventory",
  "/accounts": "Accounts",
  "/assets": "Assets",
  "/reports": "Reports",
  "/solar-washing": "Solar Washing",
  "/activity-logs": "Activity Logs",
  "/trash": "Trash",
  "/settings": "Settings",
};

const STORAGE_BASE = "recent-tabs-v1";
const storageKey = () => scopedKey(STORAGE_BASE);
const MAX_TABS = 10;

type Tab = { path: string; title: string };

function loadTabs(): Tab[] {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [{ path: "/", title: "Dashboard" }];
    const parsed = JSON.parse(raw) as Tab[];
    if (!Array.isArray(parsed) || parsed.length === 0)
      return [{ path: "/", title: "Dashboard" }];
    return parsed;
  } catch {
    return [{ path: "/", title: "Dashboard" }];
  }
}

export function RecentTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<Tab[]>(() => loadTabs());

  // Reload tabs when the signed-in account (scope) changes.
  useEffect(() => subscribeStorageScope(() => setTabs(loadTabs())), []);

  const currentPath = location.pathname;
  const knownTitle = ROUTE_TITLES[currentPath];

  useEffect(() => {
    if (!knownTitle) return; // only track known app routes
    setTabs((prev) => {
      if (prev.some((t) => t.path === currentPath)) return prev;
      const next = [...prev, { path: currentPath, title: knownTitle }];
      return next.slice(-MAX_TABS);
    });
  }, [currentPath, knownTitle]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(tabs));
    } catch {
      /* ignore */
    }
  }, [tabs]);

  const closeTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (path === "/") return; // Home tab is pinned
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.path !== path);
      if (path === currentPath) {
        const fallback = next[idx - 1] ?? next[0] ?? { path: "/", title: "Dashboard" };
        navigate(fallback.path);
      }
      return next.length ? next : [{ path: "/", title: "Dashboard" }];
    });
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b bg-muted/30 px-2 sm:px-4 h-9 flex-shrink-0">
      {tabs.map((tab) => {
        const active = tab.path === currentPath;
        const isHome = tab.path === "/";
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "group flex items-center gap-1.5 px-2.5 h-7 rounded-t-md text-xs font-medium border border-b-0 transition-colors flex-shrink-0 -mb-px",
              active
                ? "bg-background border-border text-foreground"
                : "bg-transparent border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            {isHome && <Home className="w-3 h-3" />}
            <span className="whitespace-nowrap">{tab.title}</span>
            {!isHome && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => closeTab(e, tab.path)}
                className="ml-0.5 rounded-sm p-0.5 opacity-60 hover:opacity-100 hover:bg-muted"
                aria-label={`Close ${tab.title}`}
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
