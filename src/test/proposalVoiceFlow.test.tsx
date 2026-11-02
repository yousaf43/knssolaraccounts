import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProposalAssistant } from '@/components/ProposalAssistant';
import type { Proposal } from '@/pages/Proposals';

const mocks = vi.hoisted(() => ({ record: vi.fn(), speech: vi.fn(), silence: null as (() => void) | null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } } }));
vi.mock('@/lib/voice/record-wav', () => ({ recordWav: mocks.record }));
vi.mock('@/lib/voice/stream-speech', () => ({ streamSpeech: mocks.speech }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); mocks.silence = null; });
describe('Proposal voice conversation', () => {
  it('automatically sends stopped speech to Gemini and speaks its reply without a Send click', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
    mocks.record.mockImplementation(async (onSilence: () => void) => {
      mocks.silence = onSilence;
      return { stop: async () => new File(['speech'], 'recording.wav', { type: 'audio/wav' }) };
    });
    mocks.speech.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ text: 'Ali ke liye 18 Longi panels' }))).mockResolvedValueOnce(new Response(JSON.stringify({ reply: 'Ji, har panel ki price kya hai?', patch: { customerName: 'Ali', panelQty: 18 }, missing: ['Quotation prices'] })));
    vi.stubGlobal('fetch', fetchMock);
    const apply = vi.fn();
    render(<ProposalAssistant draft={{} as Omit<Proposal, 'id' | 'proposalNo'>} onApply={apply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Record requirements' }));
    await waitFor(() => expect(mocks.silence).toBeTypeOf('function'));
    mocks.silence?.();
    await waitFor(() => expect(mocks.speech).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: 'Ali ke liye 18 Longi panels' }]);
    expect(mocks.speech.mock.calls[0][1]).toBe('Ji, har panel ki price kya hai?');
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply confirmed details' }));
    expect(apply).toHaveBeenCalledWith({ customerName: 'Ali', panelQty: 18 });
  });
});