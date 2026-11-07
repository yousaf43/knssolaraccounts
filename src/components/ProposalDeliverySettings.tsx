import { useEffect, useState } from 'react';
import { Save, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { deliveryRequest } from '@/lib/proposalDelivery';
import { toast } from 'sonner';

const defaultCaption = 'Dear {name}, thank you for contacting K&S Solar Energy. Please find your solar proposal attached.';

export function ProposalDeliverySettings() {
  const [settings, setSettings] = useState({ enabled: false, instance_id: '', api_url: '', caption: defaultCaption });
  const [token, setToken] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    deliveryRequest({ action: 'status' }).then(data => {
      setSettings({ enabled: data.enabled, instance_id: data.instance_id || '', api_url: data.api_url || '', caption: data.caption || defaultCaption });
      setConfigured(data.configured); setLoaded(true);
    }).catch(e => setError(e.message));
  }, []);
  async function save(enabled = settings.enabled) {
    setBusy(true); setError('');
    try {
      await deliveryRequest({ action: 'save', settings: { ...settings, enabled, token: token || undefined } });
      setSettings(s => ({ ...s, enabled })); if (token) setConfigured(true); setToken('');
      toast.success(enabled ? 'Automatic WhatsApp sending enabled' : 'WhatsApp settings saved — automatic sending off');
    } catch (e) { setError(e instanceof Error ? e.message : 'Settings could not be saved'); }
    finally { setBusy(false); }
  }
  async function check() {
    setBusy(true); setError('');
    try { await deliveryRequest({ action: 'check' }); toast.success('WhatsApp is linked and ready'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connection failed'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 py-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">WhatsApp Proposal Delivery (Green API)</h2>
        <Badge variant="outline" className="mt-2">{configured ? 'Token saved securely' : 'Not configured'}</Badge>
      </div>
      <Switch aria-label="Automatic WhatsApp sending" checked={settings.enabled} disabled={busy || !loaded} onCheckedChange={value => void save(value)} />
    </div>
    <p className="text-sm text-muted-foreground">Sign up at green-api.com, create an instance, scan the QR code with your WhatsApp (Linked Devices), then copy the details below.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="ga-id">Instance ID (idInstance)</Label><Input id="ga-id" inputMode="numeric" value={settings.instance_id} onChange={e => setSettings(s => ({ ...s, instance_id: e.target.value.trim() }))} /></div>
      <div><Label htmlFor="ga-url">API URL (apiUrl)</Label><Input id="ga-url" placeholder="https://7103.api.greenapi.com" value={settings.api_url} onChange={e => setSettings(s => ({ ...s, api_url: e.target.value.trim() }))} /></div>
      <div className="sm:col-span-2"><Label htmlFor="ga-token">API Token (apiTokenInstance)</Label><Input id="ga-token" type="password" autoComplete="new-password" value={token} placeholder={configured ? 'Saved — enter only to replace' : 'Enter API token'} onChange={e => setToken(e.target.value)} /></div>
      <div className="sm:col-span-2"><Label htmlFor="ga-caption">Message sent with the PDF</Label><Textarea id="ga-caption" rows={3} value={settings.caption} onChange={e => setSettings(s => ({ ...s, caption: e.target.value }))} /><p className="mt-1 text-xs text-muted-foreground">{'{name}'} is replaced with the customer name.</p></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || !loaded} onClick={() => void save()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save WhatsApp Settings</Button>
      <Button variant="outline" disabled={busy || !configured} onClick={() => void check()}><ShieldCheck className="mr-2 h-4 w-4" />Check Connection</Button>
    </div>
  </div>;
}
