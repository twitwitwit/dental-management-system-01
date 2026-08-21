import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appointments,
  clinicSettings,
  clinicalNotes,
  insuranceClaims,
  insuranceProviders,
  inventoryItems,
  inventoryMovements,
  invoiceItems,
  invoices,
  patientAccounts,
  patientDocuments,
  patientInsurance,
  patientHealthForms,
  patientPortalInvitations,
  patientPortalRecoveryRequests,
  patients,
  payments,
  periodontalStatus,
  toothConditions,
  toothSurfaceConditions,
  treatmentPlans,
  treatmentProcedures,
  users,
  type InsertAppointment,
  type InsertClinicalNote,
  type InsertInsuranceClaim,
  type InsertInsuranceProvider,
  type InsertInventoryItem,
  type InsertInventoryMovement,
  type InsertInvoice,
  type InsertInvoiceItem,
  type InsertPatient,
  type InsertPatientDocument,
  type InsertPatientInsurance,
  type InsertPayment,
  type InsertPeriodontalStatus,
  type InsertToothCondition,
  type InsertToothSurfaceCondition,
  type InsertTreatmentPlan,
  type InsertTreatmentProcedure,
  type InsertUser,
} from "../drizzle/schema";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getPatientAccountByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(patientAccounts)
    .where(eq(patientAccounts.userId, userId))
    .limit(1);
  return rows[0];
}

export async function getPatientAccountByPatientId(patientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(patientAccounts)
    .where(eq(patientAccounts.patientId, patientId))
    .limit(1);
  return rows[0];
}

export async function getPatientPortalByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const account = await getPatientAccountByUserId(userId);
  if (!account) return undefined;
  const patient = await getPatientById(account.patientId);
  if (!patient) return undefined;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return { account, patient, user: userRows[0] };
}

export async function createPatientPortalAccount(data: {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
  phone?: string | null;
  address?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const patientResult = await tx.insert(patients).values({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      status: "active",
    });
    const patientId = Number(patientResult[0].insertId);

    const userResult = await tx.insert(users).values({
      openId: `patient_${randomUUID()}`,
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      loginMethod: "local_patient",
      passwordHash: data.passwordHash,
      role: "patient",
      isActive: true,
      phone: data.phone ?? null,
    });
    const userId = Number(userResult[0].insertId);

    const accountResult = await tx.insert(patientAccounts).values({
      userId,
      patientId,
      verificationStatus: "verified",
      verificationNote: "Self-registered patient account; no manual verification required.",
      verifiedAt: new Date(),
      verifiedByUserId: null,
    });

    return {
      userId,
      patientId,
      patientAccountId: Number(accountResult[0].insertId),
    };
  });
}

export async function updatePatientPortalVerification(
  patientAccountId: number,
  input: {
    status: "verified" | "rejected" | "suspended";
    note?: string | null;
    verifiedByUserId: number;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const accountRows = await db
    .select()
    .from(patientAccounts)
    .where(eq(patientAccounts.id, patientAccountId))
    .limit(1);
  const account = accountRows[0];
  if (!account) return undefined;

  await db
    .update(patientAccounts)
    .set({
      verificationStatus: input.status,
      verificationNote: input.note ?? null,
      verifiedAt: input.status === "verified" ? new Date() : null,
      verifiedByUserId: input.verifiedByUserId,
    })
    .where(eq(patientAccounts.id, patientAccountId));

  await db
    .update(users)
    .set({ isActive: input.status === "verified" })
    .where(eq(users.id, account.userId));

  return { ...account, verificationStatus: input.status };
}

export async function listPatientPortalAccounts(status?: "pending" | "verified" | "rejected" | "suspended") {
  const db = await getDb();
  if (!db) return [];
  const accounts = await db
    .select()
    .from(patientAccounts)
    .where(status ? eq(patientAccounts.verificationStatus, status) : undefined)
    .orderBy(desc(patientAccounts.createdAt));

  const result = [];
  for (const account of accounts) {
    const patient = await getPatientById(account.patientId);
    const userRows = await db.select().from(users).where(eq(users.id, account.userId)).limit(1);
    if (patient && userRows[0]) result.push({ account, patient, user: userRows[0] });
  }
  return result;
}

export async function listAvailableDentists() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.role, "dentist"), eq(users.isActive, true)))
    .orderBy(asc(users.name));
}

const PORTAL_SLOTS = [
  ["09:00", "09:30"], ["09:30", "10:00"], ["10:00", "10:30"],
  ["10:30", "11:00"], ["11:00", "11:30"], ["11:30", "12:00"],
  ["13:00", "13:30"], ["13:30", "14:00"], ["14:00", "14:30"],
  ["14:30", "15:00"], ["15:00", "15:30"], ["15:30", "16:00"],
  ["16:00", "16:30"], ["16:30", "17:00"],
] as const;

/** Convert MySQL HH:MM:SS values and portal HH:MM values to HH:MM. */
function normalizePortalTime(value: string) {
  return value.slice(0, 5);
}

