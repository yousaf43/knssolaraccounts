import { describe, it, expect } from "vitest";
import { canAccessMenu } from "@/lib/menuAccess";

describe("menu access", () => {
  it("sales has no Reports by default", () => expect(canAccessMenu("/reports", "sales", null)).toBe(false));
  it("custom list grants Reports to sales", () => expect(canAccessMenu("/reports", "sales", ["/reports"])).toBe(true));
  it("custom list removes Invoices from accountant", () => expect(canAccessMenu("/invoices", "accountant", ["/"])).toBe(false));
  it("admin always has access", () => expect(canAccessMenu("/hr", "admin", [])).toBe(true));
  it("settings always reachable", () => expect(canAccessMenu("/settings", "sales", [])).toBe(true));
});
