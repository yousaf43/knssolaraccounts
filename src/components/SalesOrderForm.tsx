import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { SalesOrder, InvoiceItem, Customer, InventoryItem } from "@/data/mockData";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount);
}

type Props = {
  customers: Customer[];
  inventory: InventoryItem[];
  onSave: (order: SalesOrder) => void;
  onCancel: () => void;
  editOrder?: SalesOrder | null;
  nextNumber: string;
};

export function SalesOrderForm({ customers, inventory, onSave, onCancel, editOrder, nextNumber }: Props) {
  const [customer, setCustomer] = useState(editOrder?.customer || "");
  const [date, setDate] = useState(editOrder?.date || new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState(editOrder?.deliveryDate || "");
  const [status, setStatus] = useState<SalesOrder["status"]>(editOrder?.status || "pending");
  const [tax, setTax] = useState(editOrder?.tax ?? 10);
  const [notes, setNotes] = useState(editOrder?.notes || "");
  const [items, setItems] = useState<InvoiceItem[]>(
    editOrder?.items || [{ description: "", qty: 1, rate: 0, amount: 0 }]
  );

  // Advance payment
  const [showAdvance, setShowAdvance] = useState(!!(editOrder?.advancePayment && editOrder.advancePayment > 0));
  const [advancePayment, setAdvancePayment] = useState(editOrder?.advancePayment ?? 0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState(editOrder?.advancePaymentMethod || "cash");
  const [advancePaymentRef, setAdvancePaymentRef] = useState(editOrder?.advancePaymentRef || "");

  const selectInventoryItem = (index: number, itemId: string) => {
    const invItem = inventory.find((i) => i.id === itemId);
    if (!invItem) return;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        inventoryItemId: itemId,
        description: invItem.name,
        rate: invItem.salePrice || invItem.price,
        amount: (updated[index].qty || 1) * (invItem.salePrice || invItem.price),
      };
      return updated;
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "qty" || field === "rate") item.amount = Number(item.qty) * Number(item.rate);
      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { description: "", qty: 1, rate: 0, amount: 0 }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (tax / 100);
  const total = subtotal + taxAmount;

  const getRemainingStock = (itemId?: string) => {
    if (!itemId) return null;
    const invItem = inventory.find((i) => i.id === itemId);
    if (!invItem) return null;
    // Subtract qty already used in other lines for the same item
    const usedInOtherLines = items.reduce((sum, lineItem) => {
      if (lineItem.inventoryItemId === itemId) return sum + (lineItem.qty || 0);
      return sum;
    }, 0);
    return invItem.qty - usedInOtherLines;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim() || !date || !deliveryDate) return;
    const validItems = items.filter((i) => i.description.trim() && i.qty > 0 && i.rate > 0);
    if (validItems.length === 0) return;

    onSave({
      id: editOrder?.id || crypto.randomUUID(),
      number: editOrder?.number || nextNumber,
      customer: customer.trim(),
      date,
      deliveryDate,
      amount: total,
      status,
      items: validItems,
      notes: notes.trim(),
      tax,
      advancePayment: showAdvance ? advancePayment : 0,
      advancePaymentMethod: showAdvance ? advancePaymentMethod : undefined,
      advancePaymentRef: showAdvance ? advancePaymentRef.trim() : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{editOrder ? "Edit Sales Order" : "New Sales Order"}</h2>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}><X className="w-5 h-5" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Order Number</Label>
          <Input value={editOrder?.number || nextNumber} disabled className="mt-1" />
        </div>
        <div>
          <Label>Customer *</Label>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => (<SelectItem key={c.id} value={c.company}>{c.company}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Order Date *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Delivery Date *</Label>
          <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as SalesOrder["status"])}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tax Rate (%)</Label>
          <Input type="number" min={0} max={100} value={tax} onChange={(e) => setTax(Number(e.target.value))} className="mt-1" />
        </div>
      </div>

      {/* Line Items with Inventory Dropdown */}
      <div>
        <Label className="mb-2 block">Line Items (from Inventory)</Label>
        <div className="bg-muted/30 rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[220px]">Product</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Qty</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">Stock</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Rate</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Amount</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const remaining = getRemainingStock(item.inventoryItemId);
                const stockWarning = remaining !== null && remaining < 0;
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Select
                        value={item.inventoryItemId || ""}
                        onValueChange={(v) => selectInventoryItem(i, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              <span className="flex items-center gap-2">
                                {inv.name}
                                <span className="text-muted-foreground text-xs">({inv.qty} {inv.unit})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description" className="h-8" required />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={1} value={item.qty} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} className="h-8 text-right" required />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {remaining !== null ? (
                        <Badge variant={stockWarning ? "destructive" : "secondary"} className="text-xs">
                          {remaining + item.qty} left
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} step={0.01} value={item.rate} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} className="h-8 text-right" required />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                    <td className="px-2 py-2">{items.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1" /> Add Line</Button>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax ({tax}%)</span><span className="font-medium">{formatCurrency(taxAmount)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
        </div>
      </div>

      {/* Advance Payment */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-primary" />
            <Label className="font-medium">Advance Payment</Label>
          </div>
          <Switch checked={showAdvance} onCheckedChange={setShowAdvance} />
        </div>
        {showAdvance && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <Label>Amount</Label>
              <Input type="number" min={0} max={total} step={0.01} value={advancePayment} onChange={(e) => setAdvancePayment(Number(e.target.value))} className="mt-1" />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={advancePaymentMethod} onValueChange={setAdvancePaymentMethod}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={advancePaymentRef} onChange={(e) => setAdvancePaymentRef(e.target.value)} placeholder="Txn ref / cheque #" className="mt-1" />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions..." className="mt-1" maxLength={500} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{editOrder ? "Update Order" : "Create Order"}</Button>
      </div>
    </form>
  );
}
