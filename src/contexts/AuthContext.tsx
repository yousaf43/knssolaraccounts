import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "accountant" | "sales";

type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  company: string;
  avatar_url: string;
  company_id?: string | null;
};

type Company = {
  id: string;
  name: string;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  notes: string | null;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  isSuperAdmin: boolean;
  company: Company | null;
  twoFAVerified: boolean;
  setTwoFAVerified: (v: boolean) => void;
  twoFAEnabled: boolean;
  setTwoFAEnabled: (v: boolean) => void;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const twoFAKey = (uid: string) => `2fa_verified_${uid}`;
const twoFAEnabledKey = (uid: string) => `2fa_enabled_${uid}`;
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [twoFAVerified, setTwoFAVerifiedState] = useState(false);
  const [twoFAEnabled, setTwoFAEnabledState] = useState(true);

  const setTwoFAVerified = (v: boolean) => {
    setTwoFAVerifiedState(v);
    if (user) v ? sessionStorage.setItem(twoFAKey(user.id), "1") : sessionStorage.removeItem(twoFAKey(user.id));
  };

  const setTwoFAEnabled = (v: boolean) => {
    setTwoFAEnabledState(v);
    if (user) {
      localStorage.setItem(twoFAEnabledKey(user.id), v ? "1" : "0");
      if (!v) { sessionStorage.setItem(twoFAKey(user.id), "1"); setTwoFAVerifiedState(true); }
      supabase.auth.updateUser({ data: { two_fa_enabled: v } }).catch(() => {});
    }
  };

  const fetchProfile = async (userId: string) => {
    const [{ data: profileData }, { data: roleData }, { data: superAdminData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);

    setIsSuperAdmin(Boolean(superAdminData));
    if (profileData) {
      const nextProfile = profileData as Profile;
      setProfile(nextProfile);
      if (nextProfile.company_id) {
        const { data: companyData } = await supabase.from("companies").select("*").eq("id", nextProfile.company_id).single();
        setCompany((companyData as Company | null) || null);
      } else {
        setCompany(null);
      }
    } else {
      setCompany(null);
    }
    if (roleData) setRole(roleData.role as AppRole);
  };

  const refreshProfile = async () => { if (user) await fetchProfile(user.id); };
  const resolveTwoFAEnabled = (u: User) => {
    const meta = (u.user_metadata as { two_fa_enabled?: boolean } | null)?.two_fa_enabled;
    if (typeof meta === "boolean") { localStorage.setItem(twoFAEnabledKey(u.id), meta ? "1" : "0"); return meta; }
    return localStorage.getItem(twoFAEnabledKey(u.id)) !== "0";
  };

  useEffect(() => {
    const hydrate = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        const enabled = resolveTwoFAEnabled(nextSession.user);
        setTwoFAEnabledState(enabled);
        setTwoFAVerifiedState(!enabled || sessionStorage.getItem(twoFAKey(nextSession.user.id)) === "1");
        setTimeout(() => { void fetchProfile(nextSession.user.id); }, 0);
      } else {
        setProfile(null); setRole(null); setCompany(null); setIsSuperAdmin(false);
        setTwoFAVerifiedState(false); setTwoFAEnabledState(true);
      }
      setLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => hydrate(nextSession));
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => hydrate(currentSession));
    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin } });
    return { error: error as Error | null };
  };
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };
  const signOut = async () => {
    if (user) sessionStorage.removeItem(twoFAKey(user.id));
    await supabase.auth.signOut();
    setUser(null); setSession(null); setProfile(null); setRole(null); setCompany(null); setIsSuperAdmin(false); setTwoFAVerifiedState(false);
  };

  return <AuthContext.Provider value={{ user, session, profile, role, loading, isSuperAdmin, company, twoFAVerified, setTwoFAVerified, twoFAEnabled, setTwoFAEnabled, signUp, signIn, signOut, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
