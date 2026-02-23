import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  Receipt,
  Package,
  Landmark,
  Building2,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  History,
  Trash2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import ksLogo from "@/assets/ks-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Purchases", url: "/purchases", icon: Truck },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Accounts", url: "/accounts", icon: Landmark },
  { title: "Assets", url: "/assets", icon: Building2 },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Activity Logs", url: "/activity-logs", icon: History },
  { title: "Trash", url: "/trash", icon: Trash2 },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // On mobile (inside sheet), never collapse
  const isCollapsed = isMobile ? false : collapsed;

  return (
    <aside
      className={`flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-60"
      } ${isMobile ? "min-h-full" : "min-h-screen"}`}
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-2 py-3 border-b border-sidebar-border">
        <img
          src={ksLogo}
          alt="K&S Solar Energy"
          className={`${isCollapsed ? "w-10" : "h-12 w-full"} object-contain`}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-primary"
            onClick={onNavigate}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-primary"
          onClick={onNavigate}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </NavLink>
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
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
      </div>
    </aside>
  );
}
