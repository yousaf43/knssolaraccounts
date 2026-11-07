import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { aiIdentity } from '../_shared/ai-credentials.ts';
import { encryptDeliveryToken, decryptDeliveryToken } from '../_shared/delivery-crypto.ts';
import { automaticDeliveryAllowed, deliveryReady, whatsappRecipient } from '../_shared/proposal-delivery-policy.ts';

const Graph = 'https://graph.facebook.com/v25.0';
const Settings = z.object({ enabled: z.boolean(), phone_number_id: z.string().regex(/^\d*$/).max(40), business_account_id: z.string().regex(/^\d*$/).max(40), template_name: z.string().regex(/^[a-z0-9_]*$/).max(512), template_language: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/), token: z.string().max(4096).optional() });
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
async function graph(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${Graph}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  if (!response.ok) {
    // Do not log credential-bearing URLs or requests.
    console.error(`WhatsApp request failed [${response.status}]: ${text}`);
    throw Object.assign(new Error(`WhatsApp rejected the request (${response.status}): ${text}`), { status: response.status });
  }
  return JSON.parse(text);
}
async function approvedTemplate(row: any, token: string) {
  const result = await graph(`${row.business_account_id}/message_templates?name=${encodeURIComponent(row.template_name)}&fields=name,status,language,components,parameter_format&limit=100`, token);
  const template = result.data?.find((t: any) => t.name === row.template_name && t.language === row.template_language && t.status === 'APPROVED');
  if (!template || !template.components?.some((c: any) => c.type === 'HEADER' && c.format === 'DOCUMENT')) throw Object.assign(new Error('Choose an approved template with a PDF document header'), { status: 400 });
  if (template.components.some((c: any) => /\{\{/.test(c.text || '') || c.type === 'BUTTONS')) throw Object.assign(new Error('Use a document template with fixed body text and no variable buttons'), { status: 400 });
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let claimId: string | undefined;
  let db: any;
  let sendStarted = false;
  try {
    const multipart = req.headers.get('content-type')?.includes('multipart/form-data');
    const form = multipart ? await req.formData() : null;
    const body = form ? { action: form.get('action') } : await req.json();
    const action = z.enum(['status','save','check','send']).parse(body.action);
    const identity = await aiIdentity(req, action === 'save' || action === 'check' || action === 'status');
    db = identity.admin;
    const { admin, companyId } = identity;
    const { data: row, error: readError } = await admin.from('proposal_delivery_settings').select('*').eq('company_id', companyId).maybeSingle();
    if (readError) throw readError;
    if (action === 'status') return json({ enabled: row?.enabled ?? false, configured: !!row?.token_ciphertext, phone_number_id: row?.phone_number_id || '', business_account_id: row?.business_account_id || '', template_name: row?.template_name || '', template_language: row?.template_language || 'en_US' });
    if (action === 'save') {
      const settings = Settings.parse(body.settings);
      const { token: supplied, ...values } = settings;
      const ciphertext = supplied?.trim() ? await encryptDeliveryToken(supplied.trim(), companyId) : row?.token_ciphertext;
      if (values.enabled) {
        if (!ciphertext || !values.phone_number_id || !values.business_account_id || !values.template_name) return json({ error: 'Complete WhatsApp account and template settings before enabling' }, 400);
        await approvedTemplate(values, await decryptDeliveryToken(ciphertext, companyId));
      }
      const { error } = await admin.from('proposal_delivery_settings').upsert({ ...values, company_id: companyId, token_ciphertext: ciphertext || null, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'check') {
      if (!row?.token_ciphertext) return json({ error: 'Save your WhatsApp access token first' }, 400);
      const token = await decryptDeliveryToken(row.token_ciphertext, companyId);
      await graph(`${row.phone_number_id}?fields=display_phone_number`, token);
      await approvedTemplate(row, token);
      return json({ ok: true });
    }
    const proposalId = z.string().uuid().parse(form?.get('proposalId'));
    if (!automaticDeliveryAllowed(row?.enabled === true, false)) return json({ status: 'disabled' });
    const { data: proposal, error } = await admin.from('proposals').select('*').eq('id', proposalId).eq('company_id', companyId).single();
    if (error || !proposal) return json({ error: 'Proposal not found' }, 404);
    const validation = deliveryReady(proposal.data);
    if (validation) return json({ error: validation }, 400);
    const pdf = form?.get('pdf');
    if (!(pdf instanceof File) || pdf.type !== 'application/pdf' || pdf.size < 100 || pdf.size > 20 * 1024 * 1024) return json({ error: 'A valid PDF attachment under 20 MB is required' }, 400);
    const prefix = new TextDecoder().decode(await pdf.slice(0, 5).arrayBuffer());
    if (prefix !== '%PDF-') return json({ error: 'Invalid PDF file' }, 400);
    const recipient = whatsappRecipient(proposal.data.phone);
    if (!recipient) return json({ error: 'Invalid customer phone number' }, 400);
    const { data: claim, error: claimError } = await admin.from('proposal_deliveries').insert({ company_id: companyId, proposal_id: proposalId, recipient }).select('id').single();
    if (claimError?.code === '23505') return json({ status: 'already_attempted' });
    if (claimError || !claim) throw claimError || new Error('Could not record delivery');
    claimId = claim.id;
    const token = await decryptDeliveryToken(row.token_ciphertext, companyId);
    await approvedTemplate(row, token);
    const upload = new FormData();
    upload.append('messaging_product', 'whatsapp'); upload.append('type', 'application/pdf'); upload.append('file', pdf, `${proposal.proposal_no}.pdf`);
    const media = await graph(`${row.phone_number_id}/media`, token, { method: 'POST', body: upload });
    const { data: latest, error: latestError } = await admin.from('proposal_delivery_settings').select('enabled').eq('company_id', companyId).single();
    if (latestError || !latest?.enabled) throw new Error('Automatic sending was disabled before dispatch');
    sendStarted = true;
    const result = await graph(`${row.phone_number_id}/messages`, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient, type: 'template', template: { name: row.template_name, language: { code: row.template_language }, components: [{ type: 'header', parameters: [{ type: 'document', document: { id: media.id, filename: `${proposal.proposal_no}.pdf` } }] }] } }) });
    const messageId = result.messages?.[0]?.id;
    if (!messageId) throw new Error('WhatsApp did not return a message ID');
    const { error: updateError } = await admin.from('proposal_deliveries').update({ status: 'accepted', message_id: messageId, updated_at: new Date().toISOString() }).eq('id', claim.id);
    if (updateError) throw updateError;
    return json({ status: 'accepted' });
  } catch (error) {
    const e = error as Error & { status?: number };
    if (claimId && db) await db.from('proposal_deliveries').update({ status: sendStarted && !e.status ? 'unknown' : 'failed', error: e.message, updated_at: new Date().toISOString() }).eq('id', claimId);
    return json({ error: e instanceof z.ZodError ? 'Invalid request fields' : e.message || 'Delivery failed' }, e.status || (e instanceof z.ZodError ? 400 : 500));
  }
});