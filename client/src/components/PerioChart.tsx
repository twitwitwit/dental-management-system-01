import { cn } from "@/lib/utils";

/**
 * Periodontal (gum) status chart, mirroring the periodontal view of the
 * reference React Advanced Odontogram: one cell per tooth showing the
 * six-point probing pocket depths, colored by severity, plus mobility,
 * bleeding-on-probing and plaque indicators.
 *
 *   <4 mm  healthy green · 4–5 mm amber · >5 mm red (periodontitis risk)
 */

export type PerioCell = {
  toothNumber: string;
  pd: [number, number, number, number, number, number];
  recession: number;
  mobility: string;
  bleeding: boolean;
  plaque: boolean;
};

export type PerioMap = Record<string, PerioCell>;

/** Pocket-depth color scale used by periodontal charts. */
export function pdColor(mm: number): string {
  if (mm <= 3) return "#10b981"; // healthy
  if (mm <= 5) return "#f59e0b"; // watch
  return "#ef4444"; // deep pocket
}

const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export function PerioChart({
  perio,
  selected,
  onSelect,
  showWisdom = true,
}: {
  perio: PerioMap;
  selected?: string | null;
  onSelect?: (toothNumber: string) => void;
  showWisdom?: boolean;
}) {
  function cell(n: string): PerioCell | null {
    return perio[n] ?? null;
  }

  function renderArch(arch: number[], isUpper: boolean) {
    return (
      <div key={isUpper ? "upper" : "lower"} className="w-full">
        {/* FDI number row */}
        <div className="grid justify-items-center" style={{ gridTemplateColumns: `repeat(16, minmax(0, 1fr))` }}>
          {arch.map(n => (
            <span key={n} className="text-[11px] font-bold text-slate-500">{n}</span>
          ))}
        </div>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(16, minmax(0, 1fr))` }}>
          {arch.map(n => {
            const c = cell(String(n));
            const hidden = n % 10 === 8 && !showWisdom;
            const maxPd = c ? Math.max(...c.pd) : null;
            const empty = !c || c.pd.every(v => v <= 0);
            return (
              <button
                key={n}
                type="button"
                disabled={hidden}
                onClick={() => onSelect?.(String(n))}
                aria-label={`Tooth ${n} periodontal status`}
                className={cn(
                  "relative rounded-md border transition-all duration-150 p-[2px]",
                  hidden && "invisible",
                  !hidden && !c
                    ? "border-dashed border-slate-300 bg-slate-50 hover:border-primary/50"
                    : "",
                  selected === String(n) && "ring-2 ring-primary",
                )}
                style={{ aspectRatio: "1 / 1.5" }}
              >
                {empty ? (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] text-slate-400">·</span>
                ) : (
                  <div className="flex flex-col h-full justify-between">
                    {/* upper probing row (1-2-3: mesiobuccal, buccal, distobuccal) */}
                    <div className="grid grid-cols-3 text-center leading-none" style={{ fontSize: 9 }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} className="font-semibold" style={{ color: pdColor(c!.pd[i]) }}>
                          {c!.pd[i]}
                        </span>
                      ))}
                    </div>
                    {/* recession indicator */}
                    <div className="flex justify-center">
                      <span className={cn(
                        "text-[8px] font-medium px-0.5 rounded",
                        (c!.recession > 0 || c!.mobility !== "0" || c!.bleeding || c!.plaque) ? "bg-amber-100 text-amber-700" : "text-transparent",
                      )}>
                        {c!.recession > 0 ? `R${c!.recession}` : "·"}
                      </span>
                    </div>
                    {/* lower probing row (4-5-6: mesiolingual, lingual, distolingual) */}
                    <div className="grid grid-cols-3 text-center leading-none" style={{ fontSize: 9 }}>
                      {[3, 4, 5].map(i => (
                        <span key={i} className="font-semibold" style={{ color: pdColor(c!.pd[i]) }}>
                          {c!.pd[i]}
                        </span>
                      ))}
                    </div>
                    {/* mobility / bleeding / plaque dots */}
                    <div className="flex justify-center gap-[2px] pt-[1px]">
                      {c!.mobility !== "0" && (
                        <span className="text-[7px] font-bold text-purple-600">M{c!.mobility}</span>
                      )}
                      {c!.bleeding && <span className="h-[5px] w-[5px] rounded-full bg-red-500" />}
                      {c!.plaque && <span className="h-[5px] w-[5px] rounded-full bg-yellow-400" />}
                    </div>
                  </div>
                )}
                {maxPd !== null && maxPd > 3 && (
                  <span className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full" style={{ backgroundColor: pdColor(maxPd) }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {renderArch(UPPER_ARCH, true)}
      <div className="h-6" />
      {renderArch(LOWER_ARCH, false)}
    </div>
  );
}

/** Overall periodontal health summary derived from per-tooth probing. */
export function perioSummary(perio: PerioMap): { label: string; color: string } {
  const depths = Object.values(perio).flatMap(c => c.pd.filter(v => v > 0));
  if (!depths.length) return { label: "Not charted", color: "#94a3b8" };
  const avg = depths.reduce((a, b) => a + b, 0) / depths.length;
  const deep = depths.filter(v => v > 5).length;
  if (deep > 0 || avg > 5) return { label: "Periodontitis risk", color: "#ef4444" };
  if (avg > 3 || depths.some(v => v >= 4)) return { label: "Watch / gingivitis", color: "#f59e0b" };
  return { label: "Healthy", color: "#10b981" };
}
