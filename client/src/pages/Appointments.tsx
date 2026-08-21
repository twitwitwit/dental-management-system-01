import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { formatDate, formatStatusLabel, formatTime, toDateStr } from "@/lib/format";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/dental";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["scheduled", "confirmed", "completed", "no_show"] as const;

export default function Appointments() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedPatientLabel, setSelectedPatientLabel] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedDentist, setSelectedDentist] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{
    dentistId: number;
    dentistName: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(toDateStr(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignmentAppointmentId, setAssignmentAppointmentId] = useState("");
  const [assignmentDentistId, setAssignmentDentistId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [type, setType] = useState("checkup");
  const [notes, setNotes] = useState("");

  const patients = trpc.patients.list.useQuery({}, { enabled: !!role });
  const canBook = role === "receptionist";
  const dentists = trpc.appointments.dentists.useQuery(undefined, {
    enabled: canBook && (dialogOpen || assignDialogOpen),
  });
  const patientSearchResults = trpc.patients.list.useQuery(
    { search: patientSearch.trim() || undefined },
    {
      enabled: canBook && dialogOpen && patientSearch.trim().length >= 2,
    },
  );
  const availableSlots = trpc.appointments.availableSlots.useQuery(
    {
      date: appointmentDate,
      dentistId: selectedDentist ? Number(selectedDentist) : undefined,
    },
    {
      enabled: canBook && dialogOpen && Boolean(appointmentDate),
    },
  );

  const [monthKey, setMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const appointments = trpc.appointments.list.useQuery(
    {
      dateFrom: `${monthKey}-01`,
      dateTo: `${monthKey}-31`,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    { enabled: !!role },
  );

  const allMonthAppointments = trpc.appointments.list.useQuery(
    {
      dateFrom: `${monthKey}-01`,
      dateTo: `${monthKey}-31`,
    },
    { enabled: !!role },
  );

  const create = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Appointment scheduled");
      setSubmitError("");
      setDialogOpen(false);
      utils.appointments.list.invalidate();
      utils.appointments.availableSlots.invalidate();
    },
    onError: e => {
      setSubmitError(e.message);
      toast.error(e.message);
    },
  });

  const update = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Appointment updated");
      utils.appointments.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const assignDentist = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Dentist assigned to appointment");
      setAssignDialogOpen(false);
      setAssignmentAppointmentId("");
      setAssignmentDentistId("");
      utils.appointments.list.invalidate();
      utils.appointments.availableSlots.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const remove = trpc.appointments.delete.useMutation({
    onSuccess: () => {
      toast.success("Appointment deleted");
      utils.appointments.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const canManage = role === "admin" || role === "dentist" || role === "receptionist";
  const canAssignDentist = role === "receptionist";
  const isStaff = role === "staff";
  const unassignedAppointments = (allMonthAppointments.data ?? []).filter(a => !a.dentistId);
  const unassignedDentistCount = unassignedAppointments.length;

  const monthTitle = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  }, [monthKey]);

  const patientById = useMemo(() => {
    const map = new Map<number, { firstName: string; lastName: string }>();
    (patients.data ?? []).forEach(p => map.set(p.id, p));
    return map;
  }, [patients.data]);

  const calendarData = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startWeekday = first.getDay();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const byDate = new Map<string, typeof appointments.data>();
    (appointments.data ?? []).forEach(a => {
      const key = typeof a.appointmentDate === "string" ? a.appointmentDate : toDateStr(a.appointmentDate);
      const list = byDate.get(key) ?? [];
      list.push(a);
      byDate.set(key, list);
    });
    return { cells, byDate };
  }, [monthKey, appointments.data]);

  const prevMonth = () => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedCalendarDate(null);
  };
  const nextMonth = () => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedCalendarDate(null);
  };

  const selectedDayAppointments = selectedCalendarDate
    ? calendarData.byDate.get(selectedCalendarDate) ?? []
    : [];

  const selectedDayTitle = selectedCalendarDate
    ? new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <DashboardLayout>
      <PageHeader
        title="Appointments"
        description="Book visits, update status, and keep the daily schedule accurate."
        actions={
          canBook ? (
            <Dialog
              open={dialogOpen}
              onOpenChange={open => {
                setDialogOpen(open);
                if (!open) {
                  setSubmitError("");
                  setPatientSearch("");
                  setSelectedPatient("");
                  setSelectedPatientLabel("");
                  setSelectedDentist("");
                  setSelectedSlot(null);
                  setStartTime("");
                  setEndTime("");
                }
              }}
            >
              <Button className="gap-1.5" onClick={() => setDialogOpen(true)}>
                <CalendarPlus className="h-4 w-4" /> New Appointment
              </Button>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Request an appointment</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-4"
                  onSubmit={e => {
                    e.preventDefault();
                    const patientId = Number(selectedPatient);
                    if (!patientId) {
                      const message = "Select a patient before scheduling.";
                      setSubmitError(message);
                      toast.error(message);
                      return;
                    }
                    if (!selectedSlot) {
                      const message = "Choose an available time slot before scheduling.";
                      setSubmitError(message);
                      toast.error(message);
                      return;
                    }
                    setSubmitError("");
                    create.mutate({
                      patientId,
                      dentistId: selectedSlot.dentistId,
                      appointmentDate,
                      startTime: selectedSlot.startTime,
                      endTime: selectedSlot.endTime,
                      type: type || undefined,
                      status: "scheduled",
                      notes: notes || null,
                    });
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="appointment-patient-search">Patient *</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="appointment-patient-search"
                        value={selectedPatientLabel || patientSearch}
                        onChange={e => {
                          setSelectedPatient("");
                          setSelectedPatientLabel("");
                          setPatientSearch(e.target.value);
                        }}
                        placeholder="Search by patient name"
                        className="pl-9"
                        autoComplete="off"
                      />
                    </div>
                    {!selectedPatient && patientSearch.trim().length < 2 ? (
                      <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
                    ) : null}
                    {!selectedPatient && patientSearch.trim().length >= 2 ? (
                      <div className="max-h-40 overflow-y-auto rounded-lg border bg-background shadow-sm">
                        {patientSearchResults.isFetching ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching patients...
                          </div>
                        ) : patientSearchResults.data?.length ? (
                          patientSearchResults.data.slice(0, 20).map(p => (
                            <button
                              type="button"
                              key={p.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setSelectedPatient(String(p.id));
                                setSelectedPatientLabel(`${p.firstName} ${p.lastName}`);
                                setPatientSearch("");
                              }}
                            >
                              <UserRound className="h-4 w-4 text-muted-foreground" />
                              <span>{p.firstName} {p.lastName}</span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No matching patients found.</p>
                        )}
                      </div>
                    ) : null}
                    {selectedPatient ? (
                      <p className="text-xs font-medium text-primary">Selected patient: {selectedPatientLabel}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="appointment-date">Date *</Label>
                      <Input
                        id="appointment-date"
                        type="date"
                        value={appointmentDate}
                        onChange={e => {
                          setAppointmentDate(e.target.value);
                          setSelectedSlot(null);
                          setStartTime("");
                          setEndTime("");
                        }}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="appointment-dentist">Dentist</Label>
                      <div className="relative">
                        <Stethoscope className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Select
                          value={selectedDentist || "any"}
                          onValueChange={value => {
                            setSelectedDentist(value === "any" ? "" : value);
                            setSelectedSlot(null);
                            setStartTime("");
                            setEndTime("");
                          }}
                        >
                          <SelectTrigger id="appointment-dentist" className="pl-9">
                            <SelectValue placeholder="Any available dentist" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any available dentist</SelectItem>
                            {(dentists.data ?? []).map(dentist => (
                              <SelectItem key={dentist.id} value={String(dentist.id)}>
                                {dentist.name ?? dentist.email ?? `Dentist #${dentist.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!dentists.isLoading && !dentists.data?.length ? (
                        <p className="text-xs text-destructive">No active dentist account is available for scheduling.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Available time *</Label>
                      {availableSlots.isFetching ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking availability
                        </span>
                      ) : null}
                    </div>
                    {availableSlots.data?.length ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {availableSlots.data.map(slot => {
                          const isSelected = selectedSlot?.dentistId === slot.dentistId
                            && selectedSlot.startTime === slot.startTime
                            && selectedSlot.endTime === slot.endTime;
                          return (
                            <button
                              key={`${slot.dentistId}-${slot.startTime}-${slot.endTime}`}
                              type="button"
                              aria-pressed={isSelected}
                              className={cn(
                                "rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5",
                                isSelected && "border-primary bg-primary/10 ring-2 ring-primary/20",
                              )}
                              onClick={() => {
                                setSelectedSlot(slot);
                                setStartTime(slot.startTime);
                                setEndTime(slot.endTime);
                                setSubmitError("");
                              }}
                            >
                              <span className="block text-sm font-medium">{formatTime(slot.startTime)}</span>
                              <span className="block truncate text-xs text-muted-foreground">{slot.dentistName}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : availableSlots.isFetching ? null : (
                      <div className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                        No available time slots for this date and dentist selection.
                      </div>
                    )}
                    {selectedSlot ? (
                      <p className="text-xs font-medium text-primary">
                        Selected: {formatTime(selectedSlot.startTime)}–{formatTime(selectedSlot.endTime)} with {selectedSlot.dentistName}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="appointment-type">Visit type</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger id="appointment-type"><SelectValue placeholder="Choose visit type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checkup">Checkup</SelectItem>
                          <SelectItem value="cleaning">Cleaning</SelectItem>
                          <SelectItem value="consultation">Consultation</SelectItem>
                          <SelectItem value="restoration">Restoration</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="appointment-notes">Note for the clinic</Label>
                      <Input id="appointment-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
                    </div>
                  </div>

                  {submitError ? (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  ) : null}
                  <Button type="submit" disabled={create.isPending || !selectedPatient || !selectedSlot} className="gap-1.5 sm:w-fit">
                    {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                    Schedule appointment
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {unassignedDentistCount > 0 ? (
        <>
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{unassignedDentistCount} appointment{unassignedDentistCount === 1 ? " is" : "s are"} missing a dentist</p>
                  <p className="mt-0.5 text-sm">
                    These are legacy appointments. Assign a dentist before confirming or rescheduling them.
                  </p>
                </div>
                {canAssignDentist ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/70"
                    onClick={() => {
                      setAssignmentAppointmentId("");
                      setAssignmentDentistId("");
                      setAssignDialogOpen(true);
                    }}
                  >
                    <Stethoscope className="h-4 w-4" /> Assign dentist
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 text-xs font-medium">
                {canAssignDentist
                  ? "Select an affected appointment and an active dentist to repair the record."
                  : "Ask a receptionist to assign a dentist to these existing records."}
              </p>
            </div>
          </div>

          {canAssignDentist ? (
            <Dialog
              open={assignDialogOpen}
              onOpenChange={open => {
                setAssignDialogOpen(open);
                if (!open) {
                  setAssignmentAppointmentId("");
                  setAssignmentDentistId("");
                }
              }}
            >
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Assign dentist to existing appointment</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <p className="text-sm text-muted-foreground">
                    Choose a dentist for a legacy appointment that was created without one. The system will check for schedule conflicts before saving.
                  </p>

                  <div className="grid gap-1.5">
                    <Label htmlFor="unassigned-appointment">Appointment *</Label>
                    <Select value={assignmentAppointmentId} onValueChange={setAssignmentAppointmentId}>
                      <SelectTrigger id="unassigned-appointment">
                        <SelectValue placeholder="Select an appointment" />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedAppointments.map(a => {
                          const patient = patientById.get(a.patientId);
                          const patientName = patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${a.patientId}`;
                          return (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {formatDate(a.appointmentDate)} · {formatTime(a.startTime)}–{formatTime(a.endTime)} · {patientName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="assignment-dentist">Dentist *</Label>
                    <Select value={assignmentDentistId} onValueChange={setAssignmentDentistId}>
                      <SelectTrigger id="assignment-dentist">
                        <SelectValue placeholder="Select an active dentist" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dentists.data ?? []).map(dentist => (
                          <SelectItem key={dentist.id} value={String(dentist.id)}>
                            {dentist.name ?? dentist.email ?? `Dentist #${dentist.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    className="gap-1.5"
                    disabled={!assignmentAppointmentId || !assignmentDentistId || assignDentist.isPending}
                    onClick={() => {
                      if (!assignmentAppointmentId || !assignmentDentistId) return;
                      assignDentist.mutate({
                        id: Number(assignmentAppointmentId),
                        data: { dentistId: Number(assignmentDentistId) },
                      });
                    }}
                  >
                    {assignDentist.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                    Assign dentist
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("list")}
        >
          List
        </Button>
        <Button
          variant={view === "calendar" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("calendar")}
        >
          Calendar
        </Button>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-background h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => (
              <SelectItem key={s} value={s}>
                {formatStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "list" ? (
        <SectionCard title={`${(appointments.data ?? []).length} appointment${(appointments.data ?? []).length === 1 ? "" : "s"}`}>
          {appointments.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !appointments.data?.length ? (
            <EmptyState
              title="No visits scheduled this month"
              description="There are no visits in the selected month."
              action={
                canBook ? (
                  <Button variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                    <CalendarPlus className="h-4 w-4" /> New Appointment
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-border/70">
              {appointments.data.map(a => {
                const patient = patientById.get(a.patientId);
                return (
                  <div key={a.id} className="py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${a.patientId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.appointmentDate)} · {formatTime(a.startTime)}–{formatTime(a.endTime)}
                        {a.type ? ` · ${a.type}` : ""}
                      </p>
                      {a.notes ? <p className="text-xs text-muted-foreground mt-0.5 max-w-xl truncate">{a.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      {!isStaff && (
                        <Select
                          value={a.status}
                          onValueChange={v =>
                            update.mutate({
                              id: a.id,
                              data: { status: v as "scheduled" },
                            })
                          }
                        >
                          <SelectTrigger className="w-32 h-8 bg-background text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => (
                              <SelectItem key={s} value={s}>
                                {formatStatusLabel(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isStaff && (
                        <Select
                          value={a.status}
                          onValueChange={v =>
                            update.mutate({
                              id: a.id,
                              data: { status: v as "scheduled" },
                            })
                          }
                        >
                          <SelectTrigger className="w-32 h-8 bg-background text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => (
                              <SelectItem key={s} value={s}>
                                {formatStatusLabel(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {canManage && !isStaff ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate({ id: a.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title={monthTitle}
          actions={
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-px bg-border/60 rounded-xl overflow-hidden">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="bg-muted/60 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase text-center">
                {d}
              </div>
            ))}
            {calendarData.cells.map((day, i) => {
              const dayApps = day ? (calendarData.byDate.get(day) ?? []) : [];
              const isToday = day === toDateStr(new Date());
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-20 bg-card p-1.5",
                    !day && "bg-muted/20",
                  )}
                >
                  {day ? (
                    <>
                      <button
                        type="button"
                        aria-label={`Show appointments for ${day}`}
                        aria-pressed={selectedCalendarDate === day}
                        onClick={() => setSelectedCalendarDate(day)}
                        className={cn(
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[11px] font-semibold transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isToday ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground",
                          selectedCalendarDate === day && !isToday ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "",
                        )}
                      >
                        {Number(day.slice(8))}
                      </button>
                      <div className="mt-1 space-y-0.5">
                        {dayApps.slice(0, 3).map(a => (
                          <button
                            key={a.id}
                            onClick={() => update.mutate({ id: a.id, data: { status: a.status === "scheduled" ? "confirmed" : "scheduled" } })}
                            className={cn(
                              "w-full truncate rounded px-1 py-0.5 text-[10px] font-medium text-left transition-transform hover:scale-[1.02]",
                              a.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : a.status === "completed"
                                  ? "bg-slate-100 text-slate-600"
                                  : a.status === "no_show"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-teal-100 text-teal-800",
                            )}
                          >
                            {a.startTime} {patientById.get(a.patientId)?.firstName ?? "#"}
                          </button>
                        ))}
                        {dayApps.length > 3 ? (
                          <Badge variant="outline" className="text-[10px]">
                            +{dayApps.length - 3} more
                          </Badge>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>

          {selectedCalendarDate ? (
            <div className="mt-4 rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Appointments for {selectedDayTitle}</p>
                  <p className="text-xs text-muted-foreground">All appointments matching the selected status filter are shown below.</p>
                </div>
                <Badge variant="outline">
                  {selectedDayAppointments.length} appointment{selectedDayAppointments.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {selectedDayAppointments.length ? (
                <div className="mt-3 divide-y divide-border/70 rounded-lg border bg-card">
                  {selectedDayAppointments.map(a => {
                    const patient = patientById.get(a.patientId);
                    return (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${a.patientId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(a.startTime)}–{formatTime(a.endTime)}{a.type ? ` · ${a.type}` : ""}
                          </p>
                          {a.notes ? <p className="mt-0.5 max-w-xl truncate text-xs text-muted-foreground">{a.notes}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={a.status} />
                          {!isStaff ? (
                            <Select
                              value={a.status}
                              onValueChange={v => update.mutate({ id: a.id, data: { status: v as "scheduled" } })}
                            >
                              <SelectTrigger className="h-8 w-32 bg-background text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map(s => <SelectItem key={s} value={s}>{formatStatusLabel(s)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  No appointments found for this date with the current status filter.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Click a date number to view every appointment scheduled for that day.
            </p>
          )}
        </SectionCard>
      )}
    </DashboardLayout>
  );
}
