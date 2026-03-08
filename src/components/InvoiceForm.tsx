import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProductCombobox } from "@/components/ProductCombobox";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Invoice, InvoiceItem, Customer, InventoryItem } from "@/data/mockData";

type Account = { id: string; name: string; accountTitle: string; code: string; reconcileDate: string; currency: string; fxBalance: number; balance: number };

type Props = {
  customers: Customer[];
  inventory?: InventoryItem[];
  onSave: (invoice: Invoice, advanceAmount?: number, advanceMethod?: string, advanceRef?: string) => void;
  onCancel: () => void;
  editInvoice?: Invoice | null;
  nextNumber: string;
  onAddCustomer?: (customer: Customer) => void;
};

export function InvoiceForm({ customers, inventory = [], onSave, onCancel, editInvoice, nextNumber, onAddCustomer }: Props) {
  const { formatCurrency } = useSettings();
  const [accounts] = useLocalStorage<Account[]>("accounts", []);
  const [customNumber, setCustomNumber] = useState(editInvoice?.number || "");
  const [documentNumber, setDocumentNumber] = useState(editInvoice?.documentNumber || "");
  const [projectName, setProjectName] = useState(editInvoice?.projectName || "");
  const [customer, setCustomer] = useState(editInvoice?.customer || "");
  const [date, setDate] = useState(editInvoice?.date || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(editInvoice?.dueDate || "");
  const [status, setStatus] = useState<Invoice["status"]>(editInvoice?.status || "pending");
  const [tax, setTax] = useState(editInvoice?.tax ?? 0);
  const [discount, setDiscount] = useState(editInvoice?.discount ?? 0);
  const [notes, setNotes] = useState(editInvoice?.notes || "");
  const [items, setItems] = useState<InvoiceItem[]>(
    editInvoice?.items || [{ description: "", qty: 1, rate: 0, amount: 0 }]
  );
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickCompany, setQuickCompany] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickCNIC, setQuickCNIC] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceMethod, setAdvanceMethod] = useState("Cash on Hand");
  const [advanceRef, setAdvanceRef] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  // Build payment options from accounts (unique key using id)
  const paymentOptions = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.map(a => ({
        value: `${a.name}||${a.accountTitle}||${a.id}`,
        label: a.accountTitle ? `${a.name} — ${a.accountTitle}` : a.name,
        displayName: a.name,
      }));
    }
    return [
      { value: "Cash on Hand||Cash on Hand||default", label: "Cash on Hand", displayName: "Cash on Hand" },
      { value: "Bank Transfer||Bank Transfer||default2", label: "Bank Transfer", displayName: "Bank Transfer" },
      { value: "Online||Online||default3", label: "Online", displayName: "Online" },
      { value: "Cheque||Cheque||default4", label: "Cheque", displayName: "Cheque" },
    ];
  }, [accounts]);

  // Extract display name from encoded value
  const getPaymentDisplayName = (encoded: string) => encoded.split("||")[0];

  const handleQuickAddCustomer = () => {
    if (!quickName.trim() || !quickCompany.trim()) return;
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name: quickName.trim(),
      company: quickCompany.trim(),
      email: quickEmail.trim(),
      phone: quickPhone.trim(),
      address: quickCNIC.trim() ? `CNIC: ${quickCNIC.trim()}` : "",
      totalBilled: 0,
      outstanding: 0,
    };
    onAddCustomer?.(newCustomer);
    setCustomer(newCustomer.name);
    setShowQuickAdd(false);
    setQuickName(""); setQuickCompany(""); setQuickPhone(""); setQuickCNIC(""); setQuickEmail("");
  };

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
      if (field === "qty" || field === "rate") {
        item.amount = Number(item.qty) * Number(item.rate);
      }
      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { description: "", qty: 1, rate: 0, amount: 0 }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = discount;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = afterDiscount * (tax / 100);
  const total = afterDiscount + taxAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim() || !date || !dueDate || items.length === 0) return;

    const validItems = items.filter((i) => i.description.trim() && i.qty > 0 && i.rate > 0);
    if (validItems.length === 0) return;

    onSave({
      id: editInvoice?.id || crypto.randomUUID(),
      number: customNumber.trim() || nextNumber,
      documentNumber: documentNumber.trim() || undefined,
      projectName: projectName.trim() || undefined,
      customer: customer.trim(),
      date,
      dueDate,
      amount: total,
      status,
      items: validItems,
      notes: notes.trim(),
      tax,
      discount,
    }, advanceAmount > 0 ? advanceAmount : undefined, getPaymentDisplayName(advanceMethod), advanceRef.trim() || undefined);
  };

  const hasInventory = inventory.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{editInvoice ? "Edit Invoice" : "New Invoice"}</h2>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Invoice Number</Label>
          <Input value={customNumber || nextNumber} onChange={(e) => setCustomNumber(e.target.value)} placeholder={nextNumber} className="mt-1" />
        </div>
        <div>
          <Label>Document Number</Label>
          <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="e.g. DOC-001" className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <Label>Project Name</Label>
          <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Solar Panel Installation - Phase 1" className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <Label>Customer *</Label>
          <div className="flex gap-2 mt-1">
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name} ({c.company})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onAddCustomer && (
              <Button type="button" variant="outline" size="icon" onClick={() => setShowQuickAdd(!showQuickAdd)} title="Add new customer">
                <UserPlus className="w-4 h-4" />
              </Button>
            )}
          </div>
          {showQuickAdd && (
            <div className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quick Add Customer</p>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="Name *" className="h-8" />
              <Input value={quickCompany} onChange={e => setQuickCompany(e.target.value)} placeholder="Company *" className="h-8" />
              <Input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} placeholder="Phone Number *" className="h-8" />
              <Input value={quickCNIC} onChange={e => setQuickCNIC(e.target.value)} placeholder="CNIC / ID Card Number" className="h-8" />
              <Input value={quickEmail} onChange={e => setQuickEmail(e.target.value)} placeholder="Email" className="h-8" />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowQuickAdd(false)}>Cancel</Button>
                <Button type="button" size="sm" onClick={handleQuickAddCustomer}>Add</Button>
              </div>
            </div>
          )}
        </div>
        <div>
          <Label>Invoice Date *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Due Date *</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as Invoice["status"])}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
         <div>
          <Label>Tax Rate (%)</Label>
          <Input type="number" min={0} max={100} value={tax} onChange={(e) => setTax(Number(e.target.value))} className="mt-1" />
        </div>
        <div>
          <Label>Discount (Amount)</Label>
          <Input type="number" min={0} step={0.01} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} placeholder="0.00" className="mt-1" />
        </div>
        <div>
          <Label>Payment Mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
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

      {/* Line Items */}
      <div>
        <Label className="mb-2 block">Line Items</Label>
        <div className="bg-muted/30 rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {hasInventory && <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[240px]">Product</th>}
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Qty</th>
                {hasInventory && <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Stock</th>}
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Rate</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Amount</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const invItem = item.inventoryItemId ? inventory.find((inv) => inv.id === item.inventoryItemId) : null;
                return (
                  <tr key={i} className="border-b last:border-0">
                    {hasInventory && (
                      <td className="px-3 py-2">
                        <ProductCombobox
                          inventory={inventory}
                          selectedItemId={item.inventoryItemId}
                          onSelect={(id) => selectInventoryItem(i, id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Item description" className="h-8" required />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={1} value={item.qty} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} className="h-8 text-right" required />
                    </td>
                    {hasInventory && (
                      <td className="px-3 py-2 text-center">
                        {invItem ? (
                          <Badge variant={invItem.qty < item.qty ? "destructive" : "secondary"} className="text-xs">{invItem.qty}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Input type="number" min={0} step={0.01} value={item.rate} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} className="h-8 text-right" required />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                    <td className="px-2 py-2">
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
            </Button>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span className="font-medium">-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax ({tax}%)</span>
            <span className="font-medium">{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {!editInvoice && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <Label className="font-medium text-sm">Payment (Optional)</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Advance Amount</Label>
              <Input type="number" min={0} step={0.01} value={advanceAmount || ""} onChange={(e) => setAdvanceAmount(Number(e.target.value))} placeholder="0.00" className="mt-1 h-8" />
            </div>
            <div>
              <Label className="text-xs">Payment Account</Label>
              <Select value={advanceMethod} onValueChange={setAdvanceMethod}>
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input value={advanceRef} onChange={(e) => setAdvanceRef(e.target.value)} placeholder="e.g. TXN-001" className="mt-1 h-8" />
            </div>
          </div>
        </div>
      )}

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank you note..." className="mt-1" maxLength={500} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{editInvoice ? "Update Invoice" : "Create Invoice"}</Button>
      </div>
    </form>
  );
}