export async function listAvailableDentistSlots(date: string, dentistId?: number) {
  const db = await getDb();
  if (!db) return [];

  const dentists = dentistId
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(
          and(
            eq(users.id, dentistId),
            eq(users.role, "dentist"),
            eq(users.isActive, true),
          ),
        )
    : await listAvailableDentists();

  const results: Array<{
    dentistId: number;
    dentistName: string;
    startTime: string;
    endTime: string;
  }> = [];

  for (const dentist of dentists) {
    const booked = await db
      .select({
        startTime: appointments.startTime,
        endTime: appointments.endTime,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.dentistId, dentist.id),
          // appointmentDate is a MySQL DATE column. Compare the stored date
          // directly without wrapping it in DATE(...), preserving index use.
          sql`${appointments.appointmentDate} = ${date}`,
          inArray(appointments.status, ["scheduled", "confirmed"]),
        ),
      );

    // MySQL may return varchar(8) times as HH:MM:SS, while PORTAL_SLOTS use
    // HH:MM. Compare intervals so a longer booking blocks every overlapping
    // 30-minute slot, not only an exact matching start/end pair.
    const toMinutes = (value: string) => {
      const [hours, minutes] = normalizePortalTime(value).split(":").map(Number);
      return hours * 60 + minutes;
    };
    const occupied = booked.map(slot => ({
      start: toMinutes(slot.startTime),
      end: toMinutes(slot.endTime),
    }));

    for (const [startTime, endTime] of PORTAL_SLOTS) {
      const slotStart = toMinutes(startTime);
      const slotEnd = toMinutes(endTime);
      const overlaps = occupied.some(
        booking => slotStart < booking.end && slotEnd > booking.start,
      );
      if (!overlaps) {
        results.push({
          dentistId: dentist.id,
          dentistName: dentist.name ?? "Dentist",
          startTime,
          endTime,
        });
      }
    }
  }

  return results;
}

export async function createPatientPortalAppointment(data: {
  patientId: number;
  dentistId: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  type: string;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startTime = normalizePortalTime(data.startTime);
  const endTime = normalizePortalTime(data.endTime);

  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new Error("Appointment times must use HH:MM format.");
  }

  // Reject reversed or zero-length intervals before querying or inserting.
  if (startTime >= endTime) {
    throw new Error("Appointment end time must be later than the start time.");
  }

  const conflict = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.dentistId, data.dentistId),
        sql`${appointments.appointmentDate} = ${data.appointmentDate}`,
        inArray(appointments.status, ["scheduled", "confirmed"]),
        // Existing start < new end AND existing end > new start.
        sql`${appointments.startTime} < ${endTime} AND ${appointments.endTime} > ${startTime}`,
      ),
    )
    .limit(1);

  if (conflict.length > 0) {
    throw new Error("That time has just been booked. Please choose another slot.");
  }

  const result = await db.insert(appointments).values({
    patientId: data.patientId,
    dentistId: data.dentistId,
    appointmentDate: new Date(data.appointmentDate),
    // Store new portal bookings consistently as HH:MM.
    startTime,
    endTime,
    type: data.type,
    status: "scheduled",
    notes: data.notes ?? "Booked through the patient portal.",
  });

  return Number(result[0].insertId);
}

export async function getPatientPortalChart(patientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [conditions, surfaces, perio, plans, notes, documents] = await Promise.all([
    db.select().from(toothConditions).where(eq(toothConditions.patientId, patientId)),
    db.select().from(toothSurfaceConditions).where(eq(toothSurfaceConditions.patientId, patientId)),
    db.select().from(periodontalStatus).where(eq(periodontalStatus.patientId, patientId)),
    db.select().from(treatmentPlans).where(eq(treatmentPlans.patientId, patientId)).orderBy(desc(treatmentPlans.updatedAt)),
    db.select().from(clinicalNotes).where(eq(clinicalNotes.patientId, patientId)).orderBy(desc(clinicalNotes.noteDate)),
    db.select().from(patientDocuments).where(and(eq(patientDocuments.patientId, patientId), eq(patientDocuments.visibleToPatient, true))).orderBy(desc(patientDocuments.uploadedAt)),
  ]);
  return { conditions, surfaces, perio, plans, notes, documents };
}

export async function listPatientDocuments(patientId: number, visibleOnly = true) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(patientDocuments)
    .where(visibleOnly
      ? and(eq(patientDocuments.patientId, patientId), eq(patientDocuments.visibleToPatient, true))
      : eq(patientDocuments.patientId, patientId))
    .orderBy(desc(patientDocuments.uploadedAt));
}

export async function createPatientDocument(data: InsertPatientDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(patientDocuments).values(data);
  return Number(result[0].insertId);
}

export async function getPatientDocumentForView(documentId: number, patientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(patientDocuments)
    .where(and(
      eq(patientDocuments.id, documentId),
      eq(patientDocuments.patientId, patientId),
      eq(patientDocuments.visibleToPatient, true),
    ))
    .limit(1);
  return rows[0];
}


export async function updatePatientPortalProfile(patientId: number, userId: number, data: {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
  phone?: string | null;
  address?: string | null;
  occupation?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    await tx.update(users).set({
      name: `${data.firstName} ${data.lastName}`.trim(),
      phone: data.phone ?? null,
    }).where(eq(users.id, userId));
    await tx.update(patients).set({
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      occupation: data.occupation ?? null,
      emergencyContactName: data.emergencyContactName ?? null,
      emergencyContactPhone: data.emergencyContactPhone ?? null,
      emergencyContactRelation: data.emergencyContactRelation ?? null,
    }).where(eq(patients.id, patientId));
  });
}

