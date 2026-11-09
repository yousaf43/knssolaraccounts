import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Printer, ShieldCheck, Paperclip, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomersCloud } from "@/hooks/useAppData";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_OUTPUT_WARRANTY, KIND_DEFAULTS, KIND_LABEL, dmy, parseSerials, printWarranty, type WarrantyItem, type WarrantyKind, type WarrantyRecord } from "@/lib/warrantyPrint";

/** Serials typed one at a time (Enter adds), with optional bulk paste. */
function SerialEntry({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [one, setOne] = useState("");
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const add = (list: string[]) => { onChange(parseSerials([...value, ...list].join("\n"))); };
  const addOne = () => {
    const v = one.trim();
    if (!v) return;
    if (value.some((x) => x.toUpperCase() === v.toUpperCase())) { toast({ title: "Serial already added", description: v, variant: "destructive" }); return; }
    add([v]); setOne("");
  };
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex gap-2">
        <Input className="font-mono" placeholder="Type or scan a serial, press Enter" value={one} onChange={(e) => setOne(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }} />
        <Button type="button" variant="secondary" onClick={addOne}>Add</Button>
        <Button type="button" variant="ghost" onClick={() => setBulk((b) => !b)}>{bulk ? "Close" : "Paste many"}</Button>
      </div>
      {bulk && <div className="space-y-1"><Textarea rows={4} className="font-mono" placeholder="One per line or comma separated" value={bulkText} onChange={(e) => setBulkText(e.target.value)} /><Button type="button" size="sm" onClick={() => { add(parseSerials(bulkText)); setBulkText(""); setBulk(false); }}>Add all</Button></div>}
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{value.length} serial(s)</span>{value.length > 0 && <button type="button" className="text-destructive" onClick={() => onChange([])}>Clear all</button>}</div>
      {value.length > 0 && <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">{value.map((v, i) => (
        <span key={v} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs"><span className="text-muted-foreground">{i + 1}.</span>{v}<button type="button" title="Remove" onClick={() => onChange(value.filter((x) => x !== v))}><X className="h-3 w-3" /></button></span>
      ))}</div>}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): WarrantyRecord => ({
  id: "", certificateNo: "", customerName: "", fatherName: "", cnic: "", phone: "", address: "", invoiceNo: "",
  productDescription: "A Grade JA Solar Brand 605W Solar Panels", quantity: 0, startDate: today(), issueDate: today(),
  workmanshipYears: 12, outputWarranty: DEFAULT_OUTPUT_WARRANTY, serialNumbers: [], attachmentPath: "", notes: "", extraItems: [],
});

type Row = Record<string, any>;
const fromDb = (r: Row): WarrantyRecord => ({
  id: r.id, certificateNo: r.certificate_no, customerName: r.customer_name, fatherName: r.father_name || "",
  cnic: r.cnic || "", phone: r.phone || "", address: r.address || "", invoiceNo: r.invoice_no || "",
  productDescription: r.product_description || "", quantity: Number(r.quantity) || 0, startDate: r.start_date,
  issueDate: r.issue_date, workmanshipYears: Number(r.workmanship_years) || 0, outputWarranty: r.output_warranty || "",
  serialNumbers: r.serial_numbers || [], attachmentPath: r.attachment_path || "", notes: r.notes || "",
  extraItems: Array.isArray(r.extra_items) ? r.extra_items : [],
});

const CNIC_RE = /\b\d{5}-?\d{7}-?\d\b/;

