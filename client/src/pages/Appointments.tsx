import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDateTime, toDateStr } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/dental";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["scheduled", "confirmed", "completed", "no_show"] as const;

export default function Appointments() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(() =>
    toDateStr(new Date())
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDentist, setSelectedDentist] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(toDateStr(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [type, setType] = useState("checkup");
  const [notes, setNotes] = useState("");

  const patients = trpc.patients.list.useQuery({}, { enabled: !!role });

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
    { enabled: !!role }
  );

  const create = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Appointment scheduled");
      setDialogOpen(false);
      utils.appointments.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const update = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Appointment updated");
      utils.appointments.list.invalidate();
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

  const canManage =
    role === "admin" || role === "dentist" || role === "receptionist";
  const isStaff = role === "staff";

  const monthTitle = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
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
      cells.push(
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const byDate = new Map<string, typeof appointments.data>();
    (appointments.data ?? []).forEach(a => {
      const key =
        typeof a.appointmentDate === "string"
          ? a.appointmentDate
          : toDateStr(a.appointmentDate);
      const list = byDate.get(key) ?? [];
      list.push(a);
      byDate.set(key, list);
    });
    return { cells, byDate };
  }, [monthKey, appointments.data]);

  const prevMonth = () => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    const nextMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonthKey(nextMonthKey);
    setSelectedCalendarDay(`${nextMonthKey}-01`);
  };
  const nextMonth = () => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m, 1);
    const nextMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonthKey(nextMonthKey);
    setSelectedCalendarDay(`${nextMonthKey}-01`);
  };

  const selectedDayAppointments =
    calendarData.byDate.get(selectedCalendarDay) ?? [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Appointments"
        description="Schedule, reschedule, and track appointments."
        actions={
          canManage ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button className="gap-1.5" onClick={() => setDialogOpen(true)}>
                <CalendarPlus className="h-4 w-4" /> New Appointment
              </Button>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Schedule Appointment</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-3.5"
                  onSubmit={e => {
                    e.preventDefault();

                    const patientId = Number(selectedPatient);
                    const parsedDentistId = Number(selectedDentist);

                    if (!patientId) {
                      toast.error("Please select a patient");
                      return;
                    }

                    if (
                      !Number.isInteger(parsedDentistId) ||
                      parsedDentistId <= 0
                    ) {
                      toast.error("Please select a dentist");
                      return;
                    }

                    if (!appointmentDate || !startTime || !endTime) {
                      toast.error("Please complete the date and time fields");
                      return;
                    }

                    create.mutate({
                      patientId,
                      dentistId: parsedDentistId,
                      appointmentDate,
                      startTime,
                      endTime,
                      type: type || undefined,
                      status: "scheduled",
                      notes: notes || null,
                    });
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label>Patient *</Label>
                    <Select
                      value={selectedPatient}
                      onValueChange={setSelectedPatient}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {(patients.data ?? []).map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.firstName} {p.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={appointmentDate}
                        onChange={e => setAppointmentDate(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Type</Label>
                      <Input
                        value={type}
                        onChange={e => setType(e.target.value)}
                        placeholder="e.g. checkup"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Start time *</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>End time *</Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={create.isPending}
                    className="gap-1.5"
                  >
                    {create.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-4 w-4" />
                    )}
                    Schedule
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

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
                {s.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "list" ? (
        <SectionCard
          title={`${(appointments.data ?? []).length} appointment${(appointments.data ?? []).length === 1 ? "" : "s"}`}
        >
          {appointments.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !appointments.data?.length ? (
            <EmptyState
              title="No appointments this month"
              description="Create a new appointment to get started."
              action={
                canManage ? (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setDialogOpen(true)}
                  >
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
                  <div
                    key={a.id}
                    className="py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {patient
                          ? `${patient.firstName} ${patient.lastName}`
                          : `Patient #${a.patientId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(a.appointmentDate)} · {a.startTime}–
                        {a.endTime}
                        {a.type ? ` · ${a.type}` : ""}
                      </p>
                      {a.notes ? (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xl truncate">
                          {a.notes}
                        </p>
                      ) : null}
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
                                {s.replaceAll("_", " ")}
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
                                {s.replaceAll("_", " ")}
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
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={prevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={nextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-px bg-border/60 rounded-xl overflow-hidden">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div
                key={d}
                className="bg-muted/60 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase text-center"
              >
                {d}
              </div>
            ))}
            {calendarData.cells.map((day, i) => {
              const dayApps = day ? (calendarData.byDate.get(day) ?? []) : [];
              const isToday = day === toDateStr(new Date());
              const isSelected = day === selectedCalendarDay;
              return (
                <div
                  key={i}
                  role={day ? "button" : undefined}
                  tabIndex={day ? 0 : undefined}
                  aria-label={day ? `View appointments for ${day}` : undefined}
                  onClick={() => day && setSelectedCalendarDay(day)}
                  onKeyDown={event => {
                    if (day && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setSelectedCalendarDay(day);
                    }
                  }}
                  className={cn(
                    "min-h-20 bg-card p-1.5 transition-colors",
                    !day && "bg-muted/20",
                    day &&
                      "cursor-pointer hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    isSelected &&
                      "bg-primary/10 ring-2 ring-inset ring-primary/50"
                  )}
                >
                  {day ? (
                    <>
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayApps.slice(0, 3).map(a => (
                          <button
                            key={a.id}
                            onClick={event => {
                              event.stopPropagation();
                              update.mutate({
                                id: a.id,
                                data: {
                                  status:
                                    a.status === "scheduled"
                                      ? "confirmed"
                                      : "scheduled",
                                },
                              });
                            }}
                            className={cn(
                              "w-full truncate rounded px-1 py-0.5 text-[10px] font-medium text-left transition-transform hover:scale-[1.02]",
                              a.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : a.status === "completed"
                                  ? "bg-slate-100 text-slate-600"
                                  : a.status === "no_show"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-teal-100 text-teal-800"
                            )}
                          >
                            {a.startTime}{" "}
                            {patientById.get(a.patientId)?.firstName ?? "#"}
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
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Select a date to view all appointments for that day. Click an
            appointment to toggle scheduled/confirmed status.
          </p>
          <div className="mt-4 rounded-xl border bg-background p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Appointments for {selectedCalendarDay}
              </h3>
              <Badge variant="outline">
                {selectedDayAppointments.length} appointment
                {selectedDayAppointments.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {selectedDayAppointments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No appointments scheduled for this date.
              </p>
            ) : (
              <div className="divide-y divide-border/70">
                {selectedDayAppointments.map(a => {
                  const patient = patientById.get(a.patientId);
                  return (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {patient
                            ? `${patient.firstName} ${patient.lastName}`
                            : `Patient #${a.patientId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.startTime}–{a.endTime}
                          {a.type ? ` · ${a.type}` : ""}
                        </p>
                        {a.notes ? (
                          <p className="mt-0.5 max-w-xl truncate text-xs text-muted-foreground">
                            {a.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        {!isStaff ? (
                          <Select
                            value={a.status}
                            onValueChange={value =>
                              update.mutate({
                                id: a.id,
                                data: { status: value as "scheduled" },
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-32 bg-background text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(status => (
                                <SelectItem key={status} value={status}>
                                  {status.replaceAll("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </DashboardLayout>
  );
}
