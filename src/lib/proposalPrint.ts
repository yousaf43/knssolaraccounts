import type { Proposal } from "@/pages/Proposals";
import { CATEGORY_LABEL, DEFAULT_TARIFF, computeSavings, resolveCategory, type TariffRecord } from "@/lib/electricityTariff";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n: number) => `PKR ${Math.round(n).toLocaleString("en-PK")}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Company facts taken from the K&S Solar Energy company portfolio. */
const PORTFOLIO = {
  phone: "0328-0454939 | 0312-7973333",
  email: "info@knssolar.com.pk",
  address: "Basement Ramzan Plaza (Bhatti Market), College Road, Bhakkar, Pakistan",
};

const FEATURED = [
  { title: "Jamil Flour Mill", place: "Bhakkar", size: "1.2 Megawatts", img: "/portfolio/project-jamil.jpg" },
  { title: "Fazal Kareem Flour Mill", place: "Behal, Bhakkar", size: "421 Kilowatt", img: "/portfolio/project-fazal.jpg" },
  { title: "Fatima Medical Complex", place: "Bhakkar", size: "100 Kilowatt", img: "/portfolio/project-fatima.jpg" },
  { title: "Mr. Jhanzab Niazi's Home", place: "Bhakkar", size: "15 kW On-Grid", img: "/portfolio/project-jhanzab.jpg" },
];

export function printProposal(
  p: Proposal,
  company: { name: string; address: string; phone: string; email: string; logoUrl: string },
  formatDate: (d: string | Date) => string,
  projects: { title: string; customer: string; date: string; detail: string }[] = [],
  tariff: TariffRecord = DEFAULT_TARIFF
) {
  const abs = (u: string) => (u.startsWith("http") ? u : `${window.location.origin}${u}`);
  const LOGO = abs("/portfolio/ks-logo.webp");
  const featuredCards = FEATURED.map(
    (f) => `<div class="proj fp"><img src="${abs(f.img)}" alt=""><b>${esc(f.title)}</b><span>${esc(f.place)}</span><p class="size">${esc(f.size)}</p><i>Completed ✓</i></div>`
  ).join("");
  const projectCards = projects
    .slice(0, 6)
    .map((pr) => `<div class="proj"><b>${esc(pr.title)}</b><span>${esc(pr.customer)}${pr.date ? " • " + formatDate(pr.date) : ""}</span><p>${esc(pr.detail || "Solar system installation")}</p><i>Completed ✓</i></div>`)
    .join("");
  const kw = p.systemKw;
  const typeLabel =
    p.systemType === "hybrid" ? "Hybrid" : p.systemType === "off-grid" ? "Off-Grid" : "On-Grid";
  const annualUnits = p.monthlyUnits.reduce((a, b) => a + (Number(b) || 0), 0);
  const validUntil = p.date
    ? new Date(new Date(p.date).getTime() + p.validDays * 86400000)
    : null;

  const SUN = [0.72, 0.82, 1.0, 1.1, 1.18, 1.12, 1.0, 0.98, 1.0, 0.92, 0.8, 0.7];
  const genMonthly = SUN.map((f) => kw * 4.5 * 30 * f);
  const annualGen = genMonthly.reduce((a, b) => a + b, 0);
  const coverage = annualUnits ? Math.min(100, Math.round((annualGen / annualUnits) * 100)) : 0;
  const maxV = Math.max(1, ...genMonthly, ...p.monthlyUnits.map((u) => Number(u) || 0));
  const PSH = [5.64, 6.65, 7.26, 7.18, 6.16, 6.59, 6.25, 6.22, 6.41, 7.09, 6.02, 5.94];
  const MN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const bar3d = (() => {
    const X0 = 40, B = 190, H = 160, W = 30, G = 20, D = 9;
    const grid = [0, 2, 4, 6, 8].map((v) => { const y = B - (v / 8) * H; return `<line x1="${X0}" y1="${y}" x2="${X0 + 12 * (W + G) + 10}" y2="${y}" stroke="#e5e9ef"/><text x="${X0 - 8}" y="${y + 3}" font-size="8" text-anchor="end" fill="#666">${v}</text>`; }).join("");
    const floor = `<polygon points="${X0},${B} ${X0 + 12 * (W + G)},${B} ${X0 + 12 * (W + G) + D},${B - D} ${X0 + D},${B - D}" fill="#eef3f8"/>`;
    const bars = PSH.map((v, i) => {
      const x = X0 + 8 + i * (W + G), h = (v / 8) * H, y = B - h;
      return `<polygon points="${x + W},${y} ${x + W + D},${y - D} ${x + W + D},${B - D} ${x + W},${B}" fill="#0B3A6B"/><polygon points="${x},${y} ${x + D},${y - D} ${x + W + D},${y - D} ${x + W},${y}" fill="#5A9BD8"/><rect x="${x}" y="${y}" width="${W}" height="${h}" fill="url(#b3)"/><text x="${x + W / 2 + 4}" y="${y - D - 4}" font-size="8.5" font-weight="700" text-anchor="middle" fill="#222">${v.toFixed(2)}</text><text x="${x + W / 2}" y="${B + 14}" font-size="8" text-anchor="middle" fill="#555">${MN[i]}</text>`;
    }).join("");
    return `<svg viewBox="0 0 660 215" width="100%"><defs><linearGradient id="b3" x1="0" x2="1"><stop offset="0" stop-color="#2E8BD6"/><stop offset="1" stop-color="#0F5BA8"/></linearGradient></defs><text x="4" y="10" font-size="8" fill="#666">Peak sun hours / day</text>${grid}${floor}${bars}</svg>`;
  })();
  const sunCurve = (() => {
    const X0 = 50, B = 190, H = 160, S = 50;
    const vals = [0, 15, 34, 52, 68, 78, 82, 78, 68, 52, 34, 15, 2];
    const pts = vals.map((v, i) => [X0 + i * S, B - (v / 100) * H]);
    const path = pts.map((q, i) => (i ? "L" : "M") + q[0] + "," + q[1]).join(" ");
    const grid = [0, 20, 40, 60, 80, 100].map((v) => { const y = B - (v / 100) * H; return `<line x1="${X0}" y1="${y}" x2="${X0 + 12 * S}" y2="${y}" stroke="#eee"/><text x="${X0 - 6}" y="${y + 3}" font-size="8" text-anchor="end" fill="#666">${v}%</text>`; }).join("");
    const hrs = ["6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM"];
    return `<svg viewBox="0 0 680 215" width="100%"><defs><linearGradient id="sc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#F2B33D"/></linearGradient></defs><text x="4" y="10" font-size="8" fill="#666">Relative irradiance level</text>${grid}<path d="${pts.map((q, i) => (i ? "L" : "M") + (q[0] + 8) + "," + (q[1] - 8)).join(" ")} L${X0 + 12 * S + 8},${B - 8} L${X0 + 8},${B - 8} Z" fill="#E9A92C" opacity=".55"/><path d="${path} L${X0 + 12 * S},${B} L${X0},${B} Z" fill="url(#sc)"/><path d="${path}" fill="none" stroke="#D8901A" stroke-width="2"/>${pts.map((q) => `<circle cx="${q[0]}" cy="${q[1]}" r="2.6" fill="#fff" stroke="#D8901A" stroke-width="1.4"/>`).join("")}<text x="${X0 + 6 * S}" y="${pts[6][1] - 14}" font-size="9" font-weight="700" text-anchor="middle" fill="#8a5a00">Peak ≈ 82%</text>${hrs.map((h, i) => `<text x="${X0 + i * S}" y="${B + 14}" font-size="8" text-anchor="middle" fill="#555">${h}</text>`).join("")}</svg>`;
  })();
  const barChart = `<svg viewBox="0 0 640 220" width="100%" height="200"><defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E9BDA"/><stop offset="1" stop-color="#0B3A5B"/></linearGradient><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD66B"/><stop offset="1" stop-color="#D8901A"/></linearGradient></defs>${MONTHS.map((m, i) => {
    const x = 20 + i * 51; const u = Number(p.monthlyUnits[i]) || 0; const hu = (u / maxV) * 170; const hg = (genMonthly[i] / maxV) * 170;
    return `<rect x="${x + 4}" y="${185 - hu}" width="18" height="${hu}" rx="2" fill="url(#gb)"/><rect x="${x}" y="${189 - hu}" width="4" height="${hu}" fill="#08304D" opacity=".5"/><rect x="${x + 24}" y="${185 - hg}" width="18" height="${hg}" rx="2" fill="url(#gg)"/><rect x="${x + 42}" y="${189 - hg}" width="4" height="${hg}" fill="#9A6510" opacity=".45"/><text x="${x + 23}" y="205" font-size="11" text-anchor="middle" fill="#5F6F7C">${m}</text>`;
  }).join("")}<line x1="15" y1="185" x2="630" y2="185" stroke="#D7E0E7"/></svg>`;

  const itemsRows = p.items
    .map(
      (it, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(it.brand)}</b></td>
        <td>${esc(it.description)}</td>
        <td class="num">${it.qty}</td>
        <td>${esc(it.unit)}</td>
        <td class="num">${money(it.unitPrice)}</td>
        <td class="num">${money(it.amount)}</td>
      </tr>`
    )
    .join("");

  const itemDetail = (it: { brand: string; description: string; qty?: number }) => {
    const t = `${it.brand} ${it.description}`.toLowerCase();
    const bkwh = p.battery ? p.battery.units * p.battery.kwhEach : 0;
    const n2 = (x: number) => x.toFixed(2).replace(/\.?0+$/, "");
    let d: string[] = [];
    if (/panel|module|pv/.test(t)) d = [`${p.panelWatt} W High-Efficiency Modules (Total ${p.panelQty} pcs, ${kw} kW Array)`, "Certified: IEC / CE / ISO / TÜV | Low Temperature Coefficient (-0.30%/°C)", `25-Year Linear Power Warranty${p.panelWarranty ? ` (${p.panelWarranty})` : ""}`];
    else if (/batter|lithium|lifepo/.test(t)) d = [`${n2(bkwh || 5.12)} kWh Nominal (${n2((bkwh || 5.12) * 0.9)} kWh Usable @ 90% DoD)`, "6,000+ Deep Cycles Life | Built-in Smart BMS", `${p.battery?.warranty || "5-Year Standard"} Warranty`.replace(/Warranty Warranty/i, "Warranty")];
    else if (/inverter/.test(t)) d = p.systemType === "on-grid"
      ? [`${p.inverterKw} kW On-Grid Solar Inverter (Pure Sine Wave)`, "Dual MPPT Controller | Grid-Tie with Anti-Islanding Protection", "Smart Android / iOS App Wi-Fi Monitoring"]
      : [`${p.inverterKw} kW Solar + Battery + Grid ${typeLabel} Inverter (Pure Sine Wave)`, "Dual MPPT Controller | Automatic UPS Transfer (<10ms)", "Smart Android / iOS App Wi-Fi Monitoring"];
    else if (/structure|mount|c-type|frame|stand/.test(t)) d = ["Galvanized 14-gauge custom structure (Holds 2 panels each)", `Auto-calculated: ${p.panelQty} panels require exactly ${Math.ceil((p.panelQty || 0) / 2)} frames`, "Heavy-duty anchor / Rawl bolts with weather coating"];
    else if (/net|meter/.test(t)) d = [`Complete ${p.disco || "DISCO"} sanction, load verification & inspection`, "NEPRA licensing facilitation & green bi-directional meter"];
    else if (/earth|lightning|arrest/.test(t)) d = ["Dedicated chemical grounding bore for Inverter & PV Array", "Pure copper lightning spike & heavy-gauge earthing conductor"];
    else if (/cable|wire|wiring|\bdb\b|breaker|protection/.test(t)) d = ["4mm² / 6mm² pure copper single-core DC solar cables", "IP65 Distribution Box: DC/AC Breakers, SPDs & Disconnector Switch", "Extra cabling charged on actual site measurement"];
    else if (/install|commission/.test(t)) d = ["Mechanical structure mounting & PV panel array alignment", "Complete AC/DC wiring, inverter integration, testing & load balancing"];
    else if (/accessor|transport|deliver/.test(t)) d = ["PVC conduits, UV-resistant cable ties, SS hardware & consumables", "Safe transit, loading/unloading & on-site delivery"];
    return d.length ? `<div style="margin-top:1mm;font-size:9.5px;color:#444;line-height:1.5">${d.map((x) => `• ${esc(x)}`).join("<br>")}</div>` : "";
  };

  const termsList = p.terms
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) =>
      t.startsWith("!")
        ? `<li class="red">${esc(t.slice(1).trim())}</li>`
        : `<li>${esc(t)}</li>`
    )
    .join("");

  const usageRows = p.monthlyUnits.some((u) => u > 0)
    ? `<tr>${MONTHS.map((m) => `<th>${m}</th>`).join("")}</tr>
       <tr>${p.monthlyUnits.map((u) => `<td class="num">${u || "–"}</td>`).join("")}</tr>`
    : "";

  const batteryBlock = p.battery
    ? `<tr><td>Battery</td><td>${esc(p.battery.brand)} ${esc(p.battery.model)} (${esc(p.battery.type)})</td>
        <td>${p.battery.units} × ${p.battery.kwhEach} kWh = ${(p.battery.units * p.battery.kwhEach).toFixed(1)} kWh</td>
        <td>${esc(p.battery.warranty)}</td></tr>`
    : "";

  // Inverter can be excluded (panels-only proposals, e.g. customer already owns one).
  const hasInv = p.includeInverter !== false && (p.inverterKw || 0) > 0;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proposal ${esc(p.proposalNo)}</title>