export default function WarrantiesPage() {
  const { user } = useAuth();
  const { data: customers } = useCustomersCloud();
  const [list, setList] = useState<WarrantyRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WarrantyRecord>(empty());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("warranties" as never).select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load warranties", description: error.message, variant: "destructive" });
    else setList(((data || []) as Row[]).map(fromDb));
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/-/g, "");
    if (!q) return list;
    return list.filter((w) =>
      [w.certificateNo, w.customerName, w.cnic, w.phone, w.address, w.invoiceNo, ...w.serialNumbers, ...(w.extraItems || []).flatMap((i) => [i.description, ...i.serials])]
        .some((v) => (v || "").toLowerCase().replace(/-/g, "").includes(q)));
  }, [list, search]);

  const nextNo = () => {
    const max = list.reduce((m, w) => Math.max(m, Number(/(\d+)$/.exec(w.certificateNo)?.[1] || 0)), 0);
    return `WAR-${String(max + 1).padStart(4, "0")}`;
  };

  const openNew = () => { setForm({ ...empty(), certificateNo: nextNo() }); setFile(null); setOpen(true); };
  const openEdit = (w: WarrantyRecord) => { setForm(w); setFile(null); setOpen(true); };
  const set = <K extends keyof WarrantyRecord>(k: K, v: WarrantyRecord[K]) => setForm((f) => ({ ...f, [k]: v }));

  const setItem = (idx: number, patch: Partial<WarrantyItem>) =>
    setForm((f) => ({ ...f, extraItems: (f.extraItems || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const addItem = (kind: WarrantyKind) =>
    setForm((f) => ({ ...f, extraItems: [...(f.extraItems || []), { kind, quantity: 1, serials: [], ...KIND_DEFAULTS[kind] }] }));

  const pickCustomer = (name: string) => {
    set("customerName", name);
    const c = customers.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!c) return;
    const cnic = CNIC_RE.exec(`${c.address || ""} ${c.company || ""}`)?.[0] || "";
    setForm((f) => ({
      ...f, customerName: c.name, phone: f.phone || c.phone || "", cnic: f.cnic || cnic,
      address: f.address || (c.address || "").replace(CNIC_RE, "").replace(/CNIC[:\s]*/i, "").trim(),
    }));
  };

  const signedUrl = async (path: string) => {
    if (!path) return undefined;
    const { data } = await supabase.storage.from("warranty-attachments").createSignedUrl(path, 600);
    return data?.signedUrl;
  };

  const save = async (andPrint: boolean) => {
    if (!form.customerName.trim()) { toast({ title: "Customer name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const serials = form.serialNumbers;
      const extra = (form.extraItems || []).filter((i) => i.description.trim() || i.serials.length).map((i) => ({ ...i, quantity: i.quantity || i.serials.length }));
      let attachmentPath = form.attachmentPath;
      if (file) {
        const { data: cid } = await supabase.rpc("current_company_id");
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${cid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("warranty-attachments").upload(path, file);
        if (error) throw error;
        attachmentPath = path;
      }
      const row = {
        user_id: user?.id, certificate_no: form.certificateNo || nextNo(), customer_name: form.customerName.trim(),
        father_name: form.fatherName || null, cnic: form.cnic || null, phone: form.phone || null, address: form.address || null,
        invoice_no: form.invoiceNo || null, product_description: form.productDescription,
        quantity: form.quantity || serials.length, start_date: form.startDate, issue_date: form.issueDate,
        workmanship_years: form.workmanshipYears, output_warranty: form.outputWarranty || null,
        serial_numbers: serials, attachment_path: attachmentPath || null, notes: form.notes || null, extra_items: extra,
      };
      const q = form.id
        ? supabase.from("warranties" as never).update(row as never).eq("id", form.id).select().single()
        : supabase.from("warranties" as never).insert(row as never).select().single();
      let { data, error } = await q;
      if (error && /extra_items/.test(error.message)) {
        // Older database without the extra equipment column: save the main item only.
        const { extra_items: _x, ...legacy } = row;
        ({ data, error } = await (form.id
          ? supabase.from("warranties" as never).update(legacy as never).eq("id", form.id).select().single()
          : supabase.from("warranties" as never).insert(legacy as never).select().single()));
        if (!error && extra.length) toast({ title: "Inverter/motor items not saved", description: "This server needs an update for extra equipment.", variant: "destructive" });
      }
      if (error) throw error;
      const saved = fromDb(data as Row);
      toast({ title: "Warranty saved" });
      setOpen(false);
      await load();
      if (andPrint) printWarranty(saved, await signedUrl(saved.attachmentPath));
    } catch (e) {
      toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const remove = async (w: WarrantyRecord) => {
    const { error } = await supabase.from("warranties" as never).delete().eq("id", w.id);
    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); return; }
    if (w.attachmentPath) await supabase.storage.from("warranty-attachments").remove([w.attachmentPath]);
    toast({ title: "Warranty deleted" });
    void load();
  };

  const viewAttachment = async (w: WarrantyRecord) => {
    const url = await signedUrl(w.attachmentPath);
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Warranty Certificates</h1>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" />New Warranty</Button>
      </div>

      <Input placeholder="Search by name, CNIC, phone, invoice or serial number..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="p-2">No.</th><th className="p-2">Date</th><th className="p-2">Customer</th><th className="p-2">CNIC</th><th className="p-2">Phone</th><th className="p-2">Product</th><th className="p-2">Serials</th><th className="p-2 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="p-2 font-medium">{w.certificateNo}</td>
                <td className="p-2 whitespace-nowrap">{dmy(w.issueDate)}</td>
                <td className="p-2">{w.customerName}</td>
                <td className="p-2 whitespace-nowrap">{w.cnic}</td>
                <td className="p-2 whitespace-nowrap">{w.phone}</td>
                <td className="p-2">{w.quantity ? `${w.quantity} × ` : ""}{w.productDescription}{(w.extraItems || []).map((i, n) => <div key={n} className="text-xs text-muted-foreground">+ {i.quantity ? `${i.quantity} × ` : ""}{i.description || KIND_LABEL[i.kind]}</div>)}</td>
                <td className="p-2">{w.serialNumbers.length + (w.extraItems || []).reduce((n, i) => n + i.serials.length, 0)}{w.attachmentPath && <button onClick={() => viewAttachment(w)} className="ml-2 text-primary" title="View attached sheet"><Paperclip className="inline h-4 w-4" /></button>}</td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="Print" onClick={async () => printWarranty(w, await signedUrl(w.attachmentPath))}><Printer className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete warranty {w.certificateNo}?</AlertDialogTitle><AlertDialogDescription>This record and its attached sheet will be removed.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => remove(w)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No warranties yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Warranty Certificate</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Certificate No.</Label><Input value={form.certificateNo} onChange={(e) => set("certificateNo", e.target.value)} /></div>
            <div><Label>Invoice No.</Label><Input value={form.invoiceNo} onChange={(e) => set("invoiceNo", e.target.value)} /></div>
            <div>
              <Label>Customer Name *</Label>
              <Input list="warranty-customers" value={form.customerName} onChange={(e) => pickCustomer(e.target.value)} />
              <datalist id="warranty-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div><Label>Father Name</Label><Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} /></div>
            <div><Label>CNIC</Label><Input value={form.cnic} placeholder="00000-0000000-0" onChange={(e) => set("cnic", e.target.value)} /></div>
            <div><Label>Mobile No.</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Address / Location</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Product (e.g. A Grade JA Solar Brand 605W Solar Panels)</Label><Input value={form.productDescription} onChange={(e) => set("productDescription", e.target.value)} /></div>
            <div><Label>Quantity</Label><Input type="number" value={form.quantity || ""} placeholder="Auto from serials" onChange={(e) => set("quantity", Number(e.target.value) || 0)} /></div>
            <div><Label>Workmanship warranty (years)</Label><Input type="number" value={form.workmanshipYears} onChange={(e) => set("workmanshipYears", Number(e.target.value) || 0)} /></div>
            <div><Label>Warranty start date</Label><DateInput value={form.startDate} onChange={(v: string) => set("startDate", v)} /></div>
            <div><Label>Certificate date</Label><DateInput value={form.issueDate} onChange={(v: string) => set("issueDate", v)} /></div>
            <div className="sm:col-span-2"><Label>Output warranty text</Label><Textarea rows={2} value={form.outputWarranty} onChange={(e) => set("outputWarranty", e.target.value)} /></div>
            <div className="sm:col-span-2">
              <Label>Solar panel serial numbers</Label>
              <SerialEntry value={form.serialNumbers} onChange={(v) => set("serialNumbers", v)} />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="mr-auto">Other equipment (inverter, battery, motor)</Label>
                {(["inverter", "battery", "motor", "other"] as WarrantyKind[]).map((k) => (
                  <Button key={k} type="button" size="sm" variant="outline" onClick={() => addItem(k)}><Plus className="mr-1 h-3 w-3" />{KIND_LABEL[k]}</Button>
                ))}
              </div>
              {(form.extraItems || []).map((it, idx) => (
                <div key={idx} className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
                  <div className="flex items-center justify-between sm:col-span-4">
                    <Select value={it.kind} onValueChange={(v) => setItem(idx, { kind: v as WarrantyKind })}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>{(["inverter", "battery", "motor", "other"] as WarrantyKind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" title="Remove item" onClick={() => setForm((f) => ({ ...f, extraItems: (f.extraItems || []).filter((_, i) => i !== idx) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="sm:col-span-2"><Label>Product</Label><Input value={it.description} placeholder="e.g. Solis 10kW Hybrid Inverter" onChange={(e) => setItem(idx, { description: e.target.value })} /></div>
                  <div><Label>Quantity</Label><Input type="number" value={it.quantity || ""} onChange={(e) => setItem(idx, { quantity: Number(e.target.value) || 0 })} /></div>
                  <div><Label>Warranty (years)</Label><Input type="number" value={it.years || ""} onChange={(e) => setItem(idx, { years: Number(e.target.value) || 0 })} /></div>
                  <div className="sm:col-span-4"><Label>Warranty terms</Label><Textarea rows={2} value={it.terms} onChange={(e) => setItem(idx, { terms: e.target.value })} /></div>
                  <div className="sm:col-span-4"><Label>Serial numbers</Label><SerialEntry value={it.serials} onChange={(v) => setItem(idx, { serials: v })} /></div>
                </div>
              ))}
            </div>
            <div className="sm:col-span-2">
              <Label>Attach serial sheet photo/PDF (for record)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {form.attachmentPath && !file && <p className="mt-1 text-xs text-muted-foreground">A sheet is already attached. Choose a new file to replace it.</p>}
            </div>
            <div className="sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="secondary" disabled={saving} onClick={() => save(false)}>Save</Button>
            <Button disabled={saving} onClick={() => save(true)}><Printer className="mr-1 h-4 w-4" />Save & Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
