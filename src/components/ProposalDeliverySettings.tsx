import { useEffect, useState } from 'react';
import { Save, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { deliveryRequest } from '@/lib/proposalDelivery';
import { toast } from 'sonner';

export function ProposalDeliverySettings() {
  const [settings, setSettings] = useState({ enabled: false, phone_number_id: '', business_account_id: '', template_name: '', template_language: 'en_US' });
  const [token, setToken] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { deliveryRequest({ action: 'status' }).then(data => { setSettings({ enabled: data.enabled, phone_number_id: data.phone_number_id, business_account_id: data.business_account_id, template_name: data.template_name, template_language: data.template_language }); setConfigured(data.configured); setLoaded(true); }).catch(e => setError(e.message)); }, []);
  async function save(enabled = settings.enabled) {
    setBusy(true); setError('');
    try { await deliveryRequest({ action: 'save', settings: { ...settings, enabled, token: token || undefined } }); setSettings(s => ({ ...s, enabled })); if (token) setConfigured(true); setToken(''); toast.success(enabled ? 'Automatic WhatsApp sending enabled' : 'WhatsApp settings saved — automatic sending off'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Settings could not be saved'); }
    finally { setBusy(false); }
  }
  async function check() {
    setBusy(true); setError('');
    try { await deliveryRequest({ action: 'check' }); toast.success('WhatsApp account and approved PDF template verified'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connection failed'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 py-5">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">WhatsApp Proposal Delivery</h2><Badge variant="outline" className="mt-2">{configured ? 'Token saved securely' : 'Not configured'}</Badge></div><Switch aria-label="Automatic WhatsApp sending" checked={settings.enabled} disabled={busy || !loaded} onCheckedChange={value => void save(value)} /></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="wa-phone-id">WhatsApp Phone Number ID</Label><Input id="wa-phone-id" value={settings.phone_number_id} onChange={e => setSettings(s => ({ ...s, phone_number_id: e.target.value }))} /></div>
      <div><Label htmlFor="wa-account-id">WhatsApp Business Account ID</Label><Input id="wa-account-id" value={settings.business_account_id} onChange={e => setSettings(s => ({ ...s, business_account_id: e.target.value }))} /></div>
      <div><Label htmlFor="wa-template">Approved PDF Template Name</Label><Input id="wa-template" value={settings.template_name} onChange={e => setSettings(s => ({ ...s, template_name: e.target.value }))} /></div>
      <div><Label htmlFor="wa-language">Template Language</Label><Input id="wa-language" value={settings.template_language} onChange={e => setSettings(s => ({ ...s, template_language: e.target.value }))} /></div>
      <div className="sm:col-span-2"><Label htmlFor="wa-token">Meta Access Token</Label><Input id="wa-token" type="password" autoComplete="new-password" value={token} placeholder={configured ? 'Saved — enter only to replace' : 'Enter access token'} onChange={e => setToken(e.target.value)} /></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || !loaded} onClick={() => void save()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save WhatsApp Settings</Button><Button variant="outline" disabled={busy || !configured} onClick={() => void check()}><ShieldCheck className="mr-2 h-4 w-4" />Check Connection</Button></div>
  </div>;
}