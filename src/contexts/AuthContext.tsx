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
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);
  const [twoFAVerified, setTwoFAVerifiedState] = useState(false);
  const [twoFAEnabled, setTwoFAEnabledState] = useState(true);

  const setTwoFAVerified = (v: boolean) => {
    setTwoFAVerifiedState(v);
    if (user) {
      if (v) sessionStorage.setItem(twoFAKey(user.id), "1");
      else sessionStorage.removeItem(twoFAKey(user.id));
    }
  };

  const setTwoFAEnabled = (v: boolean) => {
    setTwoFAEnabledState(v);
    if (user) {
      localStorage.setItem(twoFAEnabledKey(user.id), v ? "1" : "0");
      if (!v) {
        sessionStorage.setItem(twoFAKey(user.id), "1");
        setTwoFAVerifiedState(true);
      }
    }
  };


  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileData) {
      setProfile(profileData as Profile);
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleData) {
      setRole(roleData.role as AppRole);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTwoFAVerifiedState(sessionStorage.getItem(twoFAKey(session.user.id)) === "1");
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setTwoFAVerifiedState(false);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTwoFAVerifiedState(sessionStorage.getItem(twoFAKey(session.user.id)) === "1");
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (user) sessionStorage.removeItem(twoFAKey(user.id));
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setTwoFAVerifiedState(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, twoFAVerified, setTwoFAVerified, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
