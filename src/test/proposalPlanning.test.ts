import { describe, expect, it } from 'vitest';
import { billPlan, estimatedAccessories, priceQuotation, validateBill } from '../../supabase/functions/_shared/proposal-planning';
describe('Bill-assisted proposal rules', () => {
  it('uses bill units, not rupees, and never invents twelve months from a single bill', () => {
    const plan = billPlan(validateBill({ monthlyKwh: 600, billAmount: 35000 }), 625, 4);
    expect(plan.panelQty).toBe(8);
    expect(plan.systemKw).toBe(5);
    expect(plan.monthlyUnits).toEqual(Array(12).fill(0));
  });
  it('maps only readable months and rejects absent consumption', () => {
    expect(billPlan(validateBill({ history: [{ month: 2, units: 500 }] }), 625, 4).monthlyUnits[1]).toBe(500);
    expect(() => validateBill({ billAmount: 40000 })).toThrow();
  });
  it('adds estimated breakers and accessories but no final engineering ratings', () => {
    const items = estimatedAccessories(8, true);
    expect(items.map(i => i.description)).toContain('AC breaker set');
    expect(items.map(i => i.description)).toContain('Solar cable, connectors & installation accessories');
    expect(items.every(i => i.estimated && i.unitPrice === 0)).toBe(true);
    expect(estimatedAccessories(8, false)).toEqual([]);
  });
  it('uses exact catalog selling prices and rejects invented inventory prices', () => {
    const items = priceQuotation([{ inventoryId: 'p1', qty: 8, unitPrice: 1 }, { inventoryId: 'wrong', qty: 1, unitPrice: 500 }], [{ id: 'p1', name: '625W panel', model: 'M1', unit: 'Nos', sale_price: 19000 }], 'inventory');
    expect(items[0].unitPrice).toBe(19000);
    expect(items[0].amount).toBe(152000);
    expect(items[1].unitPrice).toBe(0);
    expect(items[1].priceSource).toBe('missing');
  });
  it('keeps explicitly entered prices in manual mode', () => {
    expect(priceQuotation([{ qty: 2, unitPrice: 2500 }], [], 'manual')[0].amount).toBe(5000);
  });
});