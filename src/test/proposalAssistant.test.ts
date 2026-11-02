import { describe, it, expect } from 'vitest';
import { missingProposalDetails, validateAssistantPatch } from '../../supabase/functions/_shared/proposal-draft';
import { encodeWav } from '@/lib/voice/record-wav';
describe('Voice proposal assistant', () => {
  it('asks for missing customer instead of treating equipment as a complete proposal', () => {
    expect(missingProposalDetails({ items: [{ description: 'Solar package', qty: 1, unitPrice: 500000 }] })).toEqual(['Customer name']);
  });
  it('asks for quotation price when not supplied', () => {
    expect(missingProposalDetails({ customerName: 'Ali', items: [{ description: '590W panels', qty: 18, unitPrice: 0 }] })).toContain('Quotation prices (or confirmed free items)');
  });
  it('calculates amounts from confirmed quantities and prices without trusting AI totals', () => {
    expect(validateAssistantPatch({ items: [{ brand: 'JA Solar', description: '590W', unit: 'Nos', qty: 18, unitPrice: 20000, amount: 1 }] }).items).toEqual([{ brand: 'JA Solar', description: '590W', model: '', unit: 'Nos', qty: 18, unitPrice: 20000, amount: 360000 }]);
  });
  it('does not allow AI to save or change ownership/status', () => {
    expect(() => validateAssistantPatch({ status: 'sent' })).toThrow();
    expect(() => validateAssistantPatch({ user_id: 'other' })).toThrow();
  });
  it('preserves only supplied fields in partial updates', () => { expect(validateAssistantPatch({ customerName: 'Ali' })).toEqual({ customerName: 'Ali' }); });
  it('encodes complete WAV with correct size for voice recording', async () => {
    const blob = encodeWav([new Float32Array(2400)], 24000);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Invalid WAV')); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
    const bytes = new Uint8Array(buffer);
    expect(bytes.length).toBe(4844); expect(new TextDecoder().decode(bytes.slice(0,4))).toBe('RIFF');
  });
});