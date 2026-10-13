import type { Proposal } from "@/pages/Proposals";

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
  projects: { title: string; customer: string; date: string; detail: string }[] = []
) {
  const abs = (u: string) => (u.startsWith("http") ? u : `${window.location.origin}${u}`);
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

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proposal ${esc(p.proposalNo)}</title>
<style>
  :root{--blue:#0868A0;--gold:#F8B830;--navy:#0B3A5B;--ink:#1E2B36;--muted:#5F6F7C;--line:#D7E0E7;--soft:#EAF3F9}
  *{box-sizing:border-box;margin:0}
  body{font-family:"Segoe UI",Calibri,system-ui,Arial,sans-serif;color:var(--ink);line-height:1.45;font-size:12.5px}
  .page{width:190mm;margin:0 auto;padding:10mm 0;page-break-after:always}
  .page:last-child{page-break-after:auto}
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
  .cover3d .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,58,91,.85) 0%,rgba(11,58,91,.25) 45%,rgba(11,58,91,.9) 100%)}
  .cover3d .ct{position:relative;padding:14mm}
  .cover3d .logo{height:16mm;background:#fff;border-radius:6px;padding:2mm;margin-bottom:6mm}
  .cover3d .tag{letter-spacing:.22em;font-size:10px;color:var(--gold);font-weight:700}
  .cover3d h1{font-size:30px;font-weight:800;margin:6mm 0 3mm;text-shadow:0 3px 12px rgba(0,0,0,.5)}
  .cover3d h1 span{color:var(--gold)}
  .cover3d h2{font-size:18px;text-shadow:0 2px 8px rgba(0,0,0,.5)}
  .cover3d .cbox{position:absolute;left:12mm;right:12mm;bottom:12mm;display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
  .cover3d .cbox div{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-top:3px solid var(--gold);border-radius:8px;padding:4mm;backdrop-filter:blur(4px)}
  .cover3d .cbox small{display:block;font-size:9px;letter-spacing:.18em;color:var(--gold);font-weight:700}
  .cover3d .cbox b{display:block;font-size:14px;margin:1mm 0}.cover3d .cbox span{font-size:10px;opacity:.85}
  .chart{border:1px solid var(--line);border-radius:8px;padding:3mm;background:linear-gradient(180deg,#fff,var(--soft))}
  .legend{display:flex;gap:6mm;font-size:10.5px;color:var(--muted);margin-top:2mm}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}
  .sys3d{width:100%;height:70mm;object-fit:contain;display:block;border-radius:8px}
  .flow{display:flex;align-items:center;justify-content:space-between;gap:2mm;margin-top:2mm}.flow div{flex:1;text-align:center;background:var(--soft);border-top:3px solid var(--blue);border-radius:6px;padding:2.5mm;font-size:10px;color:var(--muted)}.flow div b{display:block;color:var(--navy);font-size:12px}.flow em{color:var(--gold);font-style:normal;font-weight:800}
  @media print{@page{size:A4;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>

<div class="page">
  <div class="cover3d">
    <img class="bg" src="${abs("/portfolio/cover-3d.jpg")}" alt="">
    <div class="shade"></div>
    <div class="ct">
      ${company.logoUrl ? `<img class="logo" src="${esc(company.logoUrl)}" alt="">` : ""}
      <div class="tag">CLEAN ENERGY • GENUINE PRODUCTS • PROFESSIONAL SERVICE</div>
      <h1>${esc(company.name).toUpperCase()}<br><span>SOLAR POWER PROPOSAL</span></h1>
      <h2>${kw} kW ${typeLabel} Solar System</h2>
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
    ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" alt="">` : ""}
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
  ${projects.length ? `<h3 class="sec">RECENTLY COMPLETED</h3><div class="grid2">${projectCards}</div>` : ""}
</div>

<div class="page">
  <div class="head">
    ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" alt="">` : ""}
    <div class="co"><b>${esc(company.name)}</b><span>${esc(company.address)}</span><span>${esc(company.phone)} • ${esc(company.email)}</span></div>
  </div>

  <h3 class="sec">CUSTOMER PROPOSAL — ${esc(p.customerName).toUpperCase()}</h3>
  <div class="meta">
    <div><b>Customer:</b> ${esc(p.customerName)}</div>
    <div><b>Company / Place:</b> ${esc(p.companyName) || "-"}</div>
    <div><b>Address:</b> ${esc(p.address) || "-"}</div>
    <div><b>City:</b> ${esc(p.city) || "-"}</div>
    <div><b>Phone:</b> ${esc(p.phone) || "-"}</div>
    <div><b>CNIC:</b> ${esc(p.cnic) || "-"}</div>
    <div><b>Proposal No:</b> ${esc(p.proposalNo)}</div>
    <div><b>Date:</b> ${p.date ? formatDate(p.date) : "-"}</div>
  </div>

  <h3 class="sec">SYSTEM DETAILS</h3>
  <table>
    <tr><th style="width:22%">Component</th><th style="width:30%">Brand / Model</th><th style="width:28%">Specification</th><th>Warranty</th></tr>
    <tr><td>Solar Panels</td><td>${esc(p.panelBrand)}</td><td>${p.panelQty} × ${p.panelWatt} W = ${kw} kWp</td><td>${esc(p.panelWarranty)}</td></tr>
    <tr><td>Inverter</td><td>${esc(p.inverterBrand)}</td><td>${p.inverterKw} kW ${typeLabel}</td><td>${esc(p.inverterWarranty)}</td></tr>
    <tr><td>Structure</td><td>${esc(p.structureType)}</td><td>${p.structureQty} set(s)</td><td>—</td></tr>
    ${batteryBlock}
    ${p.netBilling ? `<tr><td>Net Billing</td><td>${esc(p.disco)}</td><td>Green meter & net billing included</td><td>—</td></tr>` : ""}
    ${p.earthing ? `<tr><td>Earthing</td><td>—</td><td>Earthing & lightning arrestor included</td><td>—</td></tr>` : ""}
  </table>
  <h3 class="sec">SYSTEM IMPLEMENTATION PLAN</h3>
  <ol class="steps"><li>Site survey, shade analysis & roof load check</li><li>Installation of ${esc(p.structureType)} structure for ${p.panelQty} panels</li><li>Mounting of ${p.panelQty} × ${p.panelWatt} W ${esc(p.panelBrand)} panels (${kw} kWp)</li><li>${esc(p.inverterBrand)} ${p.inverterKw} kW ${typeLabel} inverter, DC/AC protection & wiring</li>${p.battery ? `<li>Battery bank installation & configuration</li>` : ""}${p.earthing ? `<li>Earthing & lightning arrestor</li>` : ""}${p.netBilling ? `<li>Net billing application & green meter with ${esc(p.disco)}</li>` : ""}<li>Testing, commissioning & handover with 1 year free maintenance</li></ol>
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
  <div class="flow"><div><b>${p.panelQty} × ${p.panelWatt}W</b>Solar Panels</div><em>➜</em><div><b>${esc(p.structureType) || "Structure"}</b>Mounting</div><em>➜</em><div><b>${p.inverterKw} kW</b>${typeLabel} Inverter</div>${p.battery ? `<em>➜</em><div><b>${(p.battery.units * p.battery.kwhEach).toFixed(1)} kWh</b>Battery</div>` : ""}<em>➜</em><div><b>${p.netBilling ? "Net Meter" : "Load"}</b>${p.netBilling ? "Grid" : "Your Home"}</div></div>
</div>

<div class="page">
  <h3 class="sec">QUOTATION</h3>
  <table>
    <tr><th>#</th><th>Item / Brand</th><th>Description</th><th class="num">Qty</th><th>Unit</th><th class="num">Unit Price</th><th class="num">Amount</th></tr>
    ${itemsRows}
    <tr class="total-row"><td colspan="6">Quotation Total</td><td class="num">${money(p.total)}</td></tr>
  </table>

  <h3 class="sec">PAYMENT & DELIVERY</h3>
  <div class="meta">
    <div><b>Payment:</b> ${esc(p.paymentMethod)}</div>
    <div><b>Delivery:</b> ${esc(p.delivery)}</div>
    <div><b>Offer valid:</b> ${p.validDays} day(s)</div>
    <div><b>Sales executive:</b> ${esc(p.salesExec)}</div>
  </div>

  ${termsList ? `<h3 class="sec">TERMS & CONDITIONS</h3><ul class="terms">${termsList}</ul>` : ""}

  <div class="sig">
    <div class="s"><b>${esc(p.signedName)}</b>${esc(p.signedTitle)}<br>${esc(p.signedPhone)}<br>${esc(p.signedEmail)}</div>
    <div class="s"><b>Customer Signature</b><br><br><br></div>
  </div>
</div>

<div class="page about">
  <h3 class="sec" style="margin-top:0">OUR VISION & MISSION</h3>
  <div class="grid2">
    <div>
      <h3 class="sec">OUR VISION</h3>
      <ul class="terms"><li><b>Empowering a Sustainable Future</b> — reliable, affordable, eco-friendly solar that reduces dependence on conventional power.</li><li><b>Customer-Centric Innovation</b> — cutting-edge technology for maximum efficiency, savings and long-term benefit.</li></ul>
    </div>
    <div>
      <h3 class="sec">OUR MISSION</h3>
      <ul class="terms"><li>Promote renewable energy for residential, commercial & industrial sectors.</li><li>Exceptional service from consultation to installation and maintenance.</li><li>Drive innovation & excellence with the latest technology.</li><li>Contribute to a greener planet by making clean energy accessible to all.</li></ul>
    </div>
  </div>
  <h3 class="sec">LEADERSHIP & TEAM</h3>
  <div class="quote" style="margin-top:0">"We believe that every rooftop should harness solar power, and every business should enjoy energy freedom. Together, let's light up the world!" — <b>Khawar Mehmood</b>, CEO</div>
  <div class="grid4" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat"><b style="font-size:13px">M. Adeel</b><span>General Manager</span></div>
    <div class="stat"><b style="font-size:13px">M. Zaheer</b><span>GAM</span></div>
    <div class="stat"><b style="font-size:13px">Zubair Akhter</b><span>SEM</span></div>
    <div class="stat"><b style="font-size:13px">Khalid Haseeb</b><span>SMM</span></div>
    <div class="stat"><b style="font-size:13px">M. Naveed</b><span>SAM</span></div>
    <div class="stat"><b style="font-size:13px">M. Yousuf</b><span>SE</span></div>
  </div>
  <p style="font-size:11px;color:var(--muted)">Backed by a team of professional electrical engineers specialised in renewable energy design, installation and optimisation.</p>
  <h3 class="sec">HOW WE WORK</h3>
  <p>1. Site survey & load analysis &nbsp;→&nbsp; 2. System design & proposal &nbsp;→&nbsp; 3. Supply of genuine equipment &nbsp;→&nbsp; 4. Professional installation & testing &nbsp;→&nbsp; 5. Net metering & handover &nbsp;→&nbsp; 6. 1 year free maintenance & ongoing support</p>
</div>

</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  const imgs = Array.from(w.document.images);
  Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = () => r(null); })))).then(() => setTimeout(() => w.print(), 200));
}
