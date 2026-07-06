import { ReactNode, useEffect, useRef, useState } from "react";
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
 * Purchases pages.
 *
 * Collapse detection uses an IntersectionObserver on a zero-height sentinel
 * placed just above the sticky header. This is immune to the flicker loop that
 * happens with scroll-position thresholds: when the header collapses its height
 * shrinks, the page can jump back below the "expand" threshold, and it
 * re-expands — repeating indefinitely at that scroll point. A sentinel that
 * lives OUTSIDE the sticky container has a fixed page position, so its
 * visibility doesn't change when the header resizes.
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
  const [isPinned, setIsPinned] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Header sits below the top app bar (h-14 mobile / h-16 sm+). Compensate
    // with a negative rootMargin so the sentinel is considered "off screen"
    // exactly when it slides under that top bar — i.e. the moment the sticky
    // header would start covering scrolled content.
    const topOffset = window.matchMedia("(min-width: 640px)").matches ? 64 : 56;
    const scrollRoot = document.getElementById("main-scroll") ?? null;

    const io = new IntersectionObserver(
      ([entry]) => setIsPinned(!entry.isIntersecting),
      {
        root: scrollRoot,
        rootMargin: `-${topOffset}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const compact = forceCompact || isPinned;

  return (
    <>
      {/* Zero-height sentinel: its intersection with the viewport top decides
          compact/full mode. Kept outside the sticky container so header height
          changes cannot re-toggle it. */}
      <div ref={sentinelRef} aria-hidden className="h-0 w-full" />
      <div
        className={`sticky top-14 sm:top-16 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 transition-[padding,background-color,box-shadow,border-color] duration-200 ease-out ${
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
    </>
  );
}

