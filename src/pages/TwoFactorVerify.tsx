import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function TwoFactorVerify() {
  const { user, signOut, setTwoFAVerified } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentRef = useRef(false);

  const sendCode = async () => {
    setSending(true);
    const { error } = await supabase.functions.invoke("send-otp-email");
    setSending(false);
    if (error) {
      toast.error("Failed to send code. " + error.message);
      return;
    }
    toast.success(`Verification code sent to ${user?.email}`);
    setCooldown(60);
  };

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-otp", { body: { code } });
    setLoading(false);
    if (error || !data?.success) {
      const msg = (data as { error?: string } | null)?.error || error?.message || "Verification failed";
      toast.error(msg);
      return;
    }
    setTwoFAVerified(true);
    toast.success("Verified! Welcome.");
  };

  const maskedEmail = user?.email
    ? user.email.replace(/^(.).*(@.*)$/, (_, a, b) => `${a}****${b}`)
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-xl shadow-lg p-8 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold">Two-Factor Verification</h1>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1 justify-center">
                <Mail className="w-3.5 h-3.5" />
                Code sent to <span className="font-medium text-foreground">{maskedEmail}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <Label>6-Digit Code</Label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verify & Sign In
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || cooldown > 0}
                className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {sending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-destructive hover:underline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          The code expires in 10 minutes.
        </p>
      </div>
    </div>
  );
}
