import { ReactNode, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Full-mode content shown under the title (typically a full <TabsList/>). */
  tabsFull?: ReactNode;
  /** Compact-mode content shown inline with the title (typically a pill <TabsList/>). */
  tabsCompact?: ReactNode;
  /** Right-aligned action buttons for expanded (full) mode. */
  actionsFull?: ReactNode;
  /** Right-aligned action buttons for compact mode. */
  actionsCompact?: ReactNode;
  /** Extra content rendered below tabsFull only when expanded (e.g. filter bar). */
  extraFull?: ReactNode;
  /** Force compact mode regardless of scroll position. */
  forceCompact?: boolean;
};

/**
 * Shared sticky page header used across Sales, Inventory, Store, Accounts and
 * Purchases pages. Collapses into a compact single-row toolbar on scroll with
 * hysteresis (compress > 40px, expand < 10px) to avoid layout thrash.
 */
export function StickyPageHeader({
  icon: Icon,
  title,
  subtitle,
  tabsFull,
  tabsCompact,
  actionsFull,
  actionsCompact,
  extraFull,
  forceCompact = false,
}: Props) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    // Use a sentinel + IntersectionObserver so the compact/full switch is
    // driven by a fixed point in the document rather than live scrollTop.
    // Scroll-position toggles flicker at the threshold because the header
    // height changes when it compacts, which shifts scrollTop and re-crosses
    // the boundary. A sentinel avoids that feedback loop.
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;width:1px;height:48px;pointer-events:none;visibility:hidden;";

    const scrollEl = document.getElementById("main-scroll");
    const host = scrollEl ?? document.body;
    const hadInlinePosition = host.style.position !== "";
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    host.prepend(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { root: scrollEl ?? null, threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
      if (!hadInlinePosition) host.style.removeProperty("position");
    };
  }, []);


  const compact = forceCompact || isScrolled;

  return (
    <div
      className={`sticky top-14 sm:top-16 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 transition-all duration-300 ease-out ${
        compact
          ? "bg-background/75 backdrop-blur-xl py-2 border-b border-border/60 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.15)]"
          : "bg-background pt-3 sm:pt-6 pb-3 space-y-4 border-b"
      }`}
    >
      {compact ? (
        <div className="flex items-center gap-2 flex-nowrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-sm">
              <Icon className="w-3 h-3" />
            </div>
            <span className="text-sm font-semibold tracking-tight hidden sm:inline">{title}</span>
            {tabsCompact && <div className="h-5 w-px bg-border hidden sm:block ml-1" />}
          </div>
          {tabsCompact}
          {(actionsCompact || actionsFull) && (
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {actionsCompact ?? actionsFull}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-bold text-2xl truncate">{title}</h1>
              {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
            </div>
            {actionsFull && <div className="flex items-center gap-2 flex-shrink-0">{actionsFull}</div>}
          </div>
          {tabsFull}
          {extraFull}
        </>
      )}
    </div>
  );
}
