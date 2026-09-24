import {
  LayoutDashboard,
  KeyRound,
  PackagePlus,
  Users,
  FileCode2,
  ShieldCheck,
  Megaphone,
  ScrollText,
  Activity,
  BarChart3,
  Terminal,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavGroupKey = "top" | "manage" | "insights" | "system";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroupKey;
  /** Single letter for the "G then letter" jump shortcut, and the palette hint. */
  shortcut?: string;
  /** Shows the live pulse dot in the sidebar (Activity only). */
  live?: boolean;
};

/** Single source of truth for the Sidebar, Topbar breadcrumbs, and the command palette. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, group: "top", shortcut: "o" },
  { href: "/dashboard/keys", label: "Keys", icon: KeyRound, group: "manage", shortcut: "k" },
  { href: "/dashboard/bulk", label: "Bulk keys", icon: PackagePlus, group: "manage" },
  { href: "/dashboard/customers", label: "Customers", icon: Users, group: "manage", shortcut: "c" },
  { href: "/dashboard/scripts", label: "Scripts", icon: FileCode2, group: "manage", shortcut: "s" },
  { href: "/dashboard/obfuscator", label: "Obfuscator", icon: ShieldCheck, group: "manage" },
  { href: "/dashboard/announcement", label: "Announcement", icon: Megaphone, group: "manage" },
  { href: "/dashboard/logs", label: "Logs", icon: ScrollText, group: "insights", shortcut: "l" },
  {
    href: "/dashboard/activity",
    label: "Activity",
    icon: Activity,
    group: "insights",
    shortcut: "a",
    live: true,
  },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, group: "insights" },
  { href: "/dashboard/playground", label: "Playground", icon: Terminal, group: "system", shortcut: "p" },
  { href: "/dashboard/settings", label: "Settings", icon: SlidersHorizontal, group: "system" },
];

export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: "manage", label: "Manage" },
  { key: "insights", label: "Insights" },
  { key: "system", label: "System" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveNavItem(pathname: string): NavItem | null {
  return NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href)) ?? null;
}
