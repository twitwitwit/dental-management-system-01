import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ToothGlyph } from "./ToothGlyph";
import { formatToothNumber, NotationSystem } from "@/lib/dentalNotation";

/**
 * Adult dentition chart (FDI notation, 32 teeth) laid out like the reference
 * odontogram export: each arch is one continuous row — the glyphs carry their
 * own cream bone and pink gum-base layers, so adjacent teeth visually join
 * into one continuous arch band. FDI numbers sit above the upper arch and
 * below the lower arch.
 *
 * Added features mirroring the reference React Advanced Odontogram:
 *  - Status / Plan layer: current findings render solid; planned treatments
 *    render as a dashed outline overlay (`planConditions`).
 *  - Visibility toggles: `showBone`, `showPulp`, `showWisdom`.
 *  - Click selection preserved, chart auto-fits its container width.
 */
export const CONDITION_COLORS: Record<string, string> = {
  healthy: "#10b981",
  decay: "#ef4444",
  filling: "#3b82f6",
  crown: "#8b5cf6",
  extraction: "#94a3b8",
  implant: "#6366f1",
  root_canal: "#f97316",
  missing: "#cbd5e1",
  veneers: "#14b8a6",
  bridge: "#a855f7",
};

/** Condition fill -> stroke contrast pair used for highlights. */
export const CONDITION_STROKE: Record<string, string> = {
  healthy: "#047857",
  decay: "#b91c1c",
  filling: "#1d4ed8",
  crown: "#6d28d9",
  extraction: "#475569",
  implant: "#4338ca",
  root_canal: "#c2410c",
  missing: "#94a3b8",
  veneers: "#0f766e",
  bridge: "#7e22ce",
};

/** Upper arch left-to-right: 18..11 then 21..28. Lower arch: 48..41 then 31..38. */
const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export type ToothMap = Record<string, string>; // toothNumber -> condition key

/** Quick selection presets, like the reference odontogram's quick groups. */
export const CHART_PRESETS = {
  all: "All teeth",
  upper: "Upper arch",
  lower: "Lower arch",
  front6: "Front six",
  molars: "All molars",
} as const;
export type ChartPreset = keyof typeof CHART_PRESETS;

export function presetTeeth(preset: ChartPreset): string[] {
  switch (preset) {
    case "all":
      return [...UPPER_ARCH, ...LOWER_ARCH].map(String);
    case "upper":
      return UPPER_ARCH.map(String);
    case "lower":
      return LOWER_ARCH.map(String);
    case "front6":
      return ["13", "12", "11", "21", "22", "23"];
    case "molars":
      return [...UPPER_ARCH, ...LOWER_ARCH].filter(n => n % 10 >= 6).map(String);
  }
}

export function ToothChart({
  conditions,
  planConditions,
  selected,
  onSelect,
  size,
  gap = 6,
  showBone = true,
  showPulp = true,
  showWisdom = true,
  notation = "fdi",
}: {
  conditions: ToothMap;
  /** Planned-treatment layer: toothNumber -> condition (rendered dashed). */
  planConditions?: ToothMap;
  selected?: string | null;
  onSelect?: (toothNumber: string) => void;
  /** per-cell size in px; auto-fits the container when omitted */
  size?: number;
  gap?: number;
  showBone?: boolean;
  showPulp?: boolean;
  showWisdom?: boolean;
  notation?: NotationSystem;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [autoWidth, setAutoWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setAutoWidth(e.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const cols = 16;
  const width = autoWidth ?? 0;
  // Auto-fit the 16-tooth row to the container; the explicit `size` prop is
  // only used as an upper cap (used by the reference-size export view).
  const cellSize = width > 0
    ? Math.floor((width - (cols - 1) * gap) / cols)
    : Math.min(size ?? 40, 72);
  const clamped = Math.max(30, Math.min(cellSize, size ?? 72));

  function renderArch(arch: number[], isUpper: boolean) {
    return (
      <div key={isUpper ? "upper" : "lower"} className="relative" style={{ width }}>
        {/* FDI / Universal / Palmer number row */}
        <div
          className="grid justify-items-center"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            columnGap: gap,
            height: 18,
          }}
        >
          {arch.map(n => (
            <span
              key={n}
              className={cn(
                "text-[11px] font-bold leading-none select-none",
                selected === String(n) ? "text-primary font-black" : "text-slate-500",
              )}
              style={{ width: cellSize }}
            >
              {formatToothNumber(n, notation)}
            </span>
          ))}
        </div>
        {/* teeth row — the glyphs' own bone/gum layers adjoin side by side
            to form the continuous arch band, like the reference export */}
        {/* glyph cell: width x (width * 1.75) — the taller cell gives the
            crown room while the roots and gingiva extend without being
            clipped; the arch band itself is formed by the glyphs' own layers */}
        <div className="relative" style={{ height: Math.round(clamped * 1.75) + 8 }}>
          <div
            className="justify-items-center relative"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              columnGap: gap,
            }}
          >
            {arch.map(n => {
              const isWisdom = n % 10 === 8;
              const hidden = isWisdom && !showWisdom;
              const cond = conditions[String(n)];
              const planCond = planConditions?.[String(n)];
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => !hidden && onSelect?.(String(n))}
                  aria-label={`Tooth ${n}`}
                  className={cn(
                    "relative rounded-md transition-all duration-200",
                    hidden ? "pointer-events-none opacity-0" : "cursor-pointer",
                    selected === String(n) && !hidden && "scale-105",
                  )}
                  style={{
                    width: clamped,
                    height: Math.round(clamped * 1.75),
                    marginTop: isUpper ? 0 : Math.round(clamped * 0.55),
                    zIndex: selected === String(n) && !hidden ? 10 : 1,
                    overflow: "visible",
                  }}
                >
                  <svg
                    viewBox="0 0 44 90"
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {cond ? (
                      <ToothGlyph
                        number={n}
                        fill={CONDITION_COLORS[cond]}
                        stroke={CONDITION_STROKE[cond]}
                        cond={cond}
                        selected={selected === String(n)}
                        showBone={showBone}
                        showPulp={showPulp}
                      />
                    ) : !planCond ? (
                      /* ghost outline: a healthy, faint tooth so the full 32-tooth
                         arch reads like a real odontogram even without data */
                      <ToothGlyph
                        number={n}
                        cond="healthy"
                        selected={false}
                        showBone={showBone}
                        showPulp={showPulp}
                        opacity={0.3}
                      />
                    ) : null}
                    {planCond && (
                      <ToothGlyph
                        number={n}
                        fill="none"
                        stroke={planCond === "missing" || planCond === "extraction" ? "#94a3b8" : CONDITION_STROKE[planCond]}
                        cond={planCond}
                        selected={false}
                        plan
                        showBone={showBone}
                        showPulp={showPulp}
                      />
                    )}
                  </svg>
                  {selected === String(n) && !hidden && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-10 bg-primary rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="w-full">
      {/* keep roots/crowns from colliding with surrounding controls */}
      <div style={{ padding: "8px 0" }}>
      <div className="mx-auto" style={{ width: width || 640 }}>
        {renderArch(UPPER_ARCH, true)}
        {/* inter-arch spacing (midline gap, like the reference export) */}
        <div style={{ height: 20 }} />
        {renderArch(LOWER_ARCH, false)}
      </div>
      </div>
    </div>
  );
}
