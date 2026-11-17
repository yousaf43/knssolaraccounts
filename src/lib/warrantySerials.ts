// Warranty serial stock helpers: reading serials from sheets and choosing available ones.
export type SerialCategory = "panel" | "inverter" | "battery" | "motor" | "other";
export const SERIAL_CATEGORY_LABEL: Record<SerialCategory, string> = {
  panel: "Solar Panel", inverter: "Inverter", battery: "Battery", motor: "Solar Pump/Motor", other: "Other",
};
export interface StockSerial {
  id: string; serial: string; serial_key: string; category: string; watt: number | null;
  brand_model: string | null; batch_label: string | null; status: string; warranty_id: string | null; created_at?: string;
}

export const serialKey = (s: string) => s.replace(/\s/g, "").toUpperCase();

/** Pull serial-looking codes (6+ letters/digits with at least one digit, not plain dates/phones of labels) from sheet text. */
export function extractSerials(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,;|\t]+/)) {
    const t = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    if (t.length < 8 || t.length > 40) continue;
    if (!/\d/.test(t) || !/^[A-Za-z0-9\-/_.]+$/.test(t)) continue;
    if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(t)) continue; // dates
    const k = serialKey(t);
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}

/** Panel wattage written in a product name, e.g. "JA Solar 605W" -> 605. */
export function wattFromText(text: string): number | null {
  const m = /(\d{3,4})\s*W(?:att|p)?\b/i.exec(text || "");
  return m ? Number(m[1]) : null;
}

/** True when the product text mentions the serial's brand (or either side is blank). */
export function brandMatches(brand?: string | null, text?: string): boolean {
  const b = (brand || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return !b || !t || t.includes(b) || b.includes(t);
}

/** Available serials for a category (and watt, for panels) that match what the user is typing. */
export function suggestSerials(stock: StockSerial[], opts: { category: string; watt?: number | null; brandText?: string; query: string; exclude: string[]; limit?: number }): StockSerial[] {
  const q = serialKey(opts.query);
  const ex = new Set(opts.exclude.map(serialKey));
  return stock.filter((s) =>
    s.status === "available" && !s.warranty_id && s.category === opts.category &&
    (!opts.watt || !s.watt || Number(s.watt) === Number(opts.watt)) &&
    brandMatches(s.brand_model, opts.brandText) &&
    !ex.has(s.serial_key) && (!q || s.serial_key.includes(q)),
  ).slice(0, opts.limit ?? 8);
}

/** Which warranty already owns this serial (other than the one being edited). */
export function usedElsewhere(stock: StockSerial[], serial: string, currentWarrantyId: string): StockSerial | undefined {
  const k = serialKey(serial);
  return stock.find((s) => s.serial_key === k && s.warranty_id && s.warranty_id !== currentWarrantyId);
}

export async function readSheetText(file: File): Promise<string> {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    for (let n = 1; n <= doc.numPages; n++) {
      const c = await (await doc.getPage(n)).getTextContent();
      text += c.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
    }
    return text;
  }
  return file.text();
}
