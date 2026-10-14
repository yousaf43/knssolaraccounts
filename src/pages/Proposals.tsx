import { useEffect, useMemo, useState } from "react";
import { FileBadge, Plus, Printer, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { toast } from "sonner";
import { printProposal } from "@/lib/proposalPrint";
import { useSalesOrdersCloud } from "@/hooks/useAppData";
import { useElectricityTariff } from "@/hooks/useElectricityTariff";
import { CATEGORY_LABEL, resolveCategory, type TariffChoice } from "@/lib/electricityTariff";

export interface ProposalItem {
  brand: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface ProposalBattery {
  type: string;
  brand: string;
  model: string;
  units: number;
  kwhEach: number;
  warranty: string;
}

export interface Proposal {
  id: string;
  proposalNo: string;
  date: string;
  validDays: number;
  customerName: string;
  companyName: string;
  address: string;
  city: string;
  phone: string;
  cnic: string;
  systemType: "on-grid" | "off-grid" | "hybrid";
  systemKw: number;
  panelQty: number;
  panelWatt: number;
  panelBrand: string;
  panelWarranty: string;
  inverterKw: number;
  inverterBrand: string;
  inverterWarranty: string;
  structureQty: number;
  structureType: string;
  netBilling: boolean;
  earthing: boolean;
  disco: string;
  /** Electricity connection type used for payback; "auto" = detected from customer details */
  tariffCategory?: TariffChoice;
  battery: ProposalBattery | null;
  monthlyUnits: number[];
  items: ProposalItem[];
  total: number;
  paymentMethod: string;
  delivery: string;
  terms: string;
  salesExec: string;
  signedName: string;
  signedTitle: string;
  signedPhone: string;
  signedEmail: string;
  status: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const emptyProposal = (): Omit<Proposal, "id" | "proposalNo"> => ({
  date: new Date().toISOString().slice(0, 10),
  validDays: 3,
  customerName: "",
  companyName: "",
  address: "",
  city: "",
  phone: "",
  cnic: "",
  systemType: "on-grid",
  systemKw: 0,
  panelQty: 0,
  panelWatt: 625,
  panelBrand: "JA Solar",
  panelWarranty: "30 years performance",
  inverterKw: 0,
  inverterBrand: "",
  inverterWarranty: "3 years replacement",
  structureQty: 0,
  structureType: "L2 C-type",
  netBilling: false,
  earthing: false,
  disco: "",
  tariffCategory: "auto",
  battery: null,
  monthlyUnits: Array(12).fill(0),
  items: [],
  total: 0,
  paymentMethod: "70% advance payment and 30% after delivery.",
  delivery: "Within 1 week after PO.",
  terms: "",
  salesExec: "",
  signedName: "",
  signedTitle: "",
  signedPhone: "",
  signedEmail: "",
  status: "draft",
});

type Row = {
  id: string;
  proposal_no: string;
  customer_name: string;
  system_type: string;
  system_kw: number;
  total: number;
  status: string;
  data: Record<string, unknown>;
  created_at: string;
};

const rowToProposal = (r: Row): Proposal =>
  ({
    ...emptyProposal(),
    ...(r.data as object),
    id: r.id,
    proposalNo: r.proposal_no,
    status: r.status,
    systemKw: Number(r.system_kw) || 0,
  }) as Proposal;

export default function Proposals() {
  const { user, company } = useAuth();
  const { settings, formatCurrency, formatDate } = useSettings();
  const { data: salesOrdersAll } = useSalesOrdersCloud();
  const { tariff, checking, refresh: refreshTariff } = useElectricityTariff();
  const checkRates = async () => {
    const res = await refreshTariff(true);
    if (res.changed) toast.success("Electricity rates updated to the latest tariff");
    else if (res.ok) toast.success("Rates are already up to date");
    else toast.error("Couldn't check new rates right now — using the saved rates");
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [form, setForm] = useState<Omit<Proposal, "id" | "proposalNo">>(emptyProposal());

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load proposals");
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const systemKw = useMemo(
    () => +(((form.panelQty || 0) * (form.panelWatt || 0)) / 1000).toFixed(2),
    [form.panelQty, form.panelWatt]
  );
  const itemsTotal = useMemo(
    () => form.items.reduce((a, it) => a + (it.amount || 0), 0),
    [form.items]
  );

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.proposal_no.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q)
    );
  });
  const { paginatedItems, currentPage, totalPages, totalItems, goToPage, resetPage } = usePagination(filtered, 25);

  const nextNo = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `KS-${stamp}-${String(rows.length + 1).padStart(2, "0")}`;
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyProposal());
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    const p = rowToProposal(r);
    setEditing(p);
    const { id: _id, proposalNo: _no, ...rest } = p;
    setForm(rest);
    setOpen(true);
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setItem = (i: number, patch: Partial<ProposalItem>) =>
    setForm((f) => {
      const items = f.items.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        next.amount = (next.qty || 0) * (next.unitPrice || 0);
        return next;
      });
      return { ...f, items };
    });

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [...f.items, { brand: "", description: "", qty: 1, unit: "Nos", unitPrice: 0, amount: 0 }],
    }));

  const fillItemsFromSystem = () =>
    setForm((f) => {
      const items: ProposalItem[] = [];
      if (f.panelQty > 0)
        items.push({
          brand: f.panelBrand,
          description: `Solar panels ${f.panelWatt}W (${f.panelQty} pcs) — ${systemKw} kWp`,
          qty: f.panelQty,
          unit: "Nos",
          unitPrice: 0,
          amount: 0,
        });
      if (f.inverterKw > 0)
        items.push({
          brand: f.inverterBrand,
          description: `${f.inverterKw} kW ${f.systemType} inverter`,
          qty: 1,
          unit: "Nos",
          unitPrice: 0,
          amount: 0,
        });
      if (f.structureQty > 0)
        items.push({
          brand: f.structureType,
          description: "Mounting structure sets",
          qty: f.structureQty,
          unit: "Set",
          unitPrice: 0,
          amount: 0,
        });
      if (f.battery && f.battery.units > 0)
        items.push({
          brand: f.battery.brand,
          description: `${f.battery.model} ${f.battery.type} battery ${f.battery.kwhEach} kWh`,
          qty: f.battery.units,
          unit: "Nos",
          unitPrice: 0,
          amount: 0,
        });
      if (f.netBilling)
        items.push({ brand: f.disco, description: "Net billing & green meter", qty: 1, unit: "Job", unitPrice: 0, amount: 0 });
      if (f.earthing)
        items.push({ brand: "", description: "Earthing & lightning arrestor", qty: 1, unit: "Job", unitPrice: 0, amount: 0 });
      items.push({ brand: "", description: "Installation & commissioning", qty: 1, unit: "Job", unitPrice: 0, amount: 0 });
      return { ...f, items };
    });

  const save = async () => {
    if (!user) return;
    if (!form.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    const payload = {
      user_id: user.id,
      company_id: company?.id ?? null,
      customer_name: form.customerName,
      system_type: form.systemType,
      system_kw: systemKw,
      total: itemsTotal,
      status: form.status,
      data: JSON.parse(JSON.stringify({ ...form, systemKw, total: itemsTotal })),
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from("proposals").update(payload).eq("id", editing.id);
      if (error) return toast.error("Failed to save proposal");
      toast.success("Proposal updated");
    } else {
      const { error } = await supabase
        .from("proposals")
        .insert([{ ...payload, proposal_no: nextNo() }]);
      if (error) return toast.error("Failed to save proposal");
      toast.success("Proposal saved");
    }
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("proposals").delete().eq("id", id);
    if (error) return toast.error("Failed to delete");
    toast.success("Proposal deleted");
    void load();
  };

  const doPrint = (r: Row) => {
    printProposal(rowToProposal(r), {
      name: settings.companyName || "K&S Solar Energy",
      address: settings.companyAddress || "",
      phone: settings.companyPhone || "",
      email: settings.companyEmail || "",
      logoUrl: settings.logoUrl || "",
    }, formatDate, salesOrdersAll
      .filter((o) => o.location === "completed" && o.status !== "cancelled")
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 8)
      .map((o) => ({
        title: o.projectName || o.customer,
        customer: o.customer,
        date: o.date,
        detail: (o.items || []).slice(0, 3).map((i) => i.description).filter(Boolean).join(" • "),
      })), tariff);
  };

  const hasBattery = form.systemType !== "on-grid" || form.battery !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBadge className="w-6 h-6 text-primary" />
            Proposals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create customer proposals with system details and generate a professional PDF.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> New Proposal
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by proposal no or customer..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading proposals...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileBadge className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No proposals yet</p>
            <p className="text-sm mt-1">Click "New Proposal" to create your first customer proposal.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.proposal_no}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell>
                      {r.system_kw} kW {r.system_type}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(r.total)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "sent" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => doPrint(r)} title="Print / PDF">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Edit">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <ConfirmDeleteDialog
                          title={`Delete proposal "${r.proposal_no}"?`}
                          description="This proposal will be permanently deleted."
                          onConfirm={() => void remove(r.id)}
                        >
                          <Button size="sm" variant="ghost">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </ConfirmDeleteDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} onPageChange={goToPage} itemLabel="proposal" />
          </>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Proposal ${editing.proposalNo}` : "New Proposal"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* System type */}
            <section>
              <h3 className="font-semibold text-sm mb-2">System Type</h3>
              <div className="grid grid-cols-3 gap-2">
                {(["on-grid", "off-grid", "hybrid"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("systemType", t)}
                    className={`rounded-md border-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      form.systemType === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>

            {/* Customer */}
            <section>
              <h3 className="font-semibold text-sm mb-2">Customer</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><Label>Customer name *</Label><Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} /></div>
                <div><Label>Company / place</Label><Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} /></div>
                <div><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
                <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
                <div><Label>Contact number</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
                <div><Label>CNIC (optional)</Label><Input value={form.cnic} onChange={(e) => set("cnic", e.target.value)} /></div>
                <div><Label>Proposal date</Label><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
              </div>
            </section>

            {/* System */}
            <section>
              <h3 className="font-semibold text-sm mb-2">System</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>Number of panels</Label><Input type="number" min={0} value={form.panelQty || ""} onChange={(e) => set("panelQty", +e.target.value)} /></div>
                <div><Label>Panel watt</Label><Input type="number" min={0} value={form.panelWatt || ""} onChange={(e) => set("panelWatt", +e.target.value)} /></div>
                <div className="col-span-2"><Label>Panel brand</Label><Input value={form.panelBrand} onChange={(e) => set("panelBrand", e.target.value)} /></div>
                <div className="col-span-2"><Label>Panel warranty</Label><Input value={form.panelWarranty} onChange={(e) => set("panelWarranty", e.target.value)} /></div>
                <div><Label>Inverter size (kW)</Label><Input type="number" step="0.1" min={0} value={form.inverterKw || ""} onChange={(e) => set("inverterKw", +e.target.value)} /></div>
                <div><Label>Inverter brand</Label><Input value={form.inverterBrand} onChange={(e) => set("inverterBrand", e.target.value)} /></div>
                <div className="col-span-2"><Label>Inverter warranty</Label><Input value={form.inverterWarranty} onChange={(e) => set("inverterWarranty", e.target.value)} /></div>
                <div><Label>Structure qty</Label><Input type="number" min={0} value={form.structureQty || ""} onChange={(e) => set("structureQty", +e.target.value)} /></div>
                <div><Label>Structure type</Label><Input value={form.structureType} onChange={(e) => set("structureType", e.target.value)} /></div>
                <div className="col-span-2 flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.netBilling} onChange={(e) => set("netBilling", e.target.checked)} />
                    Net billing included
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.earthing} onChange={(e) => set("earthing", e.target.checked)} />
                    Earthing & lightning arrestor
                  </label>
                </div>
                {form.netBilling && (
                  <div className="col-span-2"><Label>Distribution company</Label><Input value={form.disco} onChange={(e) => set("disco", e.target.value)} placeholder="FESCO" /></div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                System size: <b className="text-foreground">{systemKw} kWp</b>
              </p>
            </section>

            {/* Battery */}
            {hasBattery && (
              <section>
                <h3 className="font-semibold text-sm mb-2">Battery (optional)</h3>
                {!form.battery ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      set("battery", { type: "Lithium (LiFePO4)", brand: "", model: "", units: 1, kwhEach: 5.12, warranty: "5 years replacement" })
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add battery
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.battery.type} onValueChange={(v) => set("battery", { ...form.battery!, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lithium (LiFePO4)">Lithium (LiFePO4)</SelectItem>
                          <SelectItem value="Lead-acid tubular">Lead-acid tubular</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Brand</Label><Input value={form.battery.brand} onChange={(e) => set("battery", { ...form.battery!, brand: e.target.value })} /></div>
                    <div><Label>Model</Label><Input value={form.battery.model} onChange={(e) => set("battery", { ...form.battery!, model: e.target.value })} /></div>
                    <div><Label>Warranty</Label><Input value={form.battery.warranty} onChange={(e) => set("battery", { ...form.battery!, warranty: e.target.value })} /></div>
                    <div><Label>Units</Label><Input type="number" min={1} value={form.battery.units} onChange={(e) => set("battery", { ...form.battery!, units: +e.target.value })} /></div>
                    <div><Label>kWh per battery</Label><Input type="number" step="0.1" min={0} value={form.battery.kwhEach} onChange={(e) => set("battery", { ...form.battery!, kwhEach: +e.target.value })} /></div>
                    <div className="col-span-2 flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => set("battery", null)}>Remove battery</Button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Monthly usage */}
            <section>
              <h3 className="font-semibold text-sm mb-2">Electricity Usage (units per month)</h3>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {MONTHS.map((m, i) => (
                  <div key={m}>
                    <Label className="text-xs">{m}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.monthlyUnits[i] || ""}
                      onChange={(e) =>
                        setForm((f) => {
                          const mu = [...f.monthlyUnits];
                          mu[i] = +e.target.value;
                          return { ...f, monthlyUnits: mu };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Annual usage: <b className="text-foreground">{form.monthlyUnits.reduce((a, b) => a + (b || 0), 0).toLocaleString()} units</b>
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr] items-end">
                <div>
                  <Label>Electricity connection type</Label>
                  <Select value={form.tariffCategory || "auto"} onValueChange={(v) => set("tariffCategory", v as TariffChoice)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto detect</SelectItem>
                      {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((k) => (
                        <SelectItem key={k} value={k}>{CATEGORY_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Payback uses <b className="text-foreground">{CATEGORY_LABEL[detected.category]}</b> rates ({detected.reason}).
                  </p>
                  <p>
                    Rates: {tariff.source}{tariff.effectiveLabel ? ` — ${tariff.effectiveLabel}` : ""}, last changed {formatDate(tariff.updatedAt)}.{" "}
                    <button type="button" className="text-primary underline disabled:opacity-50" disabled={checking} onClick={checkRates}>
                      {checking ? "Checking…" : "Check for new rates"}
                    </button>
                  </p>
                </div>
              </div>
            </section>

            {/* Quotation items */}
            <section>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h3 className="font-semibold text-sm">Quotation</h3>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={fillItemsFromSystem}>Fill items from system details</Button>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add item</Button>
                </div>
              </div>
              {form.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items yet. Fill system details above, then press "Fill items from system details".</p>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Item / Brand</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-20">Unit</TableHead>
                        <TableHead className="w-28">Unit price</TableHead>
                        <TableHead className="w-28 text-right">Amount</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.items.map((it, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell><Input value={it.brand} onChange={(e) => setItem(i, { brand: e.target.value })} /></TableCell>
                          <TableCell><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></TableCell>
                          <TableCell><Input type="number" min={0} value={it.qty || ""} onChange={(e) => setItem(i, { qty: +e.target.value })} /></TableCell>
                          <TableCell><Input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} /></TableCell>
                          <TableCell><Input type="number" min={0} value={it.unitPrice || ""} onChange={(e) => setItem(i, { unitPrice: +e.target.value })} /></TableCell>
                          <TableCell className="text-right whitespace-nowrap">{formatCurrency(it.amount)}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={6} className="text-right font-semibold">Quotation total</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(itemsTotal)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div><Label>Payment method</Label><Input value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} /></div>
                <div><Label>Delivery</Label><Input value={form.delivery} onChange={(e) => set("delivery", e.target.value)} /></div>
                <div><Label>Sales executive (mobile)</Label><Input value={form.salesExec} onChange={(e) => set("salesExec", e.target.value)} /></div>
                <div><Label>Offer valid for (days)</Label><Input type="number" min={1} value={form.validDays} onChange={(e) => set("validDays", +e.target.value)} /></div>
                <div className="md:col-span-2">
                  <Label>Terms and conditions (one per line; start with ! for red)</Label>
                  <Textarea rows={5} value={form.terms} onChange={(e) => set("terms", e.target.value)} />
                </div>
              </div>
            </section>

            {/* Signed by */}
            <section>
              <h3 className="font-semibold text-sm mb-2">Signed By</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>Name</Label><Input value={form.signedName} onChange={(e) => set("signedName", e.target.value)} /></div>
                <div><Label>Title</Label><Input value={form.signedTitle} onChange={(e) => set("signedTitle", e.target.value)} /></div>
                <div><Label>Mobile</Label><Input value={form.signedPhone} onChange={(e) => set("signedPhone", e.target.value)} /></div>
                <div><Label>Email</Label><Input value={form.signedEmail} onChange={(e) => set("signedEmail", e.target.value)} /></div>
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => void save()}>{editing ? "Update Proposal" : "Save Proposal"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
