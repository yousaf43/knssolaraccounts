import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import Customers from "@/pages/Customers";
import Purchases from "@/pages/Purchases";
import Expenses from "@/pages/Expenses";
import Inventory from "@/pages/Inventory";
import StoreInventory from "@/pages/StoreInventory";

import Accounts from "@/pages/Accounts";
import Assets from "@/pages/Assets";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import PlatformAdmin from "@/pages/PlatformAdmin";
import ActivityLogs from "@/pages/ActivityLogs";
import TrashPage from "@/pages/Trash";
import DraftsPage from "@/pages/Drafts";
import SolarWashing from "@/pages/SolarWashing";
import Auth from "@/pages/Auth";
import TwoFactorVerify from "@/pages/TwoFactorVerify";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Landing from "@/pages/Landing";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, role, twoFAVerified, isSuperAdmin, company, companyResolved, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }
  if (!twoFAVerified) return <TwoFactorVerify />;
  if (!isSuperAdmin && !companyResolved) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const expired = Boolean(company?.expires_at && new Date(`${company.expires_at}T23:59:59`) < new Date());
  const unavailable = !isSuperAdmin && companyResolved && (!company || company.status !== "active" || expired);
  if (unavailable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Workspace unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {!company ? "Your account is not assigned to a company workspace." : expired ? "This company workspace has expired." : "This company workspace is currently paused or disabled."}
            {" Please contact the platform administrator."}
          </p>
          <Button onClick={() => void signOut()} className="mt-6">Sign out</Button>
        </div>
      </div>
    );
  }

  const isSales = role === "sales";

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<Invoices />} />
        
        <Route path="/customers" element={<Customers />} />
        {!isSales && <Route path="/purchases" element={<Purchases />} />}
        {!isSales && <Route path="/expenses" element={<Expenses />} />}
        {!isSales && <Route path="/inventory" element={<Inventory />} />}
        {!isSales && <Route path="/store-inventory" element={<StoreInventory />} />}
        {!isSales && <Route path="/accounts" element={<Accounts />} />}
        {!isSales && <Route path="/assets" element={<Assets />} />}
        {!isSales && <Route path="/reports" element={<Reports />} />}
        <Route path="/activity-logs" element={<ActivityLogs />} />
        <Route path="/solar-washing" element={<SolarWashing />} />
        <Route path="/drafts" element={<DraftsPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/settings" element={<Settings />} />
        {isSuperAdmin && <Route path="/platform-admin" element={<PlatformAdmin />} />}
      </Route>
      <Route path="*" element={isSales ? <Navigate to="/" replace /> : <NotFound />} />
    </Routes>
  );
}

function AuthRoute() {
  const { user, loading, twoFAVerified } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user && !twoFAVerified) return <TwoFactorVerify />;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <SettingsProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </BrowserRouter>
          </SettingsProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
