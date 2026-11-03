// AI-assisted matching of proposal quotation lines to the company's own inventory.
// The AI may only choose an inventory id from the supplied list; the price is always read from inventory.
import { aiIdentity } from '../_shared/ai-credentials.ts';
import { routeAI } from '../_shared/ai-router.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

type Line = { index: number; brand?: string; description?: string; model?: string };

// Sizes like 625w / 10kw / 5kwh must agree when both sides state the same unit.
const sizes = (s: string) => [...(s || '').toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(kwh|kwp|kw|w|v|ah)\b/g)].map(m => `${Number(m[1])}${m[2] === 'kwp' ? 'kw' : m[2]}`);
const sizeConflict = (a: string, b: string) => {
  const sa = sizes(a), sb = sizes(b);
  return sa.some(x => { const u = x.replace(/[\d.]/g, ''); const same = sb.filter(y => y.replace(/[\d.]/g, '') === u); return same.length > 0 && !same.includes(x); });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { admin, companyId } = await aiIdentity(req);
    const body = await req.json().catch(() => null);
    const lines: Line[] = Array.isArray(body?.lines) ? body.lines.slice(0, 40) : [];
    if (!lines.length) return json({ matches: [] });
    const { data: catalog, error } = await admin.from('inventory').select('id,name,model,category,sale_price').eq('company_id', companyId).gt('sale_price', 0).limit(2000);
    if (error) throw new Error('Inventory could not be loaded');
    if (!catalog?.length) return json({ matches: [] });
    const list = catalog.map(c => ({ id: c.id, name: c.name, model: c.model || '', category: c.category || '' }));
    const system = `You match solar quotation lines to a company's inventory list. Names may differ in spelling, word order, abbreviations or Urdu/English mix (e.g. "Inverter 10kW Solis" = "SOLIS 10KW Hybrid Inverter", "DC breaker" = "DC MCB"). For each line choose the single inventory id that is clearly the same product type and the same size/capacity (watts, kW, kWh, Ah, amps). If brand is given and inventory has a different brand of that product, prefer the same brand; if no item fits confidently return null. Never pick a different product type or a different size. Only use ids from the list. Return JSON {"matches":[{"index":number,"id":string|null,"reason":string}]}. Inventory: ${JSON.stringify(list)}`;
    const user = JSON.stringify(lines.map(l => ({ index: l.index, brand: l.brand || '', description: l.description || '', model: l.model || '' })));
    const { response } = await routeAI(companyId, [{ role: 'system', content: system }, { role: 'user', content: user }], { json: true, signal: req.signal });
    if (!response.ok) return json({ error: `AI request failed (${response.status})` }, response.status === 429 || response.status === 402 ? response.status : 502);
    const ai = await response.json();
    let parsed: { matches?: { index: number; id: string | null; reason?: string }[] } = {};
    try { parsed = JSON.parse(String(ai?.choices?.[0]?.message?.content || '{}').replace(/^```(?:json)?|```$/g, '').trim()); } catch { parsed = {}; }
    const byId = new Map(catalog.map(c => [c.id, c]));
    const matches = (parsed.matches || []).flatMap(m => {
      const line = lines.find(l => l.index === m.index);
      const inv = m.id ? byId.get(m.id) : undefined;
      if (!line || !inv) return [];
      if (sizeConflict(`${line.description} ${line.model}`, `${inv.name} ${inv.model || ''}`)) return [];
      return [{ index: line.index, id: inv.id, name: inv.name, salePrice: Number(inv.sale_price) || 0, reason: m.reason || '' }];
    });
    return json({ matches });
  } catch (e) {
    const err = e as Error & { status?: number };
    return json({ error: err.message || 'Failed' }, err.status || 500);
  }
});
