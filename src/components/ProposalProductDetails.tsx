import { useEffect, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Loader2 } from "lucide-react";
import { productIdentityKey, printableProductFacts, type ProductResearch } from "@/lib/productSpecs";
import type { ProposalItem } from "@/pages/Proposals";

const pending = new Map<string, Promise<ProductResearch>>();
const cache = new Map<string, ProductResearch>();
async function lookup(item: ProposalItem): Promise<ProductResearch> {
  const key = productIdentityKey(item);
  const saved = cache.get(key);
  if (saved) return saved;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const { data, error } = await supabase.functions.invoke("product-specs", { body: { brand: item.brand, description: item.description, model: item.model } });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => ({}));
        throw new Error(body.error || "Internet lookup unavailable");
      }
      throw new Error(error.message);
    }
    if (!data?.research) throw new Error("Product details were not returned");
    cache.set(key, data.research);
    return data.research as ProductResearch;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

export function ProposalProductDetails({ item, onModelChange, onResearch }: { item: ProposalItem; onModelChange: (model: string) => void; onResearch: (key: string, research: ProductResearch) => void }) {
  const identity = productIdentityKey(item);
  const current = useRef(identity);
  current.current = identity;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const callbacks = useRef(onResearch);
  callbacks.current = onResearch;
  useEffect(() => {
    setError("");
    setBusy(false);
    if (item.description.trim().length < 3 || item.research?.identityKey === identity) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const research = await lookup(item);
        if (active && current.current === identity) callbacks.current(identity, research);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Internet lookup unavailable");
      } finally { if (active) setBusy(false); }
    }, 1500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [identity, retry, item.research?.identityKey]);
  const facts = printableProductFacts(item);
  return <div className="mt-2 min-w-48 space-y-2">
    <Input aria-label={`Exact model for ${item.brand || item.description || "product"}`} placeholder="Exact model / variant" value={item.model || ""} onChange={(e) => onModelChange(e.target.value)} />
    {busy ? <div className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Finding product details…</div> : null}
    {error ? <div className="flex items-center gap-2"><span className="text-xs text-destructive">{error}</span><Button type="button" variant="ghost" size="icon" title="Retry product lookup" onClick={() => setRetry((r) => r + 1)}><RefreshCw className="h-3 w-3" /></Button></div> : null}
    {item.research?.identityKey === identity && !facts.length ? <p className="text-xs text-muted-foreground">Exact product not verified — add its model.</p> : null}
    {facts.length ? <ul className="space-y-1 text-xs text-muted-foreground">{facts.map((f, i) => <li key={i}>• {f.text} <a className="text-primary underline" href={f.sourceUrl} target="_blank" rel="noreferrer">Source</a></li>)}</ul> : null}
  </div>;
}