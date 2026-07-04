import { useMemo, useState } from "react";
import type { InventoryItem } from "@/data/mockData";
import { useSettings } from "@/contexts/SettingsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Boxes, AlertTriangle, Wallet, Search, Store } from "lucide-react";

type Props = { inventory: InventoryItem[] };

export default function StoreInventorySection({ inventory }: Props) {
  const { formatCurrency } = useSettings();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("__all__");

  const stats = useMemo(() => {
    const stockItems = inventory.filter((i) => i.productType !== "non-stock");
    const totalItems = inventory.length;
    const totalQty = stockItems.reduce((s, i) => s + (i.qty || 0), 0);
    const stockValue = stockItems.reduce((s, i) => s + (i.qty || 0) * (i.costPrice || 0), 0);
    const retailValue = stockItems.reduce((s, i) => s + (i.qty || 0) * (i.salePrice || 0), 0);
    const lowStock = stockItems.filter((i) => i.qty <= i.reorderLevel).length;
    const outOfStock = stockItems.filter((i) => (i.qty || 0) <= 0).length;
    const categories = new Set(inventory.map((i) => i.category).filter(Boolean)).size;
    return { totalItems, totalQty, stockValue, retailValue, lowStock, outOfStock, categories };
  }, [inventory]);

  const categories = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.category).filter(Boolean))).sort(),
    [inventory]
  );

  const filtered = useMemo(() => {
    return inventory.filter((i) => {
      if (cat !== "__all__" && i.category !== cat) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !i.name.toLowerCase().includes(s) &&
          !i.sku.toLowerCase().includes(s) &&
          !(i.model || "").toLowerCase().includes(s) &&
          !(i.uniqueCode || "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [inventory, q, cat]);

  const kpis = [
    { label: "Total Products", value: stats.totalItems, icon: Package, color: "text-primary" },
    { label: "Total Stock Qty", value: stats.totalQty.toLocaleString(), icon: Boxes, color: "text-primary" },
    { label: "Stock Value (Cost)", value: formatCurrency(stats.stockValue), icon: Wallet, color: "text-success" },
    { label: "Retail Value", value: formatCurrency(stats.retailValue), icon: Wallet, color: "text-success" },
    { label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, color: "text-destructive" },
    { label: "Out of Stock", value: stats.outOfStock, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center gap-2">
        <Store className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Store Inventory</h2>
          <p className="text-xs text-muted-foreground">Store dashboard & complete product overview</p>
        </div>
      </div>

      {/* Store Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="p-3 pb-1 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-lg font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Products by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex flex-wrap gap-2">
            {categories.map((c) => {
              const count = inventory.filter((i) => i.category === c).length;
              return (
                <Badge key={c} variant="outline" className="text-xs">
                  {c} · {count}
                </Badge>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Subheading + list */}
      <div>
        <h3 className="text-base font-semibold mb-2">Store Inventory</h3>

        <div className="bg-card rounded-lg border p-3 flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search store products..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="__all__">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Unit</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sale Price</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Stock Value</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const type = i.productType === "non-stock" ? "Non-Stock" : i.productType === "bundle" ? "Bundle" : "Stock";
                const value = (i.qty || 0) * (i.salePrice || 0);
                return (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{i.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.sku}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.category || "—"}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{type}</Badge></td>
                    <td className="px-3 py-2 text-center">{i.unit || "pcs"}</td>
                    <td className="px-3 py-2 text-right">{i.productType === "non-stock" ? "∞" : i.qty}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(i.salePrice || 0)}</td>
                    <td className="px-3 py-2 text-right">{i.productType === "non-stock" ? "—" : formatCurrency(value)}</td>
                    <td className="px-3 py-2 text-center">
                      {i.productType === "non-stock" ? (
                        <Badge className="bg-primary/10 text-primary border-0">Service</Badge>
                      ) : (i.qty || 0) <= 0 ? (
                        <Badge className="bg-destructive/10 text-destructive border-0">Out</Badge>
                      ) : i.qty <= i.reorderLevel ? (
                        <Badge className="bg-destructive/10 text-destructive border-0">Low</Badge>
                      ) : (
                        <Badge className="bg-success/10 text-success border-0">In Stock</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-muted-foreground">
                    No store products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
