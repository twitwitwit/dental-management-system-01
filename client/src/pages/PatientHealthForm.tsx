import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type HealthFormResponses = {
  medicalConditions: string;
  allergies: string;
  currentMedications: string;
  previousDentalTreatment: string;
  dentalAnxiety: "none" | "mild" | "moderate" | "severe";
  smoking: "never" | "former" | "current" | "prefer_not_to_say";
  pregnancyStatus: "not_applicable" | "not_pregnant" | "pregnant" | "prefer_not_to_say";
  emergencyContactName: string;
  emergencyContactPhone: string;
  additionalNotes: string;
  consentToTreatment: boolean;
};

type PatientHealthFormTabProps = {
  onCompleted?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
};

const emptyResponses: HealthFormResponses = {
  medicalConditions: "",
  allergies: "",
  currentMedications: "",
  previousDentalTreatment: "",
  dentalAnxiety: "none",
  smoking: "prefer_not_to_say",
  pregnancyStatus: "prefer_not_to_say",
  emergencyContactName: "",
  emergencyContactPhone: "",
  additionalNotes: "",
  consentToTreatment: false,
};

function readResponses(value: unknown): Partial<HealthFormResponses> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Partial<HealthFormResponses>;
}

function fieldValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default function PatientHealthForm({
  onCompleted,
  onComplete,
  onCancel,
  className,
}: PatientHealthFormTabProps = {}) {
  const formQuery = trpc.patientPortal.healthForm.useQuery();
  const statusQuery = trpc.patientPortal.healthFormStatus.useQuery();
  const utils = trpc.useUtils();
  const saveForm = trpc.patientPortal.saveHealthForm.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.patientPortal.healthForm.invalidate(),
        utils.patientPortal.healthFormStatus.invalidate(),
      ]);
      onCompleted?.();
      onComplete?.();
    },
  });

  const initialResponses = useMemo(() => {
    const data = formQuery.data as { responses?: unknown } | null | undefined;
    return { ...emptyResponses, ...readResponses(data?.responses) };
  }, [formQuery.data]);

  const [form, setForm] = useState<HealthFormResponses>(emptyResponses);

  useEffect(() => {
    if (formQuery.data) setForm(initialResponses);
  }, [formQuery.data, initialResponses]);

  const update = <K extends keyof HealthFormResponses>(
    key: K,
    value: HealthFormResponses[K],
  ) => setForm(current => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.consentToTreatment) return;
    saveForm.mutate({ responses: form });
  };

  const isComplete = Boolean(
    (statusQuery.data as { complete?: boolean } | null | undefined)?.complete ||
      (formQuery.data as { completedAt?: string | Date | null } | null | undefined)
        ?.completedAt,
  );

  if (formQuery.isLoading || statusQuery.isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className={`space-y-6 ${className ?? ""}`}>
      <div>
        <p className="text-sm text-muted-foreground">Required before booking</p>
        <h1 className="text-2xl font-semibold">Patient health form</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete this form so the clinic can prepare safely for your visit. You
          can update your answers later if your health information changes.
        </p>
      </div>

      {isComplete && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Your health form is complete. You may continue to book an appointment.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="health-medical-conditions">Medical conditions</Label>
            <Textarea
              id="health-medical-conditions"
              rows={3}
              value={fieldValue(form.medicalConditions)}
              onChange={event => update("medicalConditions", event.target.value)}
              placeholder="For example: diabetes, hypertension, asthma, or none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-allergies">Allergies</Label>
            <Textarea
              id="health-allergies"
              rows={3}
              value={fieldValue(form.allergies)}
              onChange={event => update("allergies", event.target.value)}
              placeholder="Medicines, latex, foods, or none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-medications">Current medications</Label>
            <Textarea
              id="health-medications"
              rows={3}
              value={fieldValue(form.currentMedications)}
              onChange={event => update("currentMedications", event.target.value)}
              placeholder="List current medicines or write none"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="health-dental-history">Previous dental treatment</Label>
            <Textarea
              id="health-dental-history"
              rows={3}
              value={fieldValue(form.previousDentalTreatment)}
              onChange={event => update("previousDentalTreatment", event.target.value)}
              placeholder="Recent procedures, dental concerns, or none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-anxiety">Dental anxiety</Label>
            <select
              id="health-anxiety"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.dentalAnxiety}
              onChange={event => update("dentalAnxiety", event.target.value as HealthFormResponses["dentalAnxiety"])}
            >
              <option value="none">None</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-smoking">Smoking or tobacco use</Label>
            <select
              id="health-smoking"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.smoking}
              onChange={event => update("smoking", event.target.value as HealthFormResponses["smoking"])}
            >
              <option value="never">Never</option>
              <option value="former">Former user</option>
              <option value="current">Current user</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="health-pregnancy">Pregnancy status</Label>
            <select
              id="health-pregnancy"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.pregnancyStatus}
              onChange={event => update("pregnancyStatus", event.target.value as HealthFormResponses["pregnancyStatus"])}
            >
              <option value="not_applicable">Not applicable</option>
              <option value="not_pregnant">Not pregnant</option>
              <option value="pregnant">Pregnant</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="health-notes">Additional notes for the clinic</Label>
            <Textarea
              id="health-notes"
              rows={3}
              value={fieldValue(form.additionalNotes)}
              onChange={event => update("additionalNotes", event.target.value)}
              placeholder="Anything else your care team should know"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4">
          <h2 className="font-medium">Emergency contact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="health-emergency-name">Name</Label>
              <Input
                id="health-emergency-name"
                value={fieldValue(form.emergencyContactName)}
                onChange={event => update("emergencyContactName", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="health-emergency-phone">Phone</Label>
              <Input
                id="health-emergency-phone"
                value={fieldValue(form.emergencyContactPhone)}
                onChange={event => update("emergencyContactPhone", event.target.value)}
              />
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border p-4 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={form.consentToTreatment}
            onChange={event => update("consentToTreatment", event.target.checked)}
          />
          <span>
            I confirm that the information provided is accurate to the best of my
            knowledge and consent to the clinic using it for appointment preparation
            and dental care.
          </span>
        </label>

        {saveForm.error && <p className="text-sm text-destructive">{saveForm.error.message}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={!form.consentToTreatment || saveForm.isPending}>
            {saveForm.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isComplete ? "Update health form" : "Complete health form"}
          </Button>
        </div>
      </form>
    </section>
  );
}
