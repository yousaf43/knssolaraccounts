import { describe, expect, it } from "vitest";
import { saveWithRollback } from "@/lib/saveWithRollback";

describe("invoice stock rollback", () => {
  it("restores the 10 units on hand if the invoice fails after deducting 3", async () => {
    let quantity = 10;
    await expect(saveWithRollback([
      { apply: async () => { quantity -= 3; }, undo: async () => { quantity += 3; } },
    ], async () => { throw new Error("Save failed"); })).rejects.toThrow("Save failed");
    expect(quantity).toBe(10);
  });

  it("keeps 7 units on hand after a successful 3-unit invoice", async () => {
    let quantity = 10;
    let saved = false;
    await saveWithRollback([
      { apply: async () => { quantity -= 3; }, undo: async () => { quantity += 3; } },
    ], async () => { saved = true; });
    expect(quantity).toBe(7);
    expect(saved).toBe(true);
  });

  it("undoes earlier stock writes if a later item fails", async () => {
    let quantity = 10;
    let saved = false;
    await expect(saveWithRollback([
      { apply: async () => { quantity -= 3; }, undo: async () => { quantity += 3; } },
      { apply: async () => { throw new Error("Stock failed"); }, undo: async () => {} },
    ], async () => { saved = true; })).rejects.toThrow("Stock failed");
    expect(quantity).toBe(10);
    expect(saved).toBe(false);
  });
});