export async function getPatientPortalProfile(patientId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(users.id, userId))
    .where(and(eq(patients.id, patientId), eq(users.id, userId)))
    .limit(1);
  return rows[0];
}


export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------
export async function listPatients(opts?: { search?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (opts?.search) {
    const q = `%${opts.search}%`;
    conds.push(
      or(
        like(patients.firstName, q),
        like(patients.lastName, q),
        like(patients.phone, q),
        like(patients.email, q),
      ),
    );
  }
  if (opts?.status) conds.push(eq(patients.status, opts.status as "active" | "inactive"));
  return db
    .select()
    .from(patients)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(patients.registeredAt));
}

export async function getPatientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  return rows[0];
}

export async function createPatient(data: InsertPatient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(patients).values(data);
  return result[0].insertId;
}

export async function updatePatient(id: number, data: Partial<InsertPatient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(patients).set(data).where(eq(patients.id, id));
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
export async function listAppointments(opts?: {
  patientId?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (opts?.patientId) conds.push(eq(appointments.patientId, opts.patientId));
  if (opts?.dateFrom) conds.push(sql`appointments.appointmentDate >= ${opts.dateFrom}`);
  if (opts?.dateTo) conds.push(sql`appointments.appointmentDate <= ${opts.dateTo}`);
  if (opts?.status) conds.push(eq(appointments.status, opts.status as "scheduled" | "confirmed" | "completed" | "no_show"));
  return db
    .select()
    .from(appointments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(appointments.appointmentDate, appointments.startTime);
}

const ACTIVE_APPOINTMENT_STATUSES = ["scheduled", "confirmed"] as const;

type AppointmentTime = string;

function normalizeAppointmentTime(value: AppointmentTime) {
  const normalized = value.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    throw new Error("Appointment times must use HH:MM format.");
  }
  return normalized;
}

function assertValidAppointmentRange(startTime: string, endTime: string) {
  if (startTime >= endTime) {
    throw new Error("Appointment end time must be later than the start time.");
  }
}

function appointmentDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

/**
 * Reject any active appointment whose interval overlaps the proposed interval.
 *
 * Half-open interval rule:
 *   [newStart, newEnd) conflicts with [existingStart, existingEnd) when
 *   existingStart < newEnd AND existingEnd > newStart.
 *
 * Appointments ending exactly when another begins are therefore allowed.
 */
async function assertNoAppointmentConflict(
  db: Awaited<ReturnType<typeof getDb>>,
  input: {
    dentistId: number | null | undefined;
    appointmentDate: Date;
    startTime: string;
    endTime: string;
    excludeAppointmentId?: number;
  },
) {
  if (!db) return;
  if (input.dentistId == null) {
    throw new Error("A dentist must be selected before scheduling an appointment.");
  }

  const conditions = [
    eq(appointments.dentistId, input.dentistId),
    sql`${appointments.appointmentDate} = ${appointmentDateKey(input.appointmentDate)}`,
    inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
    sql`${appointments.startTime} < ${input.endTime} AND ${appointments.endTime} > ${input.startTime}`,
  ];

  if (input.excludeAppointmentId !== undefined) {
    conditions.push(sql`${appointments.id} <> ${input.excludeAppointmentId}`);
  }

  const conflict = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(...conditions))
    .limit(1);

  if (conflict.length > 0) {
    throw new Error(
      "That dentist already has a scheduled or confirmed appointment during this time. Please choose another time.",
    );
  }
}

export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startTime = normalizeAppointmentTime(data.startTime);
  const endTime = normalizeAppointmentTime(data.endTime);
  assertValidAppointmentRange(startTime, endTime);

  const appointmentData: InsertAppointment = {
    ...data,
    startTime,
    endTime,
    // The database default is scheduled, so make that state explicit before
    // running the conflict check as well.
    status: data.status ?? "scheduled",
  };

  // Only active appointments reserve a dentist’s time. Completed and no-show
  // records remain in history but do not block a new appointment.
  if (appointmentData.status === "scheduled" || appointmentData.status === "confirmed") {
    await assertNoAppointmentConflict(db, {
      dentistId: appointmentData.dentistId,
      appointmentDate: appointmentData.appointmentDate,
      startTime,
      endTime,
    });
  }

  const result = await db.insert(appointments).values(appointmentData);
  return result[0].insertId;
}

export async function updateAppointment(id: number, data: Partial<InsertAppointment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingRows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return;

  const nextDentistId = data.dentistId !== undefined ? data.dentistId : existing.dentistId;
  const nextDate = data.appointmentDate !== undefined ? data.appointmentDate : existing.appointmentDate;
  const nextStartTime = data.startTime !== undefined
    ? normalizeAppointmentTime(data.startTime)
    : normalizeAppointmentTime(existing.startTime);
  const nextEndTime = data.endTime !== undefined
    ? normalizeAppointmentTime(data.endTime)
    : normalizeAppointmentTime(existing.endTime);
  const nextStatus = data.status !== undefined ? data.status : existing.status;

  assertValidAppointmentRange(nextStartTime, nextEndTime);

  if (nextStatus === "scheduled" || nextStatus === "confirmed") {
    await assertNoAppointmentConflict(db, {
      dentistId: nextDentistId,
      appointmentDate: nextDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      excludeAppointmentId: id,
    });
  }

  await db
    .update(appointments)
    .set({
      ...data,
      startTime: nextStartTime,
      endTime: nextEndTime,
    })
    .where(eq(appointments.id, id));
}

