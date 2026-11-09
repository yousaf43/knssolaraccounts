export type WarrantyRecord = {
  id: string;
  certificateNo: string;
  customerName: string;
  fatherName: string;
  cnic: string;
  phone: string;
  address: string;
  invoiceNo: string;
  productDescription: string;
  quantity: number;
  startDate: string; // yyyy-mm-dd
  issueDate: string; // yyyy-mm-dd
  workmanshipYears: number;
  outputWarranty: string;
  serialNumbers: string[];
  attachmentPath: string;
  notes: string;
  extraItems?: WarrantyItem[];
};

export const DEFAULT_OUTPUT_WARRANTY =
  "30 years output warranty: 1% in the first year, thereafter 0.4 % per year ending with 85% in the 30th year from the Warranty Start Date.";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const dmy = (iso: string, sep = "-") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}${sep}${m[2]}${sep}${m[1]}` : iso || "";
};

/** Splits pasted serial text (lines, commas, tabs) into unique trimmed serials, keeping order. */
export function parseSerials(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,\t;]+/)) {
    const s = raw.trim();
    if (s && !seen.has(s.toUpperCase())) { seen.add(s.toUpperCase()); out.push(s); }
  }
  return out;
}

export type WarrantyKind = "panel" | "inverter" | "battery" | "motor" | "other";
export type WarrantyItem = {
  kind: WarrantyKind; description: string; quantity: number; years: number; terms: string; serials: string[];
};
export const KIND_LABEL: Record<WarrantyKind, string> = {
  panel: "Solar Panels", inverter: "Inverter", battery: "Battery", motor: "Solar Water Pump / Motor", other: "Other Equipment",
};
export const KIND_DEFAULTS: Record<WarrantyKind, Omit<WarrantyItem, "kind" | "serials" | "quantity">> = {
  panel: { description: "A Grade JA Solar Brand 605W Solar Panels", years: 12, terms: DEFAULT_OUTPUT_WARRANTY },
  inverter: { description: "Hybrid Solar Inverter", years: 5, terms: "Manufacturer warranty against manufacturing defects as per brand policy. Damage from over-voltage, lightning, water ingress or wrong wiring is not covered." },
  battery: { description: "Lithium Battery", years: 5, terms: "Manufacturer warranty on capacity and manufacturing defects as per brand policy. Deep discharge, overcharging or physical damage is not covered." },
  motor: { description: "Solar Water Pump / Motor", years: 1, terms: "Warranty against manufacturing defects in motor winding and pump. Dry running, sand/mud damage, burnt winding from wrong voltage and bore issues are not covered." },
  other: { description: "", years: 1, terms: "Manufacturer warranty as per brand policy." },
};
/** All equipment on a certificate: the main item (legacy columns) followed by extra items. */
export const allItems = (w: WarrantyRecord): WarrantyItem[] => [
  { kind: "panel" as WarrantyKind, description: w.productDescription, quantity: w.quantity, years: w.workmanshipYears, terms: w.outputWarranty, serials: w.serialNumbers },
  ...(w.extraItems || []),
].filter((i, idx) => idx === 0 || i.description || i.serials.length);

export function warrantyHtml(w: WarrantyRecord, attachmentUrl?: string) {
  const origin = window.location.origin;
  const logo = `${origin}/portfolio/ks-logo.webp`;
  const items = allItems(w);
  const compact = items.length > 2;
  const dots = (v: string, n = 28) => (v ? esc(v) : ".".repeat(n));
  const header = `
  <div class="top"></div>
  <div class="head">
    <img class="logo" src="${logo}" alt="K&S Solar Energy">
    <div class="contact">
      <div>&#9990; +92 300 9884939</div><div>&#9990; +92 347 9645424</div><div>&#9742; +92 453 515 939</div>
      <div>&#9993; info@knssolar.com.pk</div><div>&#127760; www.knssolar.com.pk</div>
    </div>
  </div>`;
  const footer = `
  <div class="foot">
    <div>4-Basement Ramzan Plaza, College Road<br>Bhakkar, Punjab Pakistan</div>
    <div>Phase 4A, Ghouri Town, Street # 40<br>Plat No 1080, Islamabad.</div>
    <div>Office 9, 1st Floor, Khalid Business Center<br>Johar Town Lahore</div>
  </div>
  <div class="bar"><span>K&amp;S</span><i>|</i><em>Run by Sun</em></div>`;
  const wm = `<img class="wm" src="${logo}" alt="">`;

  const serialTable = (s: string[]) => {
    const cols = 3, per = Math.ceil(s.length / cols) || 1, rows: string[] = [];
    for (let r = 0; r < per; r++) {
      const cells = [];
      for (let c = 0; c < cols; c++) {
        const i = c * per + r;
        cells.push(i < s.length ? `<td class="n">${i + 1}</td><td>${esc(s[i])}</td>` : `<td class="n"></td><td></td>`);
      }
      rows.push(`<tr>${cells.join("")}</tr>`);
    }
    return `<table class="serials"><thead><tr>${"<th>#</th><th>Serial Number</th>".repeat(cols)}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  };
  const withSerials = items.filter((i) => i.serials.length);
  const serialPage = withSerials.length || attachmentUrl ? `
  <section class="page">${wm}${header}
    <h1>Serial Numbers</h1>
    <p class="sub">Certificate <b>${esc(w.certificateNo)}</b> &middot; ${esc(w.customerName)}${w.cnic ? ` &middot; CNIC ${esc(w.cnic)}` : ""}</p>
    ${withSerials.map((i) => `<div class="sgroup"><div class="stitle">${esc(KIND_LABEL[i.kind])} <span>${esc(i.description)} &middot; Qty ${esc(i.quantity || i.serials.length)}</span></div>${serialTable(i.serials)}</div>`).join("")}
    ${attachmentUrl && !withSerials.length ? `<img class="scan" src="${esc(attachmentUrl)}" alt="Serial sheet">` : ""}
    <div class="grow"></div>${footer}
  </section>` : "";

  const equipRows = items.map((i, n) => `<tr><td class="c">${n + 1}</td><td><b>${esc(KIND_LABEL[i.kind])}</b><br><span class="muted">${esc(i.description)}</span></td><td class="c">${esc(i.quantity || i.serials.length || "-")}</td><td class="c">${i.years ? `${esc(i.years)} Year${i.years > 1 ? "s" : ""}` : "-"}</td><td class="c">${i.serials.length || "-"}</td></tr>`).join("");
  const termBlocks = items.map((i) => i.kind === "panel"
    ? `<div class="tb"><h2>${esc(KIND_LABEL[i.kind])} Warranty</h2><div>${esc(i.years)} years' workmanship warranty. ${esc(i.terms || DEFAULT_OUTPUT_WARRANTY)}</div></div>`
    : `<div class="tb"><h2>${esc(KIND_LABEL[i.kind])} Warranty &mdash; ${esc(i.years)} Year${i.years > 1 ? "s" : ""}</h2><div>${esc(i.terms)}</div></div>`).join("");
  const hasPanels = items.some((i) => i.kind === "panel" && (i.description || i.serials.length));

  return `<!doctype html><html><head><meta charset="utf-8"><title>Warranty ${esc(w.certificateNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Kaushan+Script&family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:'Open Sans',Arial,sans-serif;color:#1d2733;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;display:flex;flex-direction:column;page-break-after:always;background:#fff}
.page:last-child{page-break-after:auto}
.page:before{content:"";position:absolute;inset:4mm;border:.4mm solid #c9d8ea;border-radius:2mm;pointer-events:none}
.top{height:9mm;background:linear-gradient(90deg,#1f6fb8 72%,#f5a623 72%)}
.head{display:flex;justify-content:space-between;align-items:flex-start;padding:5mm 12mm 0;position:relative}
.logo{height:24mm}
.contact{background:#f5a623;color:#13325a;font-weight:700;font-size:9.5pt;line-height:1.5;padding:2.5mm 5mm;border-radius:1.5mm;margin-top:-4mm}
.titlebox{text-align:center;margin:3mm 0 2mm;position:relative}
h1{font-family:'Kaushan Script',cursive;text-align:center;font-size:30pt;margin:3mm 0 0;color:#13325a;font-weight:400}
.rule{width:60mm;height:1mm;margin:1mm auto 0;background:linear-gradient(90deg,transparent,#f5a623,#1f6fb8,transparent)}
.certno{display:inline-block;margin-top:2mm;font-size:9pt;font-weight:700;letter-spacing:.6px;color:#1f6fb8;border:.3mm solid #1f6fb8;border-radius:5mm;padding:.6mm 4mm}
.wm{position:absolute;top:100mm;left:45mm;width:120mm;opacity:.06;pointer-events:none}
.body{padding:0 16mm;font-size:10pt;line-height:1.45;position:relative}
.compact .body{font-size:9pt;line-height:1.35}
.card{border:.3mm solid #c9d8ea;border-left:1.6mm solid #1f6fb8;background:#f4f8fc;border-radius:1.5mm;padding:2.5mm 4mm;margin:2.5mm 0}
.grid{display:grid;grid-template-columns:24mm 1fr 24mm 1fr;gap:1.2mm 3mm}
.grid .k{color:#4a6380;font-weight:600;font-size:8.8pt;text-transform:uppercase;letter-spacing:.3px}
.grid .v{font-weight:700;text-transform:uppercase;border-bottom:.2mm dotted #9bb3cf}
.equip{width:100%;border-collapse:collapse;margin:2mm 0;font-size:9pt}
.equip th{background:#1f6fb8;color:#fff;padding:1.4mm 2mm;text-align:left;font-weight:700}
.equip td{border-bottom:.25mm solid #d6e2ef;padding:1.2mm 2mm;vertical-align:top}.equip tr:nth-child(even) td{background:#f7fafd}
.equip .c{text-align:center}.muted{color:#4a6380}
h2{font-size:10.5pt;font-weight:800;margin:0 0 .5mm;color:#13325a}
.tb{border-left:1mm solid #f5a623;padding:.5mm 0 .5mm 3mm;margin:2mm 0}
ul{padding-left:5mm;margin:2mm 0}li{margin:.8mm 0;text-align:justify}
.sign{display:flex;justify-content:space-between;align-items:flex-end;padding:0 22mm;margin-top:5mm;font-weight:700;font-size:10pt}
.sline{border-top:.3mm solid #1d2733;width:45mm;text-align:center;padding-top:1mm}
.stamp{width:28mm;height:28mm;border:1mm double #2c4fa3;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#2c4fa3;font-size:9pt;opacity:.7}
.grow{flex:1}
.foot{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;padding:0 8mm 3mm;font-size:8.5pt;font-weight:700;text-align:center;color:#1b1b1b}
.foot div+div{border-left:.8mm solid #f5a623}
.bar{height:12mm;background:#1f6fb8;border-top:2mm solid #f5a623;display:flex;align-items:center;justify-content:center;gap:3mm;color:#fff;font-weight:700;font-size:14pt}
.bar em{font-family:'Kaushan Script',cursive;font-style:normal;font-size:17pt}
.sub{text-align:center;font-size:10pt;margin:2mm 15mm 3mm}
.sgroup{margin:0 14mm 4mm}.stitle{font-weight:800;color:#13325a;border-left:1mm solid #f5a623;padding-left:2mm;margin-bottom:1.5mm}.stitle span{font-weight:400;color:#4a6380;font-size:9pt}
.serials{border-collapse:collapse;font-size:9pt;width:100%}
.serials th,.serials td{border:.25mm solid #9bb3cf;padding:1mm 2mm}.serials th{background:#e7f0fa}.serials .n{width:8mm;text-align:center;color:#555}
.scan{display:block;max-width:180mm;max-height:200mm;margin:0 auto;object-fit:contain}
</style></head><body>
<section class="page ${compact ? "compact" : ""}">${wm}${header}
  <div class="titlebox"><h1>Warranty Certificate</h1><div class="rule"></div><div class="certno">CERTIFICATE NO. ${esc(w.certificateNo)}</div></div>
  <div class="body">
    <p style="margin:0">It is to certify that the following equipment has been sold and installed by <b>K&amp;S Solar Energy (Pvt) Ltd</b> to:</p>
    <div class="card"><div class="grid">
      <div class="k">Name</div><div class="v">${dots(w.customerName)}</div><div class="k">CNIC No.</div><div class="v">${dots(w.cnic, 22)}</div>
      <div class="k">Father Name</div><div class="v">${dots(w.fatherName)}</div><div class="k">Mobile No.</div><div class="v">${dots(w.phone, 22)}</div>
      <div class="k">Location</div><div class="v">${dots(w.address)}</div><div class="k">Invoice No.</div><div class="v">${dots(w.invoiceNo, 16)}</div>
    </div></div>
    <table class="equip"><thead><tr><th style="width:8mm">#</th><th>Equipment</th><th style="width:16mm">Qty</th><th style="width:24mm">Warranty</th><th style="width:20mm">Serials</th></tr></thead><tbody>${equipRows}</tbody></table>
    <p style="margin:1mm 0">Warranty start date: <b>${esc(dmy(w.startDate, "/"))}</b>. Standard warranties shall apply; terms &amp; conditions are attached herewith. The client may also claim directly from the manufacturer and K&amp;S will assist if any warranty issue arises.${withSerials.length ? " Serial numbers are attached." : ""}</p>
    ${termBlocks}
    <ul>
      <li>Warranty is void if the system is opened, repaired or altered by any unauthorized person instead of K&amp;S.</li>
      <li>Equipment warranties are provided by manufacturers and shall be reclaimed with their authority; K&amp;S Solar Energy will assist the customer in the reclamation process.</li>
      <li>Warranty is void in case of damage from natural disasters and accidents i.e. fire outbreak, hailstorms, earthquakes, floods etc.</li>
      ${hasPanels ? "<li>Warranty is void in case of damage through customer negligence and mishandling of solar panels i.e. panels mounted on trolley and rough transportation.</li>" : "<li>Warranty is void in case of damage through customer negligence, mishandling or wrong usage.</li>"}
    </ul>
    ${w.notes ? `<p style="margin:1mm 0"><b>Note:</b> ${esc(w.notes)}</p>` : ""}
  </div>
  <div class="sign"><div>Date: ${esc(dmy(w.issueDate))}</div><div class="sline">Authorized Signature</div><div class="stamp">Stamp</div></div>
  <div class="grow"></div>${footer}
</section>${serialPage}
<script>window.onload=()=>setTimeout(()=>window.print(),600)</script>
</body></html>`;
}

export function printWarranty(w: WarrantyRecord, attachmentUrl?: string) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(warrantyHtml(w, attachmentUrl));
  win.document.close();
  return true;
}
