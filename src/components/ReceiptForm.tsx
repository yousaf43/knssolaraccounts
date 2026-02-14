import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { Receipt, Customer, Invoice } from "@/data/mockData";

type Props = {
  customers: Customer[];
  invoices: Invoice[];
  onSave: (receipt: Receipt) => void;
  onCancel: () => void;
  editReceipt?: Receipt | null;
  nextNumber: string;
};

export function ReceiptForm({ customers, invoices, onSave, onCancel, editReceipt, nextNumber }: Props) {
  const [customer, setCustomer] = useState(editReceipt?.customer || "");
  const [date, setDate] = useState(editReceipt?.date || new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(editReceipt?.invoiceNumber || "");
  const [amount, setAmount] = useState(editReceipt?.amount || 0);
  const [paymentMethod, setPaymentMethod] = useState(editReceipt?.paymentMethod || "Bank Transfer");
  const [reference, setReference] = useState(editReceipt?.reference || "");
  const [notes, setNotes] = useState(editReceipt?.notes || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim() || !date || !invoiceNumber || amount <= 0) return;

    onSave({
      id: editReceipt?.id || crypto.randomUUID(),
      number: editReceipt?.number || nextNumber,
      customer: customer.trim(),
      date,
      invoiceNumber,
      amount,
      paymentMethod,
      reference: reference.trim(),
      notes: notes.trim(),
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
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => (<SelectItem key={c.id} value={c.company}>{c.company}</SelectItem>))}
            </SelectContent>
          </Select>
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
            if (inv) setAmount(inv.amount);
          }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select invoice" /></SelectTrigger>
            <SelectContent>
              {(customer ? customerInvoices : invoices).map((inv) => (
                <SelectItem key={inv.id} value={inv.number}>{inv.number} - ${inv.amount.toLocaleString()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount *</Label>
          <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" required />
        </div>
        <div>
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              <SelectItem value="Credit Card">Credit Card</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Reference / Transaction ID</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN-12345" className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment notes..." className="mt-1" maxLength={500} />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{editReceipt ? "Update Receipt" : "Create Receipt"}</Button>
      </div>
    </form>
  );
}
