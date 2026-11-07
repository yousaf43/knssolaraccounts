async function key() {
  const secret = Deno.env.get('AI_SETTINGS_ENCRYPTION_KEY');
  if (!secret) throw new Error('Secure credential storage is unavailable');
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptDeliveryToken(token: string, companyId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`whatsapp:${companyId}`) }, await key(), new TextEncoder().encode(token)));
  return btoa(String.fromCharCode(...iv, ...bytes));
}
export async function decryptDeliveryToken(value: string, companyId: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(`whatsapp:${companyId}`) }, await key(), bytes.slice(12));
  return new TextDecoder().decode(result);
}