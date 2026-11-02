export type AssistantDraft = Record<string, unknown>;
const strings = ['customerName','companyName','address','city','phone','cnic','panelBrand','panelWarranty','inverterBrand','inverterWarranty','structureType','disco','paymentMethod','delivery','terms','salesExec','signedName','signedTitle','signedPhone','signedEmail'];
const numbers = ['panelQty','panelWatt','inverterKw','structureQty','validDays'];
const booleans = ['includeInverter','netBilling','earthing','hideItemPrices'];
export function validateAssistantPatch(value: unknown): AssistantDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid proposal details');
  const patch: AssistantDraft = {};
  for (const [key, v] of Object.entries(value)) {
    if (strings.includes(key) && typeof v === 'string' && v.length <= 5000) patch[key] = v;
    else if (numbers.includes(key) && typeof v === 'number' && Number.isFinite(v) && v >= 0) patch[key] = v;
    else if (booleans.includes(key) && typeof v === 'boolean') patch[key] = v;
    else if (key === 'systemType' && typeof v === 'string') {
      const normalized = v.trim().toLowerCase().replace(/[\s_]+/g, '-');
      if (!['on-grid','off-grid','hybrid'].includes(normalized)) throw new Error('Invalid system type');
      patch[key] = normalized;
    }
    else if (key === 'monthlyUnits' && Array.isArray(v) && v.length === 12 && v.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) patch[key] = v;
    else if (key === 'battery' && v === null) patch[key] = null;
    else if (key === 'battery' && v && typeof v === 'object') {
      const b = v as Record<string, unknown>;
      if (!['type','brand','model','warranty'].every(k => typeof b[k] === 'string') || !['units','kwhEach'].every(k => typeof b[k] === 'number' && Number.isFinite(b[k]) && Number(b[k]) > 0)) throw new Error('Invalid battery details');
      patch[key] = Object.fromEntries(['type','brand','model','warranty','units','kwhEach'].map(k => [k,b[k]]));
    } else if (key === 'items' && Array.isArray(v) && v.length <= 100) {
      patch[key] = v.map(it => {
        if (!it || typeof it !== 'object' || !['brand','description','unit'].every(k => typeof it[k] === 'string') || !['qty','unitPrice'].every(k => typeof it[k] === 'number' && Number.isFinite(it[k]) && it[k] >= 0)) throw new Error('Invalid quotation item');
        return { brand: it.brand, description: it.description, model: typeof it.model === 'string' ? it.model : '', qty: it.qty, unit: it.unit, unitPrice: it.unitPrice, amount: it.qty * it.unitPrice };
      });
    } else throw new Error(`Unsupported proposal field: ${key}`);
  }
  return patch;
}
export function missingProposalDetails(draft: AssistantDraft): string[] {
  const missing: string[] = [];
  if (typeof draft.customerName !== 'string' || !draft.customerName.trim()) missing.push('Customer name');
  const items = Array.isArray(draft.items) ? draft.items : [];
  if (!items.length) missing.push('Equipment and quotation items');
  if (items.some(it => !it.description?.trim() || !(it.qty > 0))) missing.push('Product descriptions and quantities');
  if (items.length && items.some(it => !(it.unitPrice > 0))) missing.push('Quotation prices (or confirmed free items)');
  return missing;
}