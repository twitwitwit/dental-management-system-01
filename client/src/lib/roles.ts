import { useAuth } from "@/_core/hooks/useAuth";
import {
  CalendarCheck,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  ScrollText,
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
  | "audit"
  | "settings"
  | "patientPortal";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  dentist: "Dentist",
  receptionist: "Receptionist",
  staff: "Staff",
  patient: "Patient",
};

/**
 * Per-role module access. Roles map to exactly the modules described
 * in the authoritative specification.
 */
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
    "audit",
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
  patient: ["patientPortal"],
};

export const PATIENT_PORTAL_NAV_ITEMS = [
  { id: "patientPortal" as const, label: "My Portal", path: "/patient", icon: LayoutDashboard },
];

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
  { id: "audit", label: "Audit Logs", path: "/audit", icon: ScrollText },
  { id: "settings", label: "Clinic Settings", path: "/settings", icon: Settings },
];

export function useCurrentRole(): Role | null {
  const { user } = useAuth();
  const u = user as unknown as { role?: Role } | null;
  const role = u?.role ?? null;
  return role ?? null;
}

export function canAccess(role: Role | null, moduleId: string): boolean {
  if (!role) return false;
  return ROLE_SCOPES[role]?.includes(moduleId as RoleModule) ?? false;
}

export function navForRole(role: Role | null): NavItem[] {
  if (!role) return [];
  const scope = ROLE_SCOPES[role];
  return NAV_ITEMS.filter(item => scope.includes(item.id));
}
