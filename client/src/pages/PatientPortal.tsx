import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  ImagePlus,
  Loader2,
  LogOut,
  MessageCircle,
  Pencil,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDate } from "@/lib/format";

function formatPortalTime(value: string | null | undefined) {
  if (!value) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

function formatPortalStatus(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

const tabs = ["overview", "appointments", "profile", "chart", "assistant"] as const;
type Tab = (typeof tabs)[number];

function PortalShell({
  activeTab,
  onTab,
  onLogout,
  children,
  name,
}: {
  activeTab: Tab;
  onTab: (tab: Tab) => void;
  onLogout: () => void;
  children: React.ReactNode;
  name: string;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/patient" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Stethoscope className="h-5 w-5" /></div>
            <div><p className="font-semibold">Dentacare</p><p className="text-xs text-muted-foreground">Patient portal</p></div>
          </Link>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:inline">Hello, {name}</span><Button variant="ghost" size="sm" onClick={onLogout}><LogOut className="mr-1.5 h-4 w-4" />Sign out</Button></div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 lg:block lg:h-fit lg:w-48 lg:shrink-0">
          {(["overview", "appointments", "profile", "chart", "assistant"] as Tab[]).map(tab => (
            <button key={tab} type="button" onClick={() => onTab(tab)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm capitalize transition-colors lg:block lg:w-full ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><span className="inline-flex items-center gap-2">{tab === "assistant" && <MessageCircle className="h-4 w-4" />}{tab === "overview" ? "Overview" : tab === "chart" ? "Dental chart" : tab === "assistant" ? "AI assistant" : tab}</span></button>
          ))}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-2xl border bg-card p-5 shadow-sm"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{action}</div>{children}</section>;
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function Overview({ onTab }: { onTab: (tab: Tab) => void }) {
  const appointments = trpc.patientPortal.myAppointments.useQuery();
  const chart = trpc.patientPortal.chart.useQuery();
  const upcoming = useMemo(() => (appointments.data ?? []).filter(item => new Date(item.appointmentDate).getTime() >= Date.now() && item.status !== "no_show").slice(0, 3), [appointments.data]);
  const documents = chart.data?.documents ?? [];

  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Patient portal</p><h1 className="text-2xl font-semibold">Your care at a glance</h1><p className="mt-1 text-sm text-muted-foreground">Manage appointments and review records that the clinic has released to you.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><button type="button" onClick={() => onTab("appointments")} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary"><CalendarDays className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-semibold">{upcoming.length}</p><p className="text-sm text-muted-foreground">Upcoming visits</p></button><button type="button" onClick={() => onTab("chart")} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary"><FileText className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-semibold">{documents.length}</p><p className="text-sm text-muted-foreground">Approved documents</p></button><button type="button" onClick={() => onTab("profile")} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary"><UserRound className="h-5 w-5 text-primary" /><p className="mt-4 text-sm font-semibold">Profile</p><p className="text-sm text-muted-foreground">Keep your contact details current</p></button></div>
    <SectionCard title="Next appointment" description="Your next scheduled visit"><div className="space-y-3">{appointments.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : upcoming.length ? upcoming.slice(0, 1).map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4"><div><p className="font-medium">{item.type}</p><p className="text-sm text-muted-foreground">{formatDate(item.appointmentDate)} · {formatPortalTime(item.startTime)}</p></div><Badge variant="outline">{formatPortalStatus(item.status)}</Badge></div>) : <EmptyPanel text="No upcoming appointments. Choose a dentist and time to book your next visit." />}<Button variant="outline" onClick={() => onTab("appointments")}>Manage appointments</Button></div></SectionCard>
    <SectionCard title="Privacy and access" description="Your records are released by the clinic, not automatically published."><div className="flex items-start gap-3 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>Only records marked as visible to patients appear in this portal. Internal clinical notes, treatment plans, and documents remain private until the clinic releases them.</p></div></SectionCard>
  </div>;
}

function AppointmentsTab() {
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [dentistId, setDentistId] = useState("");
  const [slot, setSlot] = useState("");
  const [type, setType] = useState("Checkup");
  const [notes, setNotes] = useState("");
  const dentists = trpc.patientPortal.availableDentists.useQuery();
  const slots = trpc.patientPortal.availableSlots.useQuery({ date, dentistId: dentistId ? Number(dentistId) : undefined }, { enabled: Boolean(date) });
  const mine = trpc.patientPortal.myAppointments.useQuery();
  const utils = trpc.useUtils();
  const book = trpc.patientPortal.bookAppointment.useMutation({ onSuccess: async () => { setSlot(""); setNotes(""); await utils.patientPortal.myAppointments.invalidate(); } });

  const submit = (event: FormEvent) => { event.preventDefault(); if (!slot) return; const [startTime, endTime] = slot.split("|"); const selectedDentist = dentistId || String(slots.data?.[0]?.dentistId ?? ""); if (!selectedDentist) return; book.mutate({ dentistId: Number(selectedDentist), appointmentDate: date, startTime, endTime, type, notes: notes || null }); };
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Appointments</p><h1 className="text-2xl font-semibold">Book a visit</h1><p className="mt-1 text-sm text-muted-foreground">Choose a date, dentist, and available time. The clinic will confirm your request.</p></div>
    <SectionCard title="Request an appointment"><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="visit-date">Date</Label><Input id="visit-date" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={e => { setDate(e.target.value); setSlot(""); }} /></div><div className="space-y-2"><Label htmlFor="visit-dentist">Dentist</Label><select id="visit-dentist" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={dentistId} onChange={e => { setDentistId(e.target.value); setSlot(""); }}><option value="">Any available dentist</option>{(dentists.data ?? []).map(dentist => <option key={dentist.id} value={dentist.id}>{dentist.name ?? dentist.email ?? "Dentist"}</option>)}</select></div><div className="space-y-2 md:col-span-2"><Label>Available time</Label>{slots.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(slots.data ?? []).filter(item => !dentistId || item.dentistId === Number(dentistId)).map(item => { const value = `${item.startTime}|${item.endTime}`; return <button key={`${item.dentistId}-${value}`} type="button" onClick={() => { setSlot(value); if (!dentistId) setDentistId(String(item.dentistId)); }} className={`rounded-lg border px-3 py-2 text-left text-sm ${slot === value ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/60"}`}><span className="block font-medium">{formatPortalTime(item.startTime)}</span><span className="text-xs text-muted-foreground">{item.dentistName}</span></button>; })}</div>}{!slots.isLoading && !slots.data?.length && <p className="text-sm text-muted-foreground">No available times for this date.</p>}</div><div className="space-y-2"><Label htmlFor="visit-type">Visit type</Label><select id="visit-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={type} onChange={e => setType(e.target.value)}><option>Checkup</option><option>Cleaning</option><option>Tooth pain</option><option>Follow-up</option><option>Consultation</option></select></div><div className="space-y-2"><Label htmlFor="visit-notes">Note for the clinic</Label><Input id="visit-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></div><div className="md:col-span-2"><Button type="submit" disabled={!slot || book.isPending}>{book.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request appointment</Button>{book.error && <p className="mt-2 text-sm text-destructive">{book.error.message}</p>}{book.isSuccess && <p className="mt-2 text-sm text-emerald-700">Appointment request submitted.</p>}</div></form></SectionCard>
    <SectionCard title="Your appointment history"><div className="space-y-2">{mine.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : mine.data?.length ? mine.data.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{item.type}</p><p className="text-sm text-muted-foreground">{formatDate(item.appointmentDate)} · {formatPortalTime(item.startTime)}</p></div><Badge variant="outline">{formatPortalStatus(item.status)}</Badge></div>) : <EmptyPanel text="No appointments yet." />}</div></SectionCard>
  </div>;
}

function ProfileTab({ patient }: { patient: any }) {
  const utils = trpc.useUtils();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(() => ({ firstName: patient.firstName ?? "", lastName: patient.lastName ?? "", dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().slice(0, 10) : "", gender: patient.gender ?? "", phone: patient.phone ?? "", address: patient.address ?? "", occupation: patient.occupation ?? "", emergencyContactName: patient.emergencyContactName ?? "", emergencyContactPhone: patient.emergencyContactPhone ?? "", emergencyContactRelation: patient.emergencyContactRelation ?? "" }));
  const update = trpc.patientPortal.updateProfile.useMutation({ onSuccess: async () => { setSaved(true); await utils.patientPortal.me.invalidate(); setTimeout(() => setSaved(false), 2500); } });
  const upload = trpc.patientPortal.uploadProfilePhoto.useMutation({ onSuccess: async () => { await utils.patientPortal.chart.invalidate(); } });
  const submit = (event: FormEvent) => { event.preventDefault(); update.mutate({ ...form, gender: form.gender ? (form.gender as "male" | "female" | "other") : null, dateOfBirth: form.dateOfBirth || null }); };
  const photo = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 4000000) return; const reader = new FileReader(); reader.onload = () => { const result = String(reader.result); upload.mutate({ fileName: file.name, contentType: file.type, dataBase64: result.split(",")[1] ?? "", fileSize: file.size }); }; reader.readAsDataURL(file); };
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Profile</p><h1 className="text-2xl font-semibold">Your personal details</h1><p className="mt-1 text-sm text-muted-foreground">Keep your contact information current so the clinic can reach you.</p></div><SectionCard title="Profile photo"><div className="flex flex-wrap items-center gap-4"><div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary"><UserRound className="h-8 w-8" /></div><div><Label htmlFor="profile-photo" className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm hover:bg-muted"><ImagePlus className="mr-2 h-4 w-4" />Choose photo</Label><Input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={photo} /><p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP up to 4 MB.</p>{upload.isPending && <p className="mt-1 text-xs text-primary">Uploading…</p>}</div></div></SectionCard><SectionCard title="Personal and contact details"><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>First name</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div><div className="space-y-2"><Label>Last name</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div><div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></div><div className="space-y-2"><Label>Sex</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div><div className="space-y-2"><Label>Mobile number</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div><div className="space-y-2"><Label>Occupation</Label><Input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} /></div><div className="space-y-2 md:col-span-2"><Label>Address</Label><Textarea rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div><div className="space-y-2"><Label>Emergency contact</Label><Input value={form.emergencyContactName} onChange={e => setForm({ ...form, emergencyContactName: e.target.value })} /></div><div className="space-y-2"><Label>Emergency phone</Label><Input value={form.emergencyContactPhone} onChange={e => setForm({ ...form, emergencyContactPhone: e.target.value })} /></div><div className="space-y-2"><Label>Relationship</Label><Input value={form.emergencyContactRelation} onChange={e => setForm({ ...form, emergencyContactRelation: e.target.value })} /></div><div className="md:col-span-2"><Button type="submit" disabled={update.isPending}>{update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button>{saved && <span className="ml-3 text-sm text-emerald-700">Profile saved.</span>}{update.error && <p className="mt-2 text-sm text-destructive">{update.error.message}</p>}</div></form></SectionCard></div>;
}

function readAiAnswer(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["answer", "content", "message", "text"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
  }
  return "I could not generate an answer right now. Please contact the clinic team for help.";
}

function AiAssistantTab() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [question, setQuestion] = useState("");
  const ask = trpc.patientAi.chat.useMutation({
    onSuccess: response => setMessages(current => [...current, { role: "assistant", content: readAiAnswer(response) }]),
  });

  const send = (value = question) => {
    const text = value.trim();
    if (!text || ask.isPending) return;
    setMessages(current => [...current, { role: "user", content: text }]);
    setQuestion("");
    ask.mutate({ message: text });
  };

  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Patient support</p><h1 className="text-2xl font-semibold">AI assistant</h1><p className="mt-1 text-sm text-muted-foreground">Ask about dentist availability, appointment preparation, or general clinic information.</p></div><SectionCard title="Chat with Dentacare assistant" description="The assistant does not diagnose conditions or replace advice from your dentist."><div className="flex min-h-[360px] flex-col"><div className="flex-1 space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-4">{messages.length === 0 ? <div className="flex min-h-[260px] flex-col items-center justify-center text-center"><MessageCircle className="h-10 w-10 text-primary/60" /><p className="mt-3 font-medium">How can we help?</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Try asking “What dentists are available?” or “How should I prepare for my appointment?”</p><div className="mt-4 flex flex-wrap justify-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => send("What dentists are available?")} disabled={ask.isPending}>Dentist availability</Button><Button type="button" variant="outline" size="sm" onClick={() => send("How should I prepare for my appointment?")} disabled={ask.isPending}>Appointment preparation</Button></div></div> : messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>{message.content}</div></div>)}{ask.isPending && <div className="text-sm text-muted-foreground">The assistant is thinking…</div>}{ask.error && <p className="text-sm text-destructive">{ask.error.message}</p>}</div><form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); send(); }}><Textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question…" rows={2} className="min-h-10 resize-none" /><Button type="submit" disabled={!question.trim() || ask.isPending} className="self-end"><Send className="mr-2 h-4 w-4" />Send</Button></form><p className="mt-2 text-xs text-muted-foreground">For urgent symptoms, emergencies, or diagnosis, contact the clinic directly.</p></div></SectionCard></div>;
}

function ChartTab() {
  const chart = trpc.patientPortal.chart.useQuery();
  const [documentId, setDocumentId] = useState<number | null>(null);
  const document = trpc.patientPortal.viewDocument.useQuery({ documentId: documentId ?? 0 }, { enabled: Boolean(documentId) });
  if (chart.isLoading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  const data = chart.data;
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Dental chart</p><h1 className="text-2xl font-semibold">Your released records</h1><p className="mt-1 text-sm text-muted-foreground">Only records marked visible by the clinic are shown here.</p></div><SectionCard title="Tooth conditions"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data?.conditions?.length ? data.conditions.map(item => <div key={item.id} className="rounded-lg border p-3"><p className="font-medium">Tooth {item.toothNumber}</p><p className="text-sm capitalize text-muted-foreground">{item.condition.replaceAll("_", " ")}</p>{item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}</div>) : <EmptyPanel text="No tooth findings have been released to your portal." />}</div></SectionCard><SectionCard title="Treatment plans"><div className="space-y-2">{data?.plans?.length ? data.plans.map(plan => <div key={plan.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{plan.title}</p><Badge variant="outline">{formatPortalStatus(plan.status)}</Badge></div>{plan.diagnosis && <p className="mt-1 text-sm text-muted-foreground">{plan.diagnosis}</p>}</div>) : <EmptyPanel text="No treatment plans have been released to your portal." />}</div></SectionCard><SectionCard title="Clinical notes"><div className="space-y-2">{data?.notes?.length ? data.notes.map(note => <div key={note.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{note.title || "Clinical note"}</p><span className="text-xs text-muted-foreground">{formatDate(note.noteDate)}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p></div>) : <EmptyPanel text="No clinical notes have been released to your portal." />}</div></SectionCard><SectionCard title="X-rays and documents"><div className="space-y-2">{data?.documents?.length ? data.documents.map(doc => <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-primary" /><div><p className="font-medium">{doc.title}</p><p className="text-xs capitalize text-muted-foreground">{doc.documentType.replaceAll("_", " ")}</p></div></div><Button variant="outline" size="sm" onClick={() => setDocumentId(doc.id)}>View</Button></div>) : <EmptyPanel text="No X-rays or documents have been released to your portal." />}{document.data?.url && <a className="inline-block text-sm font-medium text-primary hover:underline" href={document.data.url} target="_blank" rel="noreferrer">Open selected document</a>}{document.isFetching && <p className="text-sm text-muted-foreground">Preparing secure document link…</p>}</div></SectionCard></div>;
}

export default function PatientPortal() {
  const auth = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/patient/login" });
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const portal = trpc.patientPortal.me.useQuery(undefined, { enabled: auth.user?.role === "patient" });

  useEffect(() => { if (auth.user && auth.user.role !== "patient") setLocation("/"); }, [auth.user, setLocation]);
  if (auth.loading || portal.isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!auth.user || auth.user.role !== "patient") return null;
  if (portal.error) return <div className="mx-auto max-w-md p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-amber-600" /><h1 className="mt-4 text-xl font-semibold">Patient portal unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{portal.error.message}</p><Link href="/patient/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Return to login</Link></div>;
  const patient = portal.data?.patient;
  if (!patient) return null;
  return <PortalShell activeTab={tab} onTab={setTab} onLogout={() => { void auth.logout(); setLocation("/patient/login"); }} name={patient.firstName}><>{tab === "overview" && <Overview onTab={setTab} />}{tab === "appointments" && <AppointmentsTab />}{tab === "profile" && <ProfileTab patient={patient} />}{tab === "chart" && <ChartTab />}{tab === "assistant" && <AiAssistantTab />}</></PortalShell>;
}