export async function deleteAppointment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(appointments).where(eq(appointments.id, id));
}

// ---------------------------------------------------------------------------
// Clinical records
// ---------------------------------------------------------------------------
export async function getToothConditions(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(toothConditions).where(eq(toothConditions.patientId, patientId));
}

export async function setToothCondition(data: InsertToothCondition) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert: one condition per patient per tooth
  const existing = await db
    .select()
    .from(toothConditions)
    .where(
      and(
        eq(toothConditions.patientId, data.patientId),
        eq(toothConditions.toothNumber, data.toothNumber),
        eq(toothConditions.mode, data.mode ?? "status"),
      ),
    )
    .limit(1);
  if (existing.length) {
    await db
      .update(toothConditions)
      .set({ condition: data.condition, note: data.note, mode: data.mode ?? "status" })
      .where(eq(toothConditions.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(toothConditions).values(data);
  return result[0].insertId;
}

// ---------------------------------------------------------------------------
// Tooth surface conditions (mesial / distal / buccal / lingual / occlusal)
// ---------------------------------------------------------------------------
export async function getToothSurfaceConditions(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(toothSurfaceConditions).where(eq(toothSurfaceConditions.patientId, patientId));
}

export async function setToothSurfaceCondition(data: InsertToothSurfaceCondition) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert: one condition per patient per tooth per surface
  const existing = await db
    .select()
    .from(toothSurfaceConditions)
    .where(
      and(
        eq(toothSurfaceConditions.patientId, data.patientId),
        eq(toothSurfaceConditions.toothNumber, data.toothNumber),
        eq(toothSurfaceConditions.surface, data.surface),
      ),
    )
    .limit(1);
  if (existing.length) {
    await db
      .update(toothSurfaceConditions)
      .set({ condition: data.condition, note: data.note })
      .where(eq(toothSurfaceConditions.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(toothSurfaceConditions).values(data);
  return result[0].insertId;
}

const TOOTH_CONDITIONS = [
  "healthy", "decay", "filling", "crown", "extraction",
  "implant", "root_canal", "missing", "veneers", "bridge",
] as const;

export async function setToothConditionsBulk(
  patientId: number,
  entries: { toothNumber: string; condition: (typeof TOOTH_CONDITIONS)[number]; mode?: string; note?: string | null }[],
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const e of entries) {
    await setToothCondition({
      patientId,
      toothNumber: e.toothNumber,
      condition: e.condition,
      mode: (e.mode ?? "status") as "status" | "plan",
      note: e.note ?? null,
    });
  }
  return { count: entries.length };
}

// ---------------------------------------------------------------------------
// Periodontal (gum) status — 6-point probing per tooth
// ---------------------------------------------------------------------------
export async function getPeriodontalStatus(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(periodontalStatus).where(eq(periodontalStatus.patientId, patientId));
}

export async function setPeriodontalStatus(data: InsertPeriodontalStatus) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(periodontalStatus)
    .where(
      and(
        eq(periodontalStatus.patientId, data.patientId),
        eq(periodontalStatus.toothNumber, data.toothNumber),
      ),
    )
    .limit(1);
  if (existing.length) {
    await db.update(periodontalStatus).set(data).where(eq(periodontalStatus.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(periodontalStatus).values(data);
  return result[0].insertId;
}

export async function listTreatmentPlans(patientId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conds = patientId ? [eq(treatmentPlans.patientId, patientId)] : [];
  return db
    .select()
    .from(treatmentPlans)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(treatmentPlans.createdAt));
}

export async function createTreatmentPlan(data: InsertTreatmentPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(treatmentPlans).values(data);
  return result[0].insertId;
}

export async function updateTreatmentPlan(id: number, data: Partial<InsertTreatmentPlan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(treatmentPlans).set(data).where(eq(treatmentPlans.id, id));
}

export async function listProceduresByPlan(planId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(treatmentProcedures).where(eq(treatmentProcedures.planId, planId));
}

export async function createProcedure(data: InsertTreatmentProcedure) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(treatmentProcedures).values(data);
  return result[0].insertId;
}

export async function updateProcedure(id: number, data: Partial<InsertTreatmentProcedure>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(treatmentProcedures).set(data).where(eq(treatmentProcedures.id, id));
}

export async function listClinicalNotes(patientId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conds = patientId ? [eq(clinicalNotes.patientId, patientId)] : [];
  return db
    .select()
    .from(clinicalNotes)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(clinicalNotes.noteDate));
}

export async function createClinicalNote(data: InsertClinicalNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clinicalNotes).values(data);
  return result[0].insertId;
}

export async function updateClinicalNote(id: number, data: Partial<InsertClinicalNote>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clinicalNotes).set(data).where(eq(clinicalNotes.id, id));
}

export async function deleteClinicalNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clinicalNotes).where(eq(clinicalNotes.id, id));
}

