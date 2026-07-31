import { supabase } from "@/integrations/supabase/client";

/**
 * Portable PostgreSQL dump generator.
 *
 * Produces a self-contained .sql file (schema + data) that can be restored into
 * any PostgreSQL database (another Lovable Cloud project, a self-hosted Postgres,
 * a cPanel Postgres instance, etc.) with:
 *
 *   psql "postgres://user:pass@host:5432/dbname" -f knssolar-dump.sql
 */

type ColumnType =
  | "uuid"
  | "uuid_pk"
  | "text"
  | "numeric"
  | "int"
  | "bool"
  | "jsonb"
  | "timestamptz";

type TableSchema = {
  name: string;
  columns: Record<string, ColumnType>;
};

const TABLES: TableSchema[] = [
  {
    name: "accounts",
    columns: {
      id: "uuid_pk", user_id: "uuid", name: "text", account_title: "text", code: "text",
      currency: "text", balance: "numeric", reconcile_date: "text", fx_balance: "numeric",
      created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "activity_logs",
    columns: {
      id: "uuid_pk", user_id: "uuid", action: "text", item_type: "text", item_id: "text",
      item_label: "text", details: "text", created_at: "timestamptz",
    },
  },
  {
    name: "bills",
    columns: {
      id: "uuid_pk", user_id: "uuid", number: "text", supplier: "text", date: "text",
      due_date: "text", amount: "numeric", status: "text", items: "jsonb", notes: "text",
      tax: "numeric", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "customers",
    columns: {
      id: "uuid_pk", user_id: "uuid", name: "text", email: "text", phone: "text",
      company: "text", address: "text", total_billed: "numeric", outstanding: "numeric",
      created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "expenses",
    columns: {
      id: "uuid_pk", user_id: "uuid", date: "text", category: "text", description: "text",
      amount: "numeric", payment_method: "text", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "inventory",
    columns: {
      id: "uuid_pk", user_id: "uuid", name: "text", sku: "text", qty: "numeric",
      reorder_level: "numeric", price: "numeric", category: "text", date: "text",
      cost_price: "numeric", sale_price: "numeric", unit: "text", weight: "numeric",
      stock_asset_account: "text", sale_discount: "numeric", purchase_discount: "numeric",
      product_type: "text", bundle_items: "jsonb", model: "text", unique_code: "text",
      location: "text", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "invoices",
    columns: {
      id: "uuid_pk", user_id: "uuid", number: "text", document_number: "text",
      project_name: "text", customer: "text", date: "text", due_date: "text",
      amount: "numeric", status: "text", items: "jsonb", notes: "text", tax: "numeric",
      discount: "numeric", payments: "jsonb", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "ledger_entries",
    columns: {
      id: "uuid_pk", user_id: "uuid", date: "text", bank: "text", type: "text",
      amount: "numeric", description: "text", reference: "text", created_at: "timestamptz",
    },
  },
  {
    name: "other_payments",
    columns: {
      id: "uuid_pk", user_id: "uuid", date: "text", account: "text", payee: "text",
      amount: "numeric", reference: "text", description: "text", created_at: "timestamptz",
    },
  },
  {
    name: "other_receipts",
    columns: {
      id: "uuid_pk", user_id: "uuid", date: "text", account: "text", received_from: "text",
      amount: "numeric", reference: "text", description: "text", created_at: "timestamptz",
    },
  },
  {
    name: "profiles",
    columns: {
      id: "uuid_pk", user_id: "uuid", full_name: "text", phone: "text", company: "text",
      avatar_url: "text", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "purchase_orders",
    columns: {
      id: "uuid_pk", user_id: "uuid", number: "text", supplier: "text", date: "text",
      delivery_date: "text", amount: "numeric", status: "text", items: "jsonb",
      notes: "text", tax: "numeric", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "purchase_payments",
    columns: {
      id: "uuid_pk", user_id: "uuid", number: "text", supplier: "text", date: "text",
      bill_number: "text", amount: "numeric", payment_method: "text", reference: "text",
      notes: "text", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "quotations",
    columns: {
      id: "uuid_pk", user_id: "uuid", number: "text", project_name: "text",
      document_number: "text", customer: "text", date: "text", due_date: "text",
      amount: "numeric", status: "text", items: "jsonb", notes: "text", tax: "numeric",
      created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "receipts",
    columns: {
      id: "uuid_pk", user_id: "uuid", number: "text", customer: "text", date: "text",
      invoice_number: "text", amount: "numeric", payment_method: "text", reference: "text",
      notes: "text", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "reconcile_entries",
    columns: {
      id: "uuid_pk", user_id: "uuid", date: "text", account: "text",
      statement_balance: "numeric", book_balance: "numeric", difference: "numeric",
      status: "text", created_at: "timestamptz",
    },
  },
  {
    name: "sales_orders",
    columns: {
      id: "uuid_pk", user_id: "uuid", number: "text", project_name: "text", customer: "text",
      date: "text", delivery_date: "text", amount: "numeric", status: "text", items: "jsonb",
      notes: "text", tax: "numeric", advance_payment: "numeric", advance_payment_method: "text",
      advance_payment_ref: "text", location: "text", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "solar_washing",
    columns: {
      id: "uuid_pk", user_id: "uuid", date: "text", customer: "text", amount: "numeric",
      notes: "text", created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "stock_adjustments",
    columns: {
      id: "uuid_pk", user_id: "uuid", item_id: "text", item_name: "text", type: "text",
      qty: "numeric", reason: "text", date: "text", note: "text", created_at: "timestamptz",
    },
  },
  {
    name: "suppliers",
    columns: {
      id: "uuid_pk", user_id: "uuid", name: "text", email: "text", phone: "text",
      company: "text", address: "text", total_paid: "numeric", outstanding: "numeric",
      created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
  {
    name: "transfers",
    columns: {
      id: "uuid_pk", user_id: "uuid", date: "text", from_account: "text", to_account: "text",
      amount: "numeric", reference: "text", created_at: "timestamptz",
    },
  },
  {
    name: "trash",
    columns: {
      id: "uuid_pk", user_id: "uuid", item_type: "text", item_id: "text", item_data: "jsonb",
      deleted_at: "timestamptz",
    },
  },
  {
    name: "user_roles",
    columns: { id: "uuid_pk", user_id: "uuid", role: "text" },
  },
  {
    name: "user_settings",
    columns: {
      id: "uuid_pk", user_id: "uuid", settings_data: "jsonb", custom_units: "jsonb",
      custom_accounts: "jsonb", custom_categories: "jsonb",
      created_at: "timestamptz", updated_at: "timestamptz",
    },
  },
];

const PG_TYPE: Record<ColumnType, string> = {
  uuid_pk: "uuid PRIMARY KEY DEFAULT gen_random_uuid()",
  uuid: "uuid",
  text: "text",
  numeric: "numeric",
  int: "integer",
  bool: "boolean",
  jsonb: "jsonb",
  timestamptz: "timestamptz",
};

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toSqlValue(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined || value === "") {
    // Empty strings on non-text columns are meaningless -> NULL
    if (value === "" && (type === "text")) return "''";
    return "NULL";
  }
  switch (type) {
    case "numeric":
    case "int": {
      const num = typeof value === "number" ? value : Number(value);
      return Number.isFinite(num) ? String(num) : "NULL";
    }
    case "bool":
      return value === true || value === "true" ? "TRUE" : "FALSE";
    case "jsonb":
      return `${quoteLiteral(JSON.stringify(value))}::jsonb`;
    case "uuid":
    case "uuid_pk":
      return `${quoteLiteral(String(value))}::uuid`;
    case "timestamptz":
      return `${quoteLiteral(String(value))}::timestamptz`;
    default:
      return quoteLiteral(typeof value === "object" ? JSON.stringify(value) : String(value));
  }
}

function createTableSql(table: TableSchema): string {
  const cols = Object.entries(table.columns)
    .map(([col, type]) => `  "${col}" ${PG_TYPE[type]}`)
    .join(",\n");
  return `CREATE TABLE IF NOT EXISTS public."${table.name}" (\n${cols}\n);`;
}

function insertsSql(table: TableSchema, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `-- no rows in ${table.name}`;
  const cols = Object.keys(table.columns);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const chunks: string[] = [];
  const BATCH = 200;

  for (let i = 0; i < rows.length; i += BATCH) {
    const values = rows.slice(i, i + BATCH).map((row) => {
      const vals = cols.map((c) => toSqlValue(row[c], table.columns[c]));
      return `  (${vals.join(", ")})`;
    });
    chunks.push(
      `INSERT INTO public."${table.name}" (${colList}) VALUES\n${values.join(",\n")}\nON CONFLICT (id) DO NOTHING;`
    );
  }
  return chunks.join("\n\n");
}

export type DumpProgress = (current: number, total: number, table: string) => void;

/**
 * Reads every table the current user can access and builds a full .sql script.
 * Rows are fetched in pages so large tables are not truncated by API limits.
 */
export async function buildSqlDump(onProgress?: DumpProgress): Promise<string> {
  const header = [
    "-- ============================================================",
    "-- K&S Solar Accounts — full PostgreSQL dump",
    `-- Generated: ${new Date().toISOString()}`,
    "--",
    "-- Restore into any PostgreSQL database:",
    "--   psql \"postgres://user:pass@host:5432/dbname\" -f this-file.sql",
    "--",
    "-- Note: row-level security policies and auth users are NOT included.",
    "-- ============================================================",
    "",
    "BEGIN;",
    "",
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    "",
  ].join("\n");

  const parts: string[] = [header];
  const failures: string[] = [];

  for (let i = 0; i < TABLES.length; i++) {
    const table = TABLES[i];
    onProgress?.(i + 1, TABLES.length, table.name);

    const rows: Record<string, unknown>[] = [];
    const PAGE = 1000;
    let from = 0;

    for (;;) {
      const { data, error } = await supabase
        .from(table.name as never)
        .select("*")
        .range(from, from + PAGE - 1);

      if (error) {
        failures.push(`${table.name}: ${error.message}`);
        break;
      }
      const page = (data as unknown as Record<string, unknown>[]) || [];
      rows.push(...page);
      if (page.length < PAGE) break;
      from += PAGE;
    }

    parts.push(
      `-- ----------------------------------------------------------\n` +
        `-- Table: ${table.name} (${rows.length} rows)\n` +
        `-- ----------------------------------------------------------\n` +
        `${createTableSql(table)}\n\n${insertsSql(table, rows)}\n`
    );
  }

  parts.push("COMMIT;");

  if (failures.length > 0) {
    parts.push(
      `\n-- WARNING: some tables could not be read (permission or network):\n` +
        failures.map((f) => `--   ${f}`).join("\n")
    );
  }

  return parts.join("\n");
}

export async function downloadSqlDump(onProgress?: DumpProgress): Promise<void> {
  const sql = await buildSqlDump(onProgress);
  const blob = new Blob([sql], { type: "application/sql" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `knssolar-database-${new Date().toISOString().slice(0, 10)}.sql`;
  a.click();
  URL.revokeObjectURL(url);
}
