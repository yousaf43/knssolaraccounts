import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/data/mockData";
import { cn } from "@/lib/utils";

type Props = {
  customers: Customer[];
  selectedName?: string;
  onSelect: (name: string) => void;
  placeholder?: string;
};

export function CustomerCombobox({ customers, selectedName, onSelect, placeholder = "Search customer..." }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = selectedName ? customers.find((c) => c.name === selectedName) : null;

  const filtered = search
    ? customers.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.company || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q)
        );
      })
    : customers;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    onSelect(name);
    setSearch("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={open ? search : (selected ? `${selected.name}${selected.company ? ` (${selected.company})` : ""}` : search)}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected ? selected.name : placeholder}
          className="pl-8"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-[280px] overflow-y-auto bg-popover border rounded-md shadow-md">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">No customers found</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.name)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2 transition-colors",
                  selectedName === c.name && "bg-accent"
                )}
              >
                <span className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{c.name}</span>
                  {c.company && <span className="text-xs text-muted-foreground truncate">{c.company}</span>}
                </span>
                {c.phone && <span className="text-xs text-muted-foreground shrink-0">{c.phone}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
