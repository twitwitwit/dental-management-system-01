import DashboardLayout from "@/components/DashboardLayout";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatDateTime, formatMoney } from "@/lib/format";
import { canAccess } from "@/lib/roles";
import { useCurrentRole } from "@/lib/roles";
import {
  CalendarClock,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  Coins,
  HandCoins,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import AccessDenied from "./AccessDenied";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dental";

const CHART_COLORS = ["#0d9488", "#f97316", "#64748b", "#e11d48"];

export default function Dashboard() {
  const role = useCurrentRole();
  const hasAccess = canAccess(role, "dashboard");

  const { data, isLoading, error } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: !!role,
  });

  if (!hasAccess) {
    return <AccessDenied moduleId="dashboard" />;
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Clinic Overview"
        description="Today's activity, appointment trends, and revenue at a glance."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 mb-6">
        <StatCard
          title="Today's Appointments"
          value={isLoading ? "—" : (data?.stats?.todayAppointments ?? 0)}
          subtitle="Scheduled & confirmed"
          icon={<CalendarClock className="h-5 w-5" />}
          tone="teal"
        />
        <StatCard
          title="Today's Revenue"
          value={isLoading ? "—" : formatMoney(data?.stats?.todayRevenue)}
          subtitle="Payments received"
          icon={<HandCoins className="h-5 w-5" />}
          tone="coral"
        />
        <StatCard
          title="New Patients"
          value={isLoading ? "—" : (data?.stats?.newPatients ?? 0)}
          subtitle={`of ${data?.stats?.totalPatients ?? 0} total registered`}
          icon={<UserPlus className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          title="Pending Tasks"
          value={isLoading ? "—" : (data?.stats?.pendingTasks ?? 0)}
          subtitle="Open invoices"
          icon={<ClipboardList className="h-5 w-5" />}
          tone="indigo"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5 mb-6">
        <SectionCard
          title="Appointments (last 14 days)"
          className="lg:col-span-3"
          actions={
            canAccess(role, "appointments") ? (
              <Badge variant="outline" className="text-xs font-normal">
                <Link href="/appointments">View all</Link>
              </Badge>
            ) : undefined
          }
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.trends ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => String(d).slice(5)}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(13,148,136,0.06)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Appointments" radius={[6, 6, 0, 0]} fill="#0d9488" maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Revenue by month"
          className="lg:col-span-2"
          actions={
            canAccess(role, "reports") ? (
              <Badge variant="outline" className="text-xs font-normal">
                <Link href="/reports">Reports</Link>
              </Badge>
            ) : undefined
          }
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.revenue ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
                />
                <Tooltip
                  formatter={(v: number) => formatMoney(v)}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Bar dataKey="amount" name="Revenue" radius={[6, 6, 0, 0]} fill="#f97316" maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard title="Appointments by status" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.byStatus ?? []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {(data?.byStatus ?? []).map((_entry, i) => (
                    <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {(data?.byStatus ?? []).map((s, i) => (
              <span key={s.status} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {s.status.replaceAll("_", " ")} ({s.count})
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Quick actions"
          className="lg:col-span-3"
          actions={
            canAccess(role, "patients") ? (
              <Badge variant="outline" className="text-xs font-normal">
                <Link href="/patients">Patients</Link>
              </Badge>
            ) : undefined
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {canAccess(role, "patients") && (
              <QuickActionCard
                icon={<Users className="h-5 w-5" />}
                title="Patients"
                description="Register and manage patient records"
                href="/patients"
                tone="teal"
              />
            )}
            {canAccess(role, "appointments") && (
              <QuickActionCard
                icon={<CalendarCheck className="h-5 w-5" />}
                title="Appointments"
                description="Schedule and track appointments"
                href="/appointments"
                tone="amber"
              />
            )}
            {canAccess(role, "clinical") && (
              <QuickActionCard
                icon={<ClipboardList className="h-5 w-5" />}
                title="Clinical Records"
                description="Tooth chart, plans, and notes"
                href="/clinical"
                tone="indigo"
              />
            )}
            {canAccess(role, "billing") && (
              <QuickActionCard
                icon={<Coins className="h-5 w-5" />}
                title="Billing"
                description="Invoices and payments"
                href="/billing"
                tone="coral"
              />
            )}
            {canAccess(role, "inventory") && (
              <QuickActionCard
                icon={<CalendarX className="h-5 w-5" />}
                title="Inventory"
                description="Supplies and stock levels"
                href="/inventory"
                tone="teal"
              />
            )}
            {canAccess(role, "reports") && (
              <QuickActionCard
                icon={<ClipboardList className="h-5 w-5" />}
                title="Reports"
                description="Analytics and exports"
                href="/reports"
                tone="amber"
              />
            )}
          </div>
          {error ? (
            <EmptyState title="Could not load dashboard data" description="Please try again in a moment." />
          ) : isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : data?.stats?.todayAppointments === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No appointments today"
                description="Schedule an appointment to get started."
                action={
                  canAccess(role, "appointments") ? (
                    <Link href="/appointments">
                      <span className="text-sm font-medium text-primary underline">Schedule now</span>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : null}
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  href,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  tone: "teal" | "coral" | "amber" | "indigo";
}) {
  const tones: Record<string, string> = {
    teal: "bg-primary/10 text-primary",
    coral: "bg-[oklch(0.62_0.14_25_/_0.12)] text-[oklch(0.55_0.16_25)]",
    amber: "bg-[oklch(0.82_0.12_75_/_0.15)] text-[oklch(0.62_0.12_75)]",
    indigo: "bg-[oklch(0.55_0.1_290_/_0.12)] text-[oklch(0.5_0.12_290)]",
  };
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background p-4 transition-all hover:shadow-[0_6px_20px_-6px_rgba(13,60,67,0.15)] hover:-translate-y-0.5"
    >
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </Link>
  );
}
