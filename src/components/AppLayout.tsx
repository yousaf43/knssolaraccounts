import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Bell, Search, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

export function AppLayout() {
  const { profile, role, signOut } = useAuth();

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions, invoices..."
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-md hover:bg-muted transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (profile?.full_name?.[0] || "U").toUpperCase()
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                <div className="flex items-center gap-1.5">
                  {role && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                      {role}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </header>
        {/* Content */}
        <main className="flex-1 overflow-auto p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
