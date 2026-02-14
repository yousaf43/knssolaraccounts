import { Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const inventory = [
  { id: "1", name: "Laptop - Dell XPS 15", sku: "LAP-001", qty: 12, reorderLevel: 5, price: 1299, category: "Electronics" },
  { id: "2", name: "Wireless Mouse", sku: "ACC-002", qty: 45, reorderLevel: 20, price: 29, category: "Accessories" },
  { id: "3", name: "USB-C Hub", sku: "ACC-003", qty: 3, reorderLevel: 10, price: 59, category: "Accessories" },
  { id: "4", name: "Monitor - LG 27\"", sku: "MON-001", qty: 8, reorderLevel: 5, price: 449, category: "Electronics" },
  { id: "5", name: "Keyboard Mechanical", sku: "ACC-004", qty: 2, reorderLevel: 10, price: 89, category: "Accessories" },
  { id: "6", name: "Office Chair", sku: "FUR-001", qty: 15, reorderLevel: 5, price: 350, category: "Furniture" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

export default function Inventory() {
  const lowStock = inventory.filter((i) => i.qty <= i.reorderLevel);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Stock management and alerts</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{lowStock.length} items</span> are below reorder level:{" "}
            {lowStock.map((i) => i.name).join(", ")}
          </p>
        </div>
      )}

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.sku}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                <td className="px-4 py-3 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.price)}</td>
                <td className="px-4 py-3 text-center">
                  {item.qty <= item.reorderLevel ? (
                    <Badge className="bg-destructive/10 text-destructive border-0">Low Stock</Badge>
                  ) : (
                    <Badge className="bg-success/10 text-success border-0">In Stock</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
