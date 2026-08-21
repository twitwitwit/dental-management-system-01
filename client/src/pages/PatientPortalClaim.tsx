import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function PatientPortalClaim() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const preview = trpc.patientPortal.invitationPreview.useQuery({ token }, { enabled: /^[a-f0-9]{64}$/i.test(token) });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [error, setError] = useState("");
  const claim = trpc.patientPortal.claimInvitation.useMutation({
    onSuccess: () => setLocation("/patient/login"),
    onError: err => setError(err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmedPassword) {
      setError("The passwords do not match.");
      return;
    }
    claim.mutate({ token, email, password });
  };

  const invalidToken = !/^[a-f0-9]{64}$/i.test(token) || preview.isError;
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:flex sm:items-center sm:justify-center sm:p-6">
      <section className="mx-auto w-full max-w-md rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
        <p className="text-sm text-muted-foreground">Clinic invitation</p>
        <h1 className="mt-1 text-2xl font-semibold">Set up your patient portal</h1>
        {preview.isLoading && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking invitation…</p>}
        {(invalidToken || (preview.data && !preview.data.valid)) && !preview.isLoading && <div className="mt-5 space-y-3"><p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">This invitation is invalid or expired.</p><Link href="/patient/recover" className="text-sm font-medium text-primary hover:underline">Request a new invitation</Link></div>}
        {!invalidToken && !preview.isLoading && preview.data?.valid && <>
          <p className="mt-2 text-sm text-muted-foreground">This invitation is for <strong>{preview.data.patientName || `${preview.data.firstName ?? ""} ${preview.data.lastName ?? ""}`.trim()}</strong>. Create your portal login below. The link can only be used once.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2"><Label htmlFor="claim-email">Email address</Label><Input id="claim-email" required type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="claim-password">Password</Label><Input id="claim-password" required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">Use at least 8 characters.</p></div>
            <div className="space-y-2"><Label htmlFor="claim-confirm-password">Confirm password</Label><Input id="claim-confirm-password" required minLength={8} type="password" value={confirmedPassword} onChange={e => setConfirmedPassword(e.target.value)} /></div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button className="w-full" type="submit" disabled={claim.isPending}>{claim.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Create portal account</Button>
          </form>
        </>}
        <p className="mt-6 text-center text-sm text-muted-foreground"><Link href="/patient/login" className="font-medium text-primary hover:underline">Back to patient login</Link></p>
      </section>
    </main>
  );
}
