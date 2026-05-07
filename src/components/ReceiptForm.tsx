import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, UserPlus, AlertTriangle, Layers } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { defaultAccounts, type Account } from "@/data/defaultAccounts";
import type { Receipt, Customer, Invoice } from "@/data/mockData";
import { getInvoicePaymentSummary } from "@/utils/invoicePayments";
import { CustomerCombobox } from "@/components/CustomerCombobox";

type Props = {
  customers: Customer[];
  invoices: Invoice[];
  receipts?: Receipt[];
  onSave: (receipt: Receipt) => void;
  onSaveBulk?: (receipts: Receipt[]) => void;
  onCancel: () => void;
  editReceipt?: Receipt | null;
  nextNumber: string;
  onAddCustomer?: (customer: Customer) => void;
  accounts?: Account[];
  prefillInvoice?: Invoice | null;
};

export function ReceiptForm({
  customers,
  invoices,
  receipts = [],
  onSave,
  onSaveBulk,
  onCancel,
  editReceipt,
  nextNumber,
  onAddCustomer,
  accounts: propAccounts,
  prefillInvoice,
}: Props) {
  const { formatCurrency } = useSettings();
  const accounts = propAccounts && propAccounts.length > 0 ? propAccounts : defaultAccounts;
  const [customer, setCustomer] = useState(editReceipt?.customer || prefillInvoice?.customer || "");
  const [date, setDate] = useState(editReceipt?.date || new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(editReceipt?.invoiceNumber || prefillInvoice?.number || "");
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
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkAmount, setBulkAmount] = useState(0);
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({});

  const selectedInvoice = useMemo(() => {
    if (prefillInvoice && invoiceNumber === prefillInvoice.number && customer === prefillInvoice.customer) {
      return prefillInvoice;
    }
    return (
      invoices.find((invoice) => invoice.number === invoiceNumber && invoice.customer === customer) ||
      invoices.find((invoice) => invoice.number === invoiceNumber) ||
      null
    );
  }, [prefillInvoice, invoices, invoiceNumber, customer]);

  const invoiceRemaining = useMemo(() => {
    if (!selectedInvoice) return 0;
    const { remaining } = getInvoicePaymentSummary(selectedInvoice, receipts, editReceipt?.id);
    return Math.max(0, remaining - discountAmount);
  }, [selectedInvoice, receipts, editReceipt?.id, discountAmount]);

  // Pending invoices for selected customer (oldest first - FIFO)
  const pendingInvoices = useMemo(() => {
    if (!customer) return [];
    return invoices
      .filter((inv) => inv.customer === customer && inv.status !== "returned")
      .map((inv) => {
        const { remaining } = getInvoicePaymentSummary(inv, receipts);
        return { invoice: inv, remaining };
      })
      .filter((x) => x.remaining > 0.01)
      .sort((a, b) => (a.invoice.date || "").localeCompare(b.invoice.date || ""));
  }, [customer, invoices, receipts]);

  const totalOutstanding = useMemo(
    () => pendingInvoices.reduce((s, x) => s + x.remaining, 0),
    [pendingInvoices]
  );

  const isManualMode = useMemo(
    () => Object.values(manualAllocations).some((v) => v > 0),
    [manualAllocations]
  );

  // Allocation preview (FIFO or Manual)
  const allocations = useMemo(() => {
    if (!bulkMode) return [];
    const result: { invoice: Invoice; allocated: number; remainingAfter: number }[] = [];
    if (isManualMode) {
      for (const { invoice, remaining: invRem } of pendingInvoices) {
        const allocated = Math.min(manualAllocations[invoice.id] || 0, invRem);
        if (allocated > 0) {
          result.push({ invoice, allocated, remainingAfter: invRem - allocated });
        }
      }
      return result;
    }
    if (bulkAmount <= 0) return [];
    let remaining = bulkAmount;
    for (const { invoice, remaining: invRem } of pendingInvoices) {
      if (remaining <= 0) break;
      const allocated = Math.min(remaining, invRem);
      result.push({ invoice, allocated, remainingAfter: invRem - allocated });
      remaining -= allocated;
    }
    return result;
  }, [bulkMode, bulkAmount, pendingInvoices, isManualMode, manualAllocations]);

  const totalAllocated = useMemo(
    () => allocations.reduce((s, a) => s + a.allocated, 0),
    [allocations]
  );

  const unallocated = useMemo(() => {
    if (isManualMode) return 0;
    return Math.max(0, bulkAmount - totalAllocated);
  }, [isManualMode, bulkAmount, totalAllocated]);

  const handleQuickAddCustomer = () => {
    if (!quickName.trim() || !quickCompany.trim()) return;
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name: quickName.trim(),
      company: quickCompany.trim(),
      email: "",
      phone: quickPhone.trim(),
      address: [quickCNIC.trim() ? `CNIC: ${quickCNIC.trim()}` : "", quickEmail.trim()].filter(Boolean).join(" | "),
      totalBilled: 0,
      outstanding: 0,
    };
    onAddCustomer?.(newCustomer);
    setCustomer(newCustomer.name);
    setShowQuickAdd(false);
    setQuickName("");
    setQuickCompany("");
    setQuickPhone("");
    setQuickCNIC("");
    setQuickEmail("");
  };

  const isOverpay = false;

  const paymentOptions = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.map((a) => ({
        value: `${a.name}||${a.accountTitle}||${a.id}`,
        label: a.accountTitle ? `${a.name} — ${a.accountTitle}` : a.name,
      }));
    }
    return [
      { value: "Cash on Hand||Cash on Hand||default", label: "Cash on Hand" },
      { value: "Bank Transfer||Bank Transfer||default2", label: "Bank Transfer" },
    ];
  }, [accounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (bulkMode) {
      if (!customer.trim() || !date || allocations.length === 0) return;
      const totalAmt = isManualMode ? totalAllocated : bulkAmount;
      if (totalAmt <= 0) return;
      const displayMethod = paymentMethod.split("||")[0];
      const baseSeq = parseInt((nextNumber.match(/\d+/) || ["0"])[0], 10);
      const prefix = nextNumber.replace(/\d+$/, "");
      const padLen = (nextNumber.match(/\d+$/) || ["001"])[0].length;
      const newReceipts: Receipt[] = allocations.map((a, i) => ({
        id: crypto.randomUUID(),
        number: `${prefix}${String(baseSeq + i).padStart(padLen, "0")}`,
        customer: customer.trim(),
        date,
        invoiceNumber: a.invoice.number,
        amount: a.allocated,
        paymentMethod: displayMethod,
        reference: reference.trim(),
        notes: notes.trim() ? `${notes.trim()} | ${isManualMode ? "Manual" : "Bulk"} allocation` : `${isManualMode ? "Manual" : "Bulk"} allocation across ${allocations.length} invoice(s)`,
      }));
      onSaveBulk?.(newReceipts);
      return;
    }

    if (!customer.trim() || !date || !invoiceNumber || (amount <= 0 && discountAmount <= 0)) return;
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

      {!editReceipt && onSaveBulk && (
        <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <div>
              <Label className="cursor-pointer">Bulk Payment (Multiple Invoices)</Label>
              <p className="text-xs text-muted-foreground">Auto FIFO allocate karein ya neeche table se khud invoices select karein</p>
            </div>
          </div>
          <Switch checked={bulkMode} onCheckedChange={setBulkMode} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Receipt Number</Label>
          <Input value={editReceipt?.number || (bulkMode ? `${nextNumber} (+${Math.max(0, allocations.length - 1)})` : nextNumber)} disabled className="mt-1" />
        </div>
        <div>
          <Label>Customer *</Label>
          <div className="flex gap-2 mt-1">
            <CustomerCombobox customers={customers} selectedName={customer} onSelect={setCustomer} />
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
              <Input value={quickEmail} onChange={e => setQuickEmail(e.target.value)} placeholder="Address" className="h-8" />
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

        {!bulkMode && (
          <>
            <div>
              <Label>Against Invoice *</Label>
              <Select value={invoiceNumber} onValueChange={(value) => {
                setInvoiceNumber(value);
                const invoice = customerInvoices.find((inv) => inv.number === value) || invoices.find((inv) => inv.number === value && inv.customer === customer) || invoices.find((inv) => inv.number === value);
                if (invoice) {
                  const { remaining } = getInvoicePaymentSummary(invoice, receipts, editReceipt?.id);
                  setAmount(Math.max(0, remaining));
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
              <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" required />
              {isOverpay && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Amount exceeds remaining balance ({formatCurrency(invoiceRemaining)})
                </p>
              )}
            </div>
          </>
        )}

        {bulkMode && (
          <div className="md:col-span-2">
            <Label>
              Total Amount Received{" "}
              {customer && <span className="text-xs text-muted-foreground ml-1">(Total Outstanding: {formatCurrency(totalOutstanding)})</span>}
              {isManualMode && <span className="text-xs text-primary ml-2">— Manual mode (sum: {formatCurrency(totalAllocated)})</span>}
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={isManualMode ? totalAllocated : (bulkAmount || "")}
              onChange={(e) => setBulkAmount(Number(e.target.value))}
              className="mt-1"
              placeholder="0.00"
              disabled={isManualMode}
            />
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setManualAllocations({}); setBulkAmount(totalOutstanding); }}>
                Pay All FIFO ({formatCurrency(totalOutstanding)})
              </Button>
              {isManualMode && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setManualAllocations({})}>
                  Clear Manual Selection
                </Button>
              )}
            </div>
          </div>
        )}

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

        {!bulkMode && (
          <div>
            <Label>Discount (Amount)</Label>
            <Input type="number" min={0} step={0.01} value={discountAmount || ""} onChange={(e) => setDiscountAmount(Number(e.target.value))} placeholder="0.00" className="mt-1" />
            {discountAmount > 0 && selectedInvoice && (
              <p className="text-xs text-success mt-1">Discount of {formatCurrency(discountAmount)} applied. New remaining: {formatCurrency(invoiceRemaining)}</p>
            )}
          </div>
        )}
      </div>

      {bulkMode && customer && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 text-sm font-semibold flex items-center justify-between">
            <span>Allocation Preview ({allocations.length} invoice{allocations.length !== 1 ? "s" : ""})</span>
            {unallocated > 0 && (
              <span className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Unallocated: {formatCurrency(unallocated)}
              </span>
            )}
          </div>
          {pendingInvoices.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Is customer ki koi pending invoice nahi hai</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Invoice</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-right px-3 py-2">Outstanding</th>
                  <th className="text-right px-3 py-2">Allocated</th>
                  <th className="text-right px-3 py-2">After</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map(({ invoice, remaining }) => {
                  const alloc = allocations.find((a) => a.invoice.id === invoice.id);
                  return (
                    <tr key={invoice.id} className={alloc ? "bg-success/5" : ""}>
                      <td className="px-3 py-2 font-medium">{invoice.number}</td>
                      <td className="px-3 py-2 text-muted-foreground">{invoice.date}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(remaining)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-success">
                        {alloc ? formatCurrency(alloc.allocated) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {alloc ? formatCurrency(alloc.remainingAfter) : formatCurrency(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment notes..." className="mt-1" maxLength={500} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={bulkMode && (allocations.length === 0 || bulkAmount <= 0)}>
          {editReceipt ? "Update Receipt" : bulkMode ? `Create ${allocations.length} Receipt${allocations.length !== 1 ? "s" : ""}` : "Create Receipt"}
        </Button>
      </div>
    </form>
  );
}
