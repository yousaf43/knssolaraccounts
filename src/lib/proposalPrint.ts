import type { Proposal } from "@/pages/Proposals";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n: number) => `PKR ${Math.round(n).toLocaleString("en-PK")}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function printProposal(
  p: Proposal,
  company: { name: string; address: string; phone: string; email: string; logoUrl: string },
  formatDate: (d: string | Date) => string
) {
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