// ---------------------------------------------------------------------------
// Billing & payments
// ---------------------------------------------------------------------------
function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export async function listInvoices(opts?: { patientId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conds = opts?.patientId ? [eq(invoices.patientId, opts.patientId)] : [];
  return db
    .select()
    .from(invoices)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return rows[0];
}

export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoices).values(data);
  return result[0].insertId;
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

export async function listInvoiceItems(invoiceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

export async function createInvoiceItem(data: InsertInvoiceItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoiceItems).values(data);
  return result[0].insertId;
}

export async function deleteInvoiceItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(invoiceItems).where(eq(invoiceItems.id, id));
}

export async function listPayments(opts?: { patientId?: number; invoiceId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (opts?.patientId) conds.push(eq(payments.patientId, opts.patientId));
  if (opts?.invoiceId) conds.push(eq(payments.invoiceId, opts.invoiceId));
  return db
    .select()
    .from(payments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(payments.paidAt));
}

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payments).values(data);
  return result[0].insertId;
}

/**
 * Compute invoice totals: invoice row totals + paid amount.
 */
export async function getInvoiceBalance(invoiceId: number) {
  const db = await getDb();
  if (!db) return { total: 0, paid: 0, balance: 0 };
  const inv = await getInvoiceById(invoiceId);
  const paidRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  const paid = paidRows.reduce(
    (acc, p) => acc + toNumber(p.amount) * (p.type === "refund" ? -1 : 1),
    0,
  );
  const total = toNumber(inv?.total);
  return { total, paid: Math.max(0, paid), balance: Math.max(0, total - paid) };
}

/** Total paid revenue across all invoices (payments of type payment minus refunds). */
export async function getTotalRevenue(opts?: { from?: string; to?: string }) {
  const db = await getDb();
  if (!db) return 0;
  const conds = [];
  if (opts?.from) conds.push(sql`payments.paidAt >= ${opts.from}`);
  if (opts?.to) conds.push(sql`payments.paidAt <= ${opts.to}`);
  const rows = await db
    .select({
      amount: payments.amount,
      type: payments.type,
    })
    .from(payments)
    .where(conds.length ? and(...conds) : undefined);
  return rows.reduce(
    (acc, r) => acc + toNumber(r.amount) * (r.type === "refund" ? -1 : 1),
    0,
  );
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export async function listInventoryItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryItems).orderBy(inventoryItems.name);
}

export async function getInventoryItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
  return rows[0];
}

export async function createInventoryItem(data: InsertInventoryItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(inventoryItems).values(data);
  return result[0].insertId;
}

export async function updateInventoryItem(id: number, data: Partial<InsertInventoryItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inventoryItems).set(data).where(eq(inventoryItems.id, id));
}

export async function adjustInventory(
  itemId: number,
  type: "stock_in" | "stock_out" | "adjustment",
  quantity: number,
  reason?: string,
  createdBy?: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const item = await getInventoryItemById(itemId);
  if (!item) throw new Error("Inventory item not found");
  let newQty = item.quantity;
  if (type === "stock_in") newQty += quantity;
  else if (type === "stock_out") newQty -= quantity;
  else newQty = quantity;
  if (newQty < 0) throw new Error("Stock cannot go below zero");
  await db.update(inventoryItems).set({
    quantity: newQty,
    lastRestockedAt: type === "stock_in" ? new Date() : item.lastRestockedAt,
  }).where(eq(inventoryItems.id, itemId));
  const result = await db
    .insert(inventoryMovements)
    .values({ itemId, type, quantity, reason, createdBy });
  return { newQuantity: newQty, movementId: result[0].insertId };
}

export async function listInventoryMovements(opts?: { itemId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conds = opts?.itemId ? [eq(inventoryMovements.itemId, opts.itemId)] : [];
  return db
    .select()
    .from(inventoryMovements)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(100);
}

// ---------------------------------------------------------------------------
// Insurance
// ---------------------------------------------------------------------------
export async function listInsuranceProviders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(insuranceProviders).orderBy(insuranceProviders.name);
}

export async function createInsuranceProvider(data: InsertInsuranceProvider) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(insuranceProviders).values(data);
  return result[0].insertId;
}

export async function updateInsuranceProvider(id: number, data: Partial<InsertInsuranceProvider>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(insuranceProviders).set(data).where(eq(insuranceProviders.id, id));
}

export async function listPatientInsurance(patientId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conds = patientId ? [eq(patientInsurance.patientId, patientId)] : [];
  return db
    .select()
    .from(patientInsurance)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(patientInsurance.createdAt));
}

export async function createPatientInsurance(data: InsertPatientInsurance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(patientInsurance).values(data);
  return result[0].insertId;
}

export async function updatePatientInsurance(id: number, data: Partial<InsertPatientInsurance>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(patientInsurance).set(data).where(eq(patientInsurance.id, id));
}

export async function listClaims(opts?: { patientId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conds = opts?.patientId ? [eq(insuranceClaims.patientId, opts.patientId)] : [];
  return db
    .select()
    .from(insuranceClaims)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(insuranceClaims.createdAt));
}

export async function createClaim(data: InsertInsuranceClaim) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(insuranceClaims).values(data);
  return result[0].insertId;
}

export async function updateClaim(id: number, data: Partial<InsertInsuranceClaim>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(insuranceClaims).set(data).where(eq(insuranceClaims.id, id));
}

