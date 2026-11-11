import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { resolvePage, periodRange, runNexiaTool } from "./nexiaLiveTools";

describe("Nexia live tools", () => {
  it("maps spoken page names to pages", () => {
    expect(resolvePage("stock valuation report kholo")).toBe("/reports");
    expect(resolvePage("Solar Washing")).toBe("/solar-washing");
    expect(resolvePage("banana")).toBeNull();
  });
  it("computes last month range", () => {
    expect(periodRange("last_month", new Date(2026, 10, 11))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("blocks sales members from opening restricted pages", async () => {
    const navigate = vi.fn();
    const res = await runNexiaTool("open_page", { page: "accounts" }, { role: "sales", menuAccess: null, navigate, endSession: () => {} });
    expect(res).toEqual({ error: "access_not_allowed" });
    expect(navigate).not.toHaveBeenCalled();
  });
  it("blocks sales members from bank balances", async () => {
    const res = await runNexiaTool("cash_bank_balances", {}, { role: "sales", menuAccess: null, navigate: () => {}, endSession: () => {} });
    expect(res).toEqual({ error: "access_not_allowed" });
  });
});
