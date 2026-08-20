const PHILIPPINE_LOCALE = "en-PH";

export function formatMoney(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat(PHILIPPINE_LOCALE, {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatCompactMoney(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "₱0";
  if (Math.abs(n) >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1).replace(/\\.0$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `₱${(n / 1_000).toFixed(1).replace(/\\.0$/, "")}k`;
  return formatMoney(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value + (value.length === 10 ? "T00:00:00" : "")) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(PHILIPPINE_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(PHILIPPINE_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString(PHILIPPINE_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const labels: Record<string, string> = {
    no_show: "No-show",
    in_progress: "In progress",
    stock_in: "Stock in",
    stock_out: "Stock out",
    bank_transfer: "Bank transfer",
    root_canal: "Root canal",
    not_specified: "Not specified",
  };
  return labels[value] ?? value.replaceAll("_", " ").replace(/\\b\\w/g, char => char.toUpperCase());
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayLabel(): string {
  return new Date().toLocaleDateString(PHILIPPINE_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
