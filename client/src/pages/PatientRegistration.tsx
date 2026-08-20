import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

export default function PatientRegistration() {
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    address: "",
  });

  const register = trpc.patientPortal.register.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    register.mutate({
      ...form,
      gender: form.gender ? (form.gender as "male" | "female" | "other") : null,
      dateOfBirth: form.dateOfBirth || null,
      phone: form.phone || null,
      address: form.address || null,
    });
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Registration received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is pending clinic verification. You will be able to sign in after a staff member confirms your registration.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => setLocation("/patient/login")}>Go to patient login</Button>
            <Button onClick={() => setLocation("/")}>Clinic staff login</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold">Create your patient account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use this form for online registration. Clinic staff will verify your details before portal access is enabled.</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        </div>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={8} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><p className="text-xs text-muted-foreground">At least 8 characters.</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="dateOfBirth">Date of birth</Label><Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="gender">Sex</Label><select id="gender" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            <div className="space-y-2"><Label htmlFor="phone">Mobile number</Label><Input id="phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09XX XXX XXXX" /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="address">Home address</Label><Textarea id="address" rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="House number, street, barangay, city" /></div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <p className="text-sm text-muted-foreground">Already registered? <Link href="/patient/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
            <Button type="submit" disabled={register.isPending}>{register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit registration</Button>
          </div>
        </form>
      </section>
    </main>
  );
}
