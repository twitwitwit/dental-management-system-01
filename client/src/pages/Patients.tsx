import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/components/dental";
import {
  AlertTriangle,
  Cigarette,
  HeartPulse,
  Loader2,
  Pencil,
  Search,
  UserPlus,
} from "lucide-react";
import { PatientFormDialog } from "@/components/PatientFormDialog";
import type { Patient } from "@shared/types";

export default function Patients() {
  const role = useCurrentRole();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

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

  const canAdd = role === "admin" || role === "receptionist";
  const canEdit = role === "admin" || role === "dentist" || role === "receptionist";

  const genderLabel = (g: string | null | undefined) =>
    g ? g.charAt(0).toUpperCase() + g.slice(1) : "—";

  const patientCount = useMemo(
    () => (query.data ? query.data.length : 0),
    [query.data],
  );

  const formatSmokerBadge = (status: string | null | undefined) => {
    if (!status || status === "never") {
      return (
        <span className="text-[11px] text-muted-foreground">
          Non-smoker
        </span>
      );
    }
    if (status === "former") {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">
          Former
        </Badge>
      );
    }
    if (status === "vaping") {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-400 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40">
          Vaping
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1 bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
        <Cigarette className="h-2.5 w-2.5" />
        Smoker
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Patients"
        description={`${patientCount} patient${patientCount === 1 ? "" : "s"} registered.`}
        actions={
          canAdd ? (
            <Button
              className="gap-1.5"
              onClick={() => {
                setEditingPatient(null);
                setFormDialogOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" /> New Patient
            </Button>
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingPatient(null);
                      setFormDialogOpen(true);
                    }}
                    className="gap-1.5"
                  >
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
                <TableHead>Gender / Age</TableHead>
                <TableHead>Phone / Email</TableHead>
                <TableHead>Smoking / Risk</TableHead>
                <TableHead>Medical Alerts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map(p => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => {
                    window.location.href = `/patients/${p.id}`;
                  }}
                >
                  <TableCell>
                    <Link
                      href={`/patients/${p.id}`}
                      className="flex items-center gap-2.5 font-medium"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {(p.firstName[0] + p.lastName[0]).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-foreground leading-tight">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">ID #{p.id}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <p>{genderLabel(p.gender)}</p>
                      <p className="text-muted-foreground">{formatDate(p.dateOfBirth)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <p className="font-medium text-foreground">{p.phone || "—"}</p>
                      <p className="text-muted-foreground truncate max-w-[150px]">{p.email || "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {formatSmokerBadge(p.smokingStatus)}
                      {p.bruxism && (
                        <p className="text-[10px] text-muted-foreground">Bruxism</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      {p.allergies ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]" title={p.allergies}>
                            {p.allergies}
                          </span>
                        </span>
                      ) : p.diabetes || p.bleedingDisorder || p.cardiovascular ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                          <HeartPulse className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {p.diabetes || p.bleedingDisorder || p.cardiovascular}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">No alerts</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingPatient(p as Patient);
                            setFormDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        asChild
                      >
                        <Link href={`/patients/${p.id}`}>View</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Patient Register / Edit Dialog */}
      <PatientFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        patient={editingPatient}
      />
    </DashboardLayout>
  );
}
