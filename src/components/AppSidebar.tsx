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
  Droplets,
  
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
      className={`flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-60"
      } ${isMobile ? "h-full" : "h-screen"} min-h-0 overflow-hidden`}
    >
      <div className="flex items-center justify-center px-2 py-3 border-b border-sidebar-border">
        <img src={ksLogo} alt="K&S Solar Energy" className={`${isCollapsed ? "w-10" : "h-12 w-full"} object-contain`} />
      </div>

      <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-2 py-4">
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
