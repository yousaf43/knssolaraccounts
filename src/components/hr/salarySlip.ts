import type { PayrollEntry } from "@/hooks/useAppData";

export type SlipCompany = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
};

export type SlipExtra = {
  designation?: string;
  department?: string;
  code?: string;
  joinDate?: string;
  presentDays?: number;
  absentDays?: number;
  leaveDays?: number;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const monthLabel = (m: string) => {
  if (!m) return "-";
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

const numToWords = (n: number): string => {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const chunk = (x: number): string => {
    if (x === 0) return "";
    if (x < 20) return a[x];
    if (x < 100) return `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`;
    return `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + chunk(x % 100) : ""}`;
  };
  let num = Math.floor(Math.abs(n));
  if (num === 0) return "Zero";
  const parts: string[] = [];
  const units: [number, string][] = [[10000000, "Crore"], [100000, "Lac"], [1000, "Thousand"]];
  for (const [val, label] of units) {
    if (num >= val) {
      parts.push(`${chunk(Math.floor(num / val))} ${label}`);
      num %= val;
    }
  }
  if (num) parts.push(chunk(num));
  return parts.join(" ").trim();
};

export type SlipInput = {
  entry: PayrollEntry;
  extra?: SlipExtra;
};

export function printSalarySlips(
  slips: SlipInput[],
  company: SlipCompany,
  formatCurrency: (n: number) => string,
  formatDate: (d: string) => string,
) {
  if (slips.length === 0) return;

  const body = slips
    .map(({ entry: p, extra = {} }) => {
      const earnings = [
        ["Basic Salary", p.basicSalary || 0],
        ["Allowances", p.allowances || 0],
        ["Overtime", p.overtime || 0],
      ] as [string, number][];
      const deductions = [
        ["Deductions", p.deductions || 0],
        ["Advance / Loan", p.advance || 0],
      ] as [string, number][];
      const gross = earnings.reduce((s, [, v]) => s + v, 0);
      const totalDed = deductions.reduce((s, [, v]) => s + v, 0);
      const net = gross - totalDed;

      const rows = Math.max(earnings.length, deductions.length);
      const lineRows = Array.from({ length: rows })
        .map((_, i) => {
          const e = earnings[i];
          const d = deductions[i];
          return `<tr>
            <td>${e ? esc(e[0]) : ""}</td><td class="num">${e ? esc(formatCurrency(e[1])) : ""}</td>
            <td>${d ? esc(d[0]) : ""}</td><td class="num">${d ? esc(formatCurrency(d[1])) : ""}</td>
          </tr>`;
        })
        .join("");

      return `<section class="slip">
        <header>
          ${company.logoUrl ? `<img class="logo" src="${esc(company.logoUrl)}" />` : ""}
          <div class="co">
            <h1>${esc(company.name || "Company")}</h1>
            <p>${esc([company.address, company.phone, company.email].filter(Boolean).join(" | "))}</p>
          </div>
          <div class="title">SALARY SLIP<span>${esc(monthLabel(p.month))}</span></div>
        </header>

        <table class="meta">
          <tr>
            <td><b>Employee</b><span>${esc(p.employeeName || "-")}</span></td>
            <td><b>Code</b><span>${esc(extra.code || "-")}</span></td>
            <td><b>Designation</b><span>${esc(extra.designation || "-")}</span></td>
          </tr>
          <tr>
            <td><b>Department</b><span>${esc(extra.department || "-")}</span></td>
            <td><b>Join Date</b><span>${esc(extra.joinDate ? formatDate(extra.joinDate) : "-")}</span></td>
            <td><b>Pay Status</b><span>${esc(p.status === "paid" ? `Paid${p.paidDate ? " on " + formatDate(p.paidDate) : ""}` : "Pending")}</span></td>
          </tr>
          <tr>
            <td><b>Present Days</b><span>${esc(extra.presentDays ?? "-")}</span></td>
            <td><b>Absent Days</b><span>${esc(extra.absentDays ?? "-")}</span></td>
            <td><b>Leave Days</b><span>${esc(extra.leaveDays ?? "-")}</span></td>
          </tr>
        </table>

        <table class="lines">
          <thead><tr><th>Earnings</th><th class="num">Amount</th><th>Deductions</th><th class="num">Amount</th></tr></thead>
          <tbody>${lineRows}</tbody>
          <tfoot>
            <tr><th>Gross Earnings</th><th class="num">${esc(formatCurrency(gross))}</th><th>Total Deductions</th><th class="num">${esc(formatCurrency(totalDed))}</th></tr>
          </tfoot>
        </table>

        <div class="net">
          <div class="words">Amount in words: <b>${esc(numToWords(net))} Only</b></div>
          <div class="amt">Net Payable<span>${esc(formatCurrency(net))}</span></div>
        </div>

        ${p.notes ? `<p class="notes"><b>Notes:</b> ${esc(p.notes)}</p>` : ""}
        <p class="pm"><b>Payment Method:</b> ${esc(p.paymentMethod || "-")}</p>

        <div class="sign">
          <div>Employee Signature</div>
          <div>Authorised Signature</div>
        </div>
      </section>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>Salary Slip</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;background:#f1f5f9;font-size:12px}
    .slip{background:#fff;width:210mm;min-height:145mm;margin:8mm auto;padding:10mm;border:1px solid #cbd5e1}
    header{display:flex;align-items:center;gap:12px;border-bottom:3px solid #0b63c5;padding-bottom:10px}
    .logo{height:52px;object-fit:contain}
    .co h1{margin:0;font-size:19px;color:#0b63c5;letter-spacing:.3px}
    .co p{margin:3px 0 0;font-size:11px;color:#475569}
    .title{margin-left:auto;text-align:right;font-size:15px;font-weight:700;color:#0b63c5}
    .title span{display:block;font-size:11px;font-weight:600;color:#334155}
    table{width:100%;border-collapse:collapse}
    .meta{margin-top:10px}
    .meta td{border:1px solid #e2e8f0;padding:6px 8px;width:33.33%}
    .meta b{display:block;font-size:9.5px;text-transform:uppercase;color:#64748b;letter-spacing:.4px}
    .meta span{font-size:12px;font-weight:600}
    .lines{margin-top:12px}
    .lines th,.lines td{border:1px solid #e2e8f0;padding:6px 8px}
    .lines thead th{background:#0b63c5;color:#fff;font-size:11px;text-transform:uppercase}
    .lines tfoot th{background:#f1f5f9}
    .num{text-align:right}
    .net{display:flex;align-items:center;gap:12px;margin-top:12px;border:1px solid #0b63c5;border-radius:4px;padding:8px 10px}
    .words{flex:1;font-size:11px}
    .amt{text-align:right;font-size:11px;color:#475569}
    .amt span{display:block;font-size:19px;font-weight:700;color:#0b63c5}
    .notes,.pm{margin:8px 0 0;font-size:11px}
    .sign{display:flex;justify-content:space-between;margin-top:26mm;font-size:11px}
    .sign div{border-top:1px solid #94a3b8;padding-top:4px;width:60mm;text-align:center}
    @media print{
      body{background:#fff}
      .slip{margin:0;border:0;page-break-after:always;width:auto;min-height:auto}
      .slip:last-child{page-break-after:auto}
      @page{size:A4 portrait;margin:10mm}
    }
  </style></head><body>${body}
  <script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
  </body></html>`;

  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
