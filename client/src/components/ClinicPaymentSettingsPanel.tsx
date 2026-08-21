import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type PaymentChannel = {
  accountName: string;
  accountNumber: string;
  qrCodeUrl: string;
};

type PaymentSettings = {
  gcash: PaymentChannel;
  maya: PaymentChannel;
  instructions: string;
};

const emptySettings: PaymentSettings = {
  gcash: { accountName: "", accountNumber: "", qrCodeUrl: "" },
  maya: { accountName: "", accountNumber: "", qrCodeUrl: "" },
  instructions: "",
};

export default function ClinicPaymentSettingsPanel() {
  const settingsQuery = trpc.clinicPaymentSettings.get.useQuery();
  const updateSettings = trpc.clinicPaymentSettings.update.useMutation({
    onSuccess: async () => {
      await settingsQuery.refetch();
    },
  });
  const [settings, setSettings] = useState<PaymentSettings>(emptySettings);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettings({
      gcash: {
        accountName: settingsQuery.data.gcash?.accountName ?? "",
        accountNumber: settingsQuery.data.gcash?.accountNumber ?? "",
        qrCodeUrl: settingsQuery.data.gcash?.qrCodeUrl ?? "",
      },
      maya: {
        accountName: settingsQuery.data.maya?.accountName ?? "",
        accountNumber: settingsQuery.data.maya?.accountNumber ?? "",
        qrCodeUrl: settingsQuery.data.maya?.qrCodeUrl ?? "",
      },
      instructions: settingsQuery.data.instructions ?? "",
    });
  }, [settingsQuery.data]);

  const updateChannel = (
    channel: "gcash" | "maya",
    field: keyof PaymentChannel,
    value: string,
  ) => {
    setSettings(current => ({
      ...current,
      [channel]: { ...current[channel], [field]: value },
    }));
  };

  const save = () => updateSettings.mutate(settings);

  return (
    <section className="space-y-6 rounded-xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Manual payment settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure the GCash and Maya details shown to patients. This does not
          connect to a payment gateway.
        </p>
      </div>

      {(["gcash", "maya"] as const).map(channel => (
        <div key={channel} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
          <h3 className="font-medium capitalize sm:col-span-3">{channel}</h3>
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Account name"
            value={settings[channel].accountName}
            onChange={event => updateChannel(channel, "accountName", event.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Account number"
            value={settings[channel].accountNumber}
            onChange={event => updateChannel(channel, "accountNumber", event.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="QR image URL"
            value={settings[channel].qrCodeUrl}
            onChange={event => updateChannel(channel, "qrCodeUrl", event.target.value)}
          />
        </div>
      ))}

      <textarea
        className="min-h-24 w-full rounded-md border px-3 py-2"
        placeholder="Payment instructions"
        value={settings.instructions}
        onChange={event =>
          setSettings(current => ({ ...current, instructions: event.target.value }))
        }
      />

      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        disabled={settingsQuery.isLoading || updateSettings.isPending}
        onClick={save}
      >
        {updateSettings.isPending ? "Saving…" : "Save payment settings"}
      </button>

      {settingsQuery.error && (
        <p className="text-sm text-destructive">{settingsQuery.error.message}</p>
      )}
      {updateSettings.error && (
        <p className="text-sm text-destructive">{updateSettings.error.message}</p>
      )}
    </section>
  );
}
