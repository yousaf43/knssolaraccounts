import { useState } from "react";
import { Package, Box, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ProductCombobox } from "@/components/ProductCombobox";
import { HighlightText } from "@/components/HighlightText";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/data/mockData";

export type AdhocBundleLine = {
  itemId: string;
  qty: number;
  rate: number;
};

type Props = {
  inventory: InventoryItem[];
  selectedItemId?: string;
  onSelect: (itemId: string) => void;
  onBundleSelect: (lines: AdhocBundleLine[]) => void;
  hidePrices?: boolean;
};

export function ProductPickerWithBundle({ inventory, selectedItemId, onSelect, onBundleSelect, hidePrices }: Props) {
  const { formatCurrency } = useSettings();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [mode, setMode] = useState<"idle" | "single" | "bundle">("idle");
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleLines, setBundleLines] = useState<AdhocBundleLine[]>([]);
  const [search, setSearch] = useState("");

  const openChooser = () => {
    if (selectedItemId) return; // already selected → show as-is
    setChooserOpen(true);
  };

  const chooseSingle = () => {
    setChooserOpen(false);
    setMode("single");
  };

  const chooseBundle = () => {
    setChooserOpen(false);
    setBundleLines([]);
    setSearch("");
    setBundleOpen(true);
  };

  const filtered = search.trim()
    ? inventory.filter((inv) => {
        const q = search.toLowerCase();
        return (
          inv.name.toLowerCase().includes(q) ||
          (inv.sku || "").toLowerCase().includes(q) ||
          (inv.model || "").toLowerCase().includes(q) ||
          (inv.category || "").toLowerCase().includes(q)
        );
      })
    : inventory.slice(0, 30);

  const addToBundle = (inv: InventoryItem) => {
    setBundleLines((prev) => {
      if (prev.some((l) => l.itemId === inv.id)) return prev;
      return [...prev, { itemId: inv.id, qty: 1, rate: inv.salePrice || inv.price || 0 }];
    });
  };

  const updateBundleLine = (itemId: string, field: "qty" | "rate", value: number) => {
    setBundleLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, [field]: value } : l)));
  };

  const removeBundleLine = (itemId: string) => {
    setBundleLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const bundleTotal = bundleLines.reduce((sum, l) => sum + l.qty * l.rate, 0);

  const confirmBundle = () => {
    if (bundleLines.length === 0) return;
    onBundleSelect(bundleLines);
    setBundleOpen(false);
    setBundleLines([]);
    setMode("idle");
  };

  // If user picked "single" mode (or already has a selection) render normal combobox
  if (mode === "single" || selectedItemId) {
    return (
      <ProductCombobox
        inventory={inventory}
        selectedItemId={selectedItemId}
        onSelect={(id) => {
          onSelect(id);
          setMode("single");
        }}
      />
    );
  }

  return (
    <>
      {/* Trigger button that mimics the combobox input */}
      <button
        type="button"
        onClick={openChooser}
        className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-2 text-xs text-left text-muted-foreground hover:bg-accent transition-colors relative"
      >
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        Search product...
      </button>

      {/* Mode chooser dialog */}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose product type</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={chooseSingle}
              className="flex flex-col items-center gap-2 p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all"
            >
              <Box className="w-8 h-8 text-primary" />
              <span className="font-medium text-sm">Single Product</span>
              <span className="text-[11px] text-muted-foreground text-center">Pick one product from inventory</span>
            </button>
            <button
              type="button"
              onClick={chooseBundle}
              className="flex flex-col items-center gap-2 p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all"
            >
              <Package className="w-8 h-8 text-primary" />
              <span className="font-medium text-sm">Bundle Product</span>
              <span className="text-[11px] text-muted-foreground text-center">Combine multiple products on the spot</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bundle builder dialog */}
      <Dialog open={bundleOpen} onOpenChange={setBundleOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Build Custom Bundle
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Search + add */}
            <div>
              <Label className="text-xs">Add products to bundle</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, SKU, model or category..."
                  className="pl-8 h-9"
                  autoFocus
                />
              </div>
              <div className="mt-2 max-h-52 overflow-y-auto border rounded-md">
                {filtered.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">No products found</div>
                ) : (
                  filtered.map((inv) => {
                    const already = bundleLines.some((l) => l.itemId === inv.id);
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        disabled={already}
                        onClick={() => addToBundle(inv)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 border-b last:border-0",
                          already ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"
                        )}
                      >
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium truncate">
                            <HighlightText text={inv.name} query={search} />
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            <HighlightText text={inv.sku || ""} query={search} />
                            {inv.category ? ` • ${inv.category}` : ""}
                          </span>
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {already ? "Added" : <Plus className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected components */}
            <div>
              <Label className="text-xs">Bundle Components ({bundleLines.length})</Label>
              {bundleLines.length === 0 ? (
                <div className="mt-1 p-6 text-center text-xs text-muted-foreground border rounded-md border-dashed">
                  No components added yet. Pick products from the list above.
                </div>
              ) : (
                <div className="mt-1 border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Product</th>
                        <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
                        {!hidePrices && <th className="text-right px-3 py-2 font-medium w-28">Rate</th>}
                        {!hidePrices && <th className="text-right px-3 py-2 font-medium w-28">Amount</th>}
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundleLines.map((line) => {
                        const inv = inventory.find((i) => i.id === line.itemId);
                        if (!inv) return null;
                        return (
                          <tr key={line.itemId} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium">{inv.name}</div>
                              <div className="text-muted-foreground text-[10px]">{inv.sku}</div>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={1}
                                value={line.qty}
                                onChange={(e) => updateBundleLine(line.itemId, "qty", Number(e.target.value))}
                                className="h-7 text-right text-xs"
                              />
                            </td>
                            {!hidePrices && (
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={line.rate}
                                  onChange={(e) => updateBundleLine(line.itemId, "rate", Number(e.target.value))}
                                  className="h-7 text-right text-xs"
                                />
                              </td>
                            )}
                            {!hidePrices && (
                              <td className="px-3 py-2 text-right font-medium">
                                {formatCurrency(line.qty * line.rate)}
                              </td>
                            )}
                            <td className="px-2 py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeBundleLine(line.itemId)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {!hidePrices && (
                      <tfoot>
                        <tr className="bg-muted/40 border-t font-semibold">
                          <td className="px-3 py-2 text-right" colSpan={3}>Bundle Total</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(bundleTotal)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setBundleOpen(false)}>Cancel</Button>
            <Button type="button" onClick={confirmBundle} disabled={bundleLines.length === 0}>
              Add {bundleLines.length > 0 ? `${bundleLines.length} ` : ""}Line{bundleLines.length !== 1 ? "s" : ""} to Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
