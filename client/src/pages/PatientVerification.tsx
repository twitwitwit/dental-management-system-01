import { useState } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, EmptyState } from "@/components/dental";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import AccessDenied from "@/pages/AccessDenied";
import { formatDate } from "@/lib/format";

export default function PatientVerification() {
  const role = useCurrentRole();
  const [noteById, setNoteById] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();
  const queue = trpc.patientPortal.verificationQueue.useQuery({ status: "pending" }, { enabled: role === "admin" });
  const verify = trpc.patientPortal.verifyAccount.useMutation({ onSuccess: async () => { await utils.patientPortal.verificationQueue.invalidate(); } });

  if (role !== "admin") return <AccessDenied moduleId="users" />;
  return <DashboardLayout><PageHeader title="Patient verification" description="Review online registrations before patients can access the portal." />
    {queue.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : !queue.data?.length ? <EmptyState title="No registrations waiting for review" description="New online registrations will appear here." /> : <div className="space-y-4">{queue.data.map(item => <section key={item.account.id} className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-semibold">{item.patient.firstName} {item.patient.lastName}</h2><Badge variant="outline">Pending</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.user.email} · Registered {formatDate(item.account.createdAt)}</p><p className="mt-1 text-sm text-muted-foreground">{item.patient.phone || "No mobile number provided"}</p></div><ShieldCheck className="h-5 w-5 text-amber-600" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Date of birth</p><p className="mt-1 text-sm">{item.patient.dateOfBirth ? formatDate(item.patient.dateOfBirth) : "Not provided"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Address</p><p className="mt-1 text-sm">{item.patient.address || "Not provided"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Sex</p><p className="mt-1 text-sm capitalize">{item.patient.gender || "Not provided"}</p></div></div><Textarea className="mt-4" rows={2} placeholder="Optional review note" value={noteById[item.account.id] ?? ""} onChange={e => setNoteById({ ...noteById, [item.account.id]: e.target.value })} /><div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={verify.isPending} onClick={() => verify.mutate({ patientAccountId: item.account.id, status: "rejected", note: noteById[item.account.id] || null })}><X className="mr-1.5 h-4 w-4" />Reject</Button><Button disabled={verify.isPending} onClick={() => verify.mutate({ patientAccountId: item.account.id, status: "verified", note: noteById[item.account.id] || null })}><Check className="mr-1.5 h-4 w-4" />Verify and enable access</Button></div></section>)}</div>}
    {verify.error && <p className="mt-4 text-sm text-destructive">{verify.error.message}</p>}
  </DashboardLayout>;
}
