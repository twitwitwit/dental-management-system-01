import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EmptyState, SectionCard } from "@/components/dental";
import { Loader2 } from "lucide-react";

type PatientOption = {
  id: number;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

type PatientPaymentHistoryProps = {
  patients: PatientOption[];
};

function formatPaymentMethod(method: string) {
  return method
    .replaceAll("_", " ")
    .replace(/\\b\\w/g, character => character.toUpperCase());
}

export function PatientPaymentHistory({ patients }: PatientPaymentHistoryProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const selectedPatient = useMemo(
    () => patients.find(patient => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const invoices = trpc.billing.invoices.useQuery(
    { patientId: selectedPatientId ?? undefined },
    { enabled: selectedPatientId !== null },
  );

  const payments = trpc.billing.payments.useQuery(
    { patientId: selectedPatientId ?? undefined },
    { enabled: selectedPatientId !== null },
  );

  const invoiceTotal = (invoices.data ?? []).reduce(
    (total, invoice) => total + Number(invoice.total ?? 0),
    0,
  );

  const netPaid = (payments.data ?? []).reduce(
    (total, payment) =>
      total + Number(payment.amount ?? 0) * (payment.type === "refund" ? -1 : 1),
    0,
  );

  const outstanding = Math.max(invoiceTotal - netPaid, 0);

  return (
    <SectionCard
      title="Payment history"
      actions={
        selectedPatient ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setSelectedPatientId(null)}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 font-normal"
          onClick={() => setPickerOpen(true)}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          {selectedPatient ? (
            <span className="truncate">
              {selectedPatient.lastName}, {selectedPatient.firstName}
              {selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Search patient by name, phone, or ID...
            </span>
          )}
        </Button>

        <CommandDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Select patient"
          description="Search by patient name, phone number, or patient ID."
        >
          <CommandInput placeholder="Type a name, phone number, or patient ID..." />
          <CommandList>
            <CommandEmpty>No matching patients found.</CommandEmpty>
            {patients.map(patient => {
              const name = `${patient.lastName}, ${patient.firstName}`;
              const searchValue = [
                name,
                `${patient.firstName} ${patient.lastName}`,
                patient.phone ?? "",
                String(patient.id),
              ].join(" ");

              return (
                <CommandItem
                  key={patient.id}
                  value={searchValue}
                  onSelect={() => {
                    setSelectedPatientId(patient.id);
                    setPickerOpen(false);
                  }}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {patient.phone || "No phone number"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ID #{patient.id}
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
        </CommandDialog>

        {!selectedPatient ? (
          <EmptyState
            title="Select a patient"
            description="Choose a patient to view invoices, payments, refunds, and the current balance."
          />
        ) : invoices.isLoading || payments.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Invoiced
                </p>
                <p className="mt-1 text-sm font-bold">{formatMoney(invoiceTotal)}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Paid
                </p>
                <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {formatMoney(netPaid)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Balance
                </p>
                <p className="mt-1 text-sm font-bold text-amber-700 dark:text-amber-300">
                  {formatMoney(outstanding)}
                </p>
              </div>
            </div>

            {!payments.data?.length ? (
              <EmptyState
                title="No payments recorded"
                description="Payments and refunds for this patient will appear here."
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {payments.data.map(payment => {
                  const isRefund = payment.type === "refund";

                  return (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            Invoice #{payment.invoiceId}
                          </p>
                          <Badge
                            variant={isRefund ? "destructive" : "outline"}
                            className="text-[10px] capitalize"
                          >
                            {isRefund ? "Refund" : "Payment"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatDate(payment.paidAt)} · {formatPaymentMethod(payment.method)}
                          {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-bold",
                          isRefund
                            ? "text-destructive"
                            : "text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {isRefund ? "−" : "+"}
                        {formatMoney(payment.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}