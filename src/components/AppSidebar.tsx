import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  Receipt,
  Package,
  Landmark,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Banking", url: "/banking", icon: Landmark },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      } min-h-screen`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Landmark className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
            CloudBooks
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-primary"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-primary"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
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
      </div>
    </aside>
  );
}
