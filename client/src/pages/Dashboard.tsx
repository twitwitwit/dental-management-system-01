import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coins,
  CreditCard,
  Package,
  UserCog,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AccessDenied from "./AccessDenied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  canAccess,
  useCurrentRole,
  type Role,
} from "@/lib/roles";
import {
  EmptyState,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/dental";
import {
  formatMoney,
  formatTime,
} from "@/lib/format";
import { useAuth } from "@/_core/hooks/useAuth";

const MANILA_TIME_ZONE = "Asia/Manila";

const ROLE_COPY: Record<Role, { title: string; description: string }> = {
  admin: {
    title: "Clinic operations",
    description: "Monitor the day’s schedule, collections, staffing, and exceptions.",
  },
  dentist: {
    title: "Clinical worklist",
    description: "Review today’s visits, patient flow, and treatment follow-up.",
  },
  receptionist: {
    title: "Front desk",
    description: "Keep appointments, patient arrivals, payments, and coverage moving.",
  },
  staff: {
    title: "Daily operations",
    description: "Stay on top of today’s visits and stock tasks.",
  },
};

function manilaDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function manilaDateLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function manilaTimeLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFromUser(user: unknown): string {
  const value = user as { name?: string | null; email?: string | null } | null;
  const name = value?.name?.trim();
  if (name) return name.split(/\s+/)[0];
  return value?.email?.split("@")[0] || "there";
}

export default function Dashboard() {
  const role = useCurrentRole();
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const canViewPatients = canAccess(role, "patients");
  const canViewBilling = canAccess(role, "billing");
  const canViewInventory = canAccess(role, "inventory");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = manilaDateKey(now);
  const appointments = trpc.appointments.list.useQuery(
    { dateFrom: today, dateTo: today },
    { enabled: !!role },
  );
  const patients = trpc.patients.list.useQuery(
    {},
    { enabled: !!role && canViewPatients },
  );
  const invoices = trpc.billing.invoices.useQuery(
    {},
    { enabled: !!role && canViewBilling },
  );
  const payments = trpc.billing.payments.useQuery(
    {},
    { enabled: !!role && canViewBilling },
  );
  const inventory = trpc.inventory.items.useQuery(undefined, {
    enabled: !!role && canViewInventory,
  });
  const staff = trpc.users.list.useQuery(undefined, {
    enabled: role === "admin",
  });

  const patientById = useMemo(() => {
    const map = new Map<number, { firstName: string; lastName: string }>();
    (patients.data ?? []).forEach(patient => map.set(patient.id, patient));
    return map;
  }, [patients.data]);

  const todayAppointments = useMemo(
    () =>
      [...(appointments.data ?? [])].sort((a, b) =>
        `${a.startTime}`.localeCompare(`${b.startTime}`),
      ),
    [appointments.data],
  );

  const appointmentCounts = useMemo(() => {
    const counts = { scheduled: 0, confirmed: 0, completed: 0, no_show: 0 };
    todayAppointments.forEach(appointment => {
      if (appointment.status in counts) {
        counts[appointment.status as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [todayAppointments]);

  const paymentSummary = useMemo(() => {
    const paidToday = (payments.data ?? []).reduce((sum, payment) => {
      if (payment.type === "refund") return sum - Number(payment.amount ?? 0);
      if (manilaDateKey(payment.paidAt) !== today) return sum;
      return sum + Number(payment.amount ?? 0);
    }, 0);

    const paidByInvoice = new Map<number, number>();
    (payments.data ?? []).forEach(payment => {
      const amount = Number(payment.amount ?? 0) * (payment.type === "refund" ? -1 : 1);
      paidByInvoice.set(
        payment.invoiceId,
        (paidByInvoice.get(payment.invoiceId) ?? 0) + amount,
      );
    });

    const openInvoices = (invoices.data ?? []).filter(invoice => {
      if (invoice.status === "cancelled" || invoice.status === "paid") return false;
      const balance = Number(invoice.total ?? 0) - (paidByInvoice.get(invoice.id) ?? 0);
      return balance > 0;
    });
    const outstanding = openInvoices.reduce((sum, invoice) => {
      const balance = Number(invoice.total ?? 0) - (paidByInvoice.get(invoice.id) ?? 0);
      return sum + Math.max(0, balance);
    }, 0);

    return { paidToday, openInvoices, outstanding };
  }, [invoices.data, payments.data, today]);

  const lowStockItems = useMemo(
    () => (inventory.data ?? []).filter(item => item.quantity <= item.lowStockThreshold),
    [inventory.data],
  );

  if (!role || !canAccess(role, "dashboard")) {
    return <AccessDenied moduleId="dashboard" />;
  }

  const copy = ROLE_COPY[role];
  const greeting = greetingForHour(
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA_TIME_ZONE,
        hour: "numeric",
        hour12: false,
      }).format(now),
    ),
  );
  const firstName = firstNameFromUser(user);
  const isLoading = appointments.isLoading;
  const appointmentCount = todayAppointments.length;
  const openBalanceLabel = paymentSummary.outstanding
    ? formatMoney(paymentSummary.outstanding)
    : "₱0";

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">
            {greeting}, {firstName}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
          <p className="mt-3 text-sm text-muted-foreground">{manilaDateLabel(now)}</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 shadow-sm">
          <Clock3 className="h-4 w-4 text-primary" />
          <span className="font-semibold tabular-nums text-foreground">{manilaTimeLabel(now)}</span>
          <span className="text-xs text-muted-foreground">Philippine time</span>
        </div>
      </div>

      <RoleStats
        role={role}
        appointmentCount={appointmentCount}
        appointmentCounts={appointmentCounts}
        paidToday={paymentSummary.paidToday}
        openBalanceLabel={openBalanceLabel}
        lowStockCount={lowStockItems.length}
        inventoryCount={inventory.data?.length ?? 0}
        staffCount={staff.data?.filter(member => member.isActive).length ?? 0}
        isLoading={isLoading}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <TodaySchedule
          role={role}
          appointments={todayAppointments}
          patientById={patientById}
          isLoading={isLoading}
          canViewPatients={canViewPatients}
        />
        <AttentionPanel
          role={role}
          appointmentCounts={appointmentCounts}
          openInvoices={paymentSummary.openInvoices.length}
          outstanding={paymentSummary.outstanding}
          lowStockCount={lowStockItems.length}
          staffCount={staff.data?.filter(member => member.isActive).length ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <PatientFlow counts={appointmentCounts} role={role} />
        <QuickActions role={role} />
      </div>
    </DashboardLayout>
  );
}

function RoleStats({
  role,
  appointmentCount,
  appointmentCounts,
  paidToday,
  openBalanceLabel,
  lowStockCount,
  inventoryCount,
  staffCount,
  isLoading,
}: {
  role: Role;
  appointmentCount: number;
  appointmentCounts: { scheduled: number; confirmed: number; completed: number; no_show: number };
  paidToday: number;
  openBalanceLabel: string;
  lowStockCount: number;
  inventoryCount: number;
  staffCount: number;
  isLoading: boolean;
}) {
  const value = (input: number | string) => (isLoading ? "—" : input);

  if (role === "staff") {
    return (
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Visits today" value={value(appointmentCount)} subtitle="Scheduled visits" icon={<CalendarClock className="h-5 w-5" />} tone="teal" />
        <StatCard title="Scheduled" value={value(appointmentCounts.scheduled)} subtitle="Awaiting the visit" icon={<CalendarCheck className="h-5 w-5" />} tone="amber" />
        <StatCard title="Low-stock items" value={value(lowStockCount)} subtitle="Review and restock" icon={<AlertTriangle className="h-5 w-5" />} tone="coral" />
        <StatCard title="Stock items" value={value(inventoryCount)} subtitle="Items being tracked" icon={<Package className="h-5 w-5" />} tone="indigo" />
      </div>
    );
  }

  if (role === "receptionist") {
    return (
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Visits today" value={value(appointmentCount)} subtitle="Scheduled visits" icon={<CalendarClock className="h-5 w-5" />} tone="teal" />
        <StatCard title="Confirmed" value={value(appointmentCounts.confirmed)} subtitle="Patients expected" icon={<CheckCircle2 className="h-5 w-5" />} tone="amber" />
        <StatCard title="Collections today" value={isLoading ? "—" : formatMoney(paidToday)} subtitle="Payments posted" icon={<WalletCards className="h-5 w-5" />} tone="coral" />
        <StatCard title="Open balances" value={isLoading ? "—" : openBalanceLabel} subtitle="Invoices needing follow-up" icon={<CreditCard className="h-5 w-5" />} tone="indigo" />
      </div>
    );
  }

  if (role === "dentist") {
    return (
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Visits today" value={value(appointmentCount)} subtitle="Your clinical schedule" icon={<CalendarClock className="h-5 w-5" />} tone="teal" />
        <StatCard title="Completed" value={value(appointmentCounts.completed)} subtitle="Visits closed today" icon={<CheckCircle2 className="h-5 w-5" />} tone="amber" />
        <StatCard title="No-shows" value={value(appointmentCounts.no_show)} subtitle="Need follow-up" icon={<AlertTriangle className="h-5 w-5" />} tone="coral" />
        <StatCard title="Open balances" value={isLoading ? "—" : openBalanceLabel} subtitle="Patient accounts" icon={<CreditCard className="h-5 w-5" />} tone="indigo" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard title="Visits today" value={value(appointmentCount)} subtitle="Clinic-wide schedule" icon={<CalendarClock className="h-5 w-5" />} tone="teal" />
      <StatCard title="Collections today" value={isLoading ? "—" : formatMoney(paidToday)} subtitle="Payments posted" icon={<WalletCards className="h-5 w-5" />} tone="coral" />
      <StatCard title="Open balances" value={isLoading ? "—" : openBalanceLabel} subtitle="Invoices needing follow-up" icon={<CreditCard className="h-5 w-5" />} tone="amber" />
      <StatCard title="Active staff" value={value(staffCount)} subtitle="Accounts enabled" icon={<UserCog className="h-5 w-5" />} tone="indigo" />
    </div>
  );
}

function TodaySchedule({
  role,
  appointments,
  patientById,
  isLoading,
  canViewPatients,
}: {
  role: Role;
  appointments: Array<{
    id: number;
    patientId: number;
    appointmentDate: string | Date;
    startTime: string;
    endTime: string;
    type: string | null;
    status: string;
    notes: string | null;
  }>;
  patientById: Map<number, { firstName: string; lastName: string }>;
  isLoading: boolean;
  canViewPatients: boolean;
}) {
  return (
    <SectionCard
      title="Today’s schedule"
      actions={
        <Badge variant="outline" className="text-xs font-normal">
          <Link href="/appointments">Open schedule</Link>
        </Badge>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-14 text-muted-foreground">
          <Clock3 className="mr-2 h-4 w-4 animate-pulse" /> Loading schedule…
        </div>
      ) : !appointments.length ? (
        <EmptyState
          title="No visits scheduled today"
          description="There are no scheduled or confirmed visits for today."
          action={
            canAccess(role, "appointments") ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/appointments">View appointments</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="divide-y divide-border/70">
          {appointments.map(appointment => {
            const patient = patientById.get(appointment.patientId);
            const name = patient
              ? `${patient.firstName} ${patient.lastName}`
              : `Patient #${appointment.patientId}`;
            return (
              <div key={appointment.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatTime(appointment.startTime)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(appointment.endTime)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appointment.type || "Dental visit"}
                    {appointment.notes ? ` · ${appointment.notes}` : ""}
                  </p>
                </div>
                <StatusBadge status={appointment.status} />
                {canViewPatients ? (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/patients/${appointment.patientId}`}>Open chart</Link>
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function PatientFlow({
  counts,
  role,
}: {
  counts: { scheduled: number; confirmed: number; completed: number; no_show: number };
  role: Role;
}) {
  const items = [
    { label: "Scheduled", value: counts.scheduled, tone: "bg-slate-400" },
    { label: "Confirmed", value: counts.confirmed, tone: "bg-amber-500" },
    { label: "Completed", value: counts.completed, tone: "bg-teal-600" },
    { label: "No-show", value: counts.no_show, tone: "bg-rose-500" },
  ];
  return (
    <SectionCard title={role === "staff" ? "Today’s visit status" : "Patient flow today"}>
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
              <span className="text-xl font-bold tabular-nums">{item.value}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AttentionPanel({
  role,
  appointmentCounts,
  openInvoices,
  outstanding,
  lowStockCount,
  staffCount,
}: {
  role: Role;
  appointmentCounts: { scheduled: number; confirmed: number; completed: number; no_show: number };
  openInvoices: number;
  outstanding: number;
  lowStockCount: number;
  staffCount: number;
}) {
  const items: Array<{ label: string; detail: string; href: string; icon: ReactNode }> = [];

  if (appointmentCounts.no_show > 0 && role !== "staff") {
    items.push({
      label: `${appointmentCounts.no_show} no-show${appointmentCounts.no_show === 1 ? "" : "s"} to follow up`,
      detail: "Review the appointment record and contact the patient.",
      href: "/appointments",
      icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
    });
  }
  if (role !== "staff" && openInvoices > 0) {
    items.push({
      label: `${openInvoices} open invoice${openInvoices === 1 ? "" : "s"}`,
      detail: `${formatMoney(outstanding)} still outstanding.`,
      href: "/billing",
      icon: <CreditCard className="h-4 w-4 text-amber-600" />,
    });
  }
  if ((role === "admin" || role === "staff") && lowStockCount > 0) {
    items.push({
      label: `${lowStockCount} low-stock item${lowStockCount === 1 ? "" : "s"}`,
      detail: "Review current quantity and record a stock movement.",
      href: "/inventory",
      icon: <Package className="h-4 w-4 text-orange-600" />,
    });
  }
  if (role === "admin" && staffCount === 0) {
    items.push({
      label: "No active staff accounts",
      detail: "Create an account in Staff Management before assigning work.",
      href: "/users",
      icon: <UserCog className="h-4 w-4 text-primary" />,
    });
  }

  return (
    <SectionCard title="Attention required">
      {!items.length ? (
        <EmptyState title="Nothing needs attention" description="The current dashboard checks are clear." />
      ) : (
        <div className="space-y-2.5">
          {items.map(item => (
            <Link key={item.label} href={item.href} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 transition-colors hover:bg-accent/50">
              <div className="mt-0.5">{item.icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function QuickActions({ role }: { role: Role }) {
  const actions: Array<{ title: string; description: string; href: string; icon: ReactNode; tone: "teal" | "coral" | "amber" | "indigo" }> = [];
  const add = (module: string, action: { title: string; description: string; href: string; icon: ReactNode; tone: "teal" | "coral" | "amber" | "indigo" }) => {
    if (canAccess(role, module)) actions.push(action);
  };

  add("patients", { title: "Register patient", description: "Add a patient and contact details", href: "/patients", icon: <UserPlus className="h-5 w-5" />, tone: "teal" });
  add("appointments", { title: "Book appointment", description: "Schedule or update a visit", href: "/appointments", icon: <CalendarCheck className="h-5 w-5" />, tone: "amber" });
  add("clinical", { title: "Open clinical records", description: "Review charts and treatment plans", href: "/clinical", icon: <ClipboardList className="h-5 w-5" />, tone: "indigo" });
  add("billing", { title: "Record payment", description: "Review invoices and payments", href: "/billing", icon: <Coins className="h-5 w-5" />, tone: "coral" });
  add("users", { title: "Manage staff", description: "Create accounts and update access", href: "/users", icon: <Users className="h-5 w-5" />, tone: "teal" });
  add("inventory", { title: "Review stock", description: "Check supplies and stock movements", href: "/inventory", icon: <Package className="h-5 w-5" />, tone: "amber" });
  add("reports", { title: "Open reports", description: "Review clinic activity and collections", href: "/reports", icon: <ClipboardList className="h-5 w-5" />, tone: "indigo" });

  return (
    <SectionCard title="Quick actions">
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map(action => (
          <Link key={action.href} href={action.href} className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3 transition-all hover:-translate-y-0.5 hover:bg-accent/50 hover:shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ACTION_TONES[action.tone]}`}>
              {action.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{action.title}</p>
              <p className="truncate text-xs text-muted-foreground">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

const ACTION_TONES: Record<string, string> = {
  teal: "bg-primary/10 text-primary",
  coral: "bg-[oklch(0.62_0.14_25_/_0.12)] text-[oklch(0.55_0.16_25)]",
  amber: "bg-[oklch(0.82_0.12_75_/_0.15)] text-[oklch(0.62_0.12_75)]",
  indigo: "bg-[oklch(0.55_0.1_290_/_0.12)] text-[oklch(0.5_0.12_290)]",
};