<style>
  :root{--blue:#0868A0;--gold:#F8B830;--navy:#0B3A5B;--ink:#1E2B36;--muted:#5F6F7C;--line:#D7E0E7;--soft:#EAF3F9}
  *{box-sizing:border-box;margin:0}
  body{font-family:"Segoe UI",Calibri,system-ui,Arial,sans-serif;color:var(--ink);line-height:1.45;font-size:12.5px}
  .page{width:190mm;max-width:100%;margin:0 auto;padding:6mm 0;display:flow-root;overflow-wrap:anywhere}
  .page+.page{break-before:page;page-break-before:always}
  .page.cover-page{padding:0}
  thead{display:table-header-group}tfoot{display:table-row-group}
  tr,.proj,.feat,.quote,.stat,.sg,.pd{break-inside:avoid;page-break-inside:avoid}
  h2,h3,h4,.phead,.qh{break-after:avoid;page-break-after:avoid}
  svg{display:block;break-inside:avoid}
  img{max-width:100%}
  .cover{background:linear-gradient(160deg,var(--navy),var(--blue));color:#fff;border-radius:6px;padding:16mm 14mm;min-height:250mm;position:relative}
  .cover .tag{letter-spacing:.22em;font-size:10px;color:var(--gold);font-weight:700}
  .cover h1{font-size:30px;margin:10mm 0 2mm;font-weight:800}
  .cover h2{font-size:20px;color:var(--gold);margin-bottom:2mm}
  .cover .sub{opacity:.85;font-size:13px}
  .cover .box{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:5mm 6mm;margin-top:10mm}
  .cover .box h3{font-size:11px;letter-spacing:.18em;color:var(--gold);margin-bottom:3mm}
  .cover .row{display:flex;justify-content:space-between;gap:8mm;flex-wrap:wrap}
  .cover .cell b{display:block;font-size:15px}
  .cover .cell span{font-size:10.5px;opacity:.75}
  .cover .foot{position:absolute;bottom:12mm;left:14mm;right:14mm;display:flex;justify-content:space-between;font-size:10.5px;opacity:.8;border-top:1px solid rgba(255,255,255,.25);padding-top:4mm}
  .head{display:flex;align-items:center;gap:5mm;border-bottom:3px solid var(--gold);padding-bottom:4mm;margin-bottom:6mm}
  .head img{height:16mm}
  .head .co b{font-size:16px;color:var(--navy)}
  .head .co span{display:block;font-size:10.5px;color:var(--muted)}
  h3.sec{font-size:13px;color:var(--navy);border-left:4px solid var(--gold);padding-left:8px;margin:6mm 0 3mm}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top}
  th{background:var(--soft);color:var(--navy);font-size:11px}
  td.num,th.num{text-align:right;white-space:nowrap}
  .total-row td{background:var(--navy);color:#fff;font-weight:700;font-size:13px}
  ul.terms{margin:2mm 0 0 5mm}
  ul.terms li{margin-bottom:1.5mm}
  ul.terms li.red{color:#C0392B;font-weight:600}
  .sig{margin-top:14mm;display:flex;justify-content:space-between;gap:10mm}
  .sig .s{flex:1;border-top:1.5px solid var(--navy);padding-top:2mm;font-size:11px}
  .sig .s b{display:block;color:var(--navy)}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:2mm 8mm;font-size:12px}
  .meta div b{color:var(--navy)}
  .about p{margin-bottom:3mm;text-align:justify}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:4mm 0}
  .stat{background:var(--soft);border-top:3px solid var(--gold);border-radius:6px;padding:4mm;text-align:center}
  .stat b{display:block;font-size:18px;color:var(--navy)}.stat span{font-size:10px;color:var(--muted)}
  .feat{border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:6px;padding:3mm 4mm}
  .feat b{color:var(--navy);display:block;margin-bottom:1mm}.feat span{font-size:11px;color:var(--muted)}
  .proj{border:1px solid var(--line);border-radius:6px;padding:3.5mm 4mm;position:relative;background:#fff}
  .proj b{color:var(--navy);display:block;font-size:13px}.proj span{font-size:10.5px;color:var(--muted)}
  .proj p{font-size:11px;margin-top:1.5mm}.proj i{position:absolute;top:3mm;right:4mm;font-size:9.5px;color:#1E8449;font-style:normal;font-weight:700}
  .proj.fp{padding:0 0 3mm;overflow:hidden}.proj.fp img{width:100%;height:42mm;object-fit:cover;display:block;margin-bottom:2.5mm}
  .proj.fp b,.proj.fp span,.proj.fp p{padding:0 4mm}.proj.fp p.size{color:var(--blue);font-weight:800;font-size:13px}.proj.fp i{top:auto;bottom:3mm;background:#fff}
  .quote{background:var(--soft);border-left:4px solid var(--gold);padding:4mm 5mm;margin-top:4mm;font-style:italic;color:var(--navy)}
  ol.steps{margin:2mm 0 0 5mm}ol.steps li{margin-bottom:1.5mm}
  .cover3d{position:relative;height:270mm;border-radius:8px;overflow:hidden;color:#fff}
  .cover3d .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .cover3d .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,0) 32%,rgba(6,25,48,.12) 68%,rgba(6,25,48,.42) 100%)}
  .cover3d .ct{position:relative;padding:11mm 12mm 0}
  .cover3d .logo{height:21mm;filter:drop-shadow(0 0 1.2mm rgba(255,255,255,.95)) drop-shadow(0 0 .4mm #fff)}
  .cover3d .cbox{position:absolute;left:12mm;right:12mm;bottom:10mm;display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
  .cover3d .cbox div{background:linear-gradient(180deg,rgba(14,58,91,.94),rgba(11,46,91,.94));border-top:4px solid #F2B33D;border-radius:8px;padding:5mm;box-shadow:0 6px 18px rgba(6,25,48,.4)}
  .cover3d .cbox small{display:block;font-size:10.5px;letter-spacing:.16em;color:#F2B33D;font-weight:800}
  .cover3d .cbox b{display:block;font-size:17px;margin:1.5mm 0}.cover3d .cbox span{font-size:11.5px;color:#dcebf7}
  .cover3d .toprow{display:flex;justify-content:space-between;align-items:flex-start}
  .cover3d .brand{display:flex;align-items:center;gap:4mm}.cover3d .brand .logo{margin-bottom:0}
  .cover3d .rbs{font-size:29px;font-style:italic;font-weight:800;color:#0F5BA8;border-left:3px solid #F2B33D;padding-left:4mm;text-shadow:0 1px 0 #fff,0 2px 10px rgba(255,255,255,.85);letter-spacing:.02em}
  .cover3d .badges{display:flex;gap:4mm;align-items:flex-start;background:linear-gradient(180deg,#0E3A5B,#0B2E5B);border-radius:6px;padding:3mm 4mm 2.5mm;box-shadow:0 4px 14px rgba(0,0,0,.3)}
  .cover3d .badges .bd{display:flex;flex-direction:column;align-items:center;gap:1mm}
  .cover3d .badges .bd span{width:15mm;height:18mm;background:#fff;display:flex;align-items:center;justify-content:center;clip-path:polygon(0 0,100% 0,100% 68%,50% 100%,0 68%);padding-bottom:2.5mm}
  .cover3d .badges .bd img{width:11mm;height:11mm;object-fit:contain}
  .cover3d .badges .bd small{font-size:7.5px;font-weight:800;letter-spacing:.04em;color:#fff}
  .cover3d .featwrap{background:rgba(255,255,255,.93);border-radius:10px;padding:3.5mm;margin-top:7mm;box-shadow:0 6px 20px rgba(6,25,48,.25)}
  .cover3d .feat{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
  .cover3d .feat div{background:linear-gradient(180deg,#0E3A5B,#0B2E5B);border-bottom:3px solid #F2B33D;border-radius:8px;padding:4.5mm 3mm;text-align:center}
  .cover3d .feat em{display:block;font-style:normal;font-size:20px}.cover3d .feat b{display:block;font-size:13px;color:#F2B33D;margin-top:1mm}.cover3d .feat span{font-size:9.5px;color:#dcebf7}
  .cover3d .tfp{font-size:31px;font-weight:800;text-align:center;margin:11mm 0 2.5mm;color:#0B2E5B;text-shadow:0 1px 0 rgba(255,255,255,.75)}
  .cover3d .tag{text-align:center;letter-spacing:.18em;font-size:10.5px;color:#0F5BA8;font-weight:800}
  .cover3d .tag::before,.cover3d .tag::after{content:"";display:inline-block;width:13mm;height:2px;background:#F2B33D;vertical-align:middle;margin:0 4mm}
  .cover3d .projbox{margin-top:7mm;background:linear-gradient(180deg,rgba(14,58,91,.93),rgba(11,46,91,.93));border-left:5px solid #F2B33D;border-radius:8px;padding:6mm 7mm;width:72%;box-shadow:0 6px 18px rgba(6,25,48,.35)}
  .cover3d .projbox .pj{font-size:22px;font-weight:700}.cover3d .projbox .pj span{color:#F2B33D}
  .cover3d .projbox .cl{font-size:14.5px;margin-top:2.5mm;color:#eaf4fc;border-top:1px solid rgba(255,255,255,.25);padding-top:2.5mm}
  .cover3d .contact{margin-top:7mm;display:grid;grid-template-columns:1fr 1fr 1.4fr;background:linear-gradient(180deg,rgba(14,58,91,.93),rgba(11,46,91,.93));border-radius:8px;padding:4mm;box-shadow:0 6px 18px rgba(6,25,48,.35)}
  .cover3d .contact div{display:flex;gap:3mm;align-items:center;padding:0 3mm;border-left:2px solid #F2B33D}.cover3d .contact div:first-child{border-left:0}
  .cover3d .contact em{font-style:normal;font-size:18px}.cover3d .contact p{font-size:11px;margin:0}.cover3d .contact small{display:block;color:#F2B33D;font-weight:700;font-size:10px}
  .chart{border:1px solid var(--line);border-radius:8px;padding:3mm;background:linear-gradient(180deg,#fff,var(--soft))}
  .legend{display:flex;gap:6mm;font-size:10.5px;color:var(--muted);margin-top:2mm}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}
  .sys3d{width:100%;height:70mm;object-fit:contain;display:block;border-radius:8px}
  .flow{display:flex;align-items:center;justify-content:space-between;gap:2mm;margin-top:2mm}.flow div{flex:1;text-align:center;background:var(--soft);border-top:3px solid var(--blue);border-radius:6px;padding:2.5mm;font-size:10px;color:var(--muted)}.flow div b{display:block;color:var(--navy);font-size:12px}.flow em{color:var(--gold);font-style:normal;font-weight:800}
  .phead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid var(--gold);padding-bottom:3mm;margin-bottom:7mm}.phead img{height:14mm}.phead b{color:var(--navy);font-size:15px}.phead span{font-size:11px;color:var(--muted)}
  .ptitle{font-size:19px;color:var(--navy);font-weight:800;border-bottom:2.5px solid var(--gold);padding-bottom:2.5mm;margin-bottom:5mm}.ptitle em{color:var(--gold);font-style:normal;margin-right:2mm}
  table.ov{border-collapse:separate;border-spacing:0 1.2mm}table.ov th,table.ov td{border:0;padding:3mm 4mm;font-size:12.5px;vertical-align:middle}table.ov th{width:36%;background:var(--soft);color:var(--blue);font-weight:700}table.ov td{border-bottom:1px solid var(--line);padding-left:5mm}
  .kband{display:grid;grid-template-columns:repeat(4,1fr);background:var(--blue);color:#fff;border-bottom:3px solid var(--gold);margin:8mm 0 7mm}.kband div{text-align:center;padding:5mm 2mm;border-left:2px solid #fff}.kband div:first-child{border-left:0}.kband b{display:block;font-size:19px;font-weight:700}.kband span{font-size:9.5px;letter-spacing:.18em;opacity:.92}
  .bgh{font-size:15px;color:var(--blue);margin-bottom:2mm}.bgp{font-size:12.5px;color:#333;margin-bottom:3mm;line-height:1.65}
  @media print{@page{size:A4;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:190mm;margin:0 auto}.cover3d{height:270mm}.tm .st{margin-top:5mm}.tm .ft{margin-top:5mm}}
</style></head><body>

<div class="page cover-page">
  <div class="cover3d">
    <img class="bg" src="${abs("/portfolio/cover-3d.jpg")}" alt="">
    <div class="shade"></div>
    <div class="ct">
      <div class="toprow">
        <div class="brand">${LOGO ? `<img class="logo" src="${abs("/portfolio/ks-logo-crop.png")}" alt="K&amp;S Solar Energy">` : ""}<span class="rbs">Run by Sun</span></div>
        <div class="badges">${[["secp","SECP Registered"],["aedb","AEDB Certified"],["pec","PEC Registered"]].map(([k,l]) => `<div class="bd"><span><img src="${abs(`/portfolio/logo-${k}.png`)}" alt="${l}"></span><small>${l}</small></div>`).join("")}</div>
      </div>
      <div class="tfp">TECHNICAL &amp; FINANCIAL PROPOSAL</div>
      <div class="tag">CLEAN ENERGY • GENUINE PRODUCTS • PROFESSIONAL SERVICE</div>
      <div class="feat">
        <div><em>☀</em><b>Since 2013</b><span>Trusted solar experience</span></div>
        <div><em>🛡</em><b>Tier-1 Products</b><span>Genuine panels &amp; inverters</span></div>
        <div><em>⚡</em><b>Net Metering</b><span>Complete approval support</span></div>
        <div><em>🔧</em><b>After-Sales</b><span>Service &amp; maintenance</span></div>
      </div>
      <div class="projbox">
        <div class="pj"><span>Project:</span> ${kw}kW ${typeLabel} Solar System</div>
        <div class="cl">Client: <b>${esc(p.customerName)}</b> &nbsp;|&nbsp; Date: <b>${p.date ? formatDate(p.date) : "-"}</b></div>
      </div>
      <div class="contact">
        <div><em>✉</em><p><small>Email Us</small>${esc(company.email || "info@knssolar.com")}</p></div>
        <div><em>🌐</em><p><small>Website</small>www.knssolar.com</p></div>
        <div><em>📍</em><p><small>Location</small>4-Basement, Ramzan Plaza, College Road, Bhakkar</p></div>
      </div>
    </div>
    <div class="cbox">
      <div><small>PREPARED FOR</small><b>${esc(p.customerName)}</b><span>${esc(p.companyName || p.city)}</span></div>
      <div><small>SYSTEM</small><b>${kw} kWp ${typeLabel}</b><span>${p.netBilling ? "With Net Billing" : "Solar Solution"}</span></div>
      <div><small>REF / DATE</small><b>${esc(p.proposalNo)}</b><span>${p.date ? formatDate(p.date) : "-"}${validUntil ? " • Valid till " + formatDate(validUntil) : ""}</span></div>
    </div>
  </div>
</div>

<div class="page about">
  <div class="head">
    ${LOGO ? `<img src="${esc(LOGO)}" alt="">` : ""}
    <div class="co"><b>${esc(company.name)}</b><span>${esc(company.address || PORTFOLIO.address)}</span><span>${esc(company.phone || PORTFOLIO.phone)} • ${esc(company.email || PORTFOLIO.email)}</span></div>
  </div>
  <h3 class="sec">COMPANY PROFILE — SINCE 2013</h3>
  <p><b>K&S Solar Energy Pvt. Ltd.</b> — <i>Run by Sun</i> — has been at the forefront of Pakistan's solar revolution since 2013, providing innovative and reliable renewable energy solutions. We started by offering high-quality solar installations for homes and businesses and have grown into a complete solar company delivering On-Grid, Off-Grid and Hybrid systems, Net Metering, maintenance and professional panel cleaning.</p>
  <p>With more than a decade of excellence, we have successfully installed hundreds of solar projects — from small residential setups to large industrial plants such as the <b>1.2 MW Jamil Flour Mill</b>. Our commitment to quality, affordability and customer satisfaction has made us a trusted name in the solar industry.</p>
  <div class="grid4">
    <div class="stat"><b>2013</b><span>Serving Since</span></div>
    <div class="stat"><b>Hundreds</b><span>Projects Installed</span></div>
    <div class="stat"><b>1.2 MW</b><span>Largest Single Plant</span></div>
    <div class="stat"><b>10</b><span>Cities Served</span></div>
  </div>
  <h3 class="sec">WHY CHOOSE US</h3>
  <div class="grid2">
    <div class="feat"><b>01. Expertise & Experience</b><span>Years of solar industry experience and professional electrical engineers, tailored to your energy needs.</span></div>
    <div class="feat"><b>02. High-Quality Products</b><span>Premium panels and equipment for durability, efficiency and long-term savings.</span></div>
    <div class="feat"><b>03. Customer-Centric Approach</b><span>Personalized consultation, professional installation and excellent after-sales support.</span></div>
    <div class="feat"><b>04. Affordable & Reliable</b><span>Competitive pricing with a great return on investment.</span></div>
  </div>
</div>

<div class="page about">
  <h3 class="sec" style="margin-top:0">OUR SERVICES</h3>
  <div class="grid2">
    <div class="feat"><b>Net Metering</b><span>Save up to 100% on bills by selling excess energy back to the grid — hassle-free paperwork.</span></div>
    <div class="feat"><b>Installation & Maintenance</b><span>Expert installation with <b>1 Year Free Maintenance</b></span></div>
    <div class="feat"><b>Solar Panel Washing</b><span>Professional cleaning for optimal energy production.</span></div>
    <div class="feat"><b>Residential • Commercial • Industrial • Agricultural</b><span>Home backup, business savings, high-capacity industrial plants and solar tube-wells.</span></div>
  </div>
  <h3 class="sec">OFFICIAL PARTNERSHIPS</h3>
  <div class="grid2">
    <div class="feat"><b>Itel Energy — Officially Authorised Dealer</b><span>Hybrid & On-Grid inverters, IP66, 5 Years Replacement warranty, plus Itel lithium batteries.</span></div>
    <div class="feat"><b>JA Solar — Direct Importer</b><span>World-class JA Solar panels imported directly — guaranteed original at competitive prices.</span></div>
  </div>
  <p style="margin-top:3mm"><b>Energy partners:</b> JA Solar, LONGi, Jinko, Astronergy, Talesun, Canadian Solar, Trina Solar, Runergy.<br>
  <b>Inverter brands:</b> Itel, Huawei, SolarMax, Growatt, Long Life, MaxPower, Sofar, Livoltek, GoodWe, Inverex, Hopewind.<br>
  <b>Finance partners:</b> U Microfinance Bank, Mobilink Microfinance Bank, The Bank of Punjab, JS Bank, Bank Al Habib.</p>
  <h3 class="sec">AREA SERVED</h3>
  <p><b>Head Office:</b> Bhakkar &nbsp;•&nbsp; <b>Offices:</b> Lahore, Islamabad, Multan, Faisalabad, Mianwali, Jauharabad, Samundri, Kamalia, Dadu (Sindh).</p>
</div>

<div class="page">
  <h3 class="sec">SUCCESS STORIES — PROJECT COMPLETION</h3>
  <div class="grid2">${featuredCards}</div>
  <h3 class="sec">CUSTOMER TESTIMONIALS</h3>
  <div class="quote" style="margin-top:0"><b>Jamil Hussain</b> — "Jamil Flour Mill is now powered by a 1.2 MW solar energy system installed by K&S Solar Energy. Maximum efficiency, reduced electricity costs and sustainable energy for uninterrupted operations."</div>
  <div class="quote"><b>Sheikh Habibullah</b> — "Atta Chaki is now powered by a 21 kW On-Grid Net Metering System, ensuring reduced electricity costs and maximum energy efficiency."</div>
  <div class="quote"><b>Dr. Safdar Bukhari</b> — "The hospital now runs on an On-Grid Solar System installed by K&S Solar Energy — lower electricity costs and uninterrupted power. Their expert service made the transition smooth!"</div>
</div>
${projects.length ? `<div class="page"><h3 class="sec" style="margin-top:0">RECENTLY COMPLETED PROJECTS</h3><div class="grid2">${projectCards}</div></div>` : ""}

<div class="page">
  <div class="phead">
    ${LOGO ? `<img src="${esc(LOGO)}" alt="">` : `<b>${esc(company.name)}</b>`}
    <span>Technical &amp; Financial Proposal &nbsp;|&nbsp; ${typeLabel} Solar System</span>
  </div>
  <h2 class="ptitle"><em>1</em> PROJECT LOCATION &amp; OVERVIEW</h2>
  <table class="ov">
    <tr><th>Client</th><td>${esc(p.customerName) || "-"}${p.companyName ? ` — ${esc(p.companyName)}` : ""}</td></tr>
    <tr><th>Project Location</th><td>${[p.address, p.city].filter(Boolean).map(esc).join(", ") || "-"}</td></tr>
    ${p.phone ? `<tr><th>Contact</th><td>${esc(p.phone)}${p.cnic ? ` &nbsp;•&nbsp; CNIC ${esc(p.cnic)}` : ""}</td></tr>` : ""}
    <tr><th>Proposal No. / Date</th><td>${esc(p.proposalNo)} &nbsp;•&nbsp; ${p.date ? formatDate(p.date) : "-"}${validUntil ? ` &nbsp;(valid until ${formatDate(validUntil)})` : ""}</td></tr>
    <tr><th>PV Array Tilt Angle (flexible)</th><td>25° ~ 35°</td></tr>
    <tr><th>PV Panels</th><td>${p.panelQty} units of ${p.panelWatt} W — ${esc(p.panelBrand) || "Mono PERC / Tier-1"}</td></tr>
    <tr><th>PV Array Nominal Power</th><td><b>${kw} kWp</b></td></tr>
    ${hasInv ? `<tr><th>${typeLabel} Inverter</th><td>1 unit of ${p.inverterKw} kW${p.inverterBrand ? ` — ${esc(p.inverterBrand)}` : ""}</td></tr>` : ""}
    ${p.battery ? `<tr><th>Battery Bank</th><td>${p.battery.units} × ${p.battery.kwhEach} kWh ${esc(p.battery.type)} = ${(p.battery.units * p.battery.kwhEach).toFixed(1).replace(/\.0$/, "")} kWh</td></tr>` : ""}
    <tr><th>System Type</th><td>${typeLabel} solar PV system${p.battery ? " with battery backup" : ""}${p.netBilling ? " and net metering" : ""}</td></tr>
  </table>
  <div class="kband">
    <div><b>${kw} kWp</b><span>SYSTEM SIZE</span></div>
    <div><b>${p.panelQty}</b><span>SOLAR PANELS</span></div>
    <div><b>${Math.round(annualGen).toLocaleString()} kWh</b><span>EST. YEARLY GENERATION</span></div>
    <div><b>${p.battery ? `${(p.battery.units * p.battery.kwhEach).toFixed(1).replace(/\.0$/, "")} kWh` : hasInv ? `${p.inverterKw} kW` : `${kw} kWp`}</b><span>${p.battery ? "BATTERY STORAGE" : hasInv ? "INVERTER CAPACITY" : "PV ARRAY"}</span></div>
  </div>
  <h4 class="bgh">Background of the Solar PV Power Project</h4>
  <p class="bgp">${p.panelQty} solar PV modules (panels) totalling ${kw} kWp will be installed on the rooftop on a raised ${esc(p.structureType) || ""} structure. ${hasInv ? `The ${typeLabel.toLowerCase()} inverter${p.battery ? " and the battery bank" : ""} will be installed in the equipment room, together with the distribution panel and safety devices.` : p.battery ? "The battery bank will be installed in the equipment room, together with the distribution panel and safety devices." : "The distribution panel and safety devices will be installed in the equipment room."}</p>
  <p class="bgp">The customer will use the power generated by the solar PV system during the day${p.battery ? ", store surplus energy in the batteries, and use the stored energy when grid power is not available" : ""}${p.netBilling ? ", and can sell any excess power to the utility grid through net metering" : ""}.</p>
</div>

<div class="page">
  <div class="phead">
    ${LOGO ? `<img src="${esc(LOGO)}" alt="">` : `<b>${esc(company.name)}</b>`}
    <span>Technical &amp; Financial Proposal &nbsp;|&nbsp; ${typeLabel} Solar System</span>
  </div>
  <h2 class="ptitle"><em>2</em> SYSTEM DETAILS &amp; IMPLEMENTATION</h2>

  <h3 class="sec">SYSTEM DETAILS</h3>
  <table>
    <tr><th style="width:22%">Component</th><th style="width:30%">Brand / Model</th><th style="width:28%">Specification</th><th>Warranty</th></tr>
    <tr><td>Solar Panels</td><td>${esc(p.panelBrand)}</td><td>${p.panelQty} × ${p.panelWatt} W = ${kw} kWp</td><td>${esc(p.panelWarranty)}</td></tr>
    ${hasInv ? `<tr><td>Inverter</td><td>${esc(p.inverterBrand)}</td><td>${p.inverterKw} kW ${typeLabel}</td><td>${esc(p.inverterWarranty)}</td></tr>` : ""}
    <tr><td>Structure</td><td>${esc(p.structureType)}</td><td>${p.structureQty} set(s)</td><td>—</td></tr>
    ${batteryBlock}
    ${p.netBilling ? `<tr><td>Net Billing</td><td>${esc(p.disco)}</td><td>Green meter & net billing included</td><td>—</td></tr>` : ""}
    ${p.earthing ? `<tr><td>Earthing</td><td>—</td><td>Earthing & lightning arrestor included</td><td>—</td></tr>` : ""}
  </table>
  <h3 class="sec">SYSTEM IMPLEMENTATION PLAN</h3>
  <ol class="steps"><li>Site survey, shade analysis & roof load check</li><li>Installation of ${esc(p.structureType)} structure for ${p.panelQty} panels</li><li>Mounting of ${p.panelQty} × ${p.panelWatt} W ${esc(p.panelBrand)} panels (${kw} kWp)</li>${hasInv ? `<li>${esc(p.inverterBrand)} ${p.inverterKw} kW ${typeLabel} inverter, DC/AC protection & wiring</li>` : ""}${p.battery ? `<li>Battery bank installation & configuration</li>` : ""}${p.earthing ? `<li>Earthing & lightning arrestor</li>` : ""}${p.netBilling ? `<li>Net billing application & green meter with ${esc(p.disco)}</li>` : ""}<li>Testing, commissioning & handover with 1 year free maintenance</li></ol>
</div>

<div class="page">
  <div class="phead">
    ${LOGO ? `<img src="${esc(LOGO)}" alt="">` : `<b>${esc(company.name)}</b>`}
    <span>Technical &amp; Financial Proposal &nbsp;|&nbsp; ${typeLabel} Solar System</span>
  </div>
  <h2 class="ptitle"><em>3</em> SOLAR RESOURCE AT THE SITE</h2>
  <p style="font-size:11px">The chart below shows the average daily solar irradiation (peak sun hours, kWh/m²/day) at the installation site on a surface fixed at a 28°–30° tilt.</p>
  <h3 class="sec">Solar Irradiance Chart for the Site</h3>
  ${bar3d}
  <p style="text-align:center;font-style:italic;font-size:9.5px;color:#555;margin:1mm 0 3mm">Figure 1: Solar irradiance (peak sun hours per day) for ${esc(p.city || "Bhakkar")}, Pakistan.</p>
  <p style="font-size:11px">Irradiation in this area is ample and distributed evenly throughout the year. The annual average is approximately 6.45 peak sun hours (PSH) per day.</p>
  <h3 class="sec">Daily Solar Irradiance Level – Average</h3>
  ${sunCurve}
  <p style="text-align:center;font-style:italic;font-size:9.5px;color:#555;margin:1mm 0 3mm">Figure 2: Average daily solar radiation pattern for ${esc(p.city || "Bhakkar")}, Pakistan.</p>
  <p style="font-size:11px">The proposed solar PV system has been designed around this irradiance pattern.</p>
</div>

<div class="page">
  <h3 class="sec" style="margin-top:0">SOLAR USAGE & ENERGY ANALYSIS</h3>
  <div class="grid4">
    <div class="stat"><b>${kw} kWp</b><span>System Size</span></div>
    <div class="stat"><b>${Math.round(annualGen).toLocaleString()}</b><span>Est. Units / Year</span></div>
    <div class="stat"><b>${annualUnits ? annualUnits.toLocaleString() : "—"}</b><span>Your Units / Year</span></div>
    <div class="stat"><b>${coverage ? coverage + "%" : "—"}</b><span>Solar Coverage</span></div>
  </div>
  <div class="chart">${barChart}</div>
  <div class="legend"><span><i style="background:var(--blue)"></i>Your usage (units)</span><span><i style="background:var(--gold)"></i>Estimated solar generation</span></div>
  ${usageRows ? `<table style="margin-top:3mm">${usageRows}</table>` : ""}
  <h3 class="sec">SYSTEM STRUCTURE</h3>
  <img class="sys3d" src="${abs("/portfolio/system-3d.jpg")}" alt="">
  <div class="flow"><div><b>${p.panelQty} × ${p.panelWatt}W</b>Solar Panels</div><em>➜</em><div><b>${esc(p.structureType) || "Structure"}</b>Mounting</div>${hasInv ? `<em>➜</em><div><b>${p.inverterKw} kW</b>${typeLabel} Inverter</div>` : ""}${p.battery ? `<em>➜</em><div><b>${(p.battery.units * p.battery.kwhEach).toFixed(1)} kWh</b>Battery</div>` : ""}<em>➜</em><div><b>${p.netBilling ? "Net Meter" : "Load"}</b>${p.netBilling ? "Grid" : "Your Home"}</div></div>
</div>

<style>
  .qt table.it th{background:#0E3A5B;color:#fff;font-size:10.5px;padding:2.2mm 1.5mm;text-align:center}
  .qt table.it td{font-size:10px;padding:2mm 1.5mm;vertical-align:middle;border-bottom:1px solid #e3e8ef}
  .qt table.it td.d{color:#333;line-height:1.45}
  .qt .tot td{background:#0E3A5B;color:#fff;font-weight:800;font-size:12.5px;padding:3mm}
  .qt .tot td.g{background:#F2B33D;color:#0E3A5B;text-align:right;font-size:15px}
  .qt .qh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5mm}
  .qt .qh img{height:12mm}.qt .qh h1{margin:0;font-size:30px;letter-spacing:3px;color:#0E3A5B;border-bottom:3px solid #F2B33D;padding-bottom:1mm;text-align:right}
  .qt .qh small{display:block;text-align:right;color:#1E5F8C;font-weight:700;font-size:11px;margin-top:1mm}
  .qt table.inf td{font-size:10.5px;padding:1.3mm 2mm;border-bottom:1px solid #e3e8ef}.qt table.inf td.k{color:#1E5F8C;font-weight:700;width:15%}
  .qt .subj{background:#FFF6DC;border-left:4px solid #F2B33D;padding:2.5mm 3mm;font-size:11.5px;font-weight:700;color:#0E3A5B;margin:5mm 0}
  .qt h4{color:#0E3A5B;font-size:13px;margin:6mm 0 1mm;border-bottom:2px solid #F2B33D;padding-bottom:1mm}
  .qt ul.tc{margin:2mm 0;padding-left:5mm}.qt ul.tc li{font-size:10px;margin:1.2mm 0;line-height:1.45}.qt ul.tc li::marker{color:#F2B33D}
  .qt .pd p{font-size:11px;margin:1mm 0}
  .qt .sg{display:flex;justify-content:space-between;margin-top:14mm}.qt .sg div{width:42%;border-top:1.5px solid #0E3A5B;padding-top:2mm;font-weight:700;color:#0E3A5B;font-size:11.5px}
</style>
${(() => {
  const BLUE = "#0868A0", GOLD = "#F8B830";
  const use = MN.map((_, i) => Math.round(Number(p.monthlyUnits[i]) || 0));
  const gen = genMonthly.map((g) => Math.round(g));
  const niceMax = (v: number, steps: number) => { const raw = Math.max(1, v) / steps; const mag = Math.pow(10, Math.floor(Math.log10(raw))); const n = [1, 2, 2.5, 3, 5, 10].find((k) => k * mag >= raw) || 10; return n * mag * steps; };
  const fk = (n: number) => Math.round(n).toLocaleString("en-US");
  // Monthly chart
  const mMax = niceMax(Math.max(...use, ...gen) * 1.1, 5);
  const X0 = 60, B = 230, H = 200, GW = 48, BW = 17;
  const sy = (v: number) => B - (v / mMax) * H;
  const mGrid = Array.from({ length: 6 }, (_, k) => { const v = (mMax / 5) * k, y = sy(v); return `<line x1="${X0}" y1="${y}" x2="${X0 + 12 * GW}" y2="${y}" stroke="#E6E9EE"/><text x="${X0 - 6}" y="${y + 3}" font-size="8" text-anchor="end" fill="#555">${fk(v)}</text>`; }).join("");
  const mBars = MN.map((m, i) => {
    const x = X0 + i * GW + 6;
    const bar = (v: number, bx: number, c: string) => `<rect x="${bx}" y="${sy(v)}" width="${BW}" height="${B - sy(v)}" fill="${c}"/><text transform="translate(${bx + BW / 2 + 2.5},${sy(v) - 3}) rotate(-90)" font-size="6.5" font-weight="700" fill="#333">${fk(v)}</text>`;
    return bar(use[i], x, BLUE) + bar(gen[i], x + BW + 1, GOLD) + `<text x="${x + BW}" y="${B + 13}" font-size="8" text-anchor="middle" fill="#444">${m}</text>`;
  }).join("");
  const monthly = `<svg viewBox="0 0 660 260" width="100%"><rect x="${X0 + 20}" y="2" width="8" height="8" fill="${BLUE}"/><text x="${X0 + 32}" y="9.5" font-size="8" fill="#333">Grid consumption (kWh)</text><rect x="${X0 + 150}" y="2" width="8" height="8" fill="${GOLD}"/><text x="${X0 + 162}" y="9.5" font-size="8" fill="#333">Solar generation (kWh)</text><text transform="translate(16,${B - H / 2}) rotate(-90)" font-size="8" text-anchor="middle" fill="#555">kWh / month</text>${mGrid}<line x1="${X0}" y1="${B}" x2="${X0 + 12 * GW}" y2="${B}" stroke="#999"/>${mBars}</svg>`;
  // Annual chart
  const aUse = use.reduce((a, b) => a + b, 0), aGen = gen.reduce((a, b) => a + b, 0);
  const aMax = niceMax(Math.max(aUse, aGen) * 1.15, 5);
  const AX = 90, AB = 210, AH = 185, AW = 380;
  const ay = (v: number) => AB - (v / aMax) * AH;
  const aGrid = Array.from({ length: 6 }, (_, k) => { const v = (aMax / 5) * k, y = ay(v); return `<line x1="${AX}" y1="${y}" x2="${AX + AW}" y2="${y}" stroke="#E6E9EE"/><text x="${AX - 6}" y="${y + 3}" font-size="8" text-anchor="end" fill="#555">${fk(v)}</text>`; }).join("");
  const aBar = (v: number, cx: number, c: string, l: string) => `<rect x="${cx - 32}" y="${ay(v)}" width="64" height="${AB - ay(v)}" fill="${c}"/><text x="${cx}" y="${ay(v) - 4}" font-size="9" font-weight="700" text-anchor="middle" fill="#222">${fk(v)} kWh</text><text x="${cx}" y="${AB + 14}" font-size="8" text-anchor="middle" fill="#444">${l}</text>`;
  const annual = `<svg viewBox="0 0 560 230" width="78%" style="display:block;margin:0 auto"><text transform="translate(40,${AB - AH / 2}) rotate(-90)" font-size="8" text-anchor="middle" fill="#555">kWh / year</text>${aGrid}<line x1="${AX}" y1="${AB}" x2="${AX + AW}" y2="${AB}" stroke="#999"/>${aBar(aUse, AX + AW * 0.27, BLUE, "Annual grid consumption")}${aBar(aGen, AX + AW * 0.73, GOLD, "Annual solar generation")}</svg>`;
  const h = (t: string) => `<h3 style="color:#0B5A8C;font-size:17px;font-weight:800;margin:5mm 0 2mm">${t}</h3>`;
  const cap = (t: string) => `<p style="text-align:center;font-style:italic;color:#666;font-size:10px;margin:1mm 0 4mm">${t}</p>`;
  return `<div class="page">
  <div class="phead">${LOGO ? `<img src="${esc(LOGO)}" alt="">` : `<b>${esc(company.name)}</b>`}<span>Technical &amp; Financial Proposal &nbsp;|&nbsp; ${typeLabel} Solar System</span></div>
  ${h("Monthly Generation vs. Grid Consumption (kWh)")}
  ${monthly}
  ${cap(`Figure 4: Monthly grid consumption vs. expected ${kw} kWp solar generation.`)}
  ${h("Annual Consumption vs. Solar Generation")}
  ${annual}
  ${cap("Figure 5: Annual grid consumption vs. annual solar generation (kWh).")}
</div>`;
})()}

${(() => {
  const { category, reason } = resolveCategory(p.tariffCategory, p);
  const sv = computeSavings(p.monthlyUnits, genMonthly, category, tariff.rates, p.netBilling);
  const usable = annualUnits ? Math.min(annualGen, annualUnits) : annualGen;
  const yearSave = sv.yearSave;
  const monthSave = sv.monthSave;
  const cost = Math.max(0, Math.round(p.total));
  const paybackYears = yearSave > 0 ? cost / yearSave : 0;
  const pbY = Math.floor(paybackYears), pbM = Math.round((paybackYears - pbY) * 12);
  const f = (n: number) => Math.round(n).toLocaleString("en-PK");
  const periods: [string, number][] = [["1 Month", 1], ["6 Months", 6], ["1 Year", 12], ["2 Years", 24], ["3 Years", 36], ["5 Years", 60], ["10 Years", 120], ["15 Years", 180], ["20 Years", 240], ["25 Years", 300]];
  const rows = periods.map(([l, m]) => { const s = monthSave * m; const net = s - cost; return `<tr><td>${l}</td><td class="num">${f(s)}</td><td class="num" style="color:${net >= 0 ? "#0a7a3b" : "#b42318"};font-weight:700">${net >= 0 ? "+" : ""}${f(net)}</td></tr>`; }).join("");
  // cumulative chart years 0..25 — bars rise from the baseline; dashed line = system cost
  const W = 620, H = 210, X0 = 60, Y0 = 20, PW = W - X0 - 15, PH = H - Y0 - 30;
  const pts = Array.from({ length: 26 }, (_, y) => yearSave * y);
  const mx = Math.max(1, ...pts, cost * 1.05);
  const sx = (y: number) => X0 + (y / 25) * PW, sy = (v: number) => Y0 + PH - (v / mx) * PH;
  const bars = pts.map((v, y) => { const x = sx(y) - 8, yv = sy(v), recovered = yearSave * y >= cost; return `<rect x="${x}" y="${yv}" width="16" height="${Math.max(1, Y0 + PH - yv)}" fill="${recovered ? "#2E9E5B" : "#2E9BDA"}" opacity=".9"/>${y % 5 === 0 ? `<text x="${sx(y)}" y="${H - 10}" font-size="9" text-anchor="middle" fill="#555">Yr ${y}</text>` : ""}`; }).join("");
  const grid = [0, .25, .5, .75, 1].map((t) => { const v = mx * t; const y = sy(v); return `<line x1="${X0}" y1="${y}" x2="${W - 15}" y2="${y}" stroke="#e5e9ef"/><text x="${X0 - 6}" y="${y + 3}" font-size="8" text-anchor="end" fill="#666">${(v / 1e6).toFixed(1)}M</text>`; }).join("");
  const costLine = cost > 0 ? `<line x1="${X0}" y1="${sy(cost)}" x2="${W - 15}" y2="${sy(cost)}" stroke="#D9534F" stroke-width="1.8" stroke-dasharray="6 4"/><text x="${W - 18}" y="${sy(cost) - 4}" font-size="9" font-weight="700" text-anchor="end" fill="#B3261E">System cost PKR ${f(cost)}</text>` : "";
  const pbX = paybackYears > 0 && paybackYears <= 25 ? `<line x1="${sx(paybackYears)}" y1="${Y0}" x2="${sx(paybackYears)}" y2="${Y0 + PH}" stroke="#F2B33D" stroke-width="2" stroke-dasharray="5 3"/><text x="${sx(paybackYears) + 4}" y="${Y0 + 10}" font-size="10" font-weight="700" fill="#B07A00">Payback ${paybackYears.toFixed(1)} yrs</text>` : "";
  return `<div class="page qt">
  <div class="phead">${LOGO ? `<img src="${esc(LOGO)}" alt="">` : `<b>${esc(company.name)}</b>`}<span>Solar Power Proposal &nbsp;|&nbsp; ${typeLabel} System</span></div>
  <h2 class="ptitle"><em>5</em> PAYBACK &amp; SAVINGS</h2>
  <div style="display:flex;gap:3mm;margin:3mm 0 5mm">
    ${[["System Cost", `PKR ${f(cost)}`], ["Monthly Saving", `PKR ${f(monthSave)}`], ["Yearly Saving", `PKR ${f(yearSave)}`], ["Payback Period", yearSave > 0 ? `${pbY} yr ${pbM} mo` : "—"]].map(([k, v]) => `<div style="flex:1;background:#0E3A5B;color:#fff;border-radius:3mm;padding:3mm;text-align:center"><div style="font-size:9.5px;opacity:.8">${k}</div><div style="font-size:14px;font-weight:800;color:#F2B33D;margin-top:1mm">${v}</div></div>`).join("")}
  </div>
  <h4>Cumulative savings (25 years)</h4>
  <svg viewBox="0 0 ${W} ${H}" width="100%">${grid}<line x1="${X0}" y1="${Y0 + PH}" x2="${W - 15}" y2="${Y0 + PH}" stroke="#333"/>${bars}${costLine}${pbX}</svg>
  <p style="font-size:9.5px;color:#555;margin:1mm 0 0"><span style="color:#2E9BDA;font-weight:700">Blue bars</span> = savings building up &nbsp;•&nbsp; <span style="color:#2E9E5B;font-weight:700">Green bars</span> = cost recovered, pure profit &nbsp;•&nbsp; <span style="color:#B3261E;font-weight:700">Red line</span> = system cost</p>
  <h4>Savings from month to years</h4>
  <table class="it"><tr><th>Period</th><th style="width:30%">Total saving (PKR)</th><th style="width:30%">Net benefit after cost (PKR)</th></tr>${rows}</table>
  <p style="font-size:9.5px;color:#555;margin-top:3mm">Calculated on the <b>${CATEGORY_LABEL[category]}</b> electricity tariff (${esc(reason)}) — ${esc(tariff.source)}${tariff.effectiveLabel ? `, ${esc(tariff.effectiveLabel)}` : ""}: average bill rate about PKR ${sv.avgRate.toFixed(1)} per unit including FPA ${tariff.rates.fpa}/unit, electricity duty ${tariff.rates.electricityDuty}% and GST ${tariff.rates.gst}%${p.netBilling ? `; exported units credited at PKR ${tariff.rates.exportRate}/unit` : ""}. Solar use on site about ${f(usable)} units/year. Actual savings depend on future tariff changes, usage and weather.</p>
</div>`;
})()}

<div class="page qt">
  <div class="qh">
    ${LOGO ? `<img src="${esc(LOGO)}" alt="">` : `<b>${esc(company.name)}</b>`}
    <div><h1>QUOTATION</h1><small>${esc(company.name)}</small></div>
  </div>
  <table class="inf">
    <tr><td class="k">Proposed To</td><td>${esc(p.customerName)}${p.companyName ? ` - ${esc(p.companyName)}` : ""}</td><td class="k">Quotation No.</td><td>${esc(p.proposalNo)}</td></tr>
    <tr><td class="k">Address</td><td>${esc(p.address || p.city || "-")}</td><td class="k">Date</td><td>${p.date ? formatDate(p.date) : "-"}</td></tr>
    <tr><td class="k">Contact #</td><td>${esc(p.phone || "-")}</td><td class="k">Valid for</td><td>${p.validDays} days</td></tr>
    <tr><td class="k">CNIC #</td><td>${esc(p.cnic || "-")}</td><td class="k">Sales Executive</td><td>${esc(p.salesExec || "-")}</td></tr>
  </table>
  <div class="subj">SUBJECT: &nbsp;Quotation for ${kw} kW ${typeLabel} Solar System.</div>
  <table class="it">
    <thead><tr><th style="width:5%">S No</th><th style="width:15%">Item / Brand</th><th>Description</th><th style="width:8%">Qty</th><th style="width:12%">Unit Price</th><th style="width:13%">Amount</th></tr></thead><tbody>
    ${p.items.map((it, i) => `<tr><td style="text-align:center">${i + 1}</td><td><b>${esc(it.brand)}</b></td><td class="d"><b style="color:#0E3A5B">${esc(it.description)}</b>${itemDetail(it)}</td><td style="text-align:center">${it.qty} ${esc(it.unit)}</td><td style="text-align:center">${Math.round(it.unitPrice).toLocaleString("en-PK")}</td><td class="num"><b>${Math.round(it.amount).toLocaleString("en-PK")}</b></td></tr>`).join("")}
    <tr class="tot"><td colspan="4">TOTAL AMOUNT IN PKR</td><td colspan="2" class="g">${Math.round(p.total).toLocaleString("en-PK")} /-</td></tr></tbody>
  </table>
</div>

<div class="page qt">
  <div class="phead"><img src="${esc(LOGO)}" alt="K&amp;S Solar Energy"><span>${esc(p.proposalNo)} &nbsp;|&nbsp; ${esc(p.customerName)}</span></div>
  <h2 class="ptitle">TERMS, PAYMENT &amp; DELIVERY</h2>
  <ul class="tc">${termsList || [
    `<li style="color:#C0262D;font-weight:700">Long-distance wire and internal wiring are not included.</li>`,
    "Civil work is not included.",
    "Quotation prices are exclusive of all taxes. If any tax is applied by the government after the quotation is delivered, the price will be revised.",
    "All warranties are offered by the respective manufacturers. The manufacturers' terms and conditions apply to any warranty claim.",
    "We expect no interference from the client side during installation. If any customization or alteration is required, it will be quoted separately.",
    "In case of non-availability of the solar panel size/brand, alternate Tier-1 solar panels will be used.",
    "FESCO demand notice fee and other WAPDA / FESCO expenses are not included.",
    "Prices will change if a customized raised structure is required instead of the L2 C-type structure.",
  ].map((t) => (t.startsWith("<li") ? t : `<li>${t}</li>`)).join("")}</ul>
  <div class="pd">
    <p><b>Payment Method:</b> ${esc(p.paymentMethod)}</p>
    <p><b>Validity:</b> Our offer is valid for ${p.validDays} days.</p>
    <p><b>Delivery:</b> ${esc(p.delivery)}</p>
  </div>
  <div class="sg"><div>Customer's Signature</div><div>For ${esc(company.name)}</div></div>
</div>

<div class="page tm">
<style>
  .tm .hd{text-align:center;margin-bottom:6mm}.tm .hd img{height:20mm}
  .tm .hd .t{font-weight:800;letter-spacing:2px;color:#1E5F8C;font-size:13px;margin-top:2mm}
  .tm .hd .s{font-style:italic;color:#C98A1B;font-size:11.5px;margin-top:1mm}
  .tm .ceo{display:flex;gap:8mm;background:#0E3A5B;color:#fff;padding:5mm;align-items:center}
  .tm .ceo img{width:46mm;height:46mm;object-fit:cover;background:#fff}
  .tm .ceo h2{margin:0;font-size:22px;color:#fff;letter-spacing:.5px}
  .tm .gold{color:#F2B33D;font-weight:700;font-size:11.5px}
  .tm .ceo .co{font-weight:800;font-size:12.5px;margin:1.5mm 0}
  .tm .ceo p{font-size:11px;line-height:1.6;margin:1mm 0 2mm;color:#E6EEF5}
  .tm .st{text-align:center;color:#1E5F8C;font-weight:800;font-size:13px;margin:8mm 0 3mm}
  .tm .team{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #dfe6ee}
  .tm .team>div{background:#F3F6FA;text-align:center;padding:4mm 3mm;border-right:1px solid #dfe6ee}
  .tm .team>div:last-child{border-right:0}
  .tm .team img{width:38mm;height:40mm;object-fit:cover;display:block;margin:0 auto 2mm}
  .tm .team b{display:block;color:#0E3A5B;font-size:12.5px}
  .tm .team .r{color:#C98A1B;font-weight:700;font-size:10px;display:block;margin:.8mm 0}
  .tm .team .d{color:#5b6573;font-size:10.5px}
  .tm .focus{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #dfe6ee}
  .tm .focus>div{text-align:center;padding:3mm 2mm;border-right:1px solid #dfe6ee}.tm .focus>div:last-child{border-right:0}
  .tm .focus i{font-style:normal;color:#C98A1B;font-weight:700;font-size:11px;display:block}
  .tm .focus b{display:block;color:#1E5F8C;font-size:12px;margin:1mm 0}
  .tm .focus span{font-size:10px;color:#444}
  .tm .ft{text-align:center;margin-top:9mm}.tm .ft .o{color:#D8901A;font-weight:800;font-size:15px;letter-spacing:.5px}
  .tm .ft p{font-size:10.5px;margin:1.5mm 0}.tm .ft .c{color:#1E5F8C;font-weight:700}
</style>
  <div class="hd">
    ${LOGO ? `<img src="${esc(LOGO)}" alt="">` : `<b>${esc(company.name)}</b>`}
    <div class="t">LEADERSHIP &nbsp;•&nbsp; MANAGEMENT &nbsp;•&nbsp; PROFESSIONAL TEAM</div>
    <div class="s">Powering Your Future with Trust, Quality &amp; Performance</div>
  </div>
  <div class="ceo">
    <img src="${abs("/portfolio/team-ceo.jpg")}" alt="">
    <div>
      <h2>RAO KHAWAR MAHMOOD</h2>
      <div class="gold">CHIEF EXECUTIVE OFFICER (CEO)</div>
      <div class="co">K&amp;S SOLAR ENERGY PVT. LTD.</div>
      <p>Providing leadership and strategic direction for a professional solar-energy company focused on quality products, reliable systems and long-term customer value.</p>
      <div class="gold">18 YEARS OF SOLAR ENERGY EXPERIENCE</div>
    </div>
  </div>
  <div class="st">LEADERSHIP TEAM</div>
  <div class="team">
    <div><img src="${abs("/portfolio/team-adeel.jpg")}" alt=""><b>ADEEL SARWAR</b><span class="r">GENERAL MANAGER</span><span class="d">General Management</span></div>
    <div><img src="${abs("/portfolio/team-zubair.jpg")}" alt=""><b>MUHAMMAD ZUBAIR</b><span class="r">SNR. SALES EXECUTIVE</span><span class="d">Sales &amp; Customer Development</span></div>
    <div><img src="${abs("/portfolio/team-zaheer.jpg")}" alt=""><b>MUHAMMAD ZAHEER</b><span class="r">FINANCE DEPARTMENT</span><span class="d">Finance &amp; Accounts</span></div>
  </div>
  <div class="st">OUR PROFESSIONAL FOCUS</div>
  <div class="focus">
    <div><i>01</i><b>QUALITY</b><span>Genuine &amp; reliable products</span></div>
    <div><i>02</i><b>EXPERTISE</b><span>Professional solar solutions</span></div>
    <div><i>03</i><b>PERFORMANCE</b><span>Efficient system design</span></div>
    <div><i>04</i><b>SERVICE</b><span>Customer-focused support</span></div>
  </div>
  <div style="display:flex;align-items:center;justify-content:center;gap:5mm;margin:4mm 0;font-size:13px;color:#444">
    <span>Questions first?</span>
    <a href="https://wa.me/923280454939?text=${encodeURIComponent(`Assalam o Alaikum, I have a question about proposal ${p.proposalNo}`)}" target="_blank" style="display:inline-flex;align-items:center;gap:2mm;background:#25D366;color:#fff;text-decoration:none;font-weight:800;padding:2.5mm 6mm;border-radius:20mm;-webkit-print-color-adjust:exact;print-color-adjust:exact"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/></svg>WhatsApp K&amp;S Solar</a>
    <a href="tel:+923280454939" style="color:#0E3A5B;font-weight:700;text-decoration:none">&#9742; 0328-0454939</a>
  </div>
  <div class="ft">
    <div class="o">ONE TEAM &nbsp;•&nbsp; ONE VISION &nbsp;•&nbsp; CLEANER ENERGY</div>
    <p>K&amp;S Solar Energy Pvt. Ltd. &nbsp;|&nbsp; 4-Basement Ramzan Plaza, College Road, Bhakkar, Punjab, Pakistan</p>
    <p class="c">+92-328-0454939 &nbsp;•&nbsp; info@knssolar.com.pk &nbsp;•&nbsp; knssolar.com.pk</p>
  </div>
</div>

<div class="page ct-page">
<style>
  .ct-page{position:relative;overflow:hidden;background:linear-gradient(160deg,#0B1E32 0%,#0E3A5B 60%,#0F5BA8 100%);color:#fff;border-radius:6px;display:flex;flex-direction:column;min-height:250mm}
  .ct-page .glow{position:absolute;width:120mm;height:120mm;border-radius:50%;background:radial-gradient(circle,rgba(46,155,218,.35),transparent 70%)}
  .ct-page .g1{top:-40mm;right:-30mm}.ct-page .g2{bottom:-50mm;left:-30mm;background:radial-gradient(circle,rgba(242,179,61,.22),transparent 70%)}
  .ct-page .inner{position:relative;padding:16mm 14mm;display:flex;flex-direction:column;flex:1}
  .ct-page .tp{display:flex;justify-content:space-between;align-items:center}
  .ct-page .tp img{height:16mm}
  .ct-page .tp .rbs{font-size:20px;font-style:italic;font-weight:800;color:#5EC9F8;text-shadow:0 0 12px rgba(94,201,248,.6)}
  .ct-page h2{font-size:30px;font-weight:800;margin:14mm 0 2mm;letter-spacing:.5px}
  .ct-page h2 span{color:#F2B33D}
  .ct-page .sub{font-size:12.5px;color:#cfe3f2;margin-bottom:10mm}
  .ct-page .cards{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
  .ct-page .card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-top:3px solid #F2B33D;border-radius:8px;padding:5mm}
  .ct-page .card small{display:block;font-size:9.5px;letter-spacing:.18em;color:#5EC9F8;font-weight:800;margin-bottom:1.5mm}
  .ct-page .card b{display:block;font-size:14px}
  .ct-page .card span{display:block;font-size:11px;color:#cfe3f2;margin-top:1mm;line-height:1.5}
  .ct-page .soc{margin-top:8mm}
  .ct-page .soc small{display:block;font-size:9.5px;letter-spacing:.18em;color:#5EC9F8;font-weight:800;margin-bottom:3mm}
  .ct-page .soc .row{display:flex;gap:3mm;flex-wrap:wrap}
  .ct-page .soc a{display:inline-flex;align-items:center;gap:2.5mm;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);color:#fff;text-decoration:none;font-size:11.5px;font-weight:700;padding:2.8mm 5mm;border-radius:20mm}
  .ct-page .soc a svg{flex:0 0 auto}
  .ct-page .map{margin-top:8mm;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:5mm;display:flex;gap:4mm;align-items:center}
  .ct-page .map .pin{font-size:26px}
  .ct-page .map b{display:block;font-size:13px}
  .ct-page .map span{font-size:11px;color:#cfe3f2;line-height:1.55}
  .ct-page .foot{margin-top:auto;padding-top:8mm;text-align:center;border-top:1px solid rgba(255,255,255,.15)}
  .ct-page .foot .o{color:#F2B33D;font-weight:800;font-size:14px;letter-spacing:1px}
  .ct-page .foot p{font-size:10px;color:#9fb9cc;margin-top:1.5mm}
</style>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="inner">
    <div class="tp">
      ${LOGO ? `<img src="${esc(LOGO)}" alt="K&amp;S Solar Energy">` : `<b>${esc(company.name)}</b>`}
      <span class="rbs">Run by Sun</span>
    </div>
    <h2>LET'S STAY <span>CONNECTED</span></h2>
    <p class="sub">Visit us, call us or follow us online — our team is always ready to help you switch to clean, affordable solar energy.</p>
    <div class="cards">
      <div class="card"><small>HEAD OFFICE</small><b>K&amp;S Solar Energy Pvt. Ltd.</b><span>4-Basement, Ramzan Plaza, College Road,<br>Bhakkar, Punjab, Pakistan</span></div>
      <div class="card"><small>CALL / WHATSAPP</small><b>+92-328-0454939</b><span>Mon – Sat, 9:00 AM – 6:00 PM<br>Quick response on WhatsApp</span></div>
      <div class="card"><small>EMAIL</small><b>info@knssolar.com.pk</b><span>Send us your electricity bill for a<br>free savings estimate</span></div>
      <div class="card"><small>WEBSITE</small><b>www.knssolar.com.pk</b><span>Projects, products &amp; our latest<br>solar installations</span></div>
    </div>
    <div class="soc">
      <small>FOLLOW US ON SOCIAL MEDIA</small>
      <div class="row">
        <a href="https://www.facebook.com/knssolarenergy" target="_blank"><svg width="15" height="15" viewBox="0 0 24 24" fill="#5EC9F8"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5H16V5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9V11H7.5v3H10v7h3.5z"/></svg>Facebook — K&amp;S Solar Energy</a>
        <a href="https://www.instagram.com/knssolarenergy" target="_blank"><svg width="15" height="15" viewBox="0 0 24 24" fill="#5EC9F8"><path d="M12 4.2c2.6 0 2.9 0 3.9.1 2.7.1 3.9 1.4 4 4 .1 1 .1 1.3.1 3.9s0 2.9-.1 3.9c-.1 2.6-1.3 3.9-4 4-1 .1-1.3.1-3.9.1s-2.9 0-3.9-.1c-2.7-.1-3.9-1.4-4-4-.1-1-.1-1.3-.1-3.9s0-2.9.1-3.9c.1-2.6 1.3-3.9 4-4 1-.1 1.3-.1 3.9-.1M12 2.5c-2.6 0-3 0-4 .1C4.7 2.7 2.7 4.7 2.6 8c-.1 1-.1 1.4-.1 4s0 3 .1 4c.1 3.3 2.1 5.3 5.4 5.4 1 .1 1.4.1 4 .1s3 0 4-.1c3.3-.1 5.3-2.1 5.4-5.4.1-1 .1-1.4.1-4s0-3-.1-4c-.1-3.3-2.1-5.3-5.4-5.4-1-.1-1.4-.1-4-.1zm0 4.7a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zm5-8.1a1.1 1.1 0 1 0 0-2.3 1.1 1.1 0 0 0 0 2.3z"/></svg>Instagram — @knssolarenergy</a>
        <a href="https://wa.me/923280454939" target="_blank"><svg width="15" height="15" viewBox="0 0 24 24" fill="#5EC9F8"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/></svg>WhatsApp — 0328-0454939</a>
        <a href="https://www.youtube.com/@knssolarenergy" target="_blank"><svg width="15" height="15" viewBox="0 0 24 24" fill="#5EC9F8"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>YouTube — K&amp;S Solar Energy</a>
      </div>
    </div>
    <div class="map">
      <span class="pin">📍</span>
      <div><b>Find us in Bhakkar</b><span>Ramzan Plaza, College Road — near the main commercial market. Free site survey within Bhakkar city; out-of-city surveys on appointment.</span></div>
    </div>
    <div class="foot">
      <div class="o">RUN BY SUN ☀ POWERED BY TRUST</div>
      <p>K&amp;S Solar Energy Pvt. Ltd. &nbsp;|&nbsp; SECP Registered &nbsp;•&nbsp; AEDB Certified &nbsp;•&nbsp; PEC Registered &nbsp;|&nbsp; Proposal ${esc(p.proposalNo)}</p>
    </div>
  </div>
</div>

</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  const imgs = Array.from(w.document.images || []);
  Promise.all([
    w.document.fonts.ready,
    ...imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = () => r(null); }))),
  ]).then(() => w.requestAnimationFrame(() => w.requestAnimationFrame(() => w.print())));
}
