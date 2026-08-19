import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { pdColor, type PerioCell } from "./PerioChart";

/**
 * Dialog for recording the periodontal status of a single tooth: the six
 * standard probing pocket depths (mesiobuccal / buccal / distobuccal above,
 * mesiolingual / lingual / distolingual below), plus recession, mobility,
 * bleeding on probing and plaque. Mirrors the probing workflow of the
 * reference React Advanced Odontogram's periodontal module.
 */
export function PerioDialog({
  open,
  onOpenChange,
  toothNumber,
  existing,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toothNumber: string;
  existing: PerioCell | null;
  saving: boolean;
  onSave: (data: {
    pd: [number, number, number, number, number, number];
    recession?: number;
    mobility?: "0" | "1" | "2" | "3";
    bleeding?: boolean;
    plaque?: boolean;
  }) => void;
}) {
  const [pd, setPd] = useState<[number, number, number, number, number, number]>([0, 0, 0, 0, 0, 0]);
  const [recession, setRecession] = useState(0);
  const [mobility, setMobility] = useState<"0" | "1" | "2" | "3">("0");
  const [bleeding, setBleeding] = useState(false);
  const [plaque, setPlaque] = useState(false);

  useEffect(() => {
    if (open) {
      const p = existing?.pd ?? [0, 0, 0, 0, 0, 0];
      setPd([...p] as [number, number, number, number, number, number]);
      setRecession(existing?.recession ?? 0);
      setMobility((existing?.mobility as "0" | "1" | "2" | "3") ?? "0");
      setBleeding(existing?.bleeding ?? false);
      setPlaque(existing?.plaque ?? false);
    }
  }, [open, existing]);

  const maxPd = Math.max(...pd);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Periodontal status — tooth {toothNumber}
            {maxPd > 0 && (
              <span className="ml-2 text-xs font-medium" style={{ color: pdColor(maxPd) }}>
                deepest {maxPd} mm
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3.5"
          onSubmit={e => {
            e.preventDefault();
            onSave({
              pd,
              recession: recession ?? 0,
              mobility,
              bleeding,
              plaque,
            });
          }}
        >
          <div className="rounded-lg bg-muted/50 p-3">
            <Label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Probing depths (mm) — six sites
            </Label>
            {/* mesiobuccal / buccal / distobuccal */}
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i}>
                  <span className="mb-0.5 block text-center text-[10px] text-muted-foreground">
                    {["Mesiobuccal", "Buccal", "Distobuccal"][i]}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={25}
                    value={pd[i]}
                    onChange={e => {
                      const v = Number(e.target.value) || 0;
                      setPd(prev => [...prev.slice(0, i), v, ...prev.slice(i + 1)] as [number, number, number, number, number, number]);
                    }}
                    className={cn("h-8 text-center text-sm font-semibold")}
                    style={{ color: pdColor(pd[i]) }}
                  />
                </div>
              ))}
            </div>
            {/* mesiolingual / lingual / distolingual */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[3, 4, 5].map(i => (
                <div key={i}>
                  <span className="mb-0.5 block text-center text-[10px] text-muted-foreground">
                    {["Mesiolingual", "Lingual", "Distolingual"][i - 3]}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={25}
                    value={pd[i]}
                    onChange={e => {
                      const v = Number(e.target.value) || 0;
                      setPd(prev => [...prev.slice(0, i), v, ...prev.slice(i + 1)] as [number, number, number, number, number, number]);
                    }}
                    className={cn("h-8 text-center text-sm font-semibold")}
                    style={{ color: pdColor(pd[i]) }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              ≤3 mm healthy · 4–5 mm watch · &gt;5 mm deep pocket
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="grid gap-1.5">
              <Label>Recession (mm)</Label>
              <Input
                type="number"
                min={0}
                max={25}
                value={recession}
                onChange={e => setRecession(Number(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mobility</Label>
              <Select value={mobility} onValueChange={v => setMobility(v as "0" | "1" | "2" | "3")}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 — none</SelectItem>
                  <SelectItem value="1">1 — slight</SelectItem>
                  <SelectItem value="2">2 — moderate</SelectItem>
                  <SelectItem value="3">3 — severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={bleeding} onCheckedChange={setBleeding} id="perio-bleeding" />
              <Label htmlFor="perio-bleeding" className="text-xs">Bleeding on probing</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={plaque} onCheckedChange={setPlaque} id="perio-plaque" />
              <Label htmlFor="perio-plaque" className="text-xs">Plaque present</Label>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save periodontal status
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
