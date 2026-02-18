import { useState } from "react";
import type { InventoryItem, StockAdjustment } from "@/data/mockData";
import { useStockAdjustmentsCloud } from "@/hooks/useAppData";
import { Plus, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ADJUSTMENT_REASONS = [
  "Damaged", "Returned", "Correction", "Theft/Loss",
  "Expired", "Found", "Transfer In", "Transfer Out", "Other",
];

interface StockAdjustmentSectionProps {
  inventory: InventoryItem[];
  onUpdateInventory: (updater: (prev: InventoryItem[]) => InventoryItem[]) => void;
}

export default function StockAdjustmentSection({ inventory, onUpdateInventory }: StockAdjustmentSectionProps) {
  const { data: adjustments, upsert } = useStockAdjustmentsCloud();
  const [showForm, setShowForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [type, setType] = useState<"increase" | "decrease">("increase");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const resetForm = () => {
    setSelectedItemId(""); setType("increase"); setQty(0); setReason(""); setNote("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !reason || qty <= 0) { toast.error("Please fill all required fields"); return; }
    const item = inventory.find((i) => i.id === selectedItemId);
    if (!item) return;
    if (type === "decrease" && qty > item.qty) {
      toast.error(`Cannot decrease by ${qty}. Current stock is ${item.qty}.`); return;
    }
    const adjustment: StockAdjustment = {
      id: crypto.randomUUID(), itemId: selectedItemId, itemName: item.name,
      type, qty, reason, date: new Date().toISOString().split("T")[0], note: note || undefined,
    };
    await upsert(adjustment);
    onUpdateInventory((prev) =>
      prev.map((i) => i.id === selectedItemId
        ? { ...i, qty: type === "increase" ? i.qty + qty : i.qty - qty }
        : i)
    );
    toast.success(`Stock ${type === "increase" ? "increased" : "decreased"} by ${qty} for ${item.name}`);
    resetForm();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Stock Adjustment</h2>
          <p className="text-muted-foreground text-sm">Manually adjust stock quantities</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Adjustment
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Record Adjustment</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Item *</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} (Qty: {item.qty})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as "increase" | "decrease")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Increase</SelectItem>
                  <SelectItem value="decrease">Decrease</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min={1} value={qty || ""} onChange={(e) => setQty(Number(e.target.value))} className="mt-1" required />
            </div>
            <div>
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" placeholder="Additional details..." maxLength={200} />
            </div>
            <div className="md:col-span-3 flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Save Adjustment</Button>
            </div>
          </form>
        </div>
      )}

      {adjustments.length > 0 && (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Item</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-right px-3 py-3 font-medium text-muted-foreground">Qty / Price Change</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Reason</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.slice(0, 20).map((adj) => (
                <tr key={adj.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground">{adj.date}</td>
                  <td className="px-3 py-3 font-medium">{adj.itemName}</td>
                  <td className="px-3 py-3 text-center">
                    {adj.type === "increase" ? (
                      <Badge className="bg-success/10 text-success border-0"><ArrowUp className="w-3 h-3 mr-1" />Increase</Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive border-0"><ArrowDown className="w-3 h-3 mr-1" />Decrease</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {adj.reason === "Price Update" ? (
                      <span className="text-xs text-warning font-medium">Price Update</span>
                    ) : (
                      <span>{adj.qty}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{adj.reason}</td>
                  <td className="px-3 py-3 text-muted-foreground">{adj.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustments.length === 0 && !showForm && (
        <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground text-sm">
          No stock adjustments recorded yet.
        </div>
      )}
    </div>
  );
}
