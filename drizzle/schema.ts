import {
  bigint,
  boolean,
  date,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Roles: admin, dentist, receptionist, staff (per authoritative spec).
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 128 }),
  role: mysqlEnum("role", ["admin", "dentist", "receptionist", "staff", "patient"])
    .default("staff")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  phone: varchar("phone", { length: 32 }),
  profilePhotoUrl: varchar("profilePhotoUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Clinic-wide settings stored as key/value pairs. */
export const clinicSettings = mysqlTable("clinicSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  settingValue: text("settingValue"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Patients registered at the clinic. */
export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  dateOfBirth: date("dateOfBirth"),
  gender: mysqlEnum("gender", ["male", "female", "other"]),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  bloodType: varchar("bloodType", { length: 4 }),
  allergies: text("allergies"),
  medicalNotes: text("medicalNotes"),
  dentalNotes: text("dentalNotes"),

  // Clinical lifestyle & smoking status
  smokingStatus: mysqlEnum("smokingStatus", [
    "never",
    "former",
    "current_light",
    "current_heavy",
    "vaping",
    "chewing_tobacco",
  ]).default("never"),
  smokingDetails: text("smokingDetails"),
  alcoholUse: mysqlEnum("alcoholUse", ["none", "occasional", "moderate", "heavy"]).default("none"),

  // Dental-relevant medical alerts & systemic conditions
  diabetes: varchar("diabetes", { length: 64 }),
  bleedingDisorder: varchar("bleedingDisorder", { length: 128 }),
  cardiovascular: text("cardiovascular"),
  isPregnant: boolean("isPregnant").default(false),
  currentMedications: text("currentMedications"),
  bruxism: boolean("bruxism").default(false),
  dentalAnxiety: mysqlEnum("dentalAnxiety", ["none", "mild", "moderate", "severe"]).default("none"),
  chiefComplaint: text("chiefComplaint"),

  // Social & Emergency contact
  occupation: varchar("occupation", { length: 128 }),
  emergencyContactName: varchar("emergencyContactName", { length: 128 }),
  emergencyContactPhone: varchar("emergencyContactPhone", { length: 32 }),
  emergencyContactRelation: varchar("emergencyContactRelation", { length: 64 }),

  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;

/** Appointments with status tracking across four states. */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  dentistId: int("dentistId"),
  appointmentDate: date("appointmentDate").notNull(),
  startTime: varchar("startTime", { length: 8 }).notNull(),
  endTime: varchar("endTime", { length: 8 }).notNull(),
  type: varchar("type", { length: 64 }).default("Checkup").notNull(),
  status: mysqlEnum("status", ["scheduled", "confirmed", "completed", "no_show"])
    .default("scheduled")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/** Per-tooth conditions recorded on the dental chart. */
export const toothConditions = mysqlTable("toothConditions", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  toothNumber: varchar("toothNumber", { length: 4 }).notNull(),
  condition: mysqlEnum(
    "condition",
    ["healthy", "decay", "filling", "crown", "extraction", "implant", "root_canal", "missing", "veneers", "bridge"]
  )
    .default("healthy")
    .notNull(),
  note: text("note"),
  /** Chart layer: "status" = current findings, "plan" = planned treatment (rendered dashed). */
  mode: mysqlEnum("mode", ["status", "plan"]).default("status").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type ToothCondition = typeof toothConditions.$inferSelect;
export type InsertToothCondition = typeof toothConditions.$inferInsert;

/** Per-surface conditions (mesial, distal, buccal, lingual, occlusal) per tooth. */
export const toothSurfaceConditions = mysqlTable("toothSurfaceConditions", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  toothNumber: varchar("toothNumber", { length: 4 }).notNull(),
  /** Surface of the tooth: mesial, distal, buccal, lingual, occlusal. */
  surface: mysqlEnum("surface", ["mesial", "distal", "buccal", "lingual", "occlusal"]).notNull(),
  condition: mysqlEnum(
    "condition",
    ["healthy", "decay", "filling", "crown", "extraction", "implant", "root_canal", "missing", "veneers", "bridge"]
  )
    .default("healthy")
    .notNull(),
  note: text("note"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type ToothSurfaceCondition = typeof toothSurfaceConditions.$inferSelect;
export type InsertToothSurfaceCondition = typeof toothSurfaceConditions.$inferInsert;

/** Treatment plans maintained per patient. */
export const treatmentPlans = mysqlTable("treatmentPlans", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  diagnosis: text("diagnosis"),
  status: mysqlEnum("status", ["planned", "in_progress", "completed", "cancelled"])
    .default("planned")
    .notNull(),
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type InsertTreatmentPlan = typeof treatmentPlans.$inferInsert;

/** Procedures within a treatment plan. */
export const treatmentProcedures = mysqlTable("treatmentProcedures", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  toothNumber: varchar("toothNumber", { length: 4 }),
  procedureName: varchar("procedureName", { length: 256 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["planned", "done"]).default("planned").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TreatmentProcedure = typeof treatmentProcedures.$inferSelect;
export type InsertTreatmentProcedure = typeof treatmentProcedures.$inferInsert;

/** Clinical/treatment notes per patient (treatment history). */
export const clinicalNotes = mysqlTable("clinicalNotes", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  appointmentId: int("appointmentId"),
  dentistName: varchar("dentistName", { length: 128 }),
  title: varchar("title", { length: 256 }),
  content: text("content"),
  noteDate: date("noteDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type InsertClinicalNote = typeof clinicalNotes.$inferInsert;

/**
 * Periodontal (gum) status per tooth.
 * Stores the 6-point probing pocket depths per tooth plus recession, mobility,
 * and bleeding-on-probing flags — mirroring the periodontal view of the
 * reference odontogram.
 */
export const periodontalStatus = mysqlTable("periodontalStatus", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  toothNumber: varchar("toothNumber", { length: 4 }).notNull(),
  /** Six probing depths in mm, in sextant order (mesiobuccal .. distopalatal). */
  pd1: decimal("pd1", { precision: 4, scale: 1 }).default("0").notNull(),
  pd2: decimal("pd2", { precision: 4, scale: 1 }).default("0").notNull(),
  pd3: decimal("pd3", { precision: 4, scale: 1 }).default("0").notNull(),
  pd4: decimal("pd4", { precision: 4, scale: 1 }).default("0").notNull(),
  pd5: decimal("pd5", { precision: 4, scale: 1 }).default("0").notNull(),
  pd6: decimal("pd6", { precision: 4, scale: 1 }).default("0").notNull(),
  /** Gingival recession in mm at the deepest site. */
  recession: decimal("recession", { precision: 4, scale: 1 }).default("0").notNull(),
  /** Mobility grade 0..3. */
  mobility: mysqlEnum("mobility", ["0", "1", "2", "3"]).default("0").notNull(),
  bleeding: int("bleeding").default(0).notNull(),
  plaque: int("plaque").default(0).notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type PeriodontalStatus = typeof periodontalStatus.$inferSelect;
export type InsertPeriodontalStatus = typeof periodontalStatus.$inferInsert;

/** Invoices generated from treatment plans. */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull().unique(),
  patientId: int("patientId").notNull(),
  treatmentPlanId: int("treatmentPlanId"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0").notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "paid", "partial", "cancelled"])
    .default("draft")
    .notNull(),
  dueDate: date("dueDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/** Line items on an invoice. */
export const invoiceItems = mysqlTable("invoiceItems", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  description: varchar("description", { length: 256 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0").notNull(),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

/** Payments recorded against invoices. */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  patientId: int("patientId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: mysqlEnum("method", ["cash", "card", "bank_transfer", "insurance", "gcash", "maya", "qr_code"]).notNull(),
  reference: varchar("reference", { length: 128 }),
  type: mysqlEnum("type", ["payment", "refund"]).default("payment").notNull(),
  paidAt: timestamp("paidAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/** Dental supplies and materials in inventory. */
export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  category: varchar("category", { length: 128 }),
  sku: varchar("sku", { length: 64 }),
  quantity: int("quantity").default(0).notNull(),
  unit: varchar("unit", { length: 32 }).default("pcs").notNull(),
  lowStockThreshold: int("lowStockThreshold").default(10).notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0").notNull(),
  supplier: varchar("supplier", { length: 256 }),
  lastRestockedAt: timestamp("lastRestockedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;

/** Stock in / stock out movements for inventory tracking. */
export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  type: mysqlEnum("type", ["stock_in", "stock_out", "adjustment"]).notNull(),
  quantity: int("quantity").notNull(),
  reason: varchar("reason", { length: 256 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;

/** Insurance providers recognized by the clinic. */
export const insuranceProviders = mysqlTable("insuranceProviders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 32 }),
  website: varchar("website", { length: 256 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InsuranceProvider = typeof insuranceProviders.$inferSelect;
export type InsertInsuranceProvider = typeof insuranceProviders.$inferInsert;

/** Patient insurance coverage details. */
export const patientInsurance = mysqlTable("patientInsurance", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  providerId: int("providerId").notNull(),
  policyNumber: varchar("policyNumber", { length: 128 }).notNull(),
  groupNumber: varchar("groupNumber", { length: 128 }),
  memberName: varchar("memberName", { length: 256 }),
  relationship: varchar("relationship", { length: 64 }),
  coPay: decimal("coPay", { precision: 10, scale: 2 }).default("0").notNull(),
  deductible: decimal("deductible", { precision: 10, scale: 2 }).default("0").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PatientInsurance = typeof patientInsurance.$inferSelect;
export type InsertPatientInsurance = typeof patientInsurance.$inferInsert;

/** Insurance claims with status tracking. */
export const insuranceClaims = mysqlTable("insuranceClaims", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  patientInsuranceId: int("patientInsuranceId"),
  invoiceId: int("invoiceId"),
  claimNumber: varchar("claimNumber", { length: 32 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "submitted", "approved", "denied"])
    .default("pending")
    .notNull(),
  description: text("description"),
  filedDate: date("filedDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InsuranceClaim = typeof insuranceClaims.$inferSelect;
export type InsertInsuranceClaim = typeof insuranceClaims.$inferInsert;

// Type helpers
export type UserWithRole = User;

// Add this table to drizzle/schema.ts.
// Import: int, mysqlEnum, mysqlTable, text, timestamp, varchar

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  actorRole: mysqlEnum("actorRole", ["admin", "dentist", "receptionist", "staff", "patient"]),
  action: varchar("action", { length: 32 }).notNull(),
  resourceType: varchar("resourceType", { length: 64 }).notNull(),
  resourceId: varchar("resourceId", { length: 64 }),
  purpose: varchar("purpose", { length: 500 }),
  outcome: mysqlEnum("outcome", ["success", "denied", "error"]).notNull().default("success"),
  metadata: text("metadata"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/*
  Migration SQL. Generate a normal Drizzle migration from schema.ts in your
  project; these statements show the intended table and append-only triggers.
*/

/*
CREATE TABLE `auditLogs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `actorUserId` int,
  `actorRole` enum('admin','dentist','receptionist','staff'),
  `action` varchar(32) NOT NULL,
  `resourceType` varchar(64) NOT NULL,
  `resourceId` varchar(64),
  `purpose` varchar(500),
  `outcome` enum('success','denied','error') NOT NULL DEFAULT 'success',
  `metadata` text,
  `ipAddress` varchar(64),
  `userAgent` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);

DELIMITER $$
CREATE TRIGGER `auditLogs_no_update`
BEFORE UPDATE ON `auditLogs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'auditLogs is append-only';
END$$

CREATE TRIGGER `auditLogs_no_delete`
BEFORE DELETE ON `auditLogs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'auditLogs is append-only';
END$$
DELIMITER ;
*/

/*
After importing the migration, grant the application account INSERT and SELECT
on auditLogs, but do not grant UPDATE or DELETE. The trigger provides a second
application-level safeguard; the database account privileges remain the real
security boundary.
*/

export const auditLogMigrationSql = `
CREATE TABLE auditLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actorUserId INT NULL,
  actorRole ENUM('admin','dentist','receptionist','staff') NULL,
  action VARCHAR(32) NOT NULL,
  resourceType VARCHAR(64) NOT NULL,
  resourceId VARCHAR(64) NULL,
  purpose VARCHAR(500) NULL,
  outcome ENUM('success','denied','error') NOT NULL DEFAULT 'success',
  metadata TEXT NULL,
  ipAddress VARCHAR(64) NULL,
  userAgent TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

/*
Important: do not expose update/delete tRPC procedures for this table. For a
stronger deployment, run the trigger statements and grant only SELECT/INSERT.
*/

export default auditLogs;

export const patientAccounts = mysqlTable("patientAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  patientId: int("patientId").notNull().unique(),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected", "suspended"])
    .default("pending")
    .notNull(),
  verificationNote: text("verificationNote"),
  verifiedAt: timestamp("verifiedAt"),
  verifiedByUserId: int("verifiedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PatientAccount = typeof patientAccounts.$inferSelect;
export type InsertPatientAccount = typeof patientAccounts.$inferInsert;

/**
 * Metadata for profile photos, X-rays, consent files, and other clinical
 * documents stored through the existing storage.ts helpers.
 * The storage key is kept private; patients receive a short-lived signed URL
 * only after the server verifies ownership and visibility.
 */
export const patientDocuments = mysqlTable("patientDocuments", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  uploadedByUserId: int("uploadedByUserId"),
  documentType: mysqlEnum("documentType", [
    "profile_photo",
    "xray",
    "clinical_document",
    "consent_form",
    "other",
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  fileSize: int("fileSize"),
  visibleToPatient: boolean("visibleToPatient").default(false).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PatientDocument = typeof patientDocuments.$inferSelect;
export type InsertPatientDocument = typeof patientDocuments.$inferInsert;

export const patientHealthForms = mysqlTable("patientHealthForms", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  formVersion: varchar("formVersion", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["draft", "completed", "superseded"])
    .default("draft")
    .notNull(),
  responses: text("responses").notNull(),
  consentAcknowledged: boolean("consentAcknowledged").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PatientHealthForm = typeof patientHealthForms.$inferSelect;
export type InsertPatientHealthForm = typeof patientHealthForms.$inferInsert;

/** Single-use links that connect an existing clinic patient to a portal account. */
export const patientPortalInvitations = mysqlTable("patientPortalInvitations", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "claimed", "expired", "revoked"])
    .default("pending")
    .notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  claimedAt: timestamp("claimedAt"),
  claimedByUserId: int("claimedByUserId"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PatientPortalInvitation = typeof patientPortalInvitations.$inferSelect;
export type InsertPatientPortalInvitation = typeof patientPortalInvitations.$inferInsert;

/** Staff-reviewed recovery requests for lost invitations. */
export const patientPortalRecoveryRequests = mysqlTable("patientPortalRecoveryRequests", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId"),
  requestedEmail: varchar("requestedEmail", { length: 320 }),
  requestedPhone: varchar("requestedPhone", { length: 32 }),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  dateOfBirth: varchar("dateOfBirth", { length: 10 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"])
    .default("pending")
    .notNull(),
  verificationMethod: varchar("verificationMethod", { length: 128 }),
  verificationNote: text("verificationNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PatientPortalRecoveryRequest = typeof patientPortalRecoveryRequests.$inferSelect;
export type InsertPatientPortalRecoveryRequest = typeof patientPortalRecoveryRequests.$inferInsert;
