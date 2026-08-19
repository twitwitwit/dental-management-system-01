import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { CONDITION_COLORS, ToothChart } from "@/components/ToothChart";
import { SurfaceKey, ToothSurfaceChart, type SurfaceMap } from "@/components/ToothSurfaceChart";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/dental";
import {
  ClipboardPlus,
  FileText,
  Loader2,
  MinusCircle,
  Pencil,
  Plus,
  ScrollText,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { TreatmentPlanCard } from "@/components/TreatmentPlanCard";
import { CDTCodePicker } from "@/components/CDTCodePicker";
import { CDTCode } from "@shared/cdtCodes";

const TOOTH_CONDITIONS = [
  "healthy", "decay", "filling", "crown", "extraction",
  "implant", "root_canal", "missing", "veneers", "bridge",
];

export default function Clinical() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const patients = trpc.patients.list.useQuery(
    { search: search || undefined },
    { enabled: !!role },
  );

  const conditions = trpc.clinical.toothConditions.useQuery(
    { patientId: selectedPatientId ?? 0 },
    { enabled: !!role && !!selectedPatientId },
  );
  const plans = trpc.clinical.plans.useQuery(
    { patientId: selectedPatientId ?? 0 },
    { enabled: !!role && !!selectedPatientId },
  );
  const notes = trpc.clinical.notes.useQuery(
    { patientId: selectedPatientId ?? 0 },
    { enabled: !!role && !!selectedPatientId },
  );
  const canManage = role === "admin" || role === "dentist";

  // Odontogram-style controls mirrored from the patient detail chart
  const [chartMode, setChartMode] = useState<"status" | "plan">("status");
  const [showBone, setShowBone] = useState(true);
  const [showPulp, setShowPulp] = useState(true);
  const [showWisdom, setShowWisdom] = useState(true);
  const [saveMode, setSaveMode] = useState<"status" | "plan">("status");
  const surfaces = trpc.clinical.surfaces.useQuery(
    { patientId: selectedPatientId ?? 0 },
    { enabled: !!role && !!selectedPatientId && canManage },
  );

  const [toothDialog, setToothDialog] = useState(false);
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [toothCondition, setToothCondition] = useState("");
  const [toothNote, setToothNote] = useState("");
  const [activeSurface, setActiveSurface] = useState<SurfaceKey | null>(null);
  const [toothCdtPickerOpen, setToothCdtPickerOpen] = useState(false);

  const [planDialog, setPlanDialog] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planDiagnosis, setPlanDiagnosis] = useState("");
  const [planCost, setPlanCost] = useState("");
  const [planProcedures, setPlanProcedures] = useState<
    { toothNumber: string; code: string; name: string; cost: number; description: string }[]
  >([]);
  const [planCdtPickerOpen, setPlanCdtPickerOpen] = useState(false);

  const [noteDialog, setNoteDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const setTooth = trpc.clinical.setToothCondition.useMutation({
    onSuccess: () => {
      toast.success("Tooth condition saved");
      setToothDialog(false);
      utils.clinical.toothConditions.invalidate({ patientId: selectedPatientId ?? undefined });
    },
    onError: e => toast.error(e.message),
  });

  const setSurface = trpc.clinical.setSurface.useMutation({
    onSuccess: () => {
      toast.success("Surface updated");
      utils.clinical.surfaces.invalidate({ patientId: selectedPatientId ?? undefined });
    },
    onError: e => toast.error(e.message),
  });

  const addPlan = trpc.clinical.createPlan.useMutation({
    onSuccess: () => {
      utils.clinical.plans.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const addProcedureMutation = trpc.clinical.addProcedure.useMutation({
    onError: e => toast.error(e.message),
  });

  const handleCreatePlanWithProcedures = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !planTitle.trim()) {
      toast.error("Please select a patient and provide a plan title");
      return;
    }
    const estimatedCost = planProcedures.reduce((acc, p) => acc + p.cost, 0) || Number(planCost) || 0;
    try {
      const res = await addPlan.mutateAsync({
        patientId: selectedPatientId,
        title: planTitle.trim(),
        diagnosis: planDiagnosis.trim() || null,
        estimatedCost,
      });
      if (res?.id && planProcedures.length > 0) {
        for (const p of planProcedures) {
          await addProcedureMutation.mutateAsync({
            planId: res.id,
            toothNumber: p.toothNumber || null,
            procedureName: `[${p.code}] ${p.name}`,
            description: p.description || null,
            cost: p.cost,
          });
        }
      }
      toast.success("Treatment plan created successfully");
      setPlanDialog(false);
      setPlanTitle("");
      setPlanDiagnosis("");
      setPlanCost("");
      setPlanProcedures([]);
      utils.clinical.plans.invalidate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create treatment plan";
      toast.error(msg);
    }
  };

  const updatePlan = trpc.clinical.updatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plan updated");
      utils.clinical.plans.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const addNote = trpc.clinical.addNote.useMutation({
    onSuccess: () => {
      toast.success("Clinical note added");
      setNoteDialog(false);
      setNoteTitle("");
      setNoteContent("");
      utils.clinical.notes.invalidate({ patientId: selectedPatientId ?? undefined });
    },
    onError: e => toast.error(e.message),
  });


  const selectedPatient = useMemo(
    () => (patients.data ?? []).find(p => p.id === selectedPatientId) ?? null,
    [patients.data, selectedPatientId],
  );

  const condMap = useMemo(() => {
    // status layer only; plan-layer items render as the dashed plan overlay
    const map: Record<string, string> = {};
    (conditions.data ?? []).forEach(c => {
      if (c.mode === "status") map[c.toothNumber] = c.condition;
    });
    return map;
  }, [conditions.data]);

  const planMap = useMemo(() => {
    const map: Record<string, string> = {};
    (conditions.data ?? []).forEach(c => {
      if (c.mode === "plan") map[c.toothNumber] = c.condition;
    });
    return map;
  }, [conditions.data]);

  const surfaceMap = useMemo(() => {
    const map: SurfaceMap = {};
    (surfaces.data ?? []).forEach(s => {
      map[s.toothNumber] = { ...(map[s.toothNumber] ?? {}), [s.surface]: s.condition };
    });
    return map;
  }, [surfaces.data]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Clinical Records"
        description="Dental charts, treatment plans, and clinical notes. Dental assistant, dentist, and admin access."
      />

      <div className="grid gap-4 mb-6 xl:grid-cols-[280px_1fr]">
        <SectionCard title="Patients">
          <div className="relative mb-3">
            <Input
              placeholder="Search patients…"
              className="bg-background h-8 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {patients.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !patients.data?.length ? (
            <EmptyState
              title="No patients"
              description="Add patients in the Patients module first."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/patients">Patients</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {patients.data.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedPatientId === p.id
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-accent/60"
                    }`}
                  >
                    <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {(p.firstName[0] + p.lastName[0]).toUpperCase()}
                    </span>
                    <span className="truncate">
                      {p.firstName} {p.lastName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {selectedPatient ? (
          <div className="grid gap-6">
            <SectionCard
              title={`Dental chart — ${selectedPatient.firstName} ${selectedPatient.lastName}`}
              actions={
                <Button size="sm" variant="outline" asChild className="gap-1.5">
                  <Link href={`/patients/${selectedPatient.id}`}>
                    <FileText className="h-4 w-4" /> Profile
                  </Link>
                </Button>
              }
            >
              {canManage && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {/* Status / Plan layer toggle */}
                  <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
                    {(["status", "plan"] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setChartMode(m)}
                        className={cn(
                          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                          chartMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m === "status" ? "Status" : "Plan"}
                      </button>
                    ))}
                  </div>
                  {/* Visibility toggles */}
                  {(["showBone", "showPulp", "showWisdom"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (t === "showBone") setShowBone(v => !v);
                        if (t === "showPulp") setShowPulp(v => !v);
                        if (t === "showWisdom") setShowWisdom(v => !v);
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                        (t === "showBone" ? showBone : t === "showPulp" ? showPulp : showWisdom)
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {t === "showBone" ? "Bone" : t === "showPulp" ? "Pulp" : "Wisdom teeth"}
                    </button>
                  ))}
                </div>
              )}
              <ToothChart
                conditions={condMap}
                planConditions={chartMode === "plan" ? undefined : (Object.keys(planMap).length ? planMap : undefined)}
                selected={selectedTooth}
                onSelect={n => {
                  setSelectedTooth(n);
                  setActiveSurface(null);
                  if (canManage) setToothDialog(true);
                }}
                showBone={showBone}
                showPulp={showPulp}
                showWisdom={showWisdom}
              />
              {canManage && (
                <div className="mt-3 mb-1 flex items-center justify-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Saving to:</span>
                  {(["status", "plan"] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSaveMode(m)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        saveMode === m
                          ? m === "status"
                            ? "border-primary/40 bg-primary/5 text-primary"
                            : "border-orange-400/60 bg-orange-400/10 text-orange-600"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {m === "status" ? "Status (now)" : "Plan (proposed)"}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Click a tooth to record its whole-tooth condition{canManage ? " — current findings render solid, planned items dashed" : ""}.
              </p>
            </SectionCard>

            <SectionCard title="Surface chart — 5 surfaces per tooth">
              <ToothSurfaceChart
                surfaces={surfaceMap}
                selectedTooth={selectedTooth}
                activeSurface={activeSurface}
                onSelect={(toothNumber, surface) => {
                  setSelectedTooth(toothNumber);
                  setActiveSurface(surface);
                  if (canManage) setToothDialog(true);
                }}
              />
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Click a surface (mesial · distal · buccal · lingual · occlusal) to record decay or fillings per surface.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {[["decay", CONDITION_COLORS.decay], ["filling", CONDITION_COLORS.filling], ["missing", CONDITION_COLORS.missing]].map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v }} />
                    {k}
                  </span>
                ))}
                <span className="text-[11px] text-muted-foreground">· white = healthy</span>
              </div>
            </SectionCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title="Treatment plans"
                actions={
                  canManage ? (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setPlanTitle("");
                        setPlanDiagnosis("");
                        setPlanCost("");
                        setPlanProcedures([]);
                        setPlanDialog(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> New plan
                    </Button>
                  ) : undefined
                }
              >
                {!plans.data?.length ? (
                  <EmptyState
                    title="No treatment plans yet"
                    description="Create an itemized plan with ADA/CDT procedure codes."
                  />
                ) : (
                  <div className="space-y-3">
                    {plans.data.map(plan => (
                      <TreatmentPlanCard
                        key={plan.id}
                        plan={plan}
                        isDentist={canManage}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Clinical notes"
                actions={
                  canManage ? (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNoteDialog(true)}>
                      <ScrollText className="h-4 w-4" /> Add note
                    </Button>
                  ) : undefined
                }
              >
                {!notes.data?.length ? (
                  <EmptyState title="No clinical notes yet" />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {notes.data.map(n => (
                      <li key={n.id} className="py-3.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold">{n.title || "Note"}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(n.noteDate)}</span>
                        </div>
                        {n.content ? (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        ) : (
          <SectionCard title="Select a patient">
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <UserRound className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-2">
                Choose a patient from the list to view their dental chart, treatment plans, and notes.
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      {/* Tooth condition dialog */}
      <Dialog open={toothDialog} onOpenChange={setToothDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Tooth {selectedTooth}
              {activeSurface ? ` — ${activeSurface} surface` : " — record condition"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              if (!selectedTooth || !selectedPatientId) return;
              if (activeSurface) {
                setSurface.mutate({
                  patientId: selectedPatientId,
                  toothNumber: selectedTooth,
                  surface: activeSurface,
                  condition: (toothCondition || "healthy") as "healthy",
                  note: toothNote || null,
                });
                setToothDialog(false);
              } else {
                setTooth.mutate({
                  patientId: selectedPatientId,
                  toothNumber: selectedTooth,
                  condition: (toothCondition || "healthy") as "healthy",
                  note: toothNote || null,
                  mode: saveMode,
                });
              }
            }}
          >
            {activeSurface ? (
              <p className="text-xs text-muted-foreground">
                Marking the <span className="font-medium text-foreground">{activeSurface}</span> surface of tooth {selectedTooth}.
                Choose <span className="font-medium">decay</span>, <span className="font-medium">filling</span>, or
                <span className="font-medium"> healthy</span> (to clear).
              </p>
            ) : null}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>{activeSurface ? "Surface condition" : "Condition"}</Label>
                <button
                  type="button"
                  onClick={() => setToothCdtPickerOpen(true)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <Sparkles className="h-3 w-3" />
                  Select from CDT Library
                </button>
              </div>
              <Select value={toothCondition} onValueChange={setToothCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {(activeSurface
                    ? ["healthy", "decay", "filling", "missing"]
                    : TOOTH_CONDITIONS
                  ).map(c => (
                    <SelectItem key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Comment / CDT Code (optional)</Label>
              <Input value={toothNote} onChange={e => setToothNote(e.target.value)} placeholder="e.g. [D2391] Resin Composite" />
            </div>
            <Button type="submit" disabled={setTooth.isPending || setSurface.isPending} className="gap-1.5">
              {setTooth.isPending || setSurface.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}
              Save condition
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Treatment plan dialog with CDT Code Integration */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              New Treatment Plan
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlanWithProcedures} className="grid gap-3.5 overflow-y-auto pr-1">
            <div className="grid gap-1.5">
              <Label>Title *</Label>
              <Input required value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="e.g. Lower molar restoration" />
            </div>
            <div className="grid gap-1.5">
              <Label>Diagnosis (optional)</Label>
              <Textarea rows={2} value={planDiagnosis} onChange={e => setPlanDiagnosis(e.target.value)} placeholder="e.g. Occlusal pit caries on #16, #46" />
            </div>

            {/* Itemized Procedures */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Planned Procedures</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setPlanCdtPickerOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Add CDT Procedure...
                </Button>
              </div>

              {planProcedures.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground bg-muted/20">
                  No procedures added yet. Click &quot;Add CDT Procedure&quot; to build an itemized estimate.
                </div>
              ) : (
                <div className="space-y-2">
                  {planProcedures.map((proc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {proc.toothNumber ? (
                            <span className="font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              #{proc.toothNumber}
                            </span>
                          ) : null}
                          <span className="font-semibold text-foreground truncate">
                            [{proc.code}] {proc.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-foreground">${proc.cost.toFixed(2)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setPlanProcedures(planProcedures.filter((_, i) => i !== idx))}
                        >
                          <MinusCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Estimated Total Cost:</span>
              <span className="text-base font-bold text-primary">
                ${(planProcedures.reduce((acc, p) => acc + p.cost, 0) || Number(planCost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <Button type="submit" disabled={addPlan.isPending || !planTitle.trim()} className="gap-1.5 mt-2">
              {addPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Create Plan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clinical note dialog */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add clinical note</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              if (!selectedPatientId) return;
              addNote.mutate({
                patientId: selectedPatientId,
                appointmentId: null,
                dentistName: role === "dentist" ? "Attending Dentist" : null,
                title: noteTitle || null,
                content: noteContent || null,
                noteDate: new Date().toISOString().slice(0, 10),
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Post-treatment check" />
            </div>
            <div className="grid gap-1.5">
              <Label>Content</Label>
              <Textarea rows={5} value={noteContent} onChange={e => setNoteContent(e.target.value)} />
            </div>
            <Button type="submit" disabled={addNote.isPending} className="gap-1.5">
              {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Save note
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* CDT Code Picker for Plan Dialog */}
      <CDTCodePicker
        open={planCdtPickerOpen}
        onOpenChange={setPlanCdtPickerOpen}
        onSelectCode={code => {
          setPlanProcedures([
            ...planProcedures,
            {
              toothNumber: selectedTooth || "",
              code: code.code,
              name: code.name,
              cost: code.defaultFee,
              description: code.description,
            },
          ]);
        }}
        toothNumber={selectedTooth}
      />

      {/* CDT Code Picker for Tooth Dialog */}
      <CDTCodePicker
        open={toothCdtPickerOpen}
        onOpenChange={setToothCdtPickerOpen}
        onSelectCode={code => {
          let cond = "healthy";
          if (code.code.startsWith("D21") || code.code.startsWith("D23")) cond = "filling";
          else if (code.code.startsWith("D27")) cond = "crown";
          else if (code.code.startsWith("D33")) cond = "root_canal";
          else if (code.code.startsWith("D60")) cond = "implant";
          else if (code.code.startsWith("D71") || code.code.startsWith("D72")) cond = "extraction";
          else if (code.code.startsWith("D296")) cond = "veneers";
          else if (code.code.startsWith("D5") || code.code.startsWith("D62") || code.code.startsWith("D67")) cond = "bridge";
          setToothCondition(cond);
          setToothNote(`[${code.code}] ${code.name}`);
        }}
        toothNumber={selectedTooth}
        surface={activeSurface}
      />
    </DashboardLayout>
  );
}
