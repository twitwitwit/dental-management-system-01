import { useMemo } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import AccessDenied from "./AccessDenied";
import { EmptyState, SectionCard } from "@/components/dental";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/format";
import { canAccess, useCurrentRole } from "@/lib/roles";
import { useAuth } from "@/_core/hooks/useAuth";

type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "no_show";

type StatusMeta = {
  label: string;
  className: string;
  icon: typeof Clock3;
};

const STATUS_META: Record<AppointmentStatus, StatusMeta> = {
  scheduled: {
    label: "Scheduled",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: Clock3,
  },
  confirmed: {
    label: "Confirmed",
    className: "border-teal-200 bg-teal-50 text-teal-700",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: CheckCircle2,
  },
  no_show: {
    label: "No-show",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
};

function getLocalDateString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export default function Dashboard() {
  const role = useCurrentRole();
  const { user } = useAuth();
  const hasAccess = canAccess(role, "dashboard");
  const today = getLocalDateString();

  const statsQuery = trpc.dashboard.stats.useQuery(undefined, {
    enabled: Boolean(role),
  });

  // These are existing server procedures. No backend changes are required for
  // this dashboard version.
  const appointmentsQuery = trpc.appointments.list.useQuery(
    { dateFrom: today, dateTo: today },
    {
      enabled: Boolean(role) && canAccess(role, "appointments"),
    },
  );

  const patientsQuery = trpc.patients.list.useQuery(
    {},
    {
      enabled: Boolean(role) && canAccess(role, "patients"),
    },
  );

  const patientNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const patient of patientsQuery.data ?? []) {
      map.set(patient.id, `${patient.firstName} ${patient.lastName}`);
    }
    return map;
  }, [patientsQuery.data]);

  const schedule = useMemo(
    () =>
      (appointmentsQuery.data ?? []).map(appointment => ({
        ...appointment,
        patientName:
          patientNameById.get(appointment.patientId) ??
          `Patient #${appointment.patientId}`,
        provider: appointment.dentistId
          ? `Provider #${appointment.dentistId}`
          : "Unassigned",
        status: appointment.status as AppointmentStatus,
      })),
    [appointmentsQuery.data, patientNameById],
  );

  const counts = useMemo(
    () =>
      schedule.reduce(
        (result, appointment) => {
          result[appointment.status] += 1;
          return result;
        },
        { scheduled: 0, confirmed: 0, completed: 0, no_show: 0 } as Record<
          AppointmentStatus,
          number
        >,
      ),
    [schedule],
  );

  const stats = statsQuery.data?.stats;
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const isLoading = statsQuery.isLoading || appointmentsQuery.isLoading;
  const hasError = Boolean(statsQuery.error || appointmentsQuery.error);

  const attentionItems = [
    counts.no_show > 0
      ? {
          tone: "rose",
          title: `${counts.no_show} no-show appointment${counts.no_show === 1 ? "" : "s"}`,
          description: "Review the schedule and contact the patient.",
          href: "/appointments",
        }
      : null,
    (stats?.pendingTasks ?? 0) > 0
      ? {
          tone: "amber",
          title: `${stats?.pendingTasks} open invoice${stats?.pendingTasks === 1 ? "" : "s"}`,
          description: "Follow up on outstanding billing tasks.",
          href: "/billing",
        }
      : null,
    (stats?.newPatients ?? 0) > 0
      ? {
          tone: "blue",
          title: `${stats?.newPatients} new patient${stats?.newPatients === 1 ? "" : "s"}`,
          description: "Review recently registered patient records.",
          href: "/patients",
        }
      : null,
  ].filter(Boolean) as Array<{
    tone: "rose" | "amber" | "blue";
    title: string;
    description: string;
    href: string;
  }>;

  if (!hasAccess) {
    return <AccessDenied moduleId="dashboard" />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Clinical operations
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Good morning, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatToday()}</p>
          </div>
          {canAccess(role, "appointments") && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/appointments">
                <CalendarDays className="mr-2 h-4 w-4" />
                New appointment
              </Link>
            </Button>
          )}
        </header>

        <section aria-labelledby="today-summary" className="border-y border-border/70 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="today-summary" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Today at a glance
            </h2>
            {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
          </div>
          <div className="grid grid-cols-2 divide-x divide-border/70 sm:grid-cols-4">
            <SummaryMetric label="Appointments" value={schedule.length || stats?.todayAppointments || 0} />
            <SummaryMetric label="Confirmed" value={counts.confirmed} />
            <SummaryMetric label="Completed" value={counts.completed} />
            <SummaryMetric label="No-shows" value={counts.no_show} tone={counts.no_show > 0 ? "rose" : "default"} />
          </div>
        </section>

        {hasError ? (
          <EmptyState
            title="Some dashboard data could not be loaded"
            description="The page is still available, but appointment details may be incomplete."
          />
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <SectionCard
            title="Today’s schedule"
            description="A practical view of the patients and appointments that need attention today."
            actions={
              canAccess(role, "appointments") ? (
                <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                  <Link href="/appointments">
                    View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : undefined
            }
          >
            {appointmentsQuery.isLoading ? (
              <ScheduleSkeleton />
            ) : schedule.length === 0 ? (
              <EmptyState
                title="No appointments today"
                description="The schedule is clear. Add an appointment when a patient books a visit."
                action={
                  canAccess(role, "appointments") ? (
                    <Button asChild size="sm">
                      <Link href="/appointments">Schedule appointment</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-border/70 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Time</th>
                      <th className="pb-3 pr-4 font-medium">Patient</th>
                      <th className="pb-3 pr-4 font-medium">Visit</th>
                      <th className="pb-3 pr-4 font-medium">Provider</th>
                      <th className="pb-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {schedule.map(appointment => (
                      <tr key={appointment.id} className="group">
                        <td className="whitespace-nowrap py-3.5 pr-4 align-top font-medium text-foreground">
                          {appointment.startTime}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {appointment.endTime}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 align-top">
                          <p className="font-medium text-foreground">{appointment.patientName}</p>
                          <p className="text-xs text-muted-foreground">Patient #{appointment.patientId}</p>
                        </td>
                        <td className="py-3.5 pr-4 align-top text-muted-foreground">
                          {appointment.type || "Appointment"}
                        </td>
                        <td className="py-3.5 pr-4 align-top text-muted-foreground">
                          {appointment.provider}
                        </td>
                        <td className="py-3.5 text-right align-top">
                          <AppointmentStatusBadge status={appointment.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Patient flow" description="Current movement through today’s schedule.">
              <div className="divide-y divide-border/60">
                <FlowRow label="Scheduled" value={counts.scheduled} tone="slate" />
                <FlowRow label="Confirmed" value={counts.confirmed} tone="teal" />
                <FlowRow label="Completed" value={counts.completed} tone="blue" />
                <FlowRow label="No-show" value={counts.no_show} tone="rose" />
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                The current appointment model tracks scheduled, confirmed, completed, and no-show states. Waiting-room and operatory states can be added later without changing this layout.
              </p>
            </SectionCard>

            <SectionCard title="Financial snapshot" description="Keep collections visible without letting them dominate the workspace.">
              <div className="space-y-4">
                <FinancialRow label="Collections today" value={formatMoney(stats?.todayRevenue ?? 0)} />
                <FinancialRow label="Open invoices" value={String(stats?.pendingTasks ?? 0)} />
                <FinancialRow label="Registered patients" value={String(stats?.totalPatients ?? 0)} />
              </div>
              {canAccess(role, "billing") && (
                <Button asChild variant="outline" size="sm" className="mt-5 w-full">
                  <Link href="/billing">Open billing <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              )}
            </SectionCard>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <SectionCard
            title="Needs attention"
            description="Actionable items derived from the current clinic data."
          >
            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                No urgent operational items right now.
              </div>
            ) : (
              <div className="space-y-2">
                {attentionItems.map(item => (
                  <Link key={item.title} href={item.href} className="block">
                    <div className="flex items-start gap-3 rounded-lg border border-border/70 px-4 py-3 transition-colors hover:bg-muted/40">
                      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${attentionDotClass[item.tone]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Common tasks" description="Keep frequent front-desk actions close at hand.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {canAccess(role, "patients") && (
                <TaskLink href="/patients" icon={UserPlus} label="Register patient" />
              )}
              {canAccess(role, "appointments") && (
                <TaskLink href="/appointments" icon={CalendarDays} label="Manage appointments" />
              )}
              {canAccess(role, "billing") && (
                <TaskLink href="/billing" icon={CreditCard} label="Review billing" />
              )}
              {canAccess(role, "clinical") && (
                <TaskLink href="/clinical" icon={ClipboardList} label="Open clinical records" />
              )}
              {canAccess(role, "patients") && (
                <TaskLink href="/patients" icon={Users} label="Browse patients" />
              )}
              {canAccess(role, "reports") && (
                <TaskLink href="/reports" icon={AlertCircle} label="View reports" />
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "rose";
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0 sm:px-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${tone === "rose" ? "text-rose-600" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.scheduled;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-[11px] font-medium ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function FlowRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "teal" | "blue" | "rose";
}) {
  const dotClass = {
    slate: "bg-slate-400",
    teal: "bg-teal-500",
    blue: "bg-blue-500",
    rose: "bg-rose-500",
  }[tone];
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function FinancialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

const attentionDotClass = {
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

function TaskLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof UserPlus;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid grid-cols-5 gap-4 border-b border-border/60 pb-3 last:border-0">
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="col-span-2 h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
