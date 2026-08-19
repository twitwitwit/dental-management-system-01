import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { formatDate, formatMoney, toDateStr } from "@/lib/format";
import { EmptyState, PageHeader, SectionCard } from "@/components/dental";
import { BarChart3, Download, Loader2, PieChart as PieIcon, Users } from "lucide-react";

const COLORS = ["#0d3c43", "#3e7c91", "#86b6c3", "#d9a441", "#b3d4dd"];

function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(r =>
      headers
        .map(h => {
          const v = r[h];
          const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    ),
  ];
  return lines.join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [month, setMonth] = useState("");

  const appointments = trpc.reports.appointments.useQuery(
    {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { enabled: !!role },
  );
  const revenue = trpc.reports.revenue.useQuery(
    { month: month || undefined },
    { enabled: !!role },
  );
  const patients = trpc.reports.patients.useQuery(undefined, { enabled: !!role });

  const canExport = role === "admin" || role === "dentist";

  const appointmentChart = useMemo(() => {
    const byDay: Record<string, { day: string; count: number }> = {};
    (appointments.data?.rows ?? []).forEach(r => {
      const d = toDateStr(r.appointmentDate);
      if (!byDay[d]) byDay[d] = { day: d, count: 0 };
      byDay[d].count += 1;
    });
    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
  }, [appointments.data]);

  const revenueChart = useMemo(() => {
    return Object.entries(revenue.data?.byMonth ?? {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, amount]) => ({ month: m, revenue: Math.round(amount) }));
  }, [revenue.data]);


  const genderData = useMemo(() => {
    return Object.entries(patients.data?.byGender ?? {}).map(([name, value]) => ({
      name: name === "unknown" ? "Not specified" : name,
      value,
    }));
  }, [patients.data]);

  const statusData = useMemo(() => {
    return Object.entries(appointments.data?.byStatus ?? {}).map(([name, value]) => ({
      name,
      value,
    }));
  }, [appointments.data]);

  const exportAppointments = () => {
    downloadCSV(
      toCSV(
        (appointments.data?.rows ?? []).map(r => ({
          date: formatDate(r.appointmentDate),
          patientId: r.patientId,
          type: r.type,
          status: r.status,
        })),
      ),
      "appointments-report.csv",
    );
  };

  const exportRevenue = () => {
    downloadCSV(
      toCSV(
        Object.entries(revenue.data?.byMonth ?? {}).map(([m, amount]) => ({
          month: m,
          revenue: amount,
        })),
      ),
      "revenue-report.csv",
    );
  };

  const exportPatients = () => {
    downloadCSV(
      toCSV(
        Object.entries(patients.data?.monthly ?? {}).map(([m, count]) => ({
          month: m,
          registrations: count,
        })),
      ),
      "patient-report.csv",
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Reports & Analytics"
        description="Appointment statistics, revenue, and patient demographics."
      />

      <div className="grid gap-6">
        <SectionCard
          title="Appointment statistics"
          actions={
            canExport ? (
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={exportAppointments}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3 mb-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-accent/60 px-3.5 py-2.5">
              <p className="text-xs text-muted-foreground">Total appointments</p>
              <p className="text-xl font-bold">
                {appointments.isLoading ? "—" : appointments.data?.total ?? 0}
              </p>
            </div>
            {Object.entries(appointments.data?.byStatus ?? {}).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-accent/60 px-3.5 py-2.5">
                <p className="text-xs text-muted-foreground capitalize">{status.replaceAll("_", " ")}</p>
                <p className="text-xl font-bold">{count}</p>
              </div>
            ))}
          </div>
          {!appointmentChart.length ? (
            <EmptyState title="No appointment data in range" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={appointmentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip
                  formatter={(v: unknown) => [`${v} appointments`, "Count"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#0d3c43" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Revenue report"
          actions={
            canExport ? (
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={exportRevenue}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3 mb-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-accent/60 px-3.5 py-2.5">
              <p className="text-xs text-muted-foreground">Total revenue (net)</p>
              <p className="text-xl font-bold">
                {revenue.isLoading ? "—" : formatMoney(revenue.data?.total ?? 0)}
              </p>
            </div>
            {Object.entries(revenue.data?.byMethod ?? {}).map(([method, amount]) => (
              <div key={method} className="rounded-xl bg-accent/60 px-3.5 py-2.5">
                <p className="text-xs text-muted-foreground capitalize">{method.replaceAll("_", " ")}</p>
                <p className="text-xl font-bold">{formatMoney(amount)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Label className="text-xs">Month</Label>
            <Input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="h-8 w-40 bg-background"
            />
            {month && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMonth("")}>
                Clear
              </Button>
            )}
          </div>
          {!revenueChart.length ? (
            <EmptyState title="No revenue data in range" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Number(v)}`} width={44} />
                <Tooltip
                  formatter={(v: unknown) => [formatMoney(Number(v)), "Revenue"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#d9a441"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#d9a441" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Patient demographics"
            actions={
              canExport ? (
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={exportPatients}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              ) : undefined
            }
          >
            <div className="grid gap-3 mb-4 sm:grid-cols-2">
              <div className="rounded-xl bg-accent/60 px-3.5 py-2.5">
                <p className="text-xs text-muted-foreground">Total patients</p>
                <p className="text-xl font-bold">
                  {patients.isLoading ? "—" : patients.data?.total ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-accent/60 px-3.5 py-2.5">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-bold">
                  {patients.isLoading ? "—" : (patients.data?.byStatus?.active ?? 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {genderData.length ? (
                <>
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                        {genderData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="space-y-1.5 text-sm">
                    {genderData.map((g, i) => (
                      <li key={g.name} className="flex items-center gap-2 capitalize">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {g.name} — {g.value}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState title="No demographic data yet" />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Appointment status mix">
            <div className="flex items-center gap-6">
              {statusData.length ? (
                <>
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                        {statusData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="space-y-1.5 text-sm">
                    {statusData.map((s, i) => (
                      <li key={s.name} className="flex items-center gap-2 capitalize">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {s.name.replaceAll("_", " ")} — {s.value}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState title="No status data yet" />
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
