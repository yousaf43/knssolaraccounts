import { useState } from "react";
import { getInitialInvoices, getInitialReceipts, type Customer, type Invoice, type Receipt } from "@/data/mockData";
import { useCustomersCloud, useInvoicesCloud, useReceiptsCloud, useSalesOrdersCloud, useQuotationsCloud } from "@/hooks/useAppData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Phone, Edit, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useTrash } from "@/hooks/useTrash";

const emptyCustomer = (): Partial<Customer> => ({ name: "", email: "", phone: "", company: "", address: "", totalBilled: 0, outstanding: 0 });

export default function Customers() {
  const { formatCurrency } = useSettings();
  const { log } = useActivityLog();
  const { moveToTrash } = useTrash();
  const { data: customers, upsert: upsertCustomer, remove: removeCustomer } = useCustomersCloud();
  const { data: invoices, upsert: upsertInvoice } = useInvoicesCloud();
  const { data: receipts, upsert: upsertReceipt } = useReceiptsCloud();
  const { data: salesOrders, upsert: upsertSalesOrder } = useSalesOrdersCloud();
  const { data: quotations, upsert: upsertQuotation } = useQuotationsCloud();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(emptyCustomer());
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const openAdd = () => { setEditing(null); setForm(emptyCustomer()); setShowForm(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm(c); setShowForm(true); };

  // Calculate real totals from invoices/receipts
  const getCustomerTotals = (customerName: string) => {
    const custInvoices = invoices.filter((i) => i.customer === customerName);
    const custReceipts = receipts.filter((r) => r.customer === customerName);
    const totalBilled = custInvoices.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = custReceipts.reduce((sum, r) => sum + r.amount, 0);
    const outstanding = totalBilled - totalPaid;
    return { totalBilled, totalPaid, outstanding, custInvoices, custReceipts };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    if (editing) {
      const oldName = editing.name;
      const newName = form.name!.trim();
      await upsertCustomer({ ...editing, ...form } as Customer);
      // Cascade name change across all documents
      if (oldName !== newName) {
        for (const inv of invoices.filter(i => i.customer === oldName)) {
          await upsertInvoice({ ...inv, customer: newName });
        }
        for (const so of salesOrders.filter(s => s.customer === oldName)) {
          await upsertSalesOrder({ ...so, customer: newName });
        }
        for (const r of receipts.filter(r => r.customer === oldName)) {
          await upsertReceipt({ ...r, customer: newName });
        }
        for (const q of quotations.filter(q => q.customer === oldName)) {
          await upsertQuotation({ ...q, customer: newName });
        }
      }
      await log("edit", "customer", editing.id, newName, `Company: ${form.company}`);
      toast.success("Customer updated");
    } else {
      const id = crypto.randomUUID();
      await upsertCustomer({ ...form, id, address: form.address || "", totalBilled: 0, outstanding: 0 } as Customer);
      await log("create", "customer", id, form.name || "", `Company: ${form.company}`);
      toast.success("Customer added");
    }
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const c = customers.find(cu => cu.id === id);
    if (c) {
      await moveToTrash("customer", id, c);
      await log("delete", "customer", id, c.name, `Company: ${c.company}`);
    }
    removeCustomer(id);
    toast.success("Customer deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer contacts</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editing ? "Edit Customer" : "Add Customer"}</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} required /></div>
            <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1" maxLength={100} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" maxLength={255} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" maxLength={20} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" maxLength={300} placeholder="Full address" /></div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Update" : "Add"}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input placeholder="Search customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-sm h-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.filter((c) => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q);
        }).map((c) => {
          const { totalBilled, totalPaid, outstanding, custInvoices, custReceipts } = getCustomerTotals(c.name);
          const isExpanded = expandedCustomer === c.id;
          return (
            <div key={c.id} className="bg-card rounded-lg border hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {c.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{c.company}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1 rounded hover:bg-muted" onClick={() => openEdit(c)}><Edit className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <ConfirmDeleteDialog onConfirm={() => handleDelete(c.id)} title="Delete Customer?" description={`Are you sure you want to delete "${c.name}"? It will be moved to trash.`}>
                      <button className="p-1 rounded hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                    </ConfirmDeleteDialog>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {c.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" /><span className="truncate">{c.email}</span></div>}
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" /><span>{c.phone}</span></div>
                  {c.address && <p className="text-muted-foreground text-xs truncate">{c.address}</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t text-sm">
                  <div><p className="text-muted-foreground text-xs">Total Billed</p><p className="font-semibold">{formatCurrency(totalBilled)}</p></div>
                  <div className="text-center"><p className="text-muted-foreground text-xs">Total Paid</p><p className="font-semibold text-success">{formatCurrency(totalPaid)}</p></div>
                  <div className="text-right"><p className="text-muted-foreground text-xs">Outstanding</p><p className={`font-semibold ${outstanding > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(outstanding)}</p></div>
                </div>
                {/* Payment History Toggle */}
                <button
                  className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => setExpandedCustomer(isExpanded ? null : c.id)}
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isExpanded ? "Hide" : "View"} Payment History ({custReceipts.length})
                </button>
              </div>

              {/* Expanded Payment History */}
              {isExpanded && (
                <div className="border-t px-5 py-3 bg-muted/20 max-h-64 overflow-y-auto">
                  {custInvoices.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Invoices</p>
                      <div className="space-y-1">
                        {custInvoices.map((inv) => {
                          const paidForInv = custReceipts.filter((r) => r.invoiceNumber === inv.number).reduce((s, r) => s + r.amount, 0);
                          const remaining = inv.amount - paidForInv;
                          return (
                            <div key={inv.id} className="flex items-center justify-between text-xs py-1 border-b border-dashed last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{inv.number}</span>
                                <span className="text-muted-foreground">{inv.date}</span>
                                <Badge variant="outline" className="text-[10px] h-4">{inv.status}</Badge>
                              </div>
                              <div className="flex items-center gap-3">
                                <span>{formatCurrency(inv.amount)}</span>
                                <span className={remaining > 0 ? "text-warning" : "text-success"}>
                                  Rem: {formatCurrency(Math.max(0, remaining))}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {custReceipts.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Payments Received</p>
                      <div className="space-y-1">
                        {custReceipts.map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-dashed last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.number}</span>
                              <span className="text-muted-foreground">{r.date}</span>
                              <Badge variant="outline" className="text-[10px] h-4">{r.paymentMethod}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">→ {r.invoiceNumber}</span>
                              <span className="font-medium text-success">{formatCurrency(r.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">No payments recorded yet</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