// ---------------------------------------------------------------------------
// Users / staff
// ---------------------------------------------------------------------------
export async function createLocalUser(data: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "dentist" | "receptionist" | "staff";
  phone?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  const result = await database.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    loginMethod: "local",
    passwordHash: data.passwordHash,
    role: data.role,
    phone: data.phone ?? null,
    isActive: true,
  });

  return Number(result[0].insertId);
}

  
export async function listStaffUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(sql`${users.role} <> 'patient'`)
    .orderBy(users.name);
}

export async function updateUserRoleAndStatus(
  id: number,
  data: {
    role?: "admin" | "dentist" | "receptionist" | "staff" | "patient";
    isActive?: boolean;
    name?: string | null;
    phone?: string | null;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, id));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function listSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clinicSettings);
}

export async function setSetting(key: string, value: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(clinicSettings)
    .values({ settingKey: key, settingValue: value })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}

// ---------------------------------------------------------------------------
// Dashboard analytics
// ---------------------------------------------------------------------------
export async function getDashboardStats(dateStr: string) {
  const db = await getDb();
  if (!db) {
    return {
      todayAppointments: 0,
      todayRevenue: 0,
      newPatients: 0,
      totalPatients: 0,
      pendingTasks: 0,
    };
  }
  const todayAppts = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        sql`appointments.appointmentDate = ${dateStr}`,
        inArray(appointments.status, ["scheduled", "confirmed"]),
      ),
    );
  const newPatients = await db
    .select({ id: patients.id })
    .from(patients)
    .where(sql`patients.registeredAt >= ${dateStr}`);
  const allPatients = await db
    .select({ id: patients.id })
    .from(patients);
  const pendingTasks = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(inArray(invoices.status, ["draft", "sent", "partial"]));
  const revenue = await getTotalRevenue({ from: dateStr });
  return {
    todayAppointments: todayAppts.length,
    todayRevenue: revenue,
    newPatients: newPatients.length,
    totalPatients: allPatients.length,
    pendingTasks: pendingTasks.length,
  };
}

export async function getAppointmentTrends(days = 14) {
  const db = await getDb();
  if (!db) return [];
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const rows = await db
    .select({
      date: appointments.appointmentDate,
      count: sql<number>`count(${appointments.id})`,
    })
    .from(appointments)
    .where(and(sql`appointments.appointmentDate >= ${start.toISOString().slice(0, 10)}`, sql`appointments.appointmentDate <= ${end.toISOString().slice(0, 10)}`))
    .groupBy(appointments.appointmentDate);
  const map = new Map<string, number>();
  rows.forEach(r => {
    const key =
      r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date);
    map.set(key, Number(r.count));
  });
  const series: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: map.get(key) ?? 0 });
  }
  return series;
}

export async function getRevenueByMonth(months = 6) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      month: sql<string>`DATE_FORMAT(${payments.paidAt}, '%Y-%m')`,
      amount: payments.amount,
      type: payments.type,
    })
    .from(payments)
    .orderBy(payments.paidAt);
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = map.get(r.month) ?? 0;
    map.set(r.month, v + toNumber(r.amount) * (r.type === "refund" ? -1 : 1));
  }
  const entries = Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1)).slice(-months);
  return entries.map(([month, amount]) => ({ month, amount }));
}

export async function getAppointmentsByStatus() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      status: appointments.status,
      count: sql<number>`count(${appointments.id})`,
    })
    .from(appointments)
    .groupBy(appointments.status)
    .orderBy(appointments.status);
  return rows.map(r => ({ status: r.status, count: Number(r.count) }));
}

const DEFAULT_PATIENT_HEALTH_FORM_VERSION = "v1";
const INVITATION_TTL_HOURS = 24;
const RECOVERY_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_RECOVERY_REQUESTS_PER_WINDOW = 3;

