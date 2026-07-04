import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SettingsProvider } from "@/contexts/SettingsContext";
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
import ActivityLogs from "@/pages/ActivityLogs";
import TrashPage from "@/pages/Trash";
import SolarWashing from "@/pages/SolarWashing";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

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
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={isSales ? <Navigate to="/" replace /> : <NotFound />} />
    </Routes>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
