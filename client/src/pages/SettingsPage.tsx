import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { PageHeader, SectionCard } from "@/components/dental";
import { Loader2, QrCode, Save } from "lucide-react";
import { toast } from "sonner";

type ClinicForm = {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  workingHours: string;
  currency: string;
};

type PaymentForm = {
  gcash: { accountName: string; accountNumber: string; qrCodeUrl: string };
  maya: { accountName: string; accountNumber: string; qrCodeUrl: string };
  instructions: string;
};

const DEFAULT_CLINIC: ClinicForm = {
  clinicName: "",
  address: "",
  phone: "",
  email: "",
  workingHours: "",
  currency: "PHP",
};

const DEFAULT_PAYMENT: PaymentForm = {
  gcash: { accountName: "", accountNumber: "", qrCodeUrl: "" },
  maya: { accountName: "", accountNumber: "", qrCodeUrl: "" },
  instructions: "",
};

export default function SettingsPage() {
  const role = useCurrentRole();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ClinicForm>(DEFAULT_CLINIC);
  const [payment, setPayment] = useState<PaymentForm>(DEFAULT_PAYMENT);

  const settings = trpc.settings.list.useQuery(undefined, { enabled: role === "admin" });
  const paymentSettings = trpc.clinicPaymentSettings.get.useQuery(undefined, {
    enabled: role === "admin",
  });

  const bulk = trpc.settings.bulk.useMutation({
    onSuccess: () => {
      toast.success("Clinic settings saved");
      utils.settings.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const savePayment = trpc.clinicPaymentSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Payment settings saved");
      utils.clinicPaymentSettings.get.invalidate();
      utils.patientPortal.billing.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!settings.data) return;
    const values = new Map<string, string>();
    settings.data.forEach(setting => {
      if (setting.settingValue !== null && setting.settingValue !== undefined) {
        values.set(setting.settingKey, setting.settingValue);
      }
    });
    setForm({
      clinicName: values.get("clinic.name") ?? "",
      address: values.get("clinic.address") ?? "",
      phone: values.get("clinic.phone") ?? "",
      email: values.get("clinic.email") ?? "",
      workingHours: values.get("clinic.workingHours") ?? "",
      currency: values.get("clinic.currency") ?? "PHP",
    });
  }, [settings.data]);

  useEffect(() => {
    if (!paymentSettings.data) return;
    setPayment({
      gcash: {
        accountName: paymentSettings.data.gcash?.accountName ?? "",
        accountNumber: paymentSettings.data.gcash?.accountNumber ?? "",
        qrCodeUrl: paymentSettings.data.gcash?.qrCodeUrl ?? "",
      },
      maya: {
        accountName: paymentSettings.data.maya?.accountName ?? "",
        accountNumber: paymentSettings.data.maya?.accountNumber ?? "",
        qrCodeUrl: paymentSettings.data.maya?.qrCodeUrl ?? "",
      },
      instructions: paymentSettings.data.instructions ?? "",
    });
  }, [paymentSettings.data]);

  const setClinic = (key: keyof ClinicForm, value: string) => {
    setForm(previous => ({ ...previous, [key]: value }));
  };

  const setPaymentField = (
    provider: "gcash" | "maya",
    key: "accountName" | "accountNumber" | "qrCodeUrl",
    value: string,
  ) => {
    setPayment(previous => ({
      ...previous,
      [provider]: { ...previous[provider], [key]: value },
    }));
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Settings"
        description="Clinic information, currency, and manual payment instructions. Admin access only."
      />

      <div className="space-y-6">
        <SectionCard title="Clinic information">
          <form
            className="grid max-w-2xl gap-5"
            onSubmit={event => {
              event.preventDefault();
              bulk.mutate({
                clinicName: form.clinicName.trim() || undefined,
                address: form.address || null,
                phone: form.phone || null,
                email: form.email || null,
                workingHours: form.workingHours || null,
                currency: form.currency.toUpperCase().slice(0, 8) || "PHP",
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Clinic name *</Label>
                <Input value={form.clinicName} onChange={event => setClinic("clinicName", event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={event => setClinic("currency", event.target.value)} placeholder="PHP" />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={event => setClinic("address", event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={event => setClinic("phone", event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={event => setClinic("email", event.target.value)} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Working hours</Label>
                <Input value={form.workingHours} onChange={event => setClinic("workingHours", event.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={bulk.isPending} className="w-fit gap-1.5">
              {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save clinic settings
            </Button>
          </form>
        </SectionCard>

        <SectionCard
          title="GCash, Maya, and QR payments"
          description="Enter the clinic-owned payment details. This is manual payment only; no merchant API or automatic collection is performed."
        >
          <form
            className="space-y-6"
            onSubmit={event => {
              event.preventDefault();
              savePayment.mutate({
                gcash: payment.gcash,
                maya: payment.maya,
                instructions: payment.instructions,
              });
            }}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              {(["gcash", "maya"] as const).map(provider => (
                <div key={provider} className="rounded-xl border p-4">
                  <h3 className="font-semibold">{provider === "gcash" ? "GCash" : "Maya"}</h3>
                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-1.5">
                      <Label>Account name</Label>
                      <Input value={payment[provider].accountName} onChange={event => setPaymentField(provider, "accountName", event.target.value)} placeholder="Clinic account name" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Account number</Label>
                      <Input value={payment[provider].accountNumber} onChange={event => setPaymentField(provider, "accountNumber", event.target.value)} placeholder="09XXXXXXXXX" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>QR image URL</Label>
                      <Input type="url" value={payment[provider].qrCodeUrl} onChange={event => setPaymentField(provider, "qrCodeUrl", event.target.value)} placeholder="https://... or your storage URL" />
                      <p className="text-xs text-muted-foreground">Paste the URL of the manually provided QR image. The URL must be reachable by patient devices.</p>
                    </div>
                    {payment[provider].qrCodeUrl ? (
                      <div className="rounded-lg border bg-white p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><QrCode className="h-4 w-4" />Preview</div>
                        <img src={payment[provider].qrCodeUrl} alt={`${provider} payment QR preview`} className="mx-auto max-h-48 object-contain" />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label>Payment instructions</Label>
              <Textarea value={payment.instructions} onChange={event => setPayment(previous => ({ ...previous, instructions: event.target.value }))} placeholder="Example: After payment, send the transaction reference to the clinic receptionist for verification." rows={4} />
            </div>
            <Button type="submit" disabled={savePayment.isPending} className="w-fit gap-1.5">
              {savePayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save payment settings
            </Button>
          </form>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}
