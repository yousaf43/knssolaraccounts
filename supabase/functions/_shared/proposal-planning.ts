export type BillSummary = { customerName?: string; address?: string; disco?: string; tariffCategory?: string; monthlyKwh?: number; billAmount?: number; sanctionedLoadKw?: number; history: { month: number; units: number }[] };
export type CatalogItem = { id: string; name: string; model: string | null; unit: string | null; sale_price: number | null };
export function validateBill(value: unknown): BillSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('No readable electricity bill received');
  const v = value as Record<string, unknown>;
  const bill: BillSummary = { history: [] };
  for (const key of ['customerName', 'address', 'disco'] as const) if (typeof v[key] === 'string' && v[key].length <= 500) bill[key] = v[key];
  if (['domestic','commercial','industrial','agricultural'].includes(String(v.tariffCategory))) bill.tariffCategory = String(v.tariffCategory);
  for (const key of ['monthlyKwh','billAmount','sanctionedLoadKw'] as const) if (typeof v[key] === 'number' && Number.isFinite(v[key]) && v[key] >= 0 && v[key] <= 100_000_000) bill[key] = v[key];
  if (Array.isArray(v.history)) {
    for (const row of v.history.slice(0, 12)) if (row && Number.isInteger(row.month) && row.month >= 1 && row.month <= 12 && typeof row.units === 'number' && Number.isFinite(row.units) && row.units >= 0 && !bill.history.some(r => r.month === row.month)) bill.history.push({ month: row.month, units: row.units });
  }
  if (bill.monthlyKwh === undefined && !bill.history.length) throw new Error('Units could not be read; upload a clearer bill or enter monthly units');
  return bill;
}
export function billPlan(bill: BillSummary, panelWatt: number, dailyYield: number) {
  if (!(panelWatt > 0) || !(dailyYield > 0) || dailyYield > 10) throw new Error('Invalid sizing assumptions');
  const units = bill.history.length ? bill.history.reduce((sum, r) => sum + r.units, 0) / bill.history.length : bill.monthlyKwh || 0;
  const panelQty = Math.ceil(units / 30 / dailyYield * 1000 / panelWatt);
  const monthlyUnits = Array(12).fill(0);
  bill.history.forEach(r => { monthlyUnits[r.month - 1] = r.units; });
  return { panelQty, systemKw: panelQty * panelWatt / 1000, monthlyUnits, averageUnits: Math.round(units) };
}
export function estimatedAccessories(panelQty: number, includeInverter: boolean) {
  if (!(panelQty > 0) || !includeInverter) return [];
  return ['DC breaker / isolator set','AC breaker set','AC/DC surge protection set','Solar cable, connectors & installation accessories'].map(description => ({ brand: '', description, model: '', qty: 1, unit: 'Set', unitPrice: 0, amount: 0, estimated: true, priceSource: 'missing' }));
}
export function priceQuotation(items: Record<string, unknown>[], catalog: CatalogItem[], mode: 'inventory' | 'manual') {
  return items.map(item => {
    const product = mode === 'inventory' ? catalog.find(p => p.id === item.inventoryId) : undefined;
    // A catalog ID is the price authority, never an AI-supplied amount or cost price.
    const qty = typeof item.qty === 'number' && Number.isFinite(item.qty) && item.qty >= 0 ? item.qty : 0;
    const supplied = typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice >= 0 ? item.unitPrice : 0;
    const unitPrice = mode === 'inventory' ? Math.max(0, Number(product?.sale_price) || 0) : supplied;
    return { ...item, ...(product ? { description: product.name, model: product.model || '', unit: product.unit || 'Nos', inventoryId: product.id } : {}), qty, unitPrice, amount: qty * unitPrice, priceSource: product && unitPrice > 0 ? 'inventory' : unitPrice > 0 ? 'manual' : 'missing' };
  });
}