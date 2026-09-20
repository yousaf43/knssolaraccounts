import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Home, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { scopedKey, subscribeStorageScope } from "@/lib/storageScope";
import { Button } from "@/components/ui/button";

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
  "/hr": "HR",
  "/solar-washing": "Solar Washing & Complaints",
  "/drafts": "Drafts",
  "/activity-logs": "Activity Logs",
  "/trash": "Trash",
  "/settings": "Settings",
  "/platform-admin": "Platform Admin",
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
    <div className="recent-tabs relative flex h-10 flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-border/70 bg-background/65 px-2 backdrop-blur-md sm:px-4">
      <div className="tab-motion-mark flex h-6 w-6 flex-none items-center justify-center text-primary" aria-hidden="true">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      {tabs.map((tab, index) => {
        const active = tab.path === currentPath;
        const isHome = tab.path === "/";
        return (
          <Button
            key={tab.path}
            type="button"
            variant="ghost"
            onClick={() => navigate(tab.path)}
            aria-current={active ? "page" : undefined}
            style={{ animationDelay: `${Math.min(index * 30, 210)}ms` }}
            className={cn(
              "recent-tab group relative h-7 flex-shrink-0 gap-1.5 overflow-hidden rounded-md border px-2.5 text-xs font-medium",
              active
                ? "is-active border-primary/35 bg-card text-foreground shadow-sm"
                : "bg-transparent border-transparent text-muted-foreground hover:border-border hover:bg-card/70 hover:text-foreground"
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
          </Button>
        );
      })}
    </div>
  );
}