function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseHealthFormResponses(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getRequiredPatientHealthFormVersion() {
  const db = await getDb();
  if (!db) return DEFAULT_PATIENT_HEALTH_FORM_VERSION;
  const rows = await db
    .select({ settingValue: clinicSettings.settingValue })
    .from(clinicSettings)
    .where(eq(clinicSettings.settingKey, "requiredPatientHealthFormVersion"))
    .limit(1);
  return rows[0]?.settingValue?.trim() || DEFAULT_PATIENT_HEALTH_FORM_VERSION;
}

export async function getPatientHealthFormStatus(patientId: number) {
  const db = await getDb();
  if (!db) {
    return {
      requiredVersion: DEFAULT_PATIENT_HEALTH_FORM_VERSION,
      completed: false,
      form: undefined,
    };
  }

  const requiredVersion = await getRequiredPatientHealthFormVersion();
  const rows = await db
    .select()
    .from(patientHealthForms)
    .where(
      and(
        eq(patientHealthForms.patientId, patientId),
        eq(patientHealthForms.formVersion, requiredVersion),
      ),
    )
    .orderBy(desc(patientHealthForms.updatedAt))
    .limit(1);
  const form = rows[0];

  return {
    requiredVersion,
    completed: form?.status === "completed" && form.consentAcknowledged,
    form: form
      ? { ...form, responses: parseHealthFormResponses(form.responses) }
      : undefined,
  };
}

export async function getPatientHealthForm(patientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const requiredVersion = await getRequiredPatientHealthFormVersion();
  const rows = await db
    .select()
    .from(patientHealthForms)
    .where(
      and(
        eq(patientHealthForms.patientId, patientId),
        eq(patientHealthForms.formVersion, requiredVersion),
      ),
    )
    .orderBy(desc(patientHealthForms.updatedAt))
    .limit(1);
  const form = rows[0];
  return form ? { ...form, responses: parseHealthFormResponses(form.responses) } : undefined;
}

export async function savePatientHealthForm(
  patientId: number,
  responses: Record<string, unknown>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const formVersion = await getRequiredPatientHealthFormVersion();
  const serialized = JSON.stringify(responses);
  const existing = await db
    .select({ id: patientHealthForms.id, status: patientHealthForms.status })
    .from(patientHealthForms)
    .where(
      and(
        eq(patientHealthForms.patientId, patientId),
        eq(patientHealthForms.formVersion, formVersion),
      ),
    )
    .orderBy(desc(patientHealthForms.updatedAt))
    .limit(1);

  if (existing[0] && existing[0].status !== "superseded") {
    await db
      .update(patientHealthForms)
      .set({
        status: "draft",
        responses: serialized,
        consentAcknowledged: false,
        completedAt: null,
      })
      .where(eq(patientHealthForms.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(patientHealthForms).values({
    patientId,
    formVersion,
    status: "draft",
    responses: serialized,
    consentAcknowledged: false,
  });
  return Number(result[0].insertId);
}

export async function completePatientHealthForm(
  patientId: number,
  responses: Record<string, unknown>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const formVersion = await getRequiredPatientHealthFormVersion();

  return db.transaction(async tx => {
    await tx
      .update(patientHealthForms)
      .set({ status: "superseded" })
      .where(
        and(
          eq(patientHealthForms.patientId, patientId),
          eq(patientHealthForms.formVersion, formVersion),
          eq(patientHealthForms.status, "completed"),
        ),
      );

    const result = await tx.insert(patientHealthForms).values({
      patientId,
      formVersion,
      status: "completed",
      responses: JSON.stringify(responses),
      consentAcknowledged: true,
      completedAt: new Date(),
    });
    return { id: Number(result[0].insertId), formVersion };
  });
}

export async function assertPatientHealthFormComplete(patientId: number) {
  const status = await getPatientHealthFormStatus(patientId);
  if (!status.completed) {
    throw new Error("Complete the required health form before booking an appointment.");
  }
  return status;
}

async function findPatientForRecovery(input: {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.firstName, input.firstName),
        eq(patients.lastName, input.lastName),
      ),
    )
    .limit(20);

  return rows.find(patient => {
    const dateMatches = input.dateOfBirth
      ? String(patient.dateOfBirth ?? "").slice(0, 10) === input.dateOfBirth
      : true;
    const emailMatches = input.email
      ? (patient.email ?? "").trim().toLowerCase() === input.email.trim().toLowerCase()
      : true;
    const phoneMatches = input.phone
      ? (patient.phone ?? "").replace(/\D/g, "") === input.phone.replace(/\D/g, "")
      : true;
    return dateMatches && emailMatches && phoneMatches;
  });
}

export async function createPatientPortalInvitation(
  patientId: number,
  invitedByUserId: number,
  ttlHours = INVITATION_TTL_HOURS,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingAccount = await db
    .select({ id: patientAccounts.id })
    .from(patientAccounts)
    .where(eq(patientAccounts.patientId, patientId))
    .limit(1);
  if (existingAccount.length) {
    throw new Error("This patient already has a portal account.");
  }

  await db
    .update(patientPortalInvitations)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(patientPortalInvitations.patientId, patientId),
        eq(patientPortalInvitations.status, "pending"),
      ),
    );

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const result = await db.insert(patientPortalInvitations).values({
    patientId,
    tokenHash: hashPortalToken(token),
    status: "pending",
    invitedByUserId,
    expiresAt,
  });

  return {
    id: Number(result[0].insertId),
    token,
    expiresAt,
  };
}

export async function getPatientPortalInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(patientPortalInvitations)
    .where(
      and(
        eq(patientPortalInvitations.tokenHash, hashPortalToken(token)),
        eq(patientPortalInvitations.status, "pending"),
      ),
    )
    .limit(1);
  const invitation = rows[0];
  if (!invitation) return undefined;
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    await db
      .update(patientPortalInvitations)
      .set({ status: "expired" })
      .where(eq(patientPortalInvitations.id, invitation.id));
    return undefined;
  }
  return invitation;
}

