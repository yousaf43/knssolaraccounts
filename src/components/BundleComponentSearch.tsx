import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/data/mockData";

type Props = {
  inventory: InventoryItem[];
  selectedItemId?: string;
  onSelect: (itemId: string) => void;
};

export function BundleComponentSearch({ inventory, selectedItemId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = selectedItemId ? inventory.find((i) => i.id === selectedItemId) : null;

  const filtered = search
    ? inventory.filter((inv) => {
        const q = search.toLowerCase();
        return (
          inv.name.toLowerCase().includes(q) ||
          inv.sku.toLowerCase().includes(q) ||
          (inv.model || "").toLowerCase().includes(q) ||
          (inv.uniqueCode || "").toLowerCase().includes(q)
        );
      })
    : inventory;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selectedItem ? `${selectedItem.name} (${selectedItem.sku})` : "Search component product..."}
          className="h-8 text-xs pl-7"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-[400px] min-w-full max-h-[280px] overflow-y-auto bg-popover border rounded-md shadow-md">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">No products found</div>
          ) : (
            filtered.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => { onSelect(inv.id); setSearch(""); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between gap-2 transition-colors",
                  selectedItemId === inv.id && "bg-accent"
                )}
              >
                <span className="font-medium truncate">{inv.name}</span>
                <span className="text-muted-foreground shrink-0">({inv.sku})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
