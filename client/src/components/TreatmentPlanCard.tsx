import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/dental";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Plus,
  Sparkles,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { CDTCodePicker } from "@/components/CDTCodePicker";
import { CDTCode } from "@shared/cdtCodes";
import { formatMoney } from "@/lib/format";
import { getPhilippineCDTFee } from "@shared/philippinesPricing";

interface TreatmentPlanCardProps {
  plan: {
    id: number;
    patientId: number;
    title: string;
    diagnosis: string | null;
    status: "planned" | "in_progress" | "completed" | "cancelled";
    estimatedCost: string;
  };
  isDentist: boolean;
}

export function TreatmentPlanCard({ plan, isDentist }: TreatmentPlanCardProps) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(true);
  const [cdtPickerOpen, setCdtPickerOpen] = useState(false);
  const [addProcDialogOpen, setAddProcDialogOpen] = useState(false);

  const [selectedTooth, setSelectedTooth] = useState("");
  const [procName, setProcName] = useState("");
  const [procCost, setProcCost] = useState("");
  const [procDescription, setProcDescription] = useState("");

  const procedures = trpc.clinical.procedures.useQuery({ planId: plan.id });

  const addProcedure = trpc.clinical.addProcedure.useMutation({
    onSuccess: () => {
      toast.success("Procedure added to treatment plan");
      utils.clinical.procedures.invalidate({ planId: plan.id });
      utils.clinical.plans.invalidate();
      setAddProcDialogOpen(false);
      setSelectedTooth("");
      setProcName("");
      setProcCost("");
      setProcDescription("");
    },
    onError: e => toast.error(e.message),
  });

  const updateProcedure = trpc.clinical.updateProcedure.useMutation({
    onSuccess: () => {
      utils.clinical.procedures.invalidate({ planId: plan.id });
    },
    onError: e => toast.error(e.message),
  });

  const updatePlanStatus = trpc.clinical.updatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plan status updated");
      utils.clinical.plans.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const handleSelectCDTCode = (code: CDTCode) => {
  setProcName(`[${code.code}] ${code.name}`);
  setProcCost(
    String(getPhilippineCDTFee(code.code, code.defaultFee)),
  );
  setProcDescription(code.description);
  setAddProcDialogOpen(true);
};

  const procs = procedures.data ?? [];
  const completedCount = procs.filter(p => p.status === "done").length;
  const totalCost = procs.reduce((acc, p) => acc + Number(p.cost || 0), 0);

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden transition-all shadow-xs">
      {/* Plan Header */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/20 border-b border-border/50">
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none min-w-0 flex-1"
          onClick={() => setExpanded(!expanded)}
        >
          <button className="text-muted-foreground hover:text-foreground">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-foreground truncate">
                {plan.title}
              </h4>
              <StatusBadge status={plan.status} />
              {procs.length > 0 && (
                <span className="text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border/60">
                  {completedCount}/{procs.length} completed
                </span>
              )}
            </div>
            {plan.diagnosis ? (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Diagnosis: {plan.diagnosis}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Est. Total</span>
            <p className="text-sm font-bold text-foreground">
              {formatMoney(totalCost || Number(plan.estimatedCost))}
            </p>
          </div>

          {isDentist && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 bg-background"
                onClick={() => setCdtPickerOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Add CDT Code
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Procedures List */}
      {expanded && (
        <div className="p-3 bg-background">
          {procedures.isLoading ? (
            <div className="py-6 flex justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : procs.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No procedures added yet.
              {isDentist && (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs gap-1"
                    onClick={() => setCdtPickerOpen(true)}
                  >
                    <Sparkles className="h-3 w-3 text-primary" />
                    Select from CDT Procedure Library
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {procs.map(proc => {
                const isDone = proc.status === "done";
                return (
                  <div
                    key={proc.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      isDone
                        ? "bg-emerald-500/5 border-emerald-200/60"
                        : "bg-card border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isDentist ? (
                        <button
                          onClick={() =>
                            updateProcedure.mutate({
                              id: proc.id,
                              data: { status: isDone ? "planned" : "done" },
                            })
                          }
                          className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                          title={isDone ? "Mark as planned" : "Mark as completed"}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="h-4.5 w-4.5 text-muted-foreground" />
                          )}
                        </button>
                      ) : (
                        <span>
                          {isDone ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                          ) : (
                            <Clock className="h-4.5 w-4.5 text-muted-foreground" />
                          )}
                        </span>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {proc.toothNumber ? (
                            <span className="font-mono text-[11px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Tooth #{proc.toothNumber}
                            </span>
                          ) : null}
                          <span
                            className={`text-sm font-medium ${
                              isDone
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {proc.procedureName}
                          </span>
                        </div>
                        {proc.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {proc.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <span className="text-sm font-semibold text-foreground">
                        {formatMoney(Number(proc.cost))}
                      </span>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {proc.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manual / CDT Procedure Confirmation Dialog */}
      <Dialog open={addProcDialogOpen} onOpenChange={setAddProcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Procedure to Treatment Plan</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              if (!procName.trim()) {
                toast.error("Procedure name is required");
                return;
              }
              addProcedure.mutate({
                planId: plan.id,
                toothNumber: selectedTooth.trim() || null,
                procedureName: procName.trim(),
                cost: Number(procCost) || 0,
                description: procDescription.trim() || null,
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label>Procedure Name *</Label>
              <Input
                value={procName}
                onChange={e => setProcName(e.target.value)}
                placeholder="e.g. [D2391] Resin Composite - 1 Surface, Posterior"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tooth # (optional)</Label>
                <Input
                  value={selectedTooth}
                  onChange={e => setSelectedTooth(e.target.value)}
                  placeholder="e.g. 16, 21, 36"
                  maxLength={4}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Standard Fee (₱) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={procCost}
                  onChange={e => setProcCost(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Clinical Notes / Description (optional)</Label>
              <Input
                value={procDescription}
                onChange={e => setProcDescription(e.target.value)}
                placeholder="e.g. Mesial-occlusal preparation under local anesthesia"
              />
            </div>

            <Button
              type="submit"
              disabled={addProcedure.isPending}
              className="gap-1.5 mt-2"
            >
              {addProcedure.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add to Plan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* CDT Code Picker Modal */}
      <CDTCodePicker
        open={cdtPickerOpen}
        onOpenChange={setCdtPickerOpen}
        onSelectCode={handleSelectCDTCode}
      />
    </div>
  );
}
