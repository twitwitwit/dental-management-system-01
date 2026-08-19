import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { PerioDialog } from "@/components/PerioDialog";
import { useCurrentRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { CONDITION_COLORS, presetTeeth, ToothChart, type ChartPreset } from "@/components/ToothChart";
import { PerioChart, perioSummary, type PerioCell, type PerioMap } from "@/components/PerioChart";
import {
  SurfaceKey,
  ToothSurfaceChart,
  type SurfaceMap,
} from "@/components/ToothSurfaceChart";
import {
  EmptyState,
  SectionCard,
  StatusBadge,
} from "@/components/dental";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ClipboardPlus,
  FileText,
  Loader2,
  MinusCircle,
  Pencil,
  Plus,
  ScrollText,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { TreatmentPlanCard } from "@/components/TreatmentPlanCard";
import { CDTCodePicker } from "@/components/CDTCodePicker";
import { CDTCode, getCDTCode } from "@shared/cdtCodes";

const TOOTH_CONDITIONS = [
  "healthy", "decay", "filling", "crown", "extraction",
  "implant", "root_canal", "missing", "veneers", "bridge",
];

export default function PatientDetail({ id }: { id: number }) {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [toothDialogOpen, setToothDialogOpen] = useState(false);
  const [toothCondition, setToothCondition] = useState("");
  const [toothNote, setToothNote] = useState("");
  const [activeSurface, setActiveSurface] = useState<SurfaceKey | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  // Odontogram-style controls: status vs plan layer, visibility toggles
  const [chartMode, setChartMode] = useState<"status" | "plan">("status");
  const [showBone, setShowBone] = useState(true);
  const [showPulp, setShowPulp] = useState(true);
  const [showWisdom, setShowWisdom] = useState(true);
  const [perioSelected, setPerioSelected] = useState<string | null>(null);
  const [perioDialogOpen, setPerioDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"status" | "plan">("status");
  const [bulkGroup, setBulkGroup] = useState<string[] | null>(null);

  // Treatment plan & CDT states
  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanDiagnosis, setNewPlanDiagnosis] = useState("");
  const [newPlanProcedures, setNewPlanProcedures] = useState<
    { toothNumber: string; code: string; name: string; cost: number; description: string }[]
  >([]);
  const [newPlanCdtPickerOpen, setNewPlanCdtPickerOpen] = useState(false);
  const [toothCdtPickerOpen, setToothCdtPickerOpen] = useState(false);

  const patient = trpc.patients.get.useQuery({ id }, { enabled: !!role && !!id });
  const conditions = trpc.clinical.toothConditions.useQuery(
    { patientId: id },
    { enabled: !!role },
  );
  const isDentist = role === "admin" || role === "dentist";
  const surfaces = trpc.clinical.surfaces.useQuery(
    { patientId: id },
    { enabled: !!role && isDentist },
  );
  const plans = trpc.clinical.plans.useQuery(
    { patientId: id },
    { enabled: !!role },
  );
  const notes = trpc.clinical.notes.useQuery(
    { patientId: id },
    { enabled: !!role },
  );
  const perio = trpc.clinical.perio.useQuery(
    { patientId: id },
    { enabled: !!role && isDentist },
  );
  const insurances = trpc.insurance.patientInsurance.useQuery(
    { patientId: id },
    { enabled: !!role },
  );

  const setTooth = trpc.clinical.setToothCondition.useMutation({
    onSuccess: () => {
      toast.success("Tooth condition saved");
      setToothDialogOpen(false);
      utils.clinical.toothConditions.invalidate({ patientId: id });
    },
    onError: e => toast.error(e.message),
  });

  const setPerio = trpc.clinical.setPerio.useMutation({
    onSuccess: () => {
      toast.success("Periodontal status saved");
      setPerioDialogOpen(false);
      utils.clinical.perio.invalidate({ patientId: id });
    },
    onError: e => toast.error(e.message),
  });
  const setToothBulk = trpc.clinical.setToothConditionsBulk.useMutation({
    onSuccess: () => {
      toast.success("Condition applied to selected teeth");
      setToothDialogOpen(false);
      setBulkGroup(null);
      utils.clinical.toothConditions.invalidate({ patientId: id });
    },
    onError: e => toast.error(e.message),
  });

  const setSurface = trpc.clinical.setSurface.useMutation({
    onSuccess: () => {
      toast.success("Surface updated");
      utils.clinical.surfaces.invalidate({ patientId: id });
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
    if (!newPlanTitle.trim()) {
      toast.error("Please provide a plan title");
      return;
    }
    const estimatedCost = newPlanProcedures.reduce((acc, p) => acc + p.cost, 0);
    try {
      const res = await addPlan.mutateAsync({
        patientId: id,
        title: newPlanTitle.trim(),
        diagnosis: newPlanDiagnosis.trim() || null,
        estimatedCost,
      });
      if (res?.id && newPlanProcedures.length > 0) {
        for (const p of newPlanProcedures) {
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
      setNewPlanDialogOpen(false);
      setNewPlanTitle("");
      setNewPlanDiagnosis("");
      setNewPlanProcedures([]);
      utils.clinical.plans.invalidate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create treatment plan";
      toast.error(msg);
    }
  };

  const addNote = trpc.clinical.addNote.useMutation({
    onSuccess: () => {
      toast.success("Clinical note added");
      setNoteDialogOpen(false);
      setNoteTitle("");
      setNoteContent("");
      utils.clinical.notes.invalidate({ patientId: id });
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    document.title = patient.data
      ? `${patient.data.firstName} ${patient.data.lastName} — Dentacare`
      : "Patient — Dentacare";
  }, [patient.data]);

  if (patient.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const p = patient.data;
  if (!p) {
    return (
      <DashboardLayout>
        <div className="py-16">
          <EmptyState title="Patient not found" description="This patient record could not be located." />
        </div>
      </DashboardLayout>
    );
  }

  const condMap = (conditions.data ?? []).reduce(
    (acc, c) => {
      const key = c.mode === "plan" ? `${c.toothNumber}:plan` : c.toothNumber;
      return { ...acc, [key]: c.condition };
    },
    {} as Record<string, string>,
  );
  const statusMap: Record<string, string> = {};
  const planMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(condMap)) {
    if (k.endsWith(":plan")) planMap[k.slice(0, -5)] = v;
    else statusMap[k] = v;
  }
  const perioMap: PerioMap = (perio.data ?? []).reduce(
    (acc, p) => ({
      ...acc,
      [p.toothNumber]: {
        toothNumber: p.toothNumber,
        pd: [Number(p.pd1), Number(p.pd2), Number(p.pd3), Number(p.pd4), Number(p.pd5), Number(p.pd6)] as [number, number, number, number, number, number],
        recession: Number(p.recession),
        mobility: p.mobility,
        bleeding: Boolean(p.bleeding),
        plaque: Boolean(p.plaque),
      },
    }),
    {} as PerioMap,
  );

  const surfaceMap = (surfaces.data ?? []).reduce(
    (acc, s) => ({
      ...acc,
      [s.toothNumber]: { ...(acc[s.toothNumber] ?? {}), [s.surface]: s.condition },
    }),
    {} as SurfaceMap,
  );

  return (
    <DashboardLayout>
      <div className="mb-5">
        <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> All patients
        </Link>
      </div>

      <div className="rounded-2xl bg-card border border-border/60 shadow-[0_2px_12px_-4px_rgba(13,60,67,0.08)] p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
            {(p.firstName[0] + p.lastName[0]).toUpperCase()}
          </div>
          <div className="flex-1 min-w-56">
            <h1 className="text-lg font-bold tracking-tight">
              {p.firstName} {p.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {p.gender ? `${p.gender.charAt(0).toUpperCase() + p.gender.slice(1)}, ` : ""}
              DOB {formatDate(p.dateOfBirth)} · ID #{p.id}
            </p>
          </div>
          <StatusBadge status={p.status} />
          <div className="flex gap-2">
            {role === "admin" || role === "receptionist" ? (
              <Button variant="outline" className="gap-1.5" onClick={() => window.location.href = "/appointments"}>
                <CalendarPlus className="h-4 w-4" /> Appointment
              </Button>
            ) : null}
            {role === "admin" || role === "dentist" || role === "receptionist" ? (
              <Button variant="outline" className="gap-1.5" onClick={() => window.location.href = "/billing"}>
                <FileText className="h-4 w-4" /> Invoice
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-x-8 gap-y-2 mt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Phone" value={p.phone} />
          <Info label="Email" value={p.email} />
          <Info label="Blood type" value={p.bloodType} />
          <Info label="Allergies" value={p.allergies} />
          <Info label="Registered" value={formatDate(p.registeredAt)} className="sm:col-span-2 lg:col-span-4" />
          {p.medicalNotes ? <Info label="Medical history" value={p.medicalNotes} className="sm:col-span-2 lg:col-span-4" /> : null}
          {p.dentalNotes ? <Info label="Dental history" value={p.dentalNotes} className="sm:col-span-2 lg:col-span-4" /> : null}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clinical" disabled={!isDentist}>Clinical</TabsTrigger>
          <TabsTrigger value="notes" disabled={!isDentist}>Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Dental chart">
            {isDentist && (
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
              conditions={statusMap}
              planConditions={chartMode === "plan" ? undefined : (Object.keys(planMap).length ? planMap : undefined)}
              selected={selectedTooth}
              onSelect={n => {
                setSelectedTooth(n);
                setActiveSurface(null);
                if (isDentist) setToothDialogOpen(true);
              }}
              size={56}
              gap={3}
              showBone={showBone}
              showPulp={showPulp}
              showWisdom={showWisdom}
            />
            {isDentist && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                <span className="mr-1 text-[11px] text-muted-foreground">Quick groups:</span>
                {(Object.keys({ all: 1, upper: 1, lower: 1, front6: 1, molars: 1 }) as ChartPreset[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setBulkGroup(presetTeeth(p));
                      setToothDialogOpen(true);
                    }}
                    className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    {p === "front6" ? "Front six" : p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("clinical");
                  }}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                >
                  Perio status
                </button>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Click a tooth to record its condition.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
              {Object.entries(CONDITION_COLORS).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v }} />
                  {k.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-6">
            <SectionCard
              title="Treatment plans"
              actions={
                isDentist ? (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => addPlan.mutate({ patientId: id, title: "New Treatment Plan", diagnosis: null, estimatedCost: 0 })}>
                    <Plus className="h-3.5 w-3.5" /> New plan
                  </Button>
                ) : undefined
              }
            >
              {!plans.data?.length ? (
                <EmptyState title="No treatment plans yet" description="Plans will appear here once created." />
              ) : (
                <ul className="divide-y divide-border/70">
                  {plans.data.map(plan => (
                    <li key={plan.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{plan.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{plan.diagnosis || "No diagnosis"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            ${Number(plan.estimatedCost).toLocaleString()}
                          </p>
                          <StatusBadge status={plan.status} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Insurance coverage">
              {!insurances.data?.length ? (
                <EmptyState
                  title="No insurance on file"
                  description="Add insurance details from the Insurance module."
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {insurances.data.map(pi => (
                    <li key={pi.id} className="py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="font-medium">Policy {pi.policyNumber}</span>
                      <StatusBadge status={pi.isActive ? "active" : "inactive"} />
                      <span className="text-muted-foreground text-xs">
                        Co-pay ${Number(pi.coPay).toFixed(0)} · Deductible ${Number(pi.deductible).toFixed(0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="clinical">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Dental chart — whole tooth">
              <ToothChart conditions={condMap} size={56} gap={3} />
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Click a tooth to record its whole-tooth condition.
              </p>
            </SectionCard>
            <SectionCard
              title="Periodontal status"
              actions={
                <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: perioSummary(perioMap).color }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: perioSummary(perioMap).color }} />
                  {perioSummary(perioMap).label}
                </span>
              }
            >
              {isDentist ? (
                <>
                  <PerioChart
                    perio={perioMap}
                    selected={perioSelected}
                    onSelect={n => {
                      setPerioSelected(n);
                      setPerioDialogOpen(true);
                    }}
                    showWisdom={showWisdom}
                  />
                  <p className="mt-3 text-xs text-muted-foreground text-center">
                    Click a tooth to record the six-point probing depths (mm), recession, mobility, bleeding and plaque.
                  </p>
                </>
              ) : (
                <PerioChart perio={perioMap} showWisdom={showWisdom} />
              )}
            </SectionCard>
            <SectionCard title="Surface chart — 5 surfaces per tooth">
              <ToothSurfaceChart
                surfaces={surfaceMap}
                selectedTooth={selectedTooth}
                activeSurface={activeSurface}
                onSelect={(toothNumber, surface) => {
                  setSelectedTooth(toothNumber);
                  setActiveSurface(surface);
                  setToothDialogOpen(true);
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
            <SectionCard
              title="Treatment plans"
              actions={
                isDentist ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setNewPlanTitle("");
                      setNewPlanDiagnosis("");
                      setNewPlanProcedures([]);
                      setNewPlanDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> New Treatment Plan
                  </Button>
                ) : undefined
              }
            >
              {!plans.data?.length ? (
                <div className="py-8 text-center">
                  <EmptyState
                    title="No treatment plans yet"
                    description="Create a phased treatment plan with ADA/CDT procedure codes."
                  />
                  {isDentist && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setNewPlanTitle("");
                          setNewPlanDiagnosis("");
                          setNewPlanProcedures([]);
                          setNewPlanDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Create First Treatment Plan
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {plans.data.map(plan => (
                    <TreatmentPlanCard
                      key={plan.id}
                      plan={plan}
                      isDentist={isDentist}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <SectionCard
            title="Clinical notes"
            actions={
              isDentist ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNoteDialogOpen(true)}>
                  <ScrollText className="h-4 w-4" /> Add note
                </Button>
              ) : undefined
            }
          >
            {!notes.data?.length ? (
              <EmptyState title="No clinical notes yet" description="Notes recorded after visits will appear here." />
            ) : (
              <ul className="divide-y divide-border/70">
                {notes.data.map(n => (
                  <li key={n.id} className="py-3.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold">{n.title || "Note"}</p>
                      <span className="text-xs text-muted-foreground">{formatDate(n.noteDate)}</span>
                    </div>
                    {n.content ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Tooth / surface condition dialog */}
      <Dialog
        open={toothDialogOpen}
        onOpenChange={open => {
          setToothDialogOpen(open);
          if (!open) {
            setActiveSurface(null);
            setBulkGroup(null);
            setToothCondition("");
            setToothNote("");
            setDialogMode(chartMode);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkGroup ? `${bulkGroup.length} teeth selected` : `Tooth ${selectedTooth}`}
              {activeSurface ? ` — ${activeSurface} surface` : " — record condition"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              if (!selectedTooth && !bulkGroup?.length) return;
              const tn = selectedTooth ?? "";
              const cond = (toothCondition || "healthy") as "healthy";
              if (activeSurface) {
                setSurface.mutate({
                  patientId: id,
                  toothNumber: tn,
                  surface: activeSurface,
                  condition: cond,
                  note: toothNote || null,
                });
                setToothDialogOpen(false);
              } else if (bulkGroup) {
                setToothBulk.mutate({
                  patientId: id,
                  teeth: bulkGroup.map(toothNumber => ({
                    toothNumber,
                    condition: cond,
                    mode: dialogMode,
                    note: toothNote || null,
                  })),
                });
              } else {
                setTooth.mutate({
                  patientId: id,
                  toothNumber: tn,
                  condition: cond,
                  mode: dialogMode,
                  note: toothNote || null,
                });
              }
            }}
          >
            {bulkGroup && !activeSurface && (
              <p className="rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                Applying to {bulkGroup.length} teeth ({bulkGroup[0]}{bulkGroup.length > 1 ? `…${bulkGroup[bulkGroup.length - 1]}` : ""})
              </p>
            )}
            {!activeSurface && !bulkGroup && (
              <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
                {(["status", "plan"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDialogMode(m)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      dialogMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {m === "status" ? "Current (status)" : "Planned (plan)"}
                  </button>
                ))}
              </div>
            )}
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
              <Input value={toothNote} onChange={e => setToothNote(e.target.value)} placeholder="e.g. [D2391] Resin Composite - 1 Surface" />
            </div>
            <Button type="submit" disabled={setTooth.isPending || setSurface.isPending || setToothBulk.isPending} className="gap-1.5">
              {setTooth.isPending || setSurface.isPending || setToothBulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}
              Save condition
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Periodontal probing dialog — 6-point charting per tooth */}
      <PerioDialog
        open={perioDialogOpen}
        onOpenChange={setPerioDialogOpen}
        toothNumber={perioSelected ?? ""}
        existing={perioSelected ? perioMap[perioSelected] ?? null : null}
        saving={setPerio.isPending}
        onSave={data => {
          if (!perioSelected) return;
          setPerio.mutate({ patientId: id, toothNumber: perioSelected, ...data });
        }}
      />

      {/* Clinical note dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add clinical note</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              addNote.mutate({
                patientId: id,
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
              <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Post-extraction check" />
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

      {/* New Treatment Plan Dialog with CDT Code Integration */}
      <Dialog open={newPlanDialogOpen} onOpenChange={setNewPlanDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Create Treatment Plan
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlanWithProcedures} className="grid gap-4 overflow-y-auto pr-1">
            <div className="grid gap-1.5">
              <Label>Plan Title *</Label>
              <Input
                value={newPlanTitle}
                onChange={e => setNewPlanTitle(e.target.value)}
                placeholder="e.g. Quadrant 1 & 2 Restorative Plan"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Diagnosis (optional)</Label>
              <Input
                value={newPlanDiagnosis}
                onChange={e => setNewPlanDiagnosis(e.target.value)}
                placeholder="e.g. Generalized moderate periodontitis, multiple interproximal caries"
              />
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
                  onClick={() => setNewPlanCdtPickerOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Add CDT Procedure...
                </Button>
              </div>

              {newPlanProcedures.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground bg-muted/20">
                  No procedures added yet. Click &quot;Add CDT Procedure&quot; to build an itemized estimate.
                </div>
              ) : (
                <div className="space-y-2">
                  {newPlanProcedures.map((proc, idx) => (
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
                          onClick={() => setNewPlanProcedures(newPlanProcedures.filter((_, i) => i !== idx))}
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
                ${newPlanProcedures.reduce((acc, p) => acc + p.cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <Button type="submit" disabled={addPlan.isPending} className="gap-1.5 mt-2">
              {addPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save Treatment Plan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* CDT Code Picker for New Treatment Plan */}
      <CDTCodePicker
        open={newPlanCdtPickerOpen}
        onOpenChange={setNewPlanCdtPickerOpen}
        onSelectCode={code => {
          setNewPlanProcedures([
            ...newPlanProcedures,
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

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">
        {value || "—"}
      </p>
    </div>
  );
}
