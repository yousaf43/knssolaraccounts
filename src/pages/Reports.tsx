import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Financial reports and analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "Profit & Loss", desc: "Revenue, expenses, and net profit summary" },
          { title: "Balance Sheet", desc: "Assets, liabilities, and equity overview" },
          { title: "Cash Flow", desc: "Cash inflows and outflows analysis" },
          { title: "Accounts Receivable", desc: "Outstanding customer payments" },
          { title: "Accounts Payable", desc: "Outstanding supplier payments" },
          { title: "Tax Summary", desc: "GST/VAT collected and paid" },
        ].map((report) => (
          <button
            key={report.title}
            className="bg-card rounded-lg border p-6 text-left hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold">{report.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{report.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
