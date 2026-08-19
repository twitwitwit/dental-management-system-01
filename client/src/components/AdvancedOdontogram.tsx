import { useState } from "react";
import { cn } from "@/lib/utils";
import { ToothChart, ToothMap, CONDITION_COLORS, presetTeeth, ChartPreset } from "@/components/ToothChart";
import { PerioMatrixChart } from "@/components/PerioMatrixChart";
import { PerioMap } from "@/components/PerioChart";
import { ToothSurfaceChart, SurfaceMap, SurfaceKey } from "@/components/ToothSurfaceChart";
import { NotationSystem, formatToothNumber, getToothAnatomicalName } from "@/lib/dentalNotation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";

interface AdvancedOdontogramProps {
  conditions: ToothMap;
  planConditions?: ToothMap;
  surfaces?: SurfaceMap;
  perio?: PerioMap;
  selectedTooth?: string | null;
  activeSurface?: SurfaceKey | null;
  onSelectTooth?: (toothNumber: string) => void;
  onSelectSurface?: (toothNumber: string, surface: SurfaceKey) => void;
  onOpenPerioDialog?: (toothNumber: string) => void;
  onOpenToothDialog?: (toothNumber: string) => void;
  onBulkSelect?: (teeth: string[]) => void;
  chartMode?: "status" | "plan";
  onChartModeChange?: (mode: "status" | "plan") => void;
  isDentist?: boolean;
}

