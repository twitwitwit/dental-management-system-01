import { ChangeEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Receipt, Upload, WalletCards } from "lucide-react";
import { trpc } from "@/lib/trpc";

function php(value: unknown) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value ?? 0));
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export default function PatientBillingTab() {
  const billing = trpc.patientPortal.billing.useQuery();
  const utils = trpc.useUtils();
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [method, setMethod] = useState<"gcash" | "maya" | "qr_code">("gcash");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [patientNote, setPatientNote] = useState("");
  const [proof, setProof] = useState<{ fileName: string; contentType: string; dataBase64: string } | null>(null);
  const [message, setMessage] = useState("");
  const submit = trpc.patientPortal.submitPaymentRequest.useMutation({
    onSuccess: async () => {
      setMessage("Payment proof submitted for clinic verification.");
      setAmount("");
      setReferenceNumber("");
      setPatientNote("");
      setProof(null);
      await utils.patientPortal.billing.invalidate();
    },
  });

  const selectedInvoice = billing.data?.invoices.find(invoice => invoice.id === invoiceId);
  const chooseProof = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.size > 8_000_000) return;
    const reader = new FileReader();
    reader.onload = () => setProof({ fileName: file.name, contentType: file.type, dataBase64: String(reader.result).split(",")[1] ?? "" });
    reader.readAsDataURL(file);
  };
  const submitPayment = () => {
    if (!selectedInvoice) return;
    submit.mutate({ invoiceId: selectedInvoice.id, method, amount, referenceNumber: referenceNumber || null, patientNote: patientNote || null, proofFileName: proof?.fileName ?? null, proofContentType: proof?.contentType ?? null, proofDataBase64: proof?.dataBase64 ?? null });
  };

  if (billing.isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  const settings = billing.data?.paymentSettings;
  return <div className="space-y-6">
    <div><p className="text-sm text-muted-foreground">Billing</p><h1 className="text-2xl font-semibold">Your balance and receipts</h1><p className="mt-1 text-sm text-muted-foreground">Review clinic-issued invoices and submit manual payment proof for verification.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-card p-5 shadow-sm"><WalletCards className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-semibold">{php(billing.data?.totalBalance)}</p><p className="text-sm text-muted-foreground">Outstanding balance</p></div><div className="rounded-2xl border bg-card p-5 shadow-sm"><Receipt className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-semibold">{billing.data?.invoices.length ?? 0}</p><p className="text-sm text-muted-foreground">Invoices</p></div><div className="rounded-2xl border bg-card p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Total paid</p><p className="mt-4 text-2xl font-semibold">{php(billing.data?.totalPaid)}</p><p className="text-sm text-muted-foreground">Verified transactions</p></div></div>
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><div className="mb-4"><h2 className="font-semibold">Invoices</h2><p className="mt-1 text-sm text-muted-foreground">Digital invoice details are available through View receipt.</p></div><div className="space-y-3">{billing.data?.invoices.length ? billing.data.invoices.map(invoice => <div key={invoice.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{invoice.invoiceNumber}</p><p className="text-sm text-muted-foreground">Issued {new Date(invoice.createdAt).toLocaleDateString("en-PH")}</p></div><Badge variant="outline">{statusLabel(invoice.status)}</Badge></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">Total</p><p className="font-semibold">{php(invoice.total)}</p></div><div><p className="text-muted-foreground">Paid</p><p className="font-semibold">{php(invoice.paid)}</p></div><div><p className="text-muted-foreground">Balance</p><p className="font-semibold">{php(invoice.balance)}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setInvoiceId(invoiceId === invoice.id ? null : invoice.id)}><Receipt className="mr-2 h-4 w-4" />{invoiceId === invoice.id ? "Hide receipt" : "View receipt"}</Button>{invoice.balance > 0 && <Button size="sm" onClick={() => { setInvoiceId(invoice.id); setAmount(String(invoice.balance)); }}>Submit payment</Button>}</div>{invoiceId === invoice.id && <div className="mt-4 space-y-3 rounded-xl bg-muted/30 p-4"><h3 className="font-medium">Digital invoice receipt</h3>{invoice.items.map((item: { id: number; description: string; quantity: number; amount: string | number }) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.description} × {item.quantity}</span><span>{php(item.amount)}</span></div>)}<div className="border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{php(invoice.subtotal)}</span></div><div className="flex justify-between font-semibold"><span>Total</span><span>{php(invoice.total)}</span></div></div>{invoice.payments.length > 0 && <div className="border-t pt-3"><p className="mb-2 text-sm font-medium">Transactions</p>{invoice.payments.map((payment: { id: number; paidAt: Date | string; method: string; amount: string | number }) => <div key={payment.id} className="flex justify-between gap-3 text-sm"><span>{new Date(payment.paidAt).toLocaleDateString("en-PH")} · {payment.method}</span><span>{php(payment.amount)}</span></div>)}</div>}</div>}</div>) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No invoices are available yet.</p>}</div></section>
    {settings && (settings.gcashEnabled || settings.mayaEnabled) && <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><h2 className="font-semibold">Manual payment options</h2><p className="mt-1 text-sm text-muted-foreground">Pay using the clinic’s displayed account or QR code, then submit your reference and proof below.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{settings.gcashEnabled && <div className="rounded-xl border p-4"><p className="font-medium">GCash</p><p className="text-sm text-muted-foreground">{settings.gcashAccountName} · {settings.gcashAccountNumber}</p>{settings.gcashQrImageUrl && <img src={settings.gcashQrImageUrl} alt="Clinic GCash QR code" className="mt-3 h-44 w-44 rounded-lg border object-contain" />}</div>}{settings.mayaEnabled && <div className="rounded-xl border p-4"><p className="font-medium">Maya</p><p className="text-sm text-muted-foreground">{settings.mayaAccountName} · {settings.mayaAccountNumber}</p>{settings.mayaQrImageUrl && <img src={settings.mayaQrImageUrl} alt="Clinic Maya QR code" className="mt-3 h-44 w-44 rounded-lg border object-contain" />}</div>}</div><p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{settings.paymentInstructions}</p><div className="mt-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2"><div className="space-y-2"><Label>Invoice</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={invoiceId ?? ""} onChange={event => { const id = Number(event.target.value); setInvoiceId(id || null); const invoice = billing.data?.invoices.find(item => item.id === id); if (invoice) setAmount(String(invoice.balance)); }}><option value="">Select invoice</option>{billing.data?.invoices.filter(invoice => invoice.balance > 0).map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {php(invoice.balance)}</option>)}</select></div><div className="space-y-2"><Label>Payment method</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={method} onChange={event => setMethod(event.target.value as typeof method)}><option value="gcash">GCash</option><option value="maya">Maya</option><option value="qr_code">QR code</option></select></div><div className="space-y-2"><Label>Amount</Label><Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></div><div className="space-y-2"><Label>Reference number</Label><Input value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Payment proof</Label><Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={chooseProof} /><p className="text-xs text-muted-foreground">Optional but recommended. Maximum 8 MB.</p></div><div className="space-y-2 sm:col-span-2"><Label>Note</Label><Textarea rows={2} value={patientNote} onChange={event => setPatientNote(event.target.value)} /></div><div className="sm:col-span-2"><Button type="button" disabled={!invoiceId || !amount || submit.isPending} onClick={submitPayment}>{submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Submit payment request</Button>{(message || submit.error) && <p className={`mt-2 text-sm ${submit.error ? "text-destructive" : "text-emerald-700"}`}>{submit.error?.message ?? message}</p>}</div></div></section>}
  </div>;
}
