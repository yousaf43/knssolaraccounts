import { AppSidebar } from "@/components/AppSidebar";
import { NexiaAssistant } from "@/components/NexiaAssistant";
import { RecentTabs } from "@/components/RecentTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Outlet } from "react-router-dom";
import { Bell, Search, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTabScrollMemory } from "@/hooks/useTabScrollMemory";
import { useTabStateMemory } from "@/hooks/useTabStateMemory";

export function AppLayout() {
  const { profile, role, company, isSuperAdmin, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useTabScrollMemory();
  useTabStateMemory();


  return (
    <>
      <div className="flex min-h-screen w-full p-0 lg:p-4">
        <div className="flex flex-1 min-w-0 rounded-none border-0 lg:rounded-3xl lg:border border-border/60 bg-card/40 shadow-[0_30px_90px_-40px_hsl(var(--primary)/0.45)]">
        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="sticky top-4 h-[calc(100vh-2rem)] self-start flex-shrink-0">
            <AppSidebar />
          </div>
        )}

        <div className="flex-1 flex min-w-0 flex-col min-h-[calc(100vh-2rem)]">
          {/* Top bar */}
          <header className="glass-panel h-14 sm:h-16 border-b border-border/60 flex items-center justify-between px-3 sm:px-6 flex-shrink-0 gap-2 sticky top-0 z-30 shadow-[0_1px_0_0_hsl(var(--border)/0.6),0_10px_30px_-24px_hsl(var(--primary)/0.6)]">

            {/* Mobile menu button */}
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <button className="p-2 rounded-md hover:bg-muted transition-colors press">
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64 [&>button]:hidden">
                  <AppSidebar onNavigate={() => setSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
            )}

            <div className="group flex items-center gap-2 flex-1 max-w-md rounded-full border border-border/70 bg-background/60 px-3 py-1.5 transition-all duration-300 focus-within:border-primary/50 focus-within:bg-background focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]">
              <Search className="w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                placeholder="Search anything..."
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <button className="relative p-2 rounded-md hover:bg-muted transition-colors press">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive animate-pulse-glow" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent ring-2 ring-background shadow-sm transition-transform duration-300 hover:scale-105 flex items-center justify-center text-primary-foreground text-sm font-semibold overflow-hidden">
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
                    {isSuperAdmin ? (
                      <Badge variant="outline" className="hidden h-4 px-1.5 text-[10px] sm:inline-flex">Platform admin</Badge>
                    ) : company?.name ? (
                      <Badge variant="outline" className="hidden h-4 max-w-36 truncate px-1.5 text-[10px] sm:inline-flex">{company.name}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-md hover:bg-muted transition-colors press"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </header>
          <RecentTabs />
          {/* Content */}
          <main id="main-scroll" className="flex-1 p-3 sm:p-6">
            {/* content */}
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
          <footer className="shrink-0 border-t border-border/40 bg-transparent py-2 text-center text-[10px] text-muted-foreground/60">
            Design & Developed by <span className="font-medium text-muted-foreground/80">Yousuf Enterprises</span>
          </footer>
        </div>
        </div>
      </div>

      <NexiaAssistant />
    </>
  );
}
