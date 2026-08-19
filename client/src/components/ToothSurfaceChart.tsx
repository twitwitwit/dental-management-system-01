import { cn } from "@/lib/utils";
import { CONDITION_COLORS } from "./ToothChart";

/**
 * Per-surface dental charting (Dentsoftware style).
 *
 * Each tooth is drawn as a square divided into 5 segments:
 *   left   = mesial,  right  = distal
 *   top    = buccal,  bottom = lingual,  center = occlusal
 *
 * Clicking a surface opens the condition palette for that surface; "Healthy"
 * clears the surface (returns it to healthy/white). Whole-tooth conditions
 * (crown, extraction, implant, root_canal, missing, bridge, veneers) are
 * handled at tooth level via ToothChart; here we use the diagnostic palette.
 */
export type SurfaceKey = "mesial" | "distal" | "buccal" | "lingual" | "occlusal";

export const SURFACES: SurfaceKey[] = ["buccal", "mesial", "occlusal", "distal", "lingual"];

/** Surfaces meaningful for diagnostic/operative charting (excludes prosthetic). */
export const DIAGNOSTIC_CONDITIONS = [
  "decay",
  "filling",
  "missing",
] as const;

export type SurfaceMap = Record<string, Record<SurfaceKey, string>>; // toothNumber -> surface -> condition

/** SVG geometry for the 5 segments inside a 100x100 square. */
function SegmentPath({ surface }: { surface: SurfaceKey }): string {
  switch (surface) {
    case "mesial":
      return "M0,0 L40,0 L40,25 L25,25 L25,75 L40,75 L40,100 L0,100 Z";
    case "distal":
      return "M100,0 L60,0 L60,25 L75,25 L75,75 L60,75 L60,100 L100,100 Z";
    case "buccal":
      return "M0,0 L100,0 L100,40 L75,40 L75,25 L25,25 L25,40 L0,40 Z";
    case "lingual":
      return "M0,100 L100,100 L100,60 L75,60 L75,75 L25,75 L25,60 L0,60 Z";
    case "occlusal":
      return "M25,25 L75,25 L75,75 L25,75 Z";
  }
}

/** Default fill when no condition is recorded (treat as healthy). */
const HEALTHY_FILL = "#f8fafc";
const HEALTHY_STROKE = "#cbd5e1";

/**
 * A single tooth rendered as the 5-segment surface diagram.
 */
function SurfaceTooth({
  number,
  surfaces,
  activeSurface,
  onSurfaceClick,
  selected,
}: {
  number: number;
  surfaces?: Record<SurfaceKey, string>;
  activeSurface?: SurfaceKey | null;
  onSurfaceClick?: (surface: SurfaceKey) => void;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center rounded-lg border bg-white transition-all duration-200",
        selected ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-slate-200",
      )}
      style={{ width: 52, height: 58 }}
    >
      <svg viewBox="0 0 100 100" className="w-10 h-10 mt-0.5">
        {SURFACES.map(surface => {
          const cond = surfaces?.[surface];
          const isUnhealthy = cond && cond !== "healthy";
          const fill = isUnhealthy ? (CONDITION_COLORS[cond] ?? HEALTHY_FILL) : HEALTHY_FILL;
          const stroke = isUnhealthy ? "#0f172a" : HEALTHY_STROKE;
          const active = activeSurface === surface;
          return (
            <path
              key={surface}
              d={SegmentPath({ surface })}
              fill={fill}
              stroke={stroke}
              strokeWidth={active ? 2.5 : 1.2}
              opacity={active ? 1 : isUnhealthy ? 1 : 0.9}
              style={{ cursor: "pointer", transition: "fill 150ms ease" }}
              onClick={() => onSurfaceClick?.(surface)}
            />
          );
        })}
      </svg>
      <span className="absolute bottom-0.5 text-[10px] font-semibold text-slate-500">{number}</span>
    </div>
  );
}

/**
 * Full dentition surface chart: 32 teeth (FDI), each drawn as the 5-segment
 * diagram. Clicking a surface fires onSelect(toothNumber, surface).
 */
export function ToothSurfaceChart({
  surfaces,
  selectedTooth,
  activeSurface,
  onSelect,
  onClickTooth,
}: {
  /** toothNumber -> surface -> condition */
  surfaces: SurfaceMap;
  selectedTooth?: string | null;
  activeSurface?: SurfaceKey | null;
  onSelect?: (toothNumber: string, surface: SurfaceKey) => void;
  onClickTooth?: (toothNumber: string) => void;
}) {
  const QUADRANTS = [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28],
    [31, 32, 33, 34, 35, 36, 37, 38],
    [48, 47, 46, 45, 44, 43, 42, 41],
  ];

  return (
    <div className="w-full overflow-x-auto">
      <div className="mx-auto relative" style={{ width: 8 * 60 + 8 }}>
        {QUADRANTS.map((quadrant, qi) => (
          <div
            key={qi}
            className="grid grid-cols-8"
            style={{ gap: 8, marginBottom: qi === 1 ? 12 : 8 }}
          >
            {quadrant.map(number => (
              <SurfaceTooth
                key={number}
                number={number}
                surfaces={surfaces[number]}
                activeSurface={selectedTooth === String(number) ? activeSurface ?? null : null}
                onSurfaceClick={surface => onSelect?.(String(number), surface)}
                selected={selectedTooth === String(number)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
