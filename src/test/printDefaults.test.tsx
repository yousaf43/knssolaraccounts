import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InvoicePreview } from "@/components/InvoicePreview";
import { SalesOrderPreview } from "@/components/SalesOrderPreview";
import type { Invoice, SalesOrder } from "@/data/mockData";

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    settings: { thermalPrintWidth: "58mm", invoiceTerms: "" },
    formatCurrency: (value: number) => String(value),
    formatDate: (value: string) => value,
  }),
}));
afterEach(cleanup);
const document = { id: "test", number: "TEST-1", customer: "Test", date: "2026-10-26", dueDate: "2026-10-26", items: [], amount: 0, status: "pending" };

describe("A4 print defaults", () => {
  it.each(["invoice", "quotation", "sales-order"])("starts %s at A4 despite saved thermal settings and permits explicit thermal selection", kind => {
    if (kind === "sales-order") render(<SalesOrderPreview order={document as SalesOrder} onClose={() => {}} />);
    else render(<InvoicePreview invoice={document as Invoice} docType={kind === "quotation" ? "quotation" : "invoice"} onClose={() => {}} />);
    const size = screen.getByRole("combobox", { name: "Print size" });
    expect(size).toHaveValue("a4");
    fireEvent.change(size, { target: { value: "80mm" } });
    expect(size).toHaveValue("80mm");
  });
});