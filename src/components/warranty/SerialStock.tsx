import { useMemo, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { pdfFileToJpegs } from "@/lib/attachmentPages";
import { SERIAL_CATEGORY_LABEL, extractSerials, readSheetText, serialKey, type SerialCategory, type StockSerial } from "@/lib/warrantySerials";

const CATS = Object.keys(SERIAL_CATEGORY_LABEL) as SerialCategory[];
const PAGE = 25;

export default function SerialStock({ stock, certNo, reload }: { stock: StockSerial[]; certNo: Record<string, string>; reload: () => Promise<void> }) {
  const [category, setCategory] = useState<SerialCategory>("panel");
  const [watt, setWatt] = useState("");
  const [brand, setBrand] = useState("");
  const [batch, setBatch] = useState("");
  const [preview, setPreview] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [fCat, setFCat] = useState("all");
  const [fWatt, setFWatt] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const existing = useMemo(() => new Set(stock.map((s) => s.serial_key)), [stock]);
  const newOnes = preview.filter((p) => !existing.has(serialKey(p)));
  const dupes = preview.length - newOnes.length;

  const readFile = async (f: File | null) => {
    setFile(f); if (!f) return;
    setBusy(true);
    try {
      let found = /\.(csv|txt)$/i.test(f.name) ? extractSerials(await readSheetText(f)) : [];
      if (!found.length) {
        if (f.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB");
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        // PDFs are turned into page photos in the browser so the server gets small, clear images.
        const parts: { mimeType: string; data: string }[] = isPdf
          ? (await pdfFileToJpegs(f)).map((data) => ({ mimeType: "image/jpeg", data }))
          : [{ mimeType: f.type || "image/jpeg", data: await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(r.error); r.readAsDataURL(f); }) }];
        const all: string[] = [];
        for (const part of parts) {
          const { data: res, error } = await supabase.functions.invoke("serial-extract", { body: part });
          if (error || res?.error) {
            let msg = res?.error as string | undefined;
            const ctx = (error as { context?: Response } | null)?.context;
            if (!msg && ctx && typeof ctx.json === "function") msg = (await ctx.json().catch(() => null))?.error;
            throw new Error(msg || error?.message || "Could not read sheet");
          }
          for (const s of (res?.serials || []) as string[]) if (!all.includes(s)) all.push(s);
        }
        found = all;
      }
      setPreview(found);
      if (!found.length) toast({ title: "No serial numbers found", description: "Please paste or type the numbers below.", variant: "destructive" });
      else toast({ title: `${found.length} serial numbers found` });
    } catch (e) { toast({ title: "Could not read file", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!brand.trim()) { toast({ title: "Enter brand", variant: "destructive" }); return; }
    if (category === "panel" && !Number(watt)) { toast({ title: "Enter panel watt", variant: "destructive" }); return; }
    if (!newOnes.length) { toast({ title: "No new serials to save", variant: "destructive" }); return; }
    setBusy(true);
    try {
      let source_path: string | null = null;
      if (file) {
        const { data: cid } = await supabase.rpc("current_company_id");
        const path = `${cid}/serial-sheets/${crypto.randomUUID()}.${file.name.split(".").pop() || "pdf"}`;
        if (!(await supabase.storage.from("warranty-attachments").upload(path, file)).error) source_path = path;
      }
      const rows = newOnes.map((serial) => ({ serial, serial_key: serialKey(serial), category, watt: category === "panel" ? Number(watt) : (Number(watt) || null), brand_model: brand || null, batch_label: batch || null, source_path }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("warranty_serials" as never).upsert(rows.slice(i, i + 500) as never, { onConflict: "company_id,serial_key", ignoreDuplicates: true });
        if (error) throw error;
      }
      toast({ title: `${rows.length} serials saved`, description: dupes ? `${dupes} already in stock were skipped.` : undefined });
      setPreview([]); setFile(null); setExtra("");
      await reload();
    } catch (e) { toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const remove = async (s: StockSerial) => {
    const { error } = await supabase.from("warranty_serials" as never).delete().eq("id", s.id);
    if (error) toast({ title: "Could not delete", description: error.message, variant: "destructive" }); else void reload();
  };

  const watts = useMemo(() => [...new Set(stock.map((s) => s.watt).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [stock]);
  const filtered = useMemo(() => {
    const k = serialKey(q);
    return stock.filter((s) => (fCat === "all" || s.category === fCat) && (fWatt === "all" || String(s.watt) === fWatt) &&
      (fStatus === "all" || (fStatus === "used" ? !!s.warranty_id : !s.warranty_id)) &&
      (!k || s.serial_key.includes(k) || (certNo[s.warranty_id || ""] || "").toUpperCase().includes(k)));
  }, [stock, fCat, fWatt, fStatus, q, certNo]);
  const avail = stock.filter((s) => !s.warranty_id).length;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Upload serial sheet</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SerialCategory)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{SERIAL_CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>{category === "panel" ? "Panel watt *" : "Size / watt (optional)"}</Label><Input type="number" value={watt} placeholder="e.g. 605" onChange={(e) => setWatt(e.target.value)} /></div>
          <div><Label>Brand *</Label><Input value={brand} placeholder="e.g. JA Solar" onChange={(e) => setBrand(e.target.value)} /></div>
          <div><Label>Batch / container</Label><Input value={batch} onChange={(e) => setBatch(e.target.value)} /></div>
        </div>
        <div><Label>Scanned sheet (PDF or photo){busy ? " — reading serial numbers..." : ""}</Label><Input type="file" accept="application/pdf,image/*,.csv,.txt,text/plain" disabled={busy} onChange={(e) => readFile(e.target.files?.[0] || null)} /></div>
        <div><Label>Or paste / type serials</Label>
          <div className="flex gap-2"><Textarea rows={2} className="font-mono" value={extra} placeholder="One per line or comma separated" onChange={(e) => setExtra(e.target.value)} />
            <Button type="button" variant="secondary" onClick={() => { setPreview((p) => [...p, ...extractSerials(extra).filter((x) => !p.some((y) => serialKey(y) === serialKey(x)))]); setExtra(""); }}>Add</Button></div></div>
        {preview.length > 0 && (<>
          <div className="text-sm"><b>{newOnes.length}</b> new{dupes ? <span className="text-muted-foreground"> · {dupes} already in stock (skipped)</span> : null}</div>
          <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">{preview.map((p) => (
            <span key={p} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs ${existing.has(serialKey(p)) ? "bg-destructive/10 text-destructive line-through" : "bg-muted"}`}>{p}
              <button type="button" onClick={() => setPreview((l) => l.filter((x) => x !== p))}>×</button></span>))}</div>
          <div className="flex gap-2"><Button disabled={busy} onClick={save}><Upload className="mr-1 h-4 w-4" />Save {newOnes.length} serials</Button><Button variant="outline" onClick={() => { setPreview([]); setFile(null); }}>Clear</Button></div>
        </>)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Search serial or WAR no..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <Select value={fCat} onValueChange={(v) => { setFCat(v); setPage(0); }}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{CATS.map((c) => <SelectItem key={c} value={c}>{SERIAL_CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent></Select>
        <Select value={fWatt} onValueChange={(v) => { setFWatt(v); setPage(0); }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All watts</SelectItem>{watts.map((w) => <SelectItem key={String(w)} value={String(w)}>{w}W</SelectItem>)}</SelectContent></Select>
        <Select value={fStatus} onValueChange={(v) => { setFStatus(v); setPage(0); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="used">Used</SelectItem></SelectContent></Select>
        <span className="text-sm text-muted-foreground">{avail} available · {stock.length - avail} used</span>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-2">Serial</th><th className="p-2">Category</th><th className="p-2">Watt</th><th className="p-2">Brand</th><th className="p-2">Batch</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
          <tbody>
            {filtered.slice(page * PAGE, page * PAGE + PAGE).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2 font-mono">{s.serial}</td>
                <td className="p-2">{SERIAL_CATEGORY_LABEL[s.category as SerialCategory] || s.category}</td>
                <td className="p-2">{s.watt ? `${s.watt}W` : ""}</td>
                <td className="p-2">{s.brand_model}</td>
                <td className="p-2">{s.batch_label}</td>
                <td className="p-2">{s.warranty_id ? <span className="text-destructive">Used · {certNo[s.warranty_id] || "warranty"}</span> : <span className="text-primary">Available</span>}</td>
                <td className="p-2 text-right">{!s.warranty_id && (
                  <AlertDialog><AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete serial {s.serial}?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => remove(s)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}</td>
              </tr>))}
            {!filtered.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No serials.</td></tr>}
          </tbody>
        </table>
      </div>
      {filtered.length > PAGE && <div className="flex items-center justify-end gap-2 text-sm">
        <Button size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Prev</Button>
        <span>{page + 1} / {Math.ceil(filtered.length / PAGE)}</span>
        <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  );
}
