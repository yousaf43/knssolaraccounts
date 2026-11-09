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

export function warrantyHtml(w: WarrantyRecord, attachmentUrl?: string) {
  const origin = window.location.origin;
  const logo = `${origin}/portfolio/ks-logo.webp`;
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

  const cols = 3;
  const rows: string[] = [];
  const s = w.serialNumbers;
  const per = Math.ceil(s.length / cols) || 1;
  for (let r = 0; r < per; r++) {
    const cells = [];
    for (let c = 0; c < cols; c++) {
      const i = c * per + r;
      cells.push(i < s.length ? `<td class="n">${i + 1}</td><td>${esc(s[i])}</td>` : `<td class="n"></td><td></td>`);
    }
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  const serialPage = s.length || attachmentUrl ? `
  <section class="page">${wm}${header}
    <h1>Serial Numbers</h1>
    <p class="sub">Certificate ${esc(w.certificateNo)} &middot; ${esc(w.customerName)} &middot; ${esc(w.productDescription)} &middot; Qty ${esc(w.quantity || s.length)}</p>
    ${s.length ? `<table class="serials"><thead><tr>${"<th>#</th><th>Serial Number</th>".repeat(cols)}</tr></thead><tbody>${rows.join("")}</tbody></table>` : ""}
    ${attachmentUrl && !s.length ? `<img class="scan" src="${esc(attachmentUrl)}" alt="Serial sheet">` : ""}
    <div class="grow"></div>${footer}
  </section>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Warranty ${esc(w.certificateNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Kaushan+Script&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:'Open Sans',Arial,sans-serif;color:#222;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;display:flex;flex-direction:column;page-break-after:always;background:#fff}
.page:last-child{page-break-after:auto}
.top{height:9mm;background:linear-gradient(90deg,#1f6fb8 72%,#f5a623 72%)}
.head{display:flex;justify-content:space-between;align-items:flex-start;padding:5mm 12mm 0}
.logo{height:26mm}
.contact{background:#f5a623;color:#13325a;font-weight:600;font-size:10.5pt;line-height:1.55;padding:3mm 6mm;border-radius:1.5mm;margin-top:-4mm}
h1{font-family:'Kaushan Script',cursive;text-align:center;font-size:28pt;margin:5mm 0 3mm;color:#1b1b1b}
.wm{position:absolute;top:95mm;left:45mm;width:120mm;opacity:.07;pointer-events:none}
.body{padding:0 18mm;font-size:10.5pt;line-height:1.5;position:relative}
.grid{display:grid;grid-template-columns:28mm 1fr 30mm 1fr;gap:1mm 3mm;margin:3mm 0 3mm 3mm;font-weight:600}
.grid .v{font-weight:700;text-transform:uppercase}
h2{font-size:14pt;font-weight:600;margin:6mm 0 1mm}
ul{padding-left:6mm;margin:5mm 0}li{margin:1.2mm 0;text-align:justify}
.sign{display:flex;justify-content:space-between;align-items:center;padding:0 22mm;margin-top:10mm;font-weight:700}
.stamp{width:30mm;height:30mm;border:1.2mm double #2c4fa3;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#2c4fa3;font-size:10pt}
.grow{flex:1}
.foot{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;padding:0 8mm 3mm;font-size:9pt;font-weight:700;text-align:center;color:#1b1b1b}
.foot div+div{border-left:.8mm solid #f5a623}
.bar{height:13mm;background:#1f6fb8;border-top:2mm solid #f5a623;display:flex;align-items:center;justify-content:center;gap:3mm;color:#fff;font-weight:700;font-size:14pt}
.bar em{font-family:'Kaushan Script',cursive;font-style:normal;font-size:17pt}
.sub{text-align:center;font-size:10pt;margin:0 15mm 4mm}
.serials{margin:0 14mm;border-collapse:collapse;font-size:9.5pt;width:calc(100% - 28mm)}
.serials th,.serials td{border:.25mm solid #9bb3cf;padding:1.2mm 2mm}.serials th{background:#e7f0fa}.serials .n{width:9mm;text-align:center;color:#555}
.scan{display:block;max-width:180mm;max-height:200mm;margin:0 auto;object-fit:contain}
</style></head><body>
<section class="page">${wm}${header}
  <h1>Warranty Certificate</h1>
  <div class="body">
    <p style="margin:0">It is to certify that ${esc(w.productDescription || "solar equipment")} ${w.quantity ? "" : ""}have been sold to</p>
    <div class="grid">
      <div>Name</div><div class="v">${dots(w.customerName)}</div><div>CNIC NO.</div><div class="v">${dots(w.cnic, 22)}</div>
      <div>Father Name</div><div class="v">${dots(w.fatherName)}</div><div>Mobile No.</div><div class="v">${dots(w.phone, 22)}</div>
      <div>Location</div><div class="v">${dots(w.address)}</div><div>Invoice NO.</div><div class="v">${dots(w.invoiceNo, 16)}</div>
    </div>
    <p style="margin:0">Standards Warranties shall apply. Terms &amp; Conditions are attached here by. Client can also claim directly from the manufacturer and we can also assist him to claim if any problem happened regarding warranties.</p>
    <p>Warranty starts date: ${esc(dmy(w.startDate, "/"))}.</p>
    <p>Serials Numbers are Attached:</p>
    <h2>Solar Panels Warranties:</h2>
    <div>${esc(w.workmanshipYears)} years' workmanship warranty</div>
    <div>${esc(w.outputWarranty || DEFAULT_OUTPUT_WARRANTY)}</div>
    <ul>
      <li>Warranty is void if the system is opened, repaired or altered by any unauthorized person instead of K&amp;S.</li>
      <li>Solar panels warranties are provided by manufacturers and shall be reclaimed with their authority.</li>
      <li>K&amp;S Solar Energy would assist customer in reclamation of warranties, however customer must process the reclamation from manufacturer without company's involvement.</li>
      <li>Warranty would be therefore void in cases any damage in natural disasters and accidents i.e. fire outbreak, hailstorms, earthquakes etc.</li>
      <li>Warranty would be void in cases of damage through customer negligence and mishandling of solar panels i.e. solar panels mounted on trolley and rough transportation.</li>
    </ul>
    ${w.notes ? `<p><b>Note:</b> ${esc(w.notes)}</p>` : ""}
  </div>
  <div class="sign"><div>Date: ${esc(dmy(w.issueDate))}</div><div>Signature<br><br>____________</div><div class="stamp">Stamp</div></div>
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