export async function claimPatientPortalInvitation(data: {
  token: string;
  email: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(patientPortalInvitations)
      .where(
        and(
          eq(patientPortalInvitations.tokenHash, hashPortalToken(data.token)),
          eq(patientPortalInvitations.status, "pending"),
        ),
      )
      .limit(1);
    const invitation = rows[0];
    if (!invitation || new Date(invitation.expiresAt).getTime() <= Date.now()) {
      throw new Error("This invitation is invalid or has expired.");
    }

    const linkedAccount = await tx
      .select({ id: patientAccounts.id })
      .from(patientAccounts)
      .where(eq(patientAccounts.patientId, invitation.patientId))
      .limit(1);
    if (linkedAccount.length) throw new Error("This patient already has a portal account.");

    const existingEmail = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.trim().toLowerCase()))
      .limit(1);
    if (existingEmail.length) throw new Error("This email is already in use.");

    const patient = await tx
      .select()
      .from(patients)
      .where(eq(patients.id, invitation.patientId))
      .limit(1);
    if (!patient[0]) throw new Error("Patient record not found.");

    const userResult = await tx.insert(users).values({
      openId: `patient_${randomBytes(16).toString("hex")}`,
      name: `${patient[0].firstName} ${patient[0].lastName}`.trim(),
      email: data.email.trim().toLowerCase(),
      loginMethod: "local_patient",
      passwordHash: data.passwordHash,
      role: "patient",
      isActive: true,
      phone: patient[0].phone ?? null,
    });
    const userId = Number(userResult[0].insertId);

    const accountResult = await tx.insert(patientAccounts).values({
      userId,
      patientId: invitation.patientId,
      verificationStatus: "verified",
      verificationNote: "Claimed through a clinic-issued invitation.",
      verifiedAt: new Date(),
      verifiedByUserId: invitation.invitedByUserId,
    });

    await tx
      .update(patientPortalInvitations)
      .set({
        status: "claimed",
        claimedAt: new Date(),
        claimedByUserId: userId,
      })
      .where(eq(patientPortalInvitations.id, invitation.id));

    return {
      userId,
      patientId: invitation.patientId,
      patientAccountId: Number(accountResult[0].insertId),
    };
  });
}

export async function createPatientPortalRecoveryRequest(input: {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - RECOVERY_RATE_WINDOW_MS);
  const recent = await db
    .select({ id: patientPortalRecoveryRequests.id })
    .from(patientPortalRecoveryRequests)
    .where(
      and(
        eq(patientPortalRecoveryRequests.status, "pending"),
        gte(patientPortalRecoveryRequests.createdAt, cutoff),
      ),
    )
    .limit(100);
  if (recent.length >= MAX_RECOVERY_REQUESTS_PER_WINDOW) {
    throw new Error("Too many recovery requests. Please contact the clinic directly.");
  }

  const patient = await findPatientForRecovery(input);
  const result = await db.insert(patientPortalRecoveryRequests).values({
    patientId: patient?.id ?? null,
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth ?? null,
    requestedEmail: input.email?.trim().toLowerCase() ?? null,
    requestedPhone: input.phone ?? null,
    status: "pending",
  });

  // Always return a neutral result. Do not reveal whether a patient record matched.
  return { id: Number(result[0].insertId) };
}

export async function listPatientPortalRecoveryRequests(
  status?: "pending" | "approved" | "rejected" | "cancelled",
) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(patientPortalRecoveryRequests)
    .where(status ? eq(patientPortalRecoveryRequests.status, status) : undefined)
    .orderBy(desc(patientPortalRecoveryRequests.createdAt));

  return Promise.all(rows.map(async request => ({
    request,
    patient: request.patientId ? await getPatientById(request.patientId) : undefined,
  })));
}

export async function reviewPatientPortalRecoveryRequest(
  requestId: number,
  input: {
    status: "approved" | "rejected";
    verificationMethod?: string | null;
    verificationNote?: string | null;
    reviewedByUserId: number;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(patientPortalRecoveryRequests)
    .where(eq(patientPortalRecoveryRequests.id, requestId))
    .limit(1);
  const request = rows[0];
  if (!request) return undefined;

  await db
    .update(patientPortalRecoveryRequests)
    .set({
      status: input.status,
      verificationMethod: input.verificationMethod ?? null,
      verificationNote: input.verificationNote ?? null,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: new Date(),
    })
    .where(eq(patientPortalRecoveryRequests.id, requestId));

  if (input.status !== "approved" || !request.patientId) {
    return { status: input.status as "approved" | "rejected", invitation: undefined };
  }

  const invitation = await createPatientPortalInvitation(
    request.patientId,
    input.reviewedByUserId,
  );
  return { status: "approved" as const, invitation };
}

export async function revokePatientPortalInvitation(invitationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(patientPortalInvitations)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(patientPortalInvitations.id, invitationId),
        eq(patientPortalInvitations.status, "pending"),
      ),
    );
}


/** Read the authenticated clinic user's editable profile fields. */
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
      profilePhotoUrl: users.profilePhotoUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0];
}

/** Update only profile fields that a clinic user may edit themselves. */
export async function updateUserProfile(
  userId: number,
  input: { name: string; phone?: string | null },
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(users)
    .set({ name: input.name, phone: input.phone ?? null })
    .where(eq(users.id, userId));
  return getUserProfile(userId);
}

/** Persist the public URL returned by the configured storage provider. */
export async function updateUserProfilePhoto(userId: number, profilePhotoUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(users)
    .set({ profilePhotoUrl })
    .where(eq(users.id, userId));
  return getUserProfile(userId);
}

export const getClinicUserProfile = getUserProfile;
export const updateClinicUserProfile = updateUserProfile;
export const setUserProfilePhoto = updateUserProfilePhoto;


/** Boolean compatibility alias used by the patient portal booking gate. */
export async function hasCompletedPatientHealthForm(patientId: number) {
  const status = await getPatientHealthFormStatus(patientId);
  return Boolean(status.completed);
}
