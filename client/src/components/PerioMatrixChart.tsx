import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { pdColor, PerioCell, PerioMap } from "./PerioChart";
import { formatToothNumber, NotationSystem } from "@/lib/dentalNotation";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Flame,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";

interface PerioMatrixChartProps {
  perio: PerioMap;
  selectedTooth?: string | null;
  onSelectTooth?: (toothNumber: string) => void;
  notation?: NotationSystem;
  showWisdom?: boolean;
}

const UPPER_ARCH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ARCH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export function PerioMatrixChart({
  perio,
  selectedTooth,
  onSelectTooth,
  notation = "fdi",
  showWisdom = true,
}: PerioMatrixChartProps) {
  // Filter wisdom teeth if toggled off
  const upperTeeth = useMemo(
    () => (showWisdom ? UPPER_ARCH : UPPER_ARCH.filter(n => n % 10 !== 8)),
    [showWisdom]
  );
  const lowerTeeth = useMemo(
    () => (showWisdom ? LOWER_ARCH : LOWER_ARCH.filter(n => n % 10 !== 8)),
    [showWisdom]
  );

  // Compute comprehensive clinical periodontal metrics
  const stats = useMemo(() => {
    const allCells = Object.values(perio);
    const activeCells = allCells.filter(c => c.pd.some(v => v > 0));
    const allDepths = allCells.flatMap(c => c.pd.filter(v => v > 0));

    const totalSitesExamined = allDepths.length;
    const healthySites = allDepths.filter(v => v <= 3).length;
    const moderateSites = allDepths.filter(v => v >= 4 && v <= 5).length;
    const deepSites = allDepths.filter(v => v >= 6).length;

    const bleedingTeeth = allCells.filter(c => c.bleeding).length;
    const plaqueTeeth = allCells.filter(c => c.plaque).length;
    const mobilityTeeth = allCells.filter(c => c.mobility && c.mobility !== "0").length;

    const bopPercent = activeCells.length > 0 ? Math.round((bleedingTeeth / activeCells.length) * 100) : 0;
    const plaquePercent = activeCells.length > 0 ? Math.round((plaqueTeeth / activeCells.length) * 100) : 0;
    const avgPd = totalSitesExamined > 0 ? (allDepths.reduce((a, b) => a + b, 0) / totalSitesExamined).toFixed(1) : "0.0";

    // Max depth
    let maxPd = 0;
    let maxPdTooth = "";
    for (const [t, data] of Object.entries(perio)) {
      const toothMax = Math.max(...data.pd);
      if (toothMax > maxPd) {
        maxPd = toothMax;
        maxPdTooth = t;
      }
    }

    // Periodontitis stage risk
    let riskLevel: "Healthy" | "Gingivitis" | "Moderate Periodontitis" | "Severe Periodontitis" = "Healthy";
    let riskColor = "text-emerald-700 bg-emerald-500/10 border-emerald-500/20";
    if (deepSites >= 4 || maxPd >= 6) {
      riskLevel = "Severe Periodontitis";
      riskColor = "text-destructive bg-destructive/10 border-destructive/20";
    } else if (moderateSites >= 4 || bopPercent > 30) {
      riskLevel = "Moderate Periodontitis";
      riskColor = "text-amber-700 bg-amber-500/10 border-amber-500/20";
    } else if (bopPercent > 10 || moderateSites > 0) {
      riskLevel = "Gingivitis";
      riskColor = "text-amber-600 bg-amber-500/10 border-amber-500/20";
    }

    return {
      totalSitesExamined,
      healthySites,
      moderateSites,
      deepSites,
      bopPercent,
      plaquePercent,
      mobilityTeeth,
      avgPd,
      maxPd,
      maxPdTooth,
      riskLevel,
      riskColor,
    };
  }, [perio]);

  // Render probing grid row for an arch
  const renderArchGrid = (teeth: number[], archLabel: string, isUpper: boolean) => {
    return (
      <div className="rounded-xl border border-border/70 bg-card overflow-x-auto shadow-xs">
        <div className="bg-muted/30 px-3 py-2 border-b border-border/50 flex items-center justify-between">
          <span className="text-xs font-bold tracking-wide uppercase text-foreground">
            {archLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {teeth.length} teeth · Buccal & Lingual/Palatal 6-Point Probing
          </span>
        </div>

        <div className="p-3 min-w-[720px]">
          <div
            className="grid gap-1 items-stretch"
            style={{ gridTemplateColumns: `repeat(${teeth.length}, minmax(0, 1fr))` }}
          >
            {teeth.map(toothNum => {
              const toothStr = String(toothNum);
              const cell = perio[toothStr];
              const isSelected = selectedTooth === toothStr;
              const hasData = !!cell && cell.pd.some(v => v > 0);

              const buccalPd = cell ? [cell.pd[0], cell.pd[1], cell.pd[2]] : [0, 0, 0];
              const lingualPd = cell ? [cell.pd[3], cell.pd[4], cell.pd[5]] : [0, 0, 0];
              const maxToothPd = cell ? Math.max(...cell.pd) : 0;

              return (
                <div
                  key={toothNum}
                  onClick={() => onSelectTooth?.(toothStr)}
                  className={cn(
                    "flex flex-col justify-between rounded-lg border transition-all cursor-pointer select-none p-1.5 text-center relative",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                      : hasData
                      ? "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/20"
                      : "border-dashed border-border/50 bg-muted/10 hover:border-border"
                  )}
                >
                  {/* Top Indicators: BOP, Plaque, Mobility */}
                  <div className="flex items-center justify-center gap-1 h-3.5">
                    {cell?.bleeding ? (
                      <span
                        className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-200"
                        title="Bleeding on Probing (BOP)"
                      />
                    ) : null}
                    {cell?.plaque ? (
                      <span
                        className="h-2 w-2 rounded-full bg-amber-400"
                        title="Plaque Present"
                      />
                    ) : null}
                    {cell?.mobility && cell.mobility !== "0" ? (
                      <span
                        className="font-mono text-[9px] font-black text-purple-700 bg-purple-100 px-1 rounded"
                        title={`Mobility Grade ${cell.mobility}`}
                      >
                        M{cell.mobility}
                      </span>
                    ) : null}
                  </div>

                  {/* Buccal Probing Values (3 sites: MB, B, DB) */}
                  <div className="grid grid-cols-3 gap-0.5 my-1 bg-muted/40 rounded p-0.5">
                    {buccalPd.map((val, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "text-[10px] font-bold leading-tight",
                          val === 0 ? "text-muted-foreground/40" : ""
                        )}
                        style={{ color: val > 0 ? pdColor(val) : undefined }}
                      >
                        {val || "·"}
                      </span>
                    ))}
                  </div>

                  {/* Tooth Number Label */}
                  <div className="py-1 border-y border-border/50 bg-muted/20 my-0.5 rounded">
                    <span
                      className={cn(
                        "text-xs font-black tracking-tight",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {formatToothNumber(toothNum, notation)}
                    </span>
                    {cell?.recession && cell.recession > 0 ? (
                      <p className="text-[9px] font-semibold text-amber-700 leading-none mt-0.5">
                        R:{cell.recession}
                      </p>
                    ) : null}
                  </div>

                  {/* Lingual Probing Values (3 sites: ML, L, DL) */}
                  <div className="grid grid-cols-3 gap-0.5 my-1 bg-muted/40 rounded p-0.5">
                    {lingualPd.map((val, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "text-[10px] font-bold leading-tight",
                          val === 0 ? "text-muted-foreground/40" : ""
                        )}
                        style={{ color: val > 0 ? pdColor(val) : undefined }}
                      >
                        {val || "·"}
                      </span>
                    ))}
                  </div>

                  {/* Deep Pocket Badge */}
                  {maxToothPd >= 5 && (
                    <span
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full border border-background shadow-xs flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ backgroundColor: pdColor(maxToothPd) }}
                    >
                      !
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Row Guide */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground px-1 border-t border-border/40 pt-2">
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">Top row:</span> Buccal (Mesial · Mid · Distal)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">Bottom row:</span> Lingual/Palatal (Mesial · Mid · Distal)
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Periodontal Assessment Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Risk Stage */}
        <div className="p-3 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Perio Classification</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <p className={cn("mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full inline-block border", stats.riskColor)}>
            {stats.riskLevel}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.totalSitesExamined} sites examined
          </p>
        </div>

        {/* Bleeding on Probing (BOP) */}
        <div className="p-3 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">BOP (Bleeding)</span>
            <Droplets className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-foreground">{stats.bopPercent}%</span>
            <span className="text-xs text-muted-foreground font-medium">
              {stats.bopPercent <= 10 ? "Low" : stats.bopPercent <= 30 ? "Moderate" : "High"}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                stats.bopPercent <= 10 ? "bg-emerald-500" : stats.bopPercent <= 30 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${Math.min(stats.bopPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Plaque Index */}
        <div className="p-3 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Plaque Index</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-foreground">{stats.plaquePercent}%</span>
            <span className="text-xs text-muted-foreground font-medium">
              {stats.plaquePercent <= 20 ? "Clean" : "Biofilm"}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${Math.min(stats.plaquePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Probing Pocket Depths */}
        <div className="p-3 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Deep Pockets (≥5mm)</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-foreground">{stats.deepSites + stats.moderateSites}</span>
            <span className="text-xs text-muted-foreground">sites</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Avg PD: <span className="font-semibold text-foreground">{stats.avgPd} mm</span> · Max:{" "}
            <span className="font-semibold text-destructive">
              {stats.maxPd > 0 ? `${stats.maxPd}mm (#${stats.maxPdTooth})` : "None"}
            </span>
          </p>
        </div>
      </div>

      {/* Probing Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-foreground">Pocket Depths:</span>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            1–3 mm (Healthy)
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            4–5 mm (Moderate)
          </span>
          <span className="inline-flex items-center gap-1 text-destructive font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            ≥6 mm (Severe Pocket)
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> BOP
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Plaque
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-purple-700 font-bold">
            M1-M3 Mobility
          </span>
        </div>
      </div>

      {/* Upper Arch (Maxillary) */}
      {renderArchGrid(upperTeeth, "Maxillary Arch (Upper)", true)}

      {/* Lower Arch (Mandibular) */}
      {renderArchGrid(lowerTeeth, "Mandibular Arch (Lower)", false)}
    </div>
  );
}
