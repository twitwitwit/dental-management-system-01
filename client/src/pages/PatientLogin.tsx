import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function PatientLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const auth = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setLocation("/patient");
    },
    onError: err => setError(err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    auth.mutate({ email, password });
  };

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LogIn className="h-5 w-5" /></div>
        <h1 className="text-2xl font-semibold">Patient portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your appointments and view approved records.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="space-y-2"><Label htmlFor="patient-email">Email address</Label><Input id="patient-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="patient-password">Password</Label><Input id="patient-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={auth.isPending}>{auth.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in</Button>
        </form>
        <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>After registration, you can sign in immediately. Complete your health form before booking an appointment.</span></div>
        <p className="mt-6 text-center text-sm text-muted-foreground">Need an account? <Link href="/patient/register" className="font-medium text-primary hover:underline">Register online</Link></p>
      </section>
    </main>
  );
}
