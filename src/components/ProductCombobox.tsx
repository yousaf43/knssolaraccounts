import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HighlightText } from "@/components/HighlightText";
import type { InventoryItem } from "@/data/mockData";
import { cn } from "@/lib/utils";


type Props = {
  inventory: InventoryItem[];
  selectedItemId?: string;
  onSelect: (itemId: string) => void;
};

export function ProductCombobox({ inventory, selectedItemId, onSelect }: Props) {
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
          inv.category.toLowerCase().includes(q) ||
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

  const handleSelect = (id: string) => {
    onSelect(id);
    setSearch("");
    setOpen(false);
  };

  const getTypeLabel = (item: InventoryItem) => {
    if (item.productType === "non-stock") return "Non-Stock";
    if (item.productType === "bundle") return "Bundle";
    return null;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selectedItem ? selectedItem.name : "Search product..."}
          className="h-8 text-xs pl-7"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-[360px] min-w-full max-h-[320px] overflow-y-auto bg-popover border rounded-md shadow-md">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">No products found</div>
          ) : (
            filtered.map((inv) => {
              const typeLabel = getTypeLabel(inv);
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => handleSelect(inv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between gap-2 transition-colors",
                    selectedItemId === inv.id && "bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">
                      <HighlightText text={inv.name} query={search} />
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      (<HighlightText text={inv.sku} query={search} />)
                    </span>
                    {inv.model && (
                      <span className="text-muted-foreground text-[10px] shrink-0">
                        <HighlightText text={inv.model} query={search} />
                      </span>
                    )}
                    {inv.category && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                        <HighlightText text={inv.category} query={search} />
                      </Badge>
                    )}
                    {typeLabel && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{typeLabel}</Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {inv.productType === "non-stock" ? "∞" : `${inv.qty} ${inv.unit}`}
                  </span>

                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
