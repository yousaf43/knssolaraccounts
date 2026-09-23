import { formatTime12, type AttendanceSettings } from "./attendanceSettings";

export type ReportCompany = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
};

export type ReportRow = {
  date: string;
  employee: string;
  status: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  lateMinutes: number;
  overtimeHours: number;
};

export type ReportSummary = {
  employee: string;
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  hours: number;
  lateDays: number;
  overtimeHours: number;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const lateLabel = (m: number) => (m > 0 ? `${m}m` : "-");

export function printAttendanceReport(opts: {
  company: ReportCompany;
  settings: AttendanceSettings;
  periodLabel: string;
  rows: ReportRow[];
  summary: ReportSummary[];
  formatDate: (d: string) => string;
}) {
  const { company, settings, periodLabel, rows, summary, formatDate } = opts;

  const totals = summary.reduce(
    (t, s) => ({
      present: t.present + s.present,
      absent: t.absent + s.absent,
      leave: t.leave + s.leave,
      halfDay: t.halfDay + s.halfDay,
      hours: t.hours + s.hours,
      lateDays: t.lateDays + s.lateDays,
      overtimeHours: t.overtimeHours + s.overtimeHours,
    }),
    { present: 0, absent: 0, leave: 0, halfDay: 0, hours: 0, lateDays: 0, overtimeHours: 0 },
  );

  const summaryRows = summary
    .map(
      (s, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td><b>${esc(s.employee)}</b></td>
        <td class="c ok">${s.present}</td>
        <td class="c">${s.halfDay}</td>
        <td class="c bad">${s.absent}</td>
        <td class="c">${s.leave}</td>
        <td class="c warn">${s.lateDays}</td>
        <td class="n">${s.hours.toFixed(2)}</td>
        <td class="n ot">${s.overtimeHours.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const detailRows = rows
    .map(
      (r, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(formatDate(r.date))}</td>
        <td><b>${esc(r.employee)}</b></td>
        <td class="c cap">${esc(r.status)}</td>
        <td class="c">${esc(formatTime12(r.checkIn) || "-")}</td>
        <td class="c">${esc(formatTime12(r.checkOut) || "-")}</td>
        <td class="n">${(r.hours || 0).toFixed(2)}</td>
        <td class="c ${r.lateMinutes > 0 ? "warn" : ""}">${lateLabel(r.lateMinutes)}</td>
        <td class="n ${r.overtimeHours > 0 ? "ot" : ""}">${r.overtimeHours > 0 ? r.overtimeHours.toFixed(2) : "-"}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>Attendance Report</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:8mm;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;background:#fff;font-size:11px}
    header{display:flex;align-items:center;gap:12px;border-bottom:3px solid #0b63c5;padding-bottom:10px}
    .logo{height:50px;object-fit:contain}
    .co h1{margin:0;font-size:18px;color:#0b63c5}
    .co p{margin:3px 0 0;font-size:10.5px;color:#475569}
    .title{margin-left:auto;text-align:right;font-size:15px;font-weight:800;color:#0b63c5}
    .title span{display:block;font-size:10.5px;font-weight:600;color:#334155}
    .rules{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
    .rules div{border:1px solid #e2e8f0;border-radius:4px;padding:4px 8px;font-size:10px;color:#475569}
    .rules b{color:#0f172a}
    h2{margin:14px 0 6px;font-size:12.5px;color:#0b63c5;text-transform:uppercase;letter-spacing:.4px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #e2e8f0;padding:4.5px 6px}
    thead th{background:#0b63c5;color:#fff;font-size:10px;text-transform:uppercase;font-weight:700}
    tbody tr:nth-child(even){background:#f8fafc}
    tfoot td{background:#f1f5f9;font-weight:800}
    .c{text-align:center}.n{text-align:right}.cap{text-transform:capitalize}
    .ok{color:#047857;font-weight:700}.bad{color:#b91c1c;font-weight:700}
    .warn{color:#b45309;font-weight:700}.ot{color:#0b63c5;font-weight:700}
    footer{margin-top:14px;display:flex;justify-content:space-between;font-size:10px;color:#64748b}
    @media print{ body{padding:0} @page{size:A4 portrait;margin:10mm} thead{display:table-header-group} }
  </style></head><body>
    <header>
      ${company.logoUrl ? `<img class="logo" src="${esc(company.logoUrl)}" />` : ""}
      <div class="co">
        <h1>${esc(company.name || "Company")}</h1>
        <p>${esc([company.address, company.phone, company.email].filter(Boolean).join(" | "))}</p>
      </div>
      <div class="title">ATTENDANCE REPORT<span>${esc(periodLabel)}</span></div>
    </header>

    <div class="rules">
      <div>Shift: <b>${esc(formatTime12(settings.shiftStart))} - ${esc(formatTime12(settings.shiftEnd))}</b></div>
      <div>Check-in cutoff: <b>${esc(formatTime12(settings.checkInCutoff))}</b></div>
      <div>Grace: <b>${settings.graceMinutes} min</b></div>
      <div>Overtime after: <b>${esc(formatTime12(settings.shiftEnd))} (${(settings.minOvertimeMinutes / 60).toFixed(2)} hour minimum)</b></div>
    </div>

    <h2>Summary</h2>
    <table>
      <thead><tr>
        <th>Sr</th><th>Employee</th><th>Present</th><th>Half Day</th><th>Absent</th>
        <th>Leave</th><th>Late Days</th><th>Hours</th><th>Overtime (h)</th>
      </tr></thead>
      <tbody>${summaryRows || `<tr><td colspan="9" class="c">No records</td></tr>`}</tbody>
      <tfoot><tr>
        <td colspan="2">Total</td>
        <td class="c">${totals.present}</td><td class="c">${totals.halfDay}</td><td class="c">${totals.absent}</td>
        <td class="c">${totals.leave}</td><td class="c">${totals.lateDays}</td>
        <td class="n">${totals.hours.toFixed(2)}</td><td class="n">${totals.overtimeHours.toFixed(2)}</td>
      </tr></tfoot>
    </table>

    <h2>Daily Detail</h2>
    <table>
      <thead><tr>
        <th>Sr</th><th>Date</th><th>Employee</th><th>Status</th><th>Check In</th>
        <th>Check Out</th><th>Hours</th><th>Late</th><th>Overtime (h)</th>
      </tr></thead>
      <tbody>${detailRows || `<tr><td colspan="9" class="c">No records</td></tr>`}</tbody>
    </table>

    <footer>
      <span>Printed: ${esc(new Date().toLocaleString("en-GB"))}</span>
      <span>${esc(company.name || "")}</span>
    </footer>
  <script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
  </body></html>`;

  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
