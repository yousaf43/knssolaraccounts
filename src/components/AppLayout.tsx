import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Bell, Search, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

export function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="sticky top-0 h-screen self-start flex-shrink-0">
            <AppSidebar />
          </div>
        )}

        <div className="flex-1 flex min-w-0 flex-col min-h-screen">
          {/* Top bar */}
          <header className="h-14 sm:h-16 border-b bg-card flex items-center justify-between px-3 sm:px-6 flex-shrink-0 gap-2 sticky top-0 z-30">
            {/* Mobile menu button */}
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <button className="p-2 rounded-md hover:bg-muted transition-colors">
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64 [&>button]:hidden">
                  <AppSidebar onNavigate={() => setSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
            )}

            <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button className="relative p-2 rounded-md hover:bg-muted transition-colors">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
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
          <main id="main-scroll" className="flex-1 bg-background p-3 sm:p-6">
            <Outlet />
          </main>
          <footer className="shrink-0 border-t border-border/30 bg-background py-2 text-center text-[10px] text-muted-foreground/60">
            Design & Developed by <span className="font-medium text-muted-foreground/80">Yousuf Enterprises</span>
          </footer>
        </div>
      </div>
    </>
  );
}
