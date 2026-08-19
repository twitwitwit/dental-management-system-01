import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { PageHeader, SectionCard } from "@/components/dental";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

type ClinicForm = {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  workingHours: string;
  currency: string;
};

const DEFAULT_FORM: ClinicForm = {
  clinicName: "",
  address: "",
  phone: "",
  email: "",
  workingHours: "",
  currency: "USD",
};

export default function SettingsPage() {
  const role = useCurrentRole();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ClinicForm>(DEFAULT_FORM);
  const settings = trpc.settings.list.useQuery(undefined, { enabled: role === "admin" });

  const bulk = trpc.settings.bulk.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      utils.settings.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    if (!settings.data) return;
    const map = new Map<string, string>();
    settings.data.forEach(s => {
      if (s.settingValue !== null && s.settingValue !== undefined) {
        map.set(s.settingKey, s.settingValue);
      }
    });
    setForm({
      clinicName: map.get("clinic.name") ?? "",
      address: map.get("clinic.address") ?? "",
      phone: map.get("clinic.phone") ?? "",
      email: map.get("clinic.email") ?? "",
      workingHours: map.get("clinic.workingHours") ?? "",
      currency: map.get("clinic.currency") ?? "USD",
    });
  }, [settings.data]);

  const set = (key: keyof ClinicForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <DashboardLayout>
      <PageHeader
        title="Settings"
        description="Clinic information and system preferences. Admin access only."
      />

      <SectionCard title="Clinic information">
        <form
          className="grid gap-5 max-w-2xl"
          onSubmit={e => {
            e.preventDefault();
            bulk.mutate({
              clinicName: form.clinicName.trim() || undefined,
              address: form.address || null,
              phone: form.phone || null,
              email: form.email || null,
              workingHours: form.workingHours || null,
              currency: form.currency.toUpperCase().slice(0, 8) || "USD",
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Clinic name *</Label>
              <Input value={form.clinicName} onChange={e => set("clinicName", e.target.value)} placeholder="e.g. Dentacare Clinic" />
            </div>
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={e => set("currency", e.target.value)} placeholder="USD" />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street, city, ZIP" />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 555 0100" />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="frontdesk@dentacare.com" />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Working hours</Label>
              <Input value={form.workingHours} onChange={e => set("workingHours", e.target.value)} placeholder="Mon–Fri 8:00–18:00, Sat 9:00–14:00" />
            </div>
          </div>
          <Button type="submit" disabled={bulk.isPending} className="gap-1.5 w-fit">
            {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </Button>
        </form>
      </SectionCard>
    </DashboardLayout>
  );
}
