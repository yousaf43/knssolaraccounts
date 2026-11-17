import { aiIdentity } from '../_shared/ai-credentials.ts';
import { routeAI } from '../_shared/ai-router.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { companyId } = await aiIdentity(req);
    const body = await req.json().catch(() => null);
    const mime = String(body?.mimeType || ''); const data = String(body?.data || '');
    if (!MIMES.includes(mime) || !data || data.length > 14_000_000) return json({ error: 'Send a PDF or photo under 10 MB' }, 400);
    const url = `data:${mime};base64,${data}`;
    const block = mime === 'application/pdf' ? { type: 'file', file: { filename: 'sheet.pdf', file_data: url } } : { type: 'image_url', image_url: { url } };
    const { response } = await routeAI(companyId, [
      { role: 'system', content: 'You read scanned solar equipment serial-number sheets. Return JSON {"serials": string[]} listing every serial number exactly as printed, in reading order, across all pages. Serials are usually 10-30 letters/digits. Skip headings, dates, page numbers, watt values, model names, phone numbers and barcodes without printed text. Never invent or complete a number you cannot read.' },
      { role: 'user', content: [{ type: 'text', text: 'Extract all serial numbers from this sheet.' }, block] },
    ], { json: true, signal: req.signal });
    const text = (await response.json())?.choices?.[0]?.message?.content || '';
    let list: unknown = [];
    try { list = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim()).serials; } catch { list = []; }
    const seen = new Set<string>(); const serials: string[] = [];
    for (const s of Array.isArray(list) ? list : []) {
      const v = String(s).replace(/\s/g, '').toUpperCase();
      if (/^[A-Z0-9\-\/]{6,40}$/.test(v) && /\d/.test(v) && !seen.has(v)) { seen.add(v); serials.push(v); }
    }
    return json({ serials });
  } catch (e) {
    const err = e as Error & { status?: number };
    return json({ error: err.message }, err.status && err.status >= 400 ? err.status : 500);
  }
});
