export function whatsappRecipient(phone: string): string | null {
  let digits = phone.replace(/[\s()+.-]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^03\d{9}$/.test(digits)) digits = `92${digits.slice(1)}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
export function deliveryReady(p: { customerName?: string; phone?: string; items?: { qty: number; unitPrice: number }[]; whatsappConsent?: boolean }) {
  if (!p.whatsappConsent) return 'Customer WhatsApp consent is required';
  if (!p.customerName?.trim() || !whatsappRecipient(p.phone || '')) return 'A customer name and valid WhatsApp number are required';
  if (!p.items?.length || p.items.some(i => !(i.qty > 0) || !(i.unitPrice > 0))) return 'Confirm every item quantity and price before sending';
  return null;
}
export function automaticDeliveryAllowed(enabled: boolean, alreadyClaimed: boolean) {
  return enabled && !alreadyClaimed;
}
export function mayManageDelivery(roles: { role: string }[]) { return roles.some(r => r.role === 'admin'); }