import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export async function deliveryRequest(body: Record<string, unknown> | FormData) {
  const { data, error } = await supabase.functions.invoke('proposal-delivery', { body });
  if (error) {
    const raw = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = raw;
    try { message = JSON.parse(raw).error || raw; } catch { /* Plain errors remain readable. */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}