import { describe, expect, it } from 'vitest';
import { automaticDeliveryAllowed, deliveryReady, mayManageDelivery, whatsappRecipient } from '../../supabase/functions/_shared/proposal-delivery-policy';

describe('automatic WhatsApp proposal rules', () => {
  it('does not send while disabled', () => { expect(automaticDeliveryAllowed(false, false)).toBe(false); expect(automaticDeliveryAllowed(true, false)).toBe(true); });
  it('does not send a proposal twice', () => { expect(automaticDeliveryAllowed(true, true)).toBe(false); });
  it('only admins manage delivery settings', () => { expect(mayManageDelivery([{ role: 'sales' }])).toBe(false); expect(mayManageDelivery([{ role: 'admin' }])).toBe(true); });
  it('requires customer consent', () => { expect(deliveryReady({ customerName: 'Ali', phone: '03001234567', items: [{ qty: 1, unitPrice: 20000 }] })).toBe('Customer WhatsApp consent is required'); });
  it('does not send missing or guessed zero rates', () => { expect(deliveryReady({ customerName: 'Ali', phone: '03001234567', whatsappConsent: true, items: [{ qty: 1, unitPrice: 0 }] })).toBe('Confirm every item quantity and price before sending'); });
  it('normalizes Pakistan customer phone numbers', () => { expect(whatsappRecipient('0300-1234567')).toBe('923001234567'); expect(whatsappRecipient('+92 300 1234567')).toBe('923001234567'); expect(whatsappRecipient('abc')).toBeNull(); });
});