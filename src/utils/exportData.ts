import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

const EXPORT_TABLES = [
  "customers", "suppliers", "inventory", "invoices", "sales_orders",
  "quotations", "receipts", "expenses", "purchase_orders", "bills",
  "purchase_payments", "stock_adjustments", "accounts", "ledger_entries",
  "other_payments", "other_receipts", "transfers", "reconcile_entries",
  "solar_washing", "activity_logs", "user_settings"
] as const;

type TableName = typeof EXPORT_TABLES[number];

async function fetchAllData(userId: string): Promise<Record<string, Record<string, unknown>[]>> {
  const data: Record<string, Record<string, unknown>[]> = {};
  const promises = EXPORT_TABLES.map(async (table) => {
    const { data: rows } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId);
    data[table] = (rows as Record<string, unknown>[]) || [];
  });
  await Promise.all(promises);
  return data;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      // Escape CSV: wrap in quotes if contains comma, quote, or newline
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

export async function exportAsJson(userId: string): Promise<void> {
  const data = await fetchAllData(userId);
  const exportObj = {
    _exportFormat: "json",
    _exportedAt: new Date().toISOString(),
    _tables: EXPORT_TABLES.length,
    ...data,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
  triggerDownload(blob, `data-export-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function exportAsCsvZip(userId: string): Promise<void> {
  const data = await fetchAllData(userId);
  const zip = new JSZip();

  for (const [table, rows] of Object.entries(data)) {
    const csv = rowsToCsv(rows);
    if (csv) {
      zip.file(`${table}.csv`, csv);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `data-export-csv-${new Date().toISOString().slice(0, 10)}.zip`);
}

export function getTableCount(data: Record<string, unknown[]>): { table: string; count: number }[] {
  return EXPORT_TABLES.map((t) => ({ table: t, count: (data[t] || []).length }));
}