export function AdvancedOdontogram({
  conditions,
  planConditions = {},
  surfaces = {},
  perio = {},
  selectedTooth,
  activeSurface,
  onSelectTooth,
  onSelectSurface,
  onOpenPerioDialog,
  onOpenToothDialog,
  onBulkSelect,
  chartMode = "status",
  onChartModeChange,
  isDentist = false,
}: AdvancedOdontogramProps) {
  const [viewTab, setViewTab] = useState<"anatomical" | "perio" | "surfaces">("anatomical");
  const [notation, setNotation] = useState<NotationSystem>("fdi");
  const [showBone, setShowBone] = useState(true);
  const [showPulp, setShowPulp] = useState(true);
  const [showWisdom, setShowWisdom] = useState(true);

  const selectedToothNum = selectedTooth ? Number(selectedTooth) : null;
  const currentToothCondition = selectedTooth ? conditions[selectedTooth] || "healthy" : null;
  const plannedToothCondition = selectedTooth ? planConditions[selectedTooth] || null : null;

  return (
    <div className="space-y-4">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/70 shadow-xs">
        {/* View Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg">
          <button
            type="button"
            onClick={() => setViewTab("anatomical")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              viewTab === "anatomical"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Stethoscope className="h-3.5 w-3.5 text-primary" />
            Anatomical Chart
          </button>

          <button
            type="button"
            onClick={() => setViewTab("perio")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              viewTab === "perio"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="h-3.5 w-3.5 text-red-500" />
            Periodontal (6-Point)
          </button>

          <button
            type="button"
            onClick={() => setViewTab("surfaces")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              viewTab === "surfaces"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5 text-blue-500" />
            5-Surface Chart
          </button>
        </div>

        {/* Right Tools: Notation Selector & Status/Plan Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Notation System Switcher */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
            <span className="text-[11px] font-medium text-muted-foreground px-1.5">
              Notation:
            </span>
            {(["fdi", "universal", "palmer"] as const).map(sys => (
              <button
                key={sys}
                type="button"
                onClick={() => setNotation(sys)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-colors",
                  notation === sys
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {sys}
              </button>
            ))}
          </div>

          {/* Status vs Plan Mark Mode */}
          {onChartModeChange && (
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
              <button
                type="button"
                onClick={() => onChartModeChange("status")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs font-semibold transition-colors",
                  chartMode === "status"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Status (Current)
              </button>
              <button
                type="button"
                onClick={() => onChartModeChange("plan")}
                className={cn(
                  "px-2.5 py-0.5 rounded text-xs font-semibold transition-colors",
                  chartMode === "plan"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Plan (Planned)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Layer Toggles & Quick Preset Bar (Visible on Anatomical & Surfaces) */}
      {viewTab !== "perio" && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 text-xs">
          {/* Quick Selection Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground font-semibold flex items-center gap-1 mr-1">
              <Filter className="h-3 w-3" /> Quick Select:
            </span>
            {(
              [
                ["all", "All 32"],
                ["upper", "Upper Arch"],
                ["lower", "Lower Arch"],
                ["front6", "Anterior 6"],
                ["molars", "Molars"],
              ] as const
            ).map(([presetKey, label]) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => onBulkSelect?.(presetTeeth(presetKey as ChartPreset))}
                className="px-2 py-1 rounded bg-background hover:bg-card border border-border/60 text-[11px] font-medium text-foreground hover:border-primary/50 transition-colors shadow-2xs"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Anatomical Visibility Toggles */}
          {viewTab === "anatomical" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground font-medium mr-1">Layers:</span>
              <button
                type="button"
                onClick={() => setShowBone(!showBone)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                  showBone
                    ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30"
                    : "bg-background text-muted-foreground border-border"
                )}
              >
                Bone
              </button>
              <button
                type="button"
                onClick={() => setShowPulp(!showPulp)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                  showPulp
                    ? "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30"
                    : "bg-background text-muted-foreground border-border"
                )}
              >
                Pulp
              </button>
              <button
                type="button"
                onClick={() => setShowWisdom(!showWisdom)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                  showWisdom
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-background text-muted-foreground border-border"
                )}
              >
                Wisdom Teeth
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Chart Canvas Area */}
      <div className="p-4 rounded-xl border border-border/70 bg-card shadow-xs">
        {viewTab === "anatomical" && (
          <div>
            <ToothChart
              conditions={conditions}
              planConditions={planConditions}
              selected={selectedTooth}
              onSelect={t => {
                onSelectTooth?.(t);
                if (isDentist) onOpenToothDialog?.(t);
              }}
              showBone={showBone}
              showPulp={showPulp}
              showWisdom={showWisdom}
              notation={notation}
            />

            {/* Condition Color Legend */}
            <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-center gap-2">
              {Object.entries(CONDITION_COLORS).map(([condKey, color]) => (
                <span
                  key={condKey}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/40"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {condKey.replaceAll("_", " ")}
                </span>
              ))}
              <span className="text-[11px] text-muted-foreground">· Faint = healthy baseline</span>
            </div>
          </div>
        )}

        {viewTab === "perio" && (
          <PerioMatrixChart
            perio={perio}
            selectedTooth={selectedTooth}
            onSelectTooth={t => {
              onSelectTooth?.(t);
              if (isDentist) onOpenPerioDialog?.(t);
            }}
            notation={notation}
            showWisdom={showWisdom}
          />
        )}

        {viewTab === "surfaces" && (
          <div>
            <ToothSurfaceChart
              surfaces={surfaces}
              selectedTooth={selectedTooth}
              activeSurface={activeSurface}
              onSelect={(toothNumber, surface) => {
                onSelectTooth?.(toothNumber);
                onSelectSurface?.(toothNumber, surface);
                if (isDentist) onOpenToothDialog?.(toothNumber);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
              <span>Mesial (M)</span> · <span>Distal (D)</span> · <span>Buccal/Vestibular (B)</span> ·{" "}
              <span>Lingual/Palatal (L)</span> · <span>Occlusal/Incisal (O)</span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Tooth Quick Context Card */}
      {selectedTooth && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono text-sm font-black px-2 py-1 rounded bg-primary text-primary-foreground">
              {formatToothNumber(selectedTooth, notation)}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                Tooth {selectedTooth} — {getToothAnatomicalName(selectedTooth)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Status:{" "}
                <span className="font-semibold text-foreground capitalize">
                  {currentToothCondition?.replaceAll("_", " ") || "Healthy"}
                </span>
                {plannedToothCondition && (
                  <span className="ml-2 text-primary font-medium">
                    (Plan: {plannedToothCondition.replaceAll("_", " ")})
                  </span>
                )}
              </p>
            </div>
          </div>

          {isDentist && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-background gap-1"
                onClick={() => onOpenPerioDialog?.(selectedTooth)}
              >
                <Activity className="h-3 w-3 text-red-500" />
                6-Point Perio Probing
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onOpenToothDialog?.(selectedTooth)}
              >
                <Stethoscope className="h-3 w-3" />
                Record Condition
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
