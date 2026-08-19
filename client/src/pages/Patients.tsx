import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/components/dental";
import { Loader2, Search, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";

type PatientForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other" | "";
  phone: string;
  email: string;
  address: string;
  bloodType: string;
  allergies: string;
  medicalNotes: string;
  dentalNotes: string;
};

const emptyForm: PatientForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  bloodType: "",
  allergies: "",
  medicalNotes: "",
  dentalNotes: "",
};

export default function Patients() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PatientForm>(emptyForm);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = trpc.patients.list.useQuery(
    {
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    { enabled: !!role },
  );

  const create = trpc.patients.create.useMutation({
    onSuccess: () => {
      toast.success("Patient registered successfully");
      setDialogOpen(false);
      setForm(emptyForm);
      utils.patients.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const canAdd = role === "admin" || role === "receptionist";

  const genderLabel = (g: string | null | undefined) =>
    g ? g.charAt(0).toUpperCase() + g.slice(1) : "—";

  const patientCount = useMemo(
    () => (query.data ? query.data.length : 0),
    [query.data],
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Patients"
        description={`${patientCount} patient${patientCount === 1 ? "" : "s"} registered.`}
        actions={
          canAdd ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <UserPlus className="h-4 w-4" /> New Patient
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register New Patient</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-3.5"
                  onSubmit={e => {
                    e.preventDefault();
                    create.mutate({
                      firstName: form.firstName.trim(),
                      lastName: form.lastName.trim(),
                      dateOfBirth: form.dateOfBirth || null,
                      gender: form.gender || null,
                      phone: form.phone || undefined,
                      email: form.email || null,
                      address: form.address || null,
                      bloodType: form.bloodType || null,
                      allergies: form.allergies || null,
                      medicalNotes: form.medicalNotes || null,
                      dentalNotes: form.dentalNotes || null,
                    });
                  }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="firstName">First name *</Label>
                      <Input
                        id="firstName"
                        required
                        value={form.firstName}
                        onChange={e => setForm({ ...form, firstName: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="lastName">Last name *</Label>
                      <Input
                        id="lastName"
                        required
                        value={form.lastName}
                        onChange={e => setForm({ ...form, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="dob">Date of birth</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={form.dateOfBirth}
                        onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Gender</Label>
                      <Select
                        value={form.gender}
                        onValueChange={v => setForm({ ...form, gender: v as PatientForm["gender"] })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Address</Label>
                    <Input
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Allergies</Label>
                    <Input
                      placeholder="e.g. Penicillin, latex"
                      value={form.allergies}
                      onChange={e => setForm({ ...form, allergies: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Medical history notes</Label>
                    <Textarea
                      rows={2}
                      value={form.medicalNotes}
                      onChange={e => setForm({ ...form, medicalNotes: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Dental history notes</Label>
                    <Textarea
                      rows={2}
                      value={form.dentalNotes}
                      onChange={e => setForm({ ...form, dentalNotes: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={create.isPending || !form.firstName.trim() || !form.lastName.trim()} className="mt-1">
                    {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Register Patient
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="rounded-2xl bg-card text-card-foreground border border-border/60 shadow-[0_2px_12px_-4px_rgba(13,60,67,0.08)]">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border/60">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email…"
              className="pl-9 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !query.data?.length ? (
          <div className="p-6">
            <EmptyState
              title="No patients found"
              description="Register your first patient to get started."
              action={
                canAdd ? (
                  <Button variant="outline" onClick={() => setDialogOpen(true)} className="gap-1.5">
                    <UserPlus className="h-4 w-4" /> New Patient
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Patient</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map(p => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50" onClick={() => { window.location.href = `/patients/${p.id}`; }}>
                  <TableCell>
                    <Link href={`/patients/${p.id}`} className="flex items-center gap-2.5 font-medium" onClick={e => e.stopPropagation()}>
                      <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {(p.firstName[0] + p.lastName[0]).toUpperCase()}
                      </span>
                      {p.firstName} {p.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{genderLabel(p.gender)}</TableCell>
                  <TableCell>{formatDate(p.dateOfBirth)}</TableCell>
                  <TableCell>{p.phone || "—"}</TableCell>
                  <TableCell>{p.email || "—"}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{formatDate(p.registeredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
}
