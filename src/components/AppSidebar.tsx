import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  Receipt,
  Package,
  Store,
  Landmark,
  Building2,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  History,
  Trash2,
  FileEdit,
  Droplets,
  Search,

  
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import ksLogo from "@/assets/ks-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

const allNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "accountant", "sales"] },
  { title: "Invoices", url: "/invoices", icon: FileText, roles: ["admin", "accountant", "sales"] },
  
  { title: "Customers", url: "/customers", icon: Users, roles: ["admin", "accountant", "sales"] },
  { title: "Purchases", url: "/purchases", icon: Truck, roles: ["admin", "accountant"] },
  { title: "Expenses", url: "/expenses", icon: Receipt, roles: ["admin", "accountant"] },
  { title: "Inventory", url: "/inventory", icon: Package, roles: ["admin", "accountant"] },
  { title: "Store Inventory", url: "/store-inventory", icon: Store, roles: ["admin", "accountant"] },
  { title: "Accounts", url: "/accounts", icon: Landmark, roles: ["admin", "accountant"] },
  { title: "Assets", url: "/assets", icon: Building2, roles: ["admin", "accountant"] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["admin", "accountant"] },
  { title: "Solar Washing", url: "/solar-washing", icon: Droplets, roles: ["admin", "accountant", "sales"] },
  { title: "Drafts", url: "/drafts", icon: FileEdit, roles: ["admin", "accountant", "sales"] },
  { title: "Activity Logs", url: "/activity-logs", icon: History, roles: ["admin", "accountant", "sales"] },
  { title: "Trash", url: "/trash", icon: Trash2, roles: ["admin", "accountant", "sales"] },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { role } = useAuth();

  const isCollapsed = isMobile ? false : collapsed;

  const navItems = allNavItems.filter((item) => !role || item.roles.includes(role));

  return (
    <aside
      className={`relative flex flex-col bg-sidebar bg-[radial-gradient(120%_60%_at_0%_0%,hsl(var(--sidebar-primary)/0.12),transparent_60%)] text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isCollapsed ? "w-16" : "w-64"
      } ${isMobile ? "h-full" : "h-full"} min-h-0 overflow-hidden`}
    >
      <div className="relative flex items-center justify-center px-2 py-3">
        <img src={ksLogo} alt="K&S Solar Energy" className={`${isCollapsed ? "w-10" : "h-12 w-full"} object-contain transition-all duration-300`} />
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 transition-colors focus-within:border-sidebar-primary/60">
            <Search className="h-4 w-4 text-sidebar-muted" />
            <input
              placeholder="Search for..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-sidebar-muted"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-2 pb-4">
        {!isCollapsed && (
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">Menu</p>
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5"
            activeClassName="bg-gradient-to-r from-sidebar-accent to-sidebar-accent/40 text-sidebar-primary shadow-[inset_3px_0_0_0_hsl(var(--sidebar-primary)),0_8px_24px_-16px_hsl(var(--sidebar-primary))]"
            onClick={onNavigate}
          >
            <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
            {!isCollapsed && <span className="animate-fade-in">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border/70 p-2 space-y-1">
        <NavLink
          to="/settings"
          className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5"
          activeClassName="bg-gradient-to-r from-sidebar-accent to-sidebar-accent/40 text-sidebar-primary shadow-[inset_3px_0_0_0_hsl(var(--sidebar-primary)),0_8px_24px_-16px_hsl(var(--sidebar-primary))]"
          onClick={onNavigate}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </NavLink>
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full press"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
        {!isCollapsed && (
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className="mt-1 flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sidebar-primary to-primary text-xs font-semibold text-sidebar-primary-foreground">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile?.full_name?.[0] || "U").toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-accent-foreground">{profile?.full_name || "User"}</p>
              <p className="truncate text-[10px] capitalize text-sidebar-muted">{role || "Account settings"}</p>
            </div>
          </NavLink>
        )}
      </div>

    </aside>
  );
}
