import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ProductCombobox } from "@/components/ProductCombobox";
import { X, Plus, Trash2, RotateCcw, ArrowLeftRight } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { defaultAccounts, type Account } from "@/data/defaultAccounts";
import type { Invoice, InvoiceItem, InventoryItem } from "@/data/mockData";

type Props = {
  invoices: Invoice[];
  inventory: InventoryItem[];
  onSaveReturn: (data: {
    originalInvoice: Invoice;
    returnType: "return" | "exchange";
    returnItems: (InvoiceItem & { returnQty: number })[];
    exchangeItems: InvoiceItem[];
    refundAmount: number;
    refundMethod: string;
    notes: string;
  }) => void;
  onCancel: () => void;
  nextReturnNumber: string;
  accounts?: Account[];
};

export function ReturnInvoiceForm({ invoices, inventory, onSaveReturn, onCancel, nextReturnNumber, accounts: propAccounts }: Props) {
  const { formatCurrency } = useSettings();
  const accounts = propAccounts && propAccounts.length > 0 ? propAccounts : defaultAccounts;
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [returnType, setReturnType] = useState<"return" | "exchange">("return");
  const [returnItems, setReturnItems] = useState<{ index: number; returnQty: number; selected: boolean }[]>([]);
  const [exchangeItems, setExchangeItems] = useState<InvoiceItem[]>([]);
  const [refundMethod, setRefundMethod] = useState("Cash on Hand");
  const [notes, setNotes] = useState("");

  // Only approved/paid invoices (not already returned, not return invoices)
  const eligibleInvoices = invoices.filter(
    (inv) => (inv.status === "approved" || inv.status === "paid") && !inv.isReturn
  );

  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId) || null;

  const paymentOptions = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.map((a) => ({
        value: a.name,
        label: a.accountTitle ? `${a.name} — ${a.accountTitle}` : a.name,
      }));
    }
    return [
      { value: "Cash on Hand", label: "Cash on Hand" },
      { value: "Bank Transfer", label: "Bank Transfer" },
      { value: "Online", label: "Online" },
    ];
  }, [accounts]);

  // When invoice is selected, populate return items
  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) {
      setReturnItems(inv.items.map((_, idx) => ({ index: idx, returnQty: 0, selected: false })));
    }
    setExchangeItems([]);
  };

  const toggleReturnItem = (index: number, checked: boolean) => {
    setReturnItems((prev) =>
      prev.map((ri) =>
        ri.index === index
          ? { ...ri, selected: checked, returnQty: checked ? (selectedInvoice?.items[index]?.qty || 1) : 0 }
          : ri
      )
    );
  };

  const updateReturnQty = (index: number, qty: number) => {
    const maxQty = selectedInvoice?.items[index]?.qty || 1;
    setReturnItems((prev) =>
      prev.map((ri) => (ri.index === index ? { ...ri, returnQty: Math.min(Math.max(0, qty), maxQty) } : ri))
    );
  };

  // Exchange items management
  const addExchangeItem = () => setExchangeItems((prev) => [...prev, { description: "", qty: 1, rate: 0, amount: 0 }]);
  const removeExchangeItem = (i: number) => setExchangeItems((prev) => prev.filter((_, idx) => idx !== i));

  const selectExchangeProduct = (index: number, itemId: string) => {
    const invItem = inventory.find((i) => i.id === itemId);
    if (!invItem) return;
    setExchangeItems((prev) => {
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

  const updateExchangeItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setExchangeItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "qty" || field === "rate") item.amount = Number(item.qty) * Number(item.rate);
      updated[index] = item;
      return updated;
    });
  };

  // Calculations
  const selectedReturnItems = returnItems.filter((ri) => ri.selected && ri.returnQty > 0);
  const returnTotal = selectedReturnItems.reduce((sum, ri) => {
    const item = selectedInvoice?.items[ri.index];
    if (!item) return sum;
    return sum + ri.returnQty * item.rate;
  }, 0);

  const exchangeTotal = exchangeItems.reduce((sum, item) => sum + item.amount, 0);
  const difference = returnTotal - exchangeTotal;
  // Positive = refund to customer, Negative = customer pays more

  const canSubmit = selectedInvoice && selectedReturnItems.length > 0 && (returnType === "return" || exchangeItems.some((i) => i.description.trim()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !canSubmit) return;

    const returnItemsData = selectedReturnItems.map((ri) => ({
      ...selectedInvoice.items[ri.index],
      returnQty: ri.returnQty,
    }));

    onSaveReturn({
      originalInvoice: selectedInvoice,
      returnType,
      returnItems: returnItemsData,
      exchangeItems: returnType === "exchange" ? exchangeItems.filter((i) => i.description.trim() && i.qty > 0) : [],
      refundAmount: Math.max(0, difference),
      refundMethod,
      notes: notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <RotateCcw className="w-5 h-5" />
          Return Sale Invoice — {nextReturnNumber}
        </h2>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Select Invoice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Select Invoice to Return Against *</Label>
          <Select value={selectedInvoiceId} onValueChange={handleSelectInvoice}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select an approved/paid invoice" />
            </SelectTrigger>
            <SelectContent>
              {eligibleInvoices.map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {inv.number} — {inv.customer} — {formatCurrency(inv.amount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedInvoice && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">Customer</Label>
              <p className="font-medium">{selectedInvoice.customer}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Invoice Date</Label>
              <p className="font-medium">{selectedInvoice.date}</p>
            </div>
          </>
        )}

        <div>
          <Label>Return Type *</Label>
          <Select value={returnType} onValueChange={(v) => setReturnType(v as "return" | "exchange")}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="return">
                <span className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5" /> Full / Partial Return</span>
              </SelectItem>
              <SelectItem value="exchange">
                <span className="flex items-center gap-2"><ArrowLeftRight className="w-3.5 h-3.5" /> Exchange</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Refund Account</Label>
          <Select value={refundMethod} onValueChange={setRefundMethod}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Return Items Selection */}
      {selectedInvoice && (
        <div>
          <Label className="mb-2 block">Select Items to Return</Label>
          <div className="bg-muted/30 rounded-lg border overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Sold Qty</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Return Qty</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Rate</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Return Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items.map((item, i) => {
                  const ri = returnItems[i];
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={ri?.selected || false}
                          onCheckedChange={(checked) => toggleReturnItem(i, !!checked)}
                        />
                      </td>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.qty}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={item.qty}
                          value={ri?.returnQty || 0}
                          onChange={(e) => updateReturnQty(i, Number(e.target.value))}
                          className="h-8 text-right"
                          disabled={!ri?.selected}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.rate)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {ri?.selected ? formatCurrency((ri.returnQty || 0) * item.rate) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-2">
            <span className="text-sm font-semibold">Return Total: {formatCurrency(returnTotal)}</span>
          </div>
        </div>
      )}

      {/* Exchange Items */}
      {returnType === "exchange" && selectedInvoice && (
        <div>
          <Label className="mb-2 block flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Exchange With (New Items)
          </Label>
          <div className="bg-muted/30 rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {inventory.length > 0 && <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[240px]">Product</th>}
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Qty</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Rate</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {exchangeItems.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {inventory.length > 0 && (
                      <td className="px-3 py-2">
                        <ProductCombobox
                          inventory={inventory}
                          selectedItemId={item.inventoryItemId}
                          onSelect={(id) => selectExchangeProduct(i, id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Input value={item.description} onChange={(e) => updateExchangeItem(i, "description", e.target.value)} placeholder="Item" className="h-8" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={1} value={item.qty} onChange={(e) => updateExchangeItem(i, "qty", Number(e.target.value))} className="h-8 text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} step={0.01} value={item.rate} onChange={(e) => updateExchangeItem(i, "rate", Number(e.target.value))} className="h-8 text-right" />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                    <td className="px-2 py-2">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeExchangeItem(i)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={addExchangeItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Exchange Item
              </Button>
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <span className="text-sm font-semibold">Exchange Total: {formatCurrency(exchangeTotal)}</span>
          </div>
        </div>
      )}

      {/* Summary */}
      {selectedInvoice && selectedReturnItems.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
          <h3 className="font-semibold text-sm">Summary</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Return Items Value</span>
            <span className="font-medium">{formatCurrency(returnTotal)}</span>
          </div>
          {returnType === "exchange" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Exchange Items Value</span>
              <span className="font-medium">{formatCurrency(exchangeTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t pt-2 font-bold">
            <span>{difference >= 0 ? "Refund to Customer" : "Customer Owes"}</span>
            <span className={difference >= 0 ? "text-destructive" : "text-success"}>
              {formatCurrency(Math.abs(difference))}
            </span>
          </div>
        </div>
      )}

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Return reason, condition of items..." className="mt-1" maxLength={500} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!canSubmit}>
          {returnType === "exchange" ? "Process Exchange" : "Process Return"}
        </Button>
      </div>
    </form>
  );
}
