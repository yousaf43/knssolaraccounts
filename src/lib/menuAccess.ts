export type MenuRole = "admin" | "accountant" | "sales";

/** Every menu a member can be given access to, with the role defaults. */
export const MENU_OPTIONS: { url: string; title: string; roles: MenuRole[] }[] = [
  { url: "/", title: "Dashboard", roles: ["admin", "accountant", "sales"] },
  { url: "/invoices", title: "Invoices", roles: ["admin", "accountant", "sales"] },
  { url: "/proposals", title: "Proposals", roles: ["admin", "accountant", "sales"] },
  { url: "/customers", title: "Customers", roles: ["admin", "accountant", "sales"] },
  { url: "/purchases", title: "Purchases", roles: ["admin", "accountant"] },
  { url: "/expenses", title: "Expenses", roles: ["admin", "accountant"] },
  { url: "/inventory", title: "Inventory", roles: ["admin", "accountant"] },
  { url: "/store-inventory", title: "Store Inventory", roles: ["admin", "accountant"] },
  { url: "/accounts", title: "Accounts", roles: ["admin", "accountant"] },
  { url: "/assets", title: "Assets", roles: ["admin", "accountant"] },
  { url: "/hr", title: "HR", roles: ["admin", "accountant"] },
  { url: "/reports", title: "Reports", roles: ["admin", "accountant"] },
  { url: "/solar-washing", title: "Solar Washing & Complaints", roles: ["admin", "accountant", "sales"] },
  { url: "/drafts", title: "Drafts", roles: ["admin", "accountant", "sales"] },
  { url: "/activity-logs", title: "Activity Logs", roles: ["admin", "accountant", "sales"] },
  { url: "/trash", title: "Trash", roles: ["admin", "accountant", "sales"] },
];

export const defaultMenusForRole = (role: MenuRole | null) =>
  MENU_OPTIONS.filter((m) => !role || m.roles.includes(role)).map((m) => m.url);

/**
 * Admins always see everything. Settings is always reachable.
 * A custom list (when set by an admin) replaces the role defaults.
 */
export function canAccessMenu(path: string, role: MenuRole | null, custom: string[] | null): boolean {
  if (path === "/settings" || role === "admin") return true;
  if (!MENU_OPTIONS.some((m) => m.url === path)) return true;
  return (custom ?? defaultMenusForRole(role)).includes(path);
}
