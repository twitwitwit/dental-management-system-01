import { useAuth } from "@/_core/hooks/useAuth";
import {
  CalendarCheck,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  Waypoints,
} from "lucide-react";

export type Role = "admin" | "dentist" | "receptionist" | "staff" | "patient";

export type RoleModule =
  | "dashboard"
  | "patients"
  | "appointments"
  | "clinical"
  | "billing"
  | "inventory"
  | "insurance"
  | "reports"
  | "users"
  | "settings";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  dentist: "Dentist",
  receptionist: "Receptionist",
  staff: "Staff",
  patient: "Patient",
};

export const ROLE_SCOPES: Record<Role, RoleModule[]> = {
  admin: [
    "dashboard",
    "patients",
    "appointments",
    "clinical",
    "billing",
    "inventory",
    "insurance",
    "reports",
    "users",
    "settings",
  ],
  dentist: [
    "dashboard",
    "patients",
    "appointments",
    "clinical",
    "billing",
    "inventory",
    "insurance",
    "reports",
  ],
  receptionist: ["dashboard", "patients", "appointments", "billing", "insurance"],
  staff: ["dashboard", "appointments", "inventory"],
  patient: ["dashboard", "appointments", "billing"],
};

export interface NavItem {
  id: RoleModule;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard },
  { id: "patients", label: "Patients", path: "/patients", icon: Users },
  { id: "appointments", label: "Appointments", path: "/appointments", icon: CalendarCheck },
  { id: "clinical", label: "Clinical Records", path: "/clinical", icon: Stethoscope },
  { id: "billing", label: "Billing & Payments", path: "/billing", icon: HandCoins },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: Waypoints },
  { id: "insurance", label: "Insurance", path: "/insurance", icon: ShieldCheck },
  { id: "reports", label: "Reports", path: "/reports", icon: ClipboardList },
  { id: "users", label: "Staff Management", path: "/users", icon: Users },
  { id: "settings", label: "Clinic Settings", path: "/settings", icon: Settings },
];

export function useCurrentRole(): Role | null {
  const { user } = useAuth();
  const u = user as unknown as { role?: Role } | null;
  return u?.role ?? null;
}

export function canAccess(role: Role | null, moduleId: string): boolean {
  if (!role) return false;
  return ROLE_SCOPES[role]?.includes(moduleId as RoleModule) ?? false;
}

export function navForRole(role: Role | null): NavItem[] {
  if (!role || role === "patient") return [];
  return NAV_ITEMS.filter(item => ROLE_SCOPES[role].includes(item.id));
}
