import type { Proposal } from "@/pages/Proposals";
import jamilImg from "@/assets/portfolio/project-jamil.jpg.asset.json";
import fazalImg from "@/assets/portfolio/project-fazal.jpg.asset.json";
import fatimaImg from "@/assets/portfolio/project-fatima.jpg.asset.json";
import jhanzabImg from "@/assets/portfolio/project-jhanzab.jpg.asset.json";

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
  { title: "Jamil Flour Mill", place: "Bhakkar", size: "1.2 Megawatts", img: jamilImg.url },
  { title: "Fazal Kareem Flour Mill", place: "Behal, Bhakkar", size: "421 Kilowatt", img: fazalImg.url },
  { title: "Fatima Medical Complex", place: "Bhakkar", size: "100 Kilowatt", img: fatimaImg.url },
  { title: "Mr. Jhanzab Niazi's Home", place: "Bhakkar", size: "15 kW On-Grid", img: jhanzabImg.url },
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
  .quote{background:var(--soft);border-left:4px solid var(--gold);padding:4mm 5mm;margin-top:4mm;font-style:italic;color:var(--navy)}
  ol.steps{margin:2mm 0 0 5mm}ol.steps li{margin-bottom:1.5mm}
  @media print{@page{size:A4;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>

<div class="page">
  <div class="cover">
    <div class="tag">CLEAN ENERGY • GENUINE PRODUCTS • PROFESSIONAL SERVICE</div>
    <h1>${esc(company.name).toUpperCase()} POWER PROPOSAL</h1>
    <h2>${kw} kW ${typeLabel} Solar System</h2>
    <p class="sub">${p.systemType === "on-grid" ? "Grid-connected" : p.systemType === "hybrid" ? "Grid-connected with battery backup" : "Independent off-grid"}${p.netBilling ? " & Net Billing" : ""}</p>
    <div class="box">
      <h3>PREPARED FOR</h3>
      <div class="row">
        <div class="cell"><b>${esc(p.customerName)}</b><span>${esc(p.companyName)}</span></div>
        <div class="cell"><b>${esc(p.city)}</b><span>${esc(p.address)}</span></div>
        <div class="cell"><b>${esc(p.phone)}</b><span>Contact</span></div>
      </div>
    </div>
    <div class="box">
      <h3>QUICK SUMMARY</h3>
      <div class="row">
        <div class="cell"><b>${kw} kWp ${typeLabel}</b><span>System</span></div>
        <div class="cell"><b>${money(p.total)}</b><span>Quote</span></div>
        ${p.battery ? `<div class="cell"><b>${(p.battery.units * p.battery.kwhEach).toFixed(1)} kWh</b><span>Battery</span></div>` : ""}
        ${annualUnits ? `<div class="cell"><b>${annualUnits.toLocaleString()} units</b><span>Annual usage</span></div>` : ""}
      </div>
    </div>
    <div class="foot">
      <span>Ref: ${esc(p.proposalNo)}</span>
      <span>Date: ${p.date ? formatDate(p.date) : "-"}</span>
      <span>Valid until: ${validUntil ? formatDate(validUntil) : "-"}</span>
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
  <h3 class="sec">WHY CHOOSE US</h3>
  <div class="grid2">
    <div class="feat"><b>01. Expertise & Experience</b><span>Years of solar industry experience and professional electrical engineers, tailored to your energy needs.</span></div>
    <div class="feat"><b>02. High-Quality Products</b><span>Premium panels and equipment for durability, efficiency and long-term savings.</span></div>
    <div class="feat"><b>03. Customer-Centric Approach</b><span>Personalized consultation, professional installation and excellent after-sales support.</span></div>
    <div class="feat"><b>04. Affordable & Reliable</b><span>Competitive pricing with a great return on investment.</span></div>
  </div>
  <h3 class="sec">OUR SERVICES</h3>
  <div class="grid2">
    <div class="feat"><b>Net Metering</b><span>Save up to 100% on bills by selling excess energy back to the grid — hassle-free paperwork.</span></div>
    <div class="feat"><b>Installation & Maintenance</b><span>Expert installation with <b>1 Year Free Maintenance</b>.</span></div>
    <div class="feat"><b>Solar Panel Washing</b><span>Professional cleaning for optimal energy production.</span></div>
    <div class="feat"><b>Residential • Commercial • Industrial • Agricultural</b><span>Home backup, business savings, high-capacity industrial plants and solar tube-wells.</span></div>
  </div>
</div>

<div class="page about">
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
  <ol class="steps"><li>Site survey & load analysis</li><li>System design & proposal</li><li>Supply of genuine equipment</li><li>Professional installation & testing</li><li>Net metering & handover</li><li>1 year free maintenance & ongoing support</li></ol>
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

  <h3 class="sec">CUSTOMER & PROJECT</h3>
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

  ${usageRows ? `<h3 class="sec">ELECTRICITY USAGE (UNITS PER MONTH)</h3><table>${usageRows}</table>` : ""}
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

</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 350);
}
