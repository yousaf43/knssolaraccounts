import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, UserPlus, AlertTriangle } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { defaultAccounts, type Account } from "@/data/defaultAccounts";
import type { Receipt, Customer, Invoice } from "@/data/mockData";

type Props = {
  customers: Customer[];
  invoices: Invoice[];
  receipts?: Receipt[];
  onSave: (receipt: Receipt) => void;
  onCancel: () => void;
  editReceipt?: Receipt | null;
  nextNumber: string;
  onAddCustomer?: (customer: Customer) => void;
};

export function ReceiptForm({ customers, invoices, receipts = [], onSave, onCancel, editReceipt, nextNumber, onAddCustomer }: Props) {
  const { formatCurrency } = useSettings();
  const [accounts] = useLocalStorage<Account[]>("accounts", []);
  const [customer, setCustomer] = useState(editReceipt?.customer || "");
  const [date, setDate] = useState(editReceipt?.date || new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(editReceipt?.invoiceNumber || "");
  const [amount, setAmount] = useState(editReceipt?.amount || 0);
  const [paymentMethod, setPaymentMethod] = useState(editReceipt?.paymentMethod || "");
  const [reference, setReference] = useState(editReceipt?.reference || "");
  const [notes, setNotes] = useState(editReceipt?.notes || "");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickCompany, setQuickCompany] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickCNIC, setQuickCNIC] = useState("");
  const [quickEmail, setQuickEmail] = useState("");

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

  // Calculate remaining for selected invoice
  const selectedInvoice = invoices.find((i) => i.number === invoiceNumber);
  const invoiceRemaining = useMemo(() => {
    if (!selectedInvoice) return 0;
    const paidSoFar = receipts
      .filter((r) => r.invoiceNumber === invoiceNumber && r.id !== editReceipt?.id)
      .reduce((s, r) => s + r.amount, 0);
    return Math.max(0, selectedInvoice.amount - paidSoFar - discountAmount);
  }, [selectedInvoice, invoiceNumber, receipts, editReceipt, discountAmount]);

  const isOverpay = selectedInvoice && amount > invoiceRemaining;

  // Build payment options from accounts (unique key using id)
  const paymentOptions = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.map(a => ({
        value: `${a.name}||${a.accountTitle}||${a.id}`,
        label: a.accountTitle ? `${a.name} — ${a.accountTitle}` : a.name,
      }));
    }
    return [
      { value: "Cash on Hand||Cash on Hand||default", label: "Cash on Hand" },
      { value: "Bank Transfer||Bank Transfer||default2", label: "Bank Transfer" },
      { value: "Online||Online||default3", label: "Online" },
      { value: "Cheque||Cheque||default4", label: "Cheque" },
    ];
  }, [accounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim() || !date || !invoiceNumber || amount <= 0) return;
    if (isOverpay) return;

    const displayMethod = paymentMethod.split("||")[0];
    onSave({
      id: editReceipt?.id || crypto.randomUUID(),
      number: editReceipt?.number || nextNumber,
      customer: customer.trim(),
      date,
      invoiceNumber,
      amount,
      paymentMethod: displayMethod,
      reference: reference.trim(),
      notes: discountAmount > 0 ? `${notes.trim()} | Discount: ${discountAmount}`.trim() : notes.trim(),
    });
  };

  const customerInvoices = invoices.filter((inv) => inv.customer === customer);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{editReceipt ? "Edit Receipt" : "New Receipt"}</h2>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}><X className="w-5 h-5" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Receipt Number</Label>
          <Input value={editReceipt?.number || nextNumber} disabled className="mt-1" />
        </div>
        <div>
          <Label>Customer *</Label>
          <div className="flex gap-2 mt-1">
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name} ({c.company})</SelectItem>))}
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
          <Label>Receipt Date *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Against Invoice *</Label>
          <Select value={invoiceNumber} onValueChange={(v) => {
            setInvoiceNumber(v);
            const inv = invoices.find((i) => i.number === v);
            if (inv) {
              const paid = receipts.filter((r) => r.invoiceNumber === v && r.id !== editReceipt?.id).reduce((s, r) => s + r.amount, 0);
              setAmount(Math.max(0, inv.amount - paid));
            }
          }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select invoice" /></SelectTrigger>
            <SelectContent>
              {(customer ? customerInvoices : invoices).map((inv) => (
                <SelectItem key={inv.id} value={inv.number}>{inv.number} - {formatCurrency(inv.amount)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount * {selectedInvoice && <span className="text-xs text-muted-foreground ml-1">(Remaining: {formatCurrency(invoiceRemaining)})</span>}</Label>
          <Input type="number" min={0} max={invoiceRemaining || undefined} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={`mt-1 ${isOverpay ? "border-destructive" : ""}`} required />
          {isOverpay && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Amount exceeds remaining balance ({formatCurrency(invoiceRemaining)})
            </p>
          )}
        </div>
        <div>
          <Label>Payment Account / Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {paymentOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Reference / Transaction ID</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN-12345" className="mt-1" />
        </div>
        <div>
          <Label>Discount (Amount)</Label>
          <Input type="number" min={0} step={0.01} value={discountAmount || ""} onChange={(e) => setDiscountAmount(Number(e.target.value))} placeholder="0.00" className="mt-1" />
          {discountAmount > 0 && selectedInvoice && (
            <p className="text-xs text-success mt-1">Discount of {formatCurrency(discountAmount)} applied. New remaining: {formatCurrency(invoiceRemaining)}</p>
          )}
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment notes..." className="mt-1" maxLength={500} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!!isOverpay}>{editReceipt ? "Update Receipt" : "Create Receipt"}</Button>
      </div>
    </form>
  );
}