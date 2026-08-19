import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * Figma-inspired stat card: white card, tinted rounded icon tile,
 * soft shadow, value + delta.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "teal",
}: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon: ReactNode;
  tone?: "teal" | "coral" | "amber" | "indigo";
}) {
  const tones: Record<string, string> = {
    teal: "bg-primary/10 text-primary",
    coral: "bg-[oklch(0.62_0.14_25_/_0.12)] text-[oklch(0.55_0.16_25)]",
    amber: "bg-[oklch(0.82_0.12_75_/_0.15)] text-[oklch(0.62_0.12_75)]",
    indigo: "bg-[oklch(0.55_0.1_290_/_0.12)] text-[oklch(0.5_0.12_290)]",
  };
  return (
    <div className="rounded-2xl bg-card text-card-foreground border border-border/60 p-5 shadow-[0_2px_12px_-4px_rgba(13,60,67,0.08)] transition-all hover:shadow-[0_6px_20px_-6px_rgba(13,60,67,0.12)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={cn("h-10 w-10 rounded-xl flex items-center justify-center", tones[tone])}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-rose-50 text-rose-600 border-rose-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  denied: "bg-rose-50 text-rose-700 border-rose-200",
  planned: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  decay: "bg-rose-50 text-rose-700 border-rose-200",
  filling: "bg-blue-50 text-blue-700 border-blue-200",
  crown: "bg-violet-50 text-violet-700 border-violet-200",
  extraction: "bg-slate-100 text-slate-600 border-slate-200",
  implant: "bg-indigo-50 text-indigo-700 border-indigo-200",
  root_canal: "bg-orange-50 text-orange-700 border-orange-200",
  missing: "bg-slate-100 text-slate-500 border-slate-200",
  veneers: "bg-teal-50 text-teal-700 border-teal-200",
  bridge: "bg-purple-50 text-purple-700 border-purple-200",
  payment: "bg-emerald-50 text-emerald-700 border-emerald-200",
  refund: "bg-rose-50 text-rose-700 border-rose-200",
  stock_in: "bg-emerald-50 text-emerald-700 border-emerald-200",
  stock_out: "bg-rose-50 text-rose-700 border-rose-200",
  adjustment: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-rose-50 text-rose-700 border-rose-200",
  admin: "bg-indigo-50 text-indigo-700 border-indigo-200",
  dentist: "bg-teal-50 text-teal-700 border-teal-200",
  receptionist: "bg-blue-50 text-blue-700 border-blue-200",
  staff: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize font-medium text-[11px] px-2 py-0.5 rounded-full",
        style,
        className,
      )}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background/50 p-10 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-card text-card-foreground border border-border/60 shadow-[0_2px_12px_-4px_rgba(13,60,67,0.08)]",
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <h2 className="font-semibold text-sm tracking-tight">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
