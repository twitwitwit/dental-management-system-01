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
import { randomUUID } from "node:crypto";
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
      isActive: false,
      phone: data.phone ?? null,
    });
    const userId = Number(userResult[0].insertId);

    const accountResult = await tx.insert(patientAccounts).values({
      userId,
      patientId,
      verificationStatus: "pending",
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

export async function listAvailableDentistSlots(date: string, dentistId?: number) {
  const db = await getDb();
  if (!db) return [];
  const dentists = dentistId
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.id, dentistId), eq(users.role, "dentist"), eq(users.isActive, true)))
    : await listAvailableDentists();

  const results: Array<{ dentistId: number; dentistName: string; startTime: string; endTime: string }> = [];
  for (const dentist of dentists) {
    const booked = await db
      .select({ startTime: appointments.startTime, endTime: appointments.endTime })
      .from(appointments)
      .where(
        and(
          eq(appointments.dentistId, dentist.id),
          sql`DATE(${appointments.appointmentDate}) = ${date}`,
          sql`${appointments.status} IN ('scheduled', 'confirmed')`,
        ),
      );
    const occupied = new Set(booked.map(slot => `${slot.startTime}-${slot.endTime}`));
    for (const [startTime, endTime] of PORTAL_SLOTS) {
      if (!occupied.has(`${startTime}-${endTime}`)) {
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
  const conflict = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.dentistId, data.dentistId),
        sql`DATE(${appointments.appointmentDate}) = ${data.appointmentDate}`,
        eq(appointments.startTime, data.startTime),
        sql`${appointments.status} IN ('scheduled', 'confirmed')`,
      ),
    )
    .limit(1);
  if (conflict.length) throw new Error("That time has just been booked. Please choose another slot.");

  const result = await db.insert(appointments).values({
    patientId: data.patientId,
    dentistId: data.dentistId,
    appointmentDate: new Date(data.appointmentDate),
    startTime: data.startTime,
    endTime: data.endTime,
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
    db.select().from(treatmentPlans).where(and(eq(treatmentPlans.patientId, patientId), eq(treatmentPlans.patientVisible, true))).orderBy(desc(treatmentPlans.updatedAt)),
    db.select().from(clinicalNotes).where(and(eq(clinicalNotes.patientId, patientId), eq(clinicalNotes.patientVisible, true))).orderBy(desc(clinicalNotes.noteDate)),
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

export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(appointments).values(data);
  return result[0].insertId;
}

export async function updateAppointment(id: number, data: Partial<InsertAppointment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set(data).where(eq(appointments.id, id));
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
  data: { role?: "admin" | "dentist" | "receptionist" | "staff"; isActive?: boolean },
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
