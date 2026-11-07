import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { aiIdentity } from '../_shared/ai-credentials.ts';
import { encryptDeliveryToken, decryptDeliveryToken } from '../_shared/delivery-crypto.ts';
import { automaticDeliveryAllowed, deliveryReady, whatsappRecipient } from '../_shared/proposal-delivery-policy.ts';

// Green API settings reuse existing columns: phone_number_id = Instance ID,
// template_name = API URL, business_account_id = message caption, token_ciphertext = API token.
const Settings = z.object({
  enabled: z.boolean(),
  instance_id: z.string().regex(/^\d*$/).max(40),
  api_url: z.string().max(200).refine(v => !v || /^https:\/\/[a-z0-9.-]+\.green-api\.com\/?$|^https:\/\/[a-z0-9.-]+\.greenapi\.com\/?$/i.test(v), 'Invalid API URL'),
  caption: z.string().max(1000),
  token: z.string().max(200).optional(),
});
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function apiBase(row: any) {
  const url = (row.template_name || '').replace(/\/$/, '') || `https://${String(row.phone_number_id).slice(0, 4)}.api.greenapi.com`;
  return `${url}/waInstance${row.phone_number_id}`;
}
async function green(row: any, method: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase(row)}/${method}/${token}`, { ...init, signal: AbortSignal.timeout(60000) });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Green API ${method} failed [${response.status}]: ${text.slice(0, 300)}`);
    throw Object.assign(new Error(`Green API rejected the request (${response.status}): ${text.slice(0, 200)}`), { status: response.status === 401 ? 400 : 502 });
  }
  return text ? JSON.parse(text) : {};
}
async function authorized(row: any, token: string) {
  const state = await green(row, 'getStateInstance', token);
  if (state.stateInstance !== 'authorized') throw Object.assign(new Error(`WhatsApp is not linked (status: ${state.stateInstance || 'unknown'}). Scan the QR code in your Green API console.`), { status: 400 });
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
    const action = z.enum(['status', 'save', 'check', 'send']).parse(body.action);
    const identity = await aiIdentity(req, action !== 'send');
    db = identity.admin;
    const { admin, companyId } = identity;
    const { data: row, error: readError } = await admin.from('proposal_delivery_settings').select('*').eq('company_id', companyId).maybeSingle();
    if (readError) throw readError;
    if (action === 'status') return json({ enabled: row?.enabled ?? false, configured: !!row?.token_ciphertext, instance_id: row?.phone_number_id || '', api_url: row?.template_name || '', caption: row?.business_account_id || '' });
    if (action === 'save') {
      const s = Settings.parse(body.settings);
      const ciphertext = s.token?.trim() ? await encryptDeliveryToken(s.token.trim(), companyId) : row?.token_ciphertext;
      const values = { enabled: s.enabled, phone_number_id: s.instance_id, template_name: s.api_url.replace(/\/$/, ''), business_account_id: s.caption, template_language: 'en_US' };
      if (values.enabled) {
        if (!ciphertext || !values.phone_number_id) return json({ error: 'Enter Green API Instance ID and API Token before enabling' }, 400);
        await authorized(values, await decryptDeliveryToken(ciphertext, companyId));
      }
      const { error } = await admin.from('proposal_delivery_settings').upsert({ ...values, company_id: companyId, token_ciphertext: ciphertext || null, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'check') {
      if (!row?.token_ciphertext || !row.phone_number_id) return json({ error: 'Save your Green API Instance ID and API Token first' }, 400);
      await authorized(row, await decryptDeliveryToken(row.token_ciphertext, companyId));
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
    const { data: latest, error: latestError } = await admin.from('proposal_delivery_settings').select('enabled').eq('company_id', companyId).single();
    if (latestError || !latest?.enabled) throw new Error('Automatic sending was disabled before dispatch');
    const caption = (row.business_account_id || 'Dear {name}, thank you for contacting K&S Solar Energy. Please find your solar proposal attached.').replaceAll('{name}', proposal.data.customerName || 'Customer');
    const upload = new FormData();
    upload.append('chatId', `${recipient}@c.us`);
    upload.append('caption', caption);
    upload.append('fileName', `${proposal.proposal_no}.pdf`);
    upload.append('file', pdf, `${proposal.proposal_no}.pdf`);
    sendStarted = true;
    const result = await green(row, 'sendFileByUpload', token, { method: 'POST', body: upload });
    if (!result.idMessage) throw new Error('Green API did not return a message ID');
    const { error: updateError } = await admin.from('proposal_deliveries').update({ status: 'accepted', message_id: result.idMessage, updated_at: new Date().toISOString() }).eq('id', claim.id);
    if (updateError) throw updateError;
    return json({ status: 'accepted' });
  } catch (error) {
    const e = error as Error & { status?: number };
    if (claimId && db) await db.from('proposal_deliveries').update({ status: sendStarted && !e.status ? 'unknown' : 'failed', error: e.message, updated_at: new Date().toISOString() }).eq('id', claimId);
    return json({ error: e instanceof z.ZodError ? (e.issues[0]?.message || 'Invalid request fields') : e.message || 'Delivery failed' }, e.status || (e instanceof z.ZodError ? 400 : 500));
  }
});
