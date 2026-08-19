import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Cigarette,
  Flame,
  HeartPulse,
  Loader2,
  Phone,
  Pencil,
  ShieldAlert,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";
import type { Patient } from "@shared/types";

export type PatientFormData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other" | "";
  phone: string;
  email: string;
  address: string;
  occupation: string;
  status: "active" | "inactive";

  // Lifestyle & Habits
  smokingStatus: "never" | "former" | "current_light" | "current_heavy" | "vaping" | "chewing_tobacco";
  smokingDetails: string;
  alcoholUse: "none" | "occasional" | "moderate" | "heavy";
  bruxism: boolean;
  dentalAnxiety: "none" | "mild" | "moderate" | "severe";

  // Medical Alerts & Systemic Health
  bloodType: string;
  allergies: string;
  diabetes: string;
  bleedingDisorder: string;
  cardiovascular: string;
  isPregnant: boolean;
  currentMedications: string;
  chiefComplaint: string;

  // Emergency Contact & Notes
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  medicalNotes: string;
  dentalNotes: string;
};

const TAB_ORDER = ["personal", "lifestyle", "medical", "emergency"] as const;
type PatientTab = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<PatientTab, string> = {
  personal: "Personal & Contact",
  lifestyle: "Lifestyle & Smoker",
  medical: "Medical Alerts",
  emergency: "Emergency & Notes",
};

const defaultFormData: PatientFormData = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  occupation: "",
  status: "active",

  smokingStatus: "never",
  smokingDetails: "",
  alcoholUse: "none",
  bruxism: false,
  dentalAnxiety: "none",

  bloodType: "",
  allergies: "",
  diabetes: "",
  bleedingDisorder: "",
  cardiovascular: "",
  isPregnant: false,
  currentMedications: "",
  chiefComplaint: "",

  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  medicalNotes: "",
  dentalNotes: "",
};

interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
  onSuccess?: (patientId?: number) => void;
}

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  onSuccess,
}: PatientFormDialogProps) {
  const utils = trpc.useUtils();
  const isEdit = !!patient;
  const [activeTab, setActiveTab] = useState<PatientTab>("personal");
  const [form, setForm] = useState<PatientFormData>(defaultFormData);

  // Populate form data when dialog opens or patient changes
  useEffect(() => {
    if (open) {
      if (patient) {
        let dobStr = "";
        if (patient.dateOfBirth) {
          const d = new Date(patient.dateOfBirth);
          if (!Number.isNaN(d.getTime())) {
            dobStr = d.toISOString().slice(0, 10);
          }
        }

        setForm({
          firstName: patient.firstName || "",
          lastName: patient.lastName || "",
          dateOfBirth: dobStr,
          gender: (patient.gender as PatientFormData["gender"]) || "",
          phone: patient.phone || "",
          email: patient.email || "",
          address: patient.address || "",
          occupation: patient.occupation || "",
          status: patient.status || "active",

          smokingStatus: patient.smokingStatus || "never",
          smokingDetails: patient.smokingDetails || "",
          alcoholUse: patient.alcoholUse || "none",
          bruxism: Boolean(patient.bruxism),
          dentalAnxiety: patient.dentalAnxiety || "none",

          bloodType: patient.bloodType || "",
          allergies: patient.allergies || "",
          diabetes: patient.diabetes || "",
          bleedingDisorder: patient.bleedingDisorder || "",
          cardiovascular: patient.cardiovascular || "",
          isPregnant: Boolean(patient.isPregnant),
          currentMedications: patient.currentMedications || "",
          chiefComplaint: patient.chiefComplaint || "",

          emergencyContactName: patient.emergencyContactName || "",
          emergencyContactPhone: patient.emergencyContactPhone || "",
          emergencyContactRelation: patient.emergencyContactRelation || "",
          medicalNotes: patient.medicalNotes || "",
          dentalNotes: patient.dentalNotes || "",
        });
      } else {
        setForm(defaultFormData);
      }
      setActiveTab("personal");
    }
  }, [open, patient]);

  const createMutation = trpc.patients.create.useMutation({
    onSuccess: res => {
      toast.success("Patient registered successfully");
      utils.patients.list.invalidate();
      onOpenChange(false);
      onSuccess?.(res.id);
    },
    onError: err => {
      toast.error(err.message || "Failed to register patient");
    },
  });

  const updateMutation = trpc.patients.update.useMutation({
    onSuccess: () => {
      toast.success("Patient information updated");
      utils.patients.list.invalidate();
      if (patient?.id) {
        utils.patients.get.invalidate({ id: patient.id });
      }
      onOpenChange(false);
      onSuccess?.(patient?.id);
    },
    onError: err => {
      toast.error(err.message || "Failed to update patient");
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const activeStepIndex = TAB_ORDER.indexOf(activeTab);
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === TAB_ORDER.length - 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // The first step is the only step with required fields. Keep the user on
    // that step when they try to continue without the minimum patient identity.
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setActiveTab("personal");
      toast.error("Please enter first and last name");
      return;
    }

    // Continue through the wizard one tab at a time. Only the last step
    // reaches the mutation payload below.
    if (!isLastStep) {
      setActiveTab(TAB_ORDER[activeStepIndex + 1]);
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender ? form.gender : null,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      occupation: form.occupation.trim() || null,
      status: form.status,

      smokingStatus: form.smokingStatus,
      smokingDetails: form.smokingDetails.trim() || null,
      alcoholUse: form.alcoholUse,
      bruxism: form.bruxism,
      dentalAnxiety: form.dentalAnxiety,

      bloodType: form.bloodType.trim() || null,
      allergies: form.allergies.trim() || null,
      diabetes: form.diabetes.trim() || null,
      bleedingDisorder: form.bleedingDisorder.trim() || null,
      cardiovascular: form.cardiovascular.trim() || null,
      isPregnant: form.isPregnant,
      currentMedications: form.currentMedications.trim() || null,
      chiefComplaint: form.chiefComplaint.trim() || null,

      emergencyContactName: form.emergencyContactName.trim() || null,
      emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      emergencyContactRelation: form.emergencyContactRelation.trim() || null,
      medicalNotes: form.medicalNotes.trim() || null,
      dentalNotes: form.dentalNotes.trim() || null,
    };

    if (isEdit && patient?.id) {
      updateMutation.mutate({
        id: patient.id,
        data: payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSmoker = form.smokingStatus !== "never";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-card">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              {isEdit ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isEdit
                  ? `Edit Patient: ${patient.firstName} ${patient.lastName}`
                  : "Register New Patient"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEdit
                  ? "Update patient profile, smoking status, medical alerts, and contact details."
                  : "Enter patient demographics, dental risk factors, smoking habits, and health history."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={v => setActiveTab(v as typeof activeTab)}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 pt-3 border-b bg-muted/20">
              <TabsList className="grid grid-cols-4 h-9 bg-muted/70">
                <TabsTrigger value="personal" className="text-xs font-medium gap-1.5">
                  Personal & Contact
                </TabsTrigger>
                <TabsTrigger value="lifestyle" className="text-xs font-medium gap-1.5">
                  Lifestyle & Smoker
                </TabsTrigger>
                <TabsTrigger value="medical" className="text-xs font-medium gap-1.5">
                  Medical Alerts
                </TabsTrigger>
                <TabsTrigger value="emergency" className="text-xs font-medium gap-1.5">
                  Emergency & Notes
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* TAB 1: PERSONAL & CONTACT */}
              <TabsContent value="personal" className="space-y-4 m-0">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="firstName" className="text-xs font-bold">
                      First Name *
                    </Label>
                    <Input
                      id="firstName"
                      required
                      placeholder="e.g. John"
                      value={form.firstName}
                      onChange={e => setForm({ ...form, firstName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="lastName" className="text-xs font-bold">
                      Last Name *
                    </Label>
                    <Input
                      id="lastName"
                      required
                      placeholder="e.g. Doe"
                      value={form.lastName}
                      onChange={e => setForm({ ...form, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dob" className="text-xs font-semibold">
                      Date of Birth
                    </Label>
                    <Input
                      id="dob"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Gender</Label>
                    <Select
                      value={form.gender}
                      onValueChange={v => setForm({ ...form, gender: v as PatientFormData["gender"] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={v => setForm({ ...form, status: v as "active" | "inactive" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Phone Number</Label>
                    <Input
                      placeholder="e.g. (555) 123-4567"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="e.g. patient@example.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-xs font-semibold">Home / Mailing Address</Label>
                    <Input
                      placeholder="Street address, City, State/Province, Postal Code"
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Occupation</Label>
                    <Input
                      placeholder="e.g. Teacher, Engineer"
                      value={form.occupation}
                      onChange={e => setForm({ ...form, occupation: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: LIFESTYLE & SMOKING STATUS */}
              <TabsContent value="lifestyle" className="space-y-4 m-0">
                <div className="p-3.5 rounded-xl border bg-amber-500/5 border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Cigarette className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-bold text-foreground">
                      Tobacco & Nicotine Use (Crucial for Perio & Implant Prognosis)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold">Smoking / Tobacco Status</Label>
                      <Select
                        value={form.smokingStatus}
                        onValueChange={v =>
                          setForm({ ...form, smokingStatus: v as PatientFormData["smokingStatus"] })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Non-Smoker (Never used)</SelectItem>
                          <SelectItem value="former">Former Smoker (Quit)</SelectItem>
                          <SelectItem value="current_light">Current Smoker (Light &lt;10/day)</SelectItem>
                          <SelectItem value="current_heavy">Current Smoker (Heavy 10+/day)</SelectItem>
                          <SelectItem value="vaping">Vaping / E-Cigarettes</SelectItem>
                          <SelectItem value="chewing_tobacco">Chewing Tobacco / Smokeless</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold">
                        {isSmoker ? "Smoking History / Pack-Years / Quit Date" : "Details (Optional)"}
                      </Label>
                      <Input
                        placeholder={
                          form.smokingStatus === "former"
                            ? "e.g. Quit 2 years ago, smoked 1 pack/day for 10 yrs"
                            : isSmoker
                            ? "e.g. 1 pack/day for 5 years"
                            : "None"
                        }
                        value={form.smokingDetails}
                        onChange={e => setForm({ ...form, smokingDetails: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                  </div>

                  {isSmoker && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      * Note: Tobacco use increases risk of periodontal bone loss, delayed post-extraction healing, peri-implantitis, and oral mucosal lesions.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Alcohol Consumption</Label>
                    <Select
                      value={form.alcoholUse}
                      onValueChange={v => setForm({ ...form, alcoholUse: v as PatientFormData["alcoholUse"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None / Non-drinker</SelectItem>
                        <SelectItem value="occasional">Occasional (Socially)</SelectItem>
                        <SelectItem value="moderate">Moderate (1–2 drinks/day)</SelectItem>
                        <SelectItem value="heavy">Heavy (&gt;2 drinks/day)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Dental Anxiety / Phobia</Label>
                    <Select
                      value={form.dentalAnxiety}
                      onValueChange={v =>
                        setForm({ ...form, dentalAnxiety: v as PatientFormData["dentalAnxiety"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Comfortable)</SelectItem>
                        <SelectItem value="mild">Mild (Slightly nervous)</SelectItem>
                        <SelectItem value="moderate">Moderate (Needs reassurance/sedation)</SelectItem>
                        <SelectItem value="severe">Severe / High Phobia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground cursor-pointer">
                      Bruxism (Teeth Grinding / Clenching)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Patient grinds teeth during sleep or daytime; consider occlusal guard / nightguard.
                    </p>
                  </div>
                  <Switch
                    checked={form.bruxism}
                    onCheckedChange={checked => setForm({ ...form, bruxism: checked })}
                  />
                </div>
              </TabsContent>

              {/* TAB 3: MEDICAL ALERTS & SYSTEMIC HEALTH */}
              <TabsContent value="medical" className="space-y-4 m-0">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Known Allergies
                    </Label>
                    <Input
                      placeholder="e.g. Penicillin, Latex, Local Anesthetic, Sulfa, Codeine"
                      value={form.allergies}
                      onChange={e => setForm({ ...form, allergies: e.target.value })}
                      className={form.allergies ? "border-destructive/50 bg-destructive/5" : ""}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Blood Type</Label>
                    <Select
                      value={form.bloodType}
                      onValueChange={v => setForm({ ...form, bloodType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select (e.g. O+, A+)" />
                      </SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map(bt => (
                          <SelectItem key={bt} value={bt}>
                            {bt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Diabetes Mellitus</Label>
                    <Input
                      placeholder="e.g. None, Type 1 (controlled), Type 2 (HbA1c 6.8)"
                      value={form.diabetes}
                      onChange={e => setForm({ ...form, diabetes: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Bleeding Disorders / Anticoagulants</Label>
                    <Input
                      placeholder="e.g. Warfarin, Aspirin, Plavix, Hemophilia"
                      value={form.bleedingDisorder}
                      onChange={e => setForm({ ...form, bleedingDisorder: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Cardiovascular Conditions</Label>
                    <Input
                      placeholder="e.g. Hypertension, Pacemaker, Heart murmur, Pre-med needed"
                      value={form.cardiovascular}
                      onChange={e => setForm({ ...form, cardiovascular: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Current Medications</Label>
                    <Input
                      placeholder="e.g. Bisphosphonates, Metformin, Lisinopril, Daily vitamins"
                      value={form.currentMedications}
                      onChange={e => setForm({ ...form, currentMedications: e.target.value })}
                    />
                  </div>
                </div>

                {form.gender === "female" && (
                  <div className="p-3 rounded-xl border bg-card flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold text-foreground">Pregnancy Status</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Patient is pregnant or nursing (requires X-ray shielding & anesthetic precautions).
                      </p>
                    </div>
                    <Switch
                      checked={form.isPregnant}
                      onCheckedChange={checked => setForm({ ...form, isPregnant: checked })}
                    />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Chief Dental Complaint / Primary Concern
                  </Label>
                  <Input
                    placeholder="e.g. Pain on upper right molar when chewing, wants teeth whitening, routine checkup"
                    value={form.chiefComplaint}
                    onChange={e => setForm({ ...form, chiefComplaint: e.target.value })}
                  />
                </div>
              </TabsContent>

              {/* TAB 4: EMERGENCY CONTACT & CLINICAL NOTES */}
              <TabsContent value="emergency" className="space-y-4 m-0">
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" /> Emergency Contact
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold">Full Name</Label>
                      <Input
                        placeholder="e.g. Jane Doe"
                        value={form.emergencyContactName}
                        onChange={e => setForm({ ...form, emergencyContactName: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        placeholder="e.g. (555) 987-6543"
                        value={form.emergencyContactPhone}
                        onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-semibold">Relationship</Label>
                      <Input
                        placeholder="e.g. Spouse, Parent, Sibling"
                        value={form.emergencyContactRelation}
                        onChange={e => setForm({ ...form, emergencyContactRelation: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Medical History Notes</Label>
                    <Textarea
                      rows={2}
                      placeholder="Past surgeries, hospitalizations, systemic health history..."
                      value={form.medicalNotes}
                      onChange={e => setForm({ ...form, medicalNotes: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs font-semibold">Dental History & Preferences</Label>
                    <Textarea
                      rows={2}
                      placeholder="Past orthodontic work, prosthetics, dental hygiene habits..."
                      value={form.dentalNotes}
                      onChange={e => setForm({ ...form, dentalNotes: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="px-6 py-3 border-t bg-card flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Step {activeStepIndex + 1} of {TAB_ORDER.length}: {TAB_LABELS[activeTab]}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isFirstStep) {
                    onOpenChange(false);
                  } else {
                    setActiveTab(TAB_ORDER[activeStepIndex - 1]);
                  }
                }}
                disabled={isSaving}
              >
                {isFirstStep ? "Cancel" : "Back"}
              </Button>
              <Button
                type="submit"
                disabled={isSaving || (isFirstStep && (!form.firstName.trim() || !form.lastName.trim()))}
                className="gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLastStep ? (
                  isEdit ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />
                ) : null}
                {isLastStep ? (isEdit ? "Save Changes" : "Register Patient") : `Next: ${TAB_LABELS[TAB_ORDER[activeStepIndex + 1]]}`}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
