import { COOKIE_NAME } from "@shared/const";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import {
  appendAuditLog,
  listAuditLogs,
  requireAccess,
} from "./accessControlAudit";
import { storageGetSignedUrl, storagePut } from "./storage";

type Role = "admin" | "dentist" | "receptionist" | "staff" | "patient";

const patientRole = "patient" as const;
const patientStaffRoles = ["admin", "dentist"] as const;

type PatientPortalContext = {
  user: { id: number; role?: unknown } | null;
  req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
};

function requirePatient(ctx: PatientPortalContext) {
  if (!ctx.user || ctx.user.role !== patientRole) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Patient portal access required" });
  }
  return ctx.user;
}

async function requireVerifiedPatient(ctx: PatientPortalContext) {
  const user = requirePatient(ctx);
  const portal = await db.getPatientPortalByUserId(user.id);
  if (!portal || portal.account.verificationStatus !== "verified") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your patient account is not verified yet" });
  }
  return portal;
}

function requireAdmin(ctx: PatientPortalContext) {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required" });
  }
  return ctx.user;
}

function requireClinicalStaff(ctx: PatientPortalContext) {
  if (!ctx.user || !patientStaffRoles.includes(ctx.user.role as (typeof patientStaffRoles)[number])) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Dentist or administrator access required" });
  }
  return ctx.user;
}

const patientRegistrationInput = z.object({
  firstName: z.string().trim().min(1).max(128),
  lastName: z.string().trim().min(1).max(128),
  email: z.string().email().transform(value => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
});

const safeProfileUpdate = z.object({
  firstName: z.string().trim().min(1).max(128).optional(),
  lastName: z.string().trim().min(1).max(128).optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  occupation: z.string().trim().max(128).nullable().optional(),
  emergencyContactName: z.string().trim().max(128).nullable().optional(),
  emergencyContactPhone: z.string().trim().max(32).nullable().optional(),
  emergencyContactRelation: z.string().trim().max(64).nullable().optional(),
});

const imageContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const documentContentTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
]);

export const patientPortalRouter = router({
  /** Public self-registration creates a pending, inactive local patient account. */
  register: publicProcedure
    .input(patientRegistrationInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      }

      const passwordHash = createHash("sha256").update(input.password).digest("hex");
      try {
        const created = await db.createPatientPortalAccount({
          ...input,
          passwordHash,
        });
        try {
          await appendAuditLog(ctx, {
            action: "write",
            resourceType: "patient_account",
            resourceId: String(created.patientAccountId),
            purpose: "Patient self-registration",
            outcome: "success",
            metadata: JSON.stringify({ verificationStatus: "pending" }),
          });
        } catch (auditError) {
          console.error("[PatientPortal] Registration audit failed", auditError);
        }
        return { success: true, verificationStatus: "pending" as const };
      } catch (error) {
        try {
          await appendAuditLog(ctx, {
            action: "write",
            resourceType: "patient_account",
            purpose: "Patient self-registration",
            outcome: "error",
            metadata: JSON.stringify({ reason: "account_creation_failed" }),
          });
        } catch (auditError) {
          console.error("[PatientPortal] Registration error audit failed", auditError);
        }
        throw error;
      }
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const portal = await requireVerifiedPatient(ctx);
    return {
      account: portal.account,
      patient: portal.patient,
      user: portal.user,
    };
  }),

  updateProfile: protectedProcedure
    .input(safeProfileUpdate)
    .mutation(async ({ ctx, input }) => {
      const portal = await requireVerifiedPatient(ctx);
      await db.updatePatientPortalProfile(
        portal.patient.id,
        ctx.user!.id,
        {
          firstName: input.firstName ?? portal.patient.firstName,
          lastName: input.lastName ?? portal.patient.lastName,
          dateOfBirth: input.dateOfBirth !== undefined
            ? input.dateOfBirth
            : portal.patient.dateOfBirth
              ? new Date(portal.patient.dateOfBirth).toISOString().slice(0, 10)
              : null,
          gender: input.gender !== undefined ? input.gender : portal.patient.gender,
          phone: input.phone !== undefined ? input.phone : portal.patient.phone,
          address: input.address !== undefined ? input.address : portal.patient.address,
          occupation: input.occupation !== undefined ? input.occupation : portal.patient.occupation,
          emergencyContactName: input.emergencyContactName !== undefined ? input.emergencyContactName : portal.patient.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone !== undefined ? input.emergencyContactPhone : portal.patient.emergencyContactPhone,
          emergencyContactRelation: input.emergencyContactRelation !== undefined ? input.emergencyContactRelation : portal.patient.emergencyContactRelation,
        },
      );
      await appendAuditLog(ctx, {
        action: "write",
        resourceType: "patient_profile",
        resourceId: String(portal.patient.id),
        purpose: "Patient updated their own profile",
        outcome: "success",
        metadata: JSON.stringify({ changedFields: Object.keys(input) }),
      });
      return { success: true } as const;
    }),

  availableDentists: protectedProcedure.query(async ({ ctx }) => {
    await requireVerifiedPatient(ctx);
    return db.listAvailableDentists();
  }),

  availableSlots: protectedProcedure
    .input(z.object({ date: z.string(), dentistId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      await requireVerifiedPatient(ctx);
      return db.listAvailableDentistSlots(input.date, input.dentistId);
    }),

  bookAppointment: protectedProcedure
    .input(z.object({
      dentistId: z.number().int().positive(),
      appointmentDate: z.string(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      type: z.string().trim().min(1).max(64),
      notes: z.string().trim().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const portal = await requireVerifiedPatient(ctx);
      const appointmentId = await db.createPatientPortalAppointment({
        ...input,
        patientId: portal.patient.id,
      });
      await appendAuditLog(ctx, {
        action: "write",
        resourceType: "appointment",
        resourceId: String(appointmentId),
        purpose: "Patient booked an appointment through the portal",
        outcome: "success",
        metadata: JSON.stringify({ dentistId: input.dentistId, appointmentDate: input.appointmentDate }),
      });
      return { id: appointmentId };
    }),

  myAppointments: protectedProcedure.query(async ({ ctx }) => {
    const portal = await requireVerifiedPatient(ctx);
    return db.listAppointments({ patientId: portal.patient.id });
  }),

  chart: protectedProcedure.query(async ({ ctx }) => {
    const portal = await requireVerifiedPatient(ctx);
    const chart = await db.getPatientPortalChart(portal.patient.id);
    await appendAuditLog(ctx, {
      action: "read",
      resourceType: "patient_chart",
      resourceId: String(portal.patient.id),
      purpose: "Patient viewed their own dental chart",
      outcome: "success",
      metadata: JSON.stringify({ scope: "patient_visible_records" }),
    });
    return chart;
  }),

  documents: protectedProcedure.query(async ({ ctx }) => {
    const portal = await requireVerifiedPatient(ctx);
    return db.listPatientDocuments(portal.patient.id, true);
  }),

  viewDocument: protectedProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const portal = await requireVerifiedPatient(ctx);
      const document = await db.getPatientDocumentForView(input.documentId, portal.patient.id);
      if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      const url = await storageGetSignedUrl(document.storageKey);
      await appendAuditLog(ctx, {
        action: "read",
        resourceType: "patient_document",
        resourceId: String(document.id),
        purpose: "Patient viewed an approved document",
        outcome: "success",
        metadata: JSON.stringify({ documentType: document.documentType }),
      });
      return { ...document, url };
    }),

  uploadProfilePhoto: protectedProcedure
    .input(z.object({
      fileName: z.string().trim().min(1).max(160),
      contentType: z.string(),
      dataBase64: z.string().min(1).max(5_500_000),
      fileSize: z.number().int().positive().max(4_000_000),
    }))
    .mutation(async ({ ctx, input }) => {
      const portal = await requireVerifiedPatient(ctx);
      if (!imageContentTypes.has(input.contentType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use a JPG, PNG, or WebP image" });
      }
      const data = Buffer.from(input.dataBase64, "base64");
      if (data.length > 4_000_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Profile photos must be 4 MB or smaller" });
      }
      const stored = await storagePut(
        `patients/${portal.patient.id}/profile/${input.fileName}`,
        data,
        input.contentType,
      );
      const id = await db.createPatientDocument({
        patientId: portal.patient.id,
        uploadedByUserId: ctx.user!.id,
        documentType: "profile_photo",
        title: "Profile photo",
        storageKey: stored.key,
        contentType: input.contentType,
        fileSize: data.length,
        visibleToPatient: true,
      });
      return { id, url: stored.url };
    }),

  /** Admin-only verification queue. No patient can approve their own account. */
  verificationQueue: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "verified", "rejected", "suspended"]).optional() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      return db.listPatientPortalAccounts(input.status);
    }),

  verifyAccount: protectedProcedure
    .input(z.object({
      patientAccountId: z.number().int().positive(),
      status: z.enum(["verified", "rejected", "suspended"]),
      note: z.string().trim().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const admin = requireAdmin(ctx);
      const result = await db.updatePatientPortalVerification(input.patientAccountId, {
        status: input.status,
        note: input.note,
        verifiedByUserId: admin.id,
      });
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Patient account not found" });
      await appendAuditLog(ctx, {
        action: "admin",
        resourceType: "patient_account",
        resourceId: String(input.patientAccountId),
        purpose: "Administrator reviewed a patient portal account",
        outcome: "success",
        metadata: JSON.stringify({ status: input.status }),
      });
      return { success: true } as const;
    }),

  /** Dentist/admin document upload; patient visibility is explicit. */
  uploadDocument: protectedProcedure
    .input(z.object({
      patientId: z.number().int().positive(),
      fileName: z.string().trim().min(1).max(160),
      title: z.string().trim().min(1).max(256),
      documentType: z.enum(["xray", "clinical_document", "consent_form", "other"]),
      contentType: z.string(),
      dataBase64: z.string().min(1).max(25_000_000),
      fileSize: z.number().int().positive().max(18_000_000),
      visibleToPatient: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const staff = requireClinicalStaff(ctx);
      if (!documentContentTypes.has(input.contentType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only JPG, PNG, WebP, and PDF files are supported" });
      }
      const data = Buffer.from(input.dataBase64, "base64");
      if (data.length > 18_000_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Documents must be 18 MB or smaller" });
      }
      const stored = await storagePut(
        `patients/${input.patientId}/documents/${input.fileName}`,
        data,
        input.contentType,
      );
      const id = await db.createPatientDocument({
        patientId: input.patientId,
        uploadedByUserId: staff.id,
        documentType: input.documentType,
        title: input.title,
        storageKey: stored.key,
        contentType: input.contentType,
        fileSize: data.length,
        visibleToPatient: input.visibleToPatient,
      });
      await appendAuditLog(ctx, {
        action: "write",
        resourceType: "patient_document",
        resourceId: String(id),
        purpose: "Staff uploaded a patient document",
        outcome: "success",
        metadata: JSON.stringify({ patientId: input.patientId, documentType: input.documentType, visibleToPatient: input.visibleToPatient }),
      });
      return { id };
    }),
});




function roleOf(ctx: { user: { role?: unknown } | null }): Role | null {
  return (ctx.user?.role as Role | undefined) ?? null;
}

/** Require one of the allowed roles; otherwise forbidden. */
function requireRoles(
  ctx: { user: { role?: unknown } | null },
  allowed: Role[]
) {
  const role = roleOf(ctx);
  if (!role || !allowed.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied for your role",
    });
  }
  return role;
}

const dentistOrAdmin = ["admin", "dentist"] as Role[];
const receptionistAccess = ["admin", "dentist", "receptionist"] as Role[];
const everyone = ["admin", "dentist", "receptionist", "staff"] as Role[];

// Shared input schemas
const patientInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  bloodType: z.string().max(4).nullable().optional(),
  allergies: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
  dentalNotes: z.string().nullable().optional(),

  // Clinical lifestyle & smoking status
  smokingStatus: z
    .enum([
      "never",
      "former",
      "current_light",
      "current_heavy",
      "vaping",
      "chewing_tobacco",
    ])
    .nullable()
    .optional(),
  smokingDetails: z.string().nullable().optional(),
  alcoholUse: z
    .enum(["none", "occasional", "moderate", "heavy"])
    .nullable()
    .optional(),

  // Dental-relevant medical alerts & systemic conditions
  diabetes: z.string().nullable().optional(),
  bleedingDisorder: z.string().nullable().optional(),
  cardiovascular: z.string().nullable().optional(),
  isPregnant: z.boolean().nullable().optional(),
  currentMedications: z.string().nullable().optional(),
  bruxism: z.boolean().nullable().optional(),
  dentalAnxiety: z
    .enum(["none", "mild", "moderate", "severe"])
    .nullable()
    .optional(),
  chiefComplaint: z.string().nullable().optional(),

  // Social & Emergency contact
  occupation: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  emergencyContactRelation: z.string().nullable().optional(),

  status: z.enum(["active", "inactive"]).optional(),
});

const money = (name: string) =>
  z
    .union([z.string(), z.number()])
    .transform(v => Number(v))
    .refine(n => !Number.isNaN(n) && n >= 0, name);

export const appRouter = router({
  // Inside appRouter:
  audit: router({
    list: protectedProcedure
      .input(
        z.object({
          actorUserId: z.number().optional(),
          action: z.string().optional(),
          resourceType: z.string().optional(),
          outcome: z.enum(["success", "denied", "error"]).optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          limit: z.number().int().min(1).max(500).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        requireAccess(ctx, "audit", "read");
        return listAuditLogs({
          ...input,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        });
      }),
  }),
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({ email: z.string().email(), password: z.string().min(1) })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        const passwordHash = createHash("sha256")
          .update(input.password)
          .digest("hex");
        if (!user || !user.isActive || user.passwordHash !== passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Patient accounts require explicit administrator verification before login.
        if (user.role === "patient") {
          const patientPortal = await db.getPatientAccountByUserId(user.id);
          if (!patientPortal || patientPortal.verificationStatus !== "verified") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Your patient account is pending verification by the clinic",
            });
          }
        }

        const token = await sdk.signSession({
          openId: user.openId,
          appId: "local",
          name: user.name ?? user.email ?? "User",
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: 365 * 24 * 60 * 60 * 1000,
        });
        return user;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      requireRoles(ctx, everyone);
      const today = new Date().toISOString().slice(0, 10);
      const [stats, trends, revenue, byStatus] = await Promise.all([
        db.getDashboardStats(today),
        db.getAppointmentTrends(),
        db.getRevenueByMonth(),
        db.getAppointmentsByStatus(),
      ]);
      return { stats, trends, revenue, byStatus };
    }),
  }),

  // ---------------------------------------------------------------------------
  // Patients
  // ---------------------------------------------------------------------------
  patients: router({
    list: protectedProcedure
      .input(
        z.object({
          search: z.string().optional(),
          status: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listPatients(input);
      }),
    get: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          auditPurpose: z.string().trim().min(8).max(500).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        requireAccess(ctx, "medical", "read", input.auditPurpose);

        const patient = await db.getPatientById(input.id);

        if (!patient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient not found",
          });
        }

        await appendAuditLog(ctx, {
          action: "read",
          resourceType: "patient",
          resourceId: String(input.id),
          purpose: input.auditPurpose ?? null,
          outcome: "success",
          metadata: JSON.stringify({ procedure: "patients.get" }),
        });

        return patient;
      }),

    create: protectedProcedure
      .input(patientInput)
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        const id = await db.createPatient({
          ...input,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        });
        return { id };
      }),
    update: protectedProcedure
  .input(z.object({ id: z.number(), data: patientInput.partial() }))
  .mutation(async ({ ctx, input }) => {
    const changedFields = Object.keys(input.data);

    try {
      requireRoles(ctx, ["admin", "dentist", "receptionist"]);

      const updateData: Record<string, unknown> = { ...input.data };

      if (input.data.dateOfBirth !== undefined) {
        updateData.dateOfBirth = input.data.dateOfBirth
          ? new Date(input.data.dateOfBirth)
          : null;
      }

      await db.updatePatient(input.id, updateData);

      try {
        await appendAuditLog(ctx, {
          action: "update",
          resourceType: "patient",
          resourceId: String(input.id),
          purpose: null,
          outcome: "success",
          // Record field names only. Do not store medical values or full payloads.
          metadata: JSON.stringify({
            procedure: "patients.update",
            changedFields,
          }),
        });
      } catch (auditError) {
        console.error("Failed to write patient update audit log", auditError);
      }

      return { success: true } as const;
    } catch (error) {
      try {
        await appendAuditLog(ctx, {
          action: "update",
          resourceType: "patient",
          resourceId: String(input.id),
          purpose: null,
          outcome:
            error instanceof TRPCError && error.code === "FORBIDDEN"
              ? "denied"
              : "error",
          metadata: JSON.stringify({
            procedure: "patients.update",
            changedFields,
          }),
        });
      } catch (auditError) {
        console.error("Failed to write patient update failure audit log", auditError);
      }

      throw error;
    }
  }),

  }),

  patientPortal: patientPortalRouter,

  // ---------------------------------------------------------------------------
  // Appointments
  // ---------------------------------------------------------------------------
  appointments: router({
    list: protectedProcedure
      .input(
        z.object({
          patientId: z.number().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          status: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, everyone);
        return db.listAppointments(input);
      }),
    create: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          dentistId: z.number().nullable().optional(),
          appointmentDate: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          type: z.string().optional(),
          status: z
            .enum(["scheduled", "confirmed", "completed", "no_show"])
            .optional(),
          notes: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        const id = await db.createAppointment({
          ...input,
          appointmentDate: new Date(input.appointmentDate),
          status: input.status ?? "scheduled",
        });
        return { id };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            patientId: z.number().optional(),
            dentistId: z.number().nullable().optional(),
            appointmentDate: z.string().optional(),
            startTime: z.string().optional(),
            endTime: z.string().optional(),
            type: z.string().optional(),
            status: z
              .enum(["scheduled", "confirmed", "completed", "no_show"])
              .optional(),
            notes: z.string().nullable().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const changedFields = Object.keys(input.data);

        try {
          requireRoles(ctx, everyone);
          const role = roleOf(ctx);

          if (role === "staff") {
            const onlyStatus =
              Object.keys(input.data).length === 1 && "status" in input.data;
            if (!onlyStatus) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Staff can only update appointment status",
              });
            }
          }

          await db.updateAppointment(input.id, {
            ...input.data,
            appointmentDate: input.data.appointmentDate
              ? new Date(input.data.appointmentDate)
              : undefined,
          });

          try {
            await appendAuditLog(ctx, {
              action: "update",
              resourceType: "appointment",
              resourceId: String(input.id),
              purpose: null,
              outcome: "success",
              metadata: JSON.stringify({
                procedure: "appointments.update",
                changedFields,
              }),
            });
          } catch (auditError) {
            console.error("Failed to write appointment update audit log", auditError);
          }

          return { success: true } as const;
        } catch (error) {
          try {
            await appendAuditLog(ctx, {
              action: "update",
              resourceType: "appointment",
              resourceId: String(input.id),
              purpose: null,
              outcome:
                error instanceof TRPCError && error.code === "FORBIDDEN"
                  ? "denied"
                  : "error",
              metadata: JSON.stringify({
                procedure: "appointments.update",
                changedFields,
              }),
            });
          } catch (auditError) {
            console.error("Failed to write appointment update failure audit log", auditError);
          }

          throw error;
        }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          requireRoles(ctx, ["admin", "dentist", "receptionist"]);
          await db.deleteAppointment(input.id);

          try {
            await appendAuditLog(ctx, {
              action: "delete",
              resourceType: "appointment",
              resourceId: String(input.id),
              purpose: null,
              outcome: "success",
              metadata: JSON.stringify({
                procedure: "appointments.delete",
              }),
            });
          } catch (auditError) {
            console.error("Failed to write appointment deletion audit log", auditError);
          }

          return { success: true } as const;
        } catch (error) {
          try {
            await appendAuditLog(ctx, {
              action: "delete",
              resourceType: "appointment",
              resourceId: String(input.id),
              purpose: null,
              outcome:
                error instanceof TRPCError && error.code === "FORBIDDEN"
                  ? "denied"
                  : "error",
              metadata: JSON.stringify({
                procedure: "appointments.delete",
              }),
            });
          } catch (auditError) {
            console.error("Failed to write appointment deletion failure audit log", auditError);
          }

          throw error;
        }
      }),
  }),

  // ---------------------------------------------------------------------------
  // Clinical records
  // ---------------------------------------------------------------------------
  clinical: router({
    toothConditions: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.getToothConditions(input.patientId);
      }),
    setToothCondition: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          toothNumber: z.string().min(1).max(4),
          condition: z.enum([
            "healthy",
            "decay",
            "filling",
            "crown",
            "extraction",
            "implant",
            "root_canal",
            "missing",
            "veneers",
            "bridge",
          ]),
          note: z.string().nullable().optional(),
          /** Chart layer: "status" (current findings) or "plan" (planned treatment). */
          mode: z.enum(["status", "plan"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.setToothCondition({
          ...input,
          mode: input.mode ?? "status",
        });
        return { id };
      }),
    setToothConditionsBulk: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          teeth: z
            .array(
              z.object({
                toothNumber: z.string().min(1).max(4),
                condition: z.enum([
                  "healthy",
                  "decay",
                  "filling",
                  "crown",
                  "extraction",
                  "implant",
                  "root_canal",
                  "missing",
                  "veneers",
                  "bridge",
                ]),
                mode: z.enum(["status", "plan"]).optional(),
                note: z.string().nullable().optional(),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.setToothConditionsBulk(
          input.patientId,
          input.teeth.map(t => ({ ...t, mode: t.mode ?? "status" }))
        );
      }),
    /** Periodontal (gum) status: 6-point probing depths + recession/mobility/bleeding per tooth. */
    perio: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.getPeriodontalStatus(input.patientId);
      }),
    setPerio: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          toothNumber: z.string().min(1).max(4),
          pd: z.tuple([
            z.number(),
            z.number(),
            z.number(),
            z.number(),
            z.number(),
            z.number(),
          ]),
          recession: z.number().optional(),
          mobility: z.enum(["0", "1", "2", "3"]).optional(),
          bleeding: z.boolean().optional(),
          plaque: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const [pd1, pd2, pd3, pd4, pd5, pd6] = input.pd;
        const clampPd = (v: number) =>
          Math.max(0, Math.min(25, Number(v) || 0));
        const id = await db.setPeriodontalStatus({
          patientId: input.patientId,
          toothNumber: input.toothNumber,
          pd1: String(clampPd(pd1)),
          pd2: String(clampPd(pd2)),
          pd3: String(clampPd(pd3)),
          pd4: String(clampPd(pd4)),
          pd5: String(clampPd(pd5)),
          pd6: String(clampPd(pd6)),
          recession: String(
            Math.max(0, Math.min(25, Number(input.recession) || 0))
          ),
          mobility: input.mobility ?? "0",
          bleeding: input.bleeding ? 1 : 0,
          plaque: input.plaque ? 1 : 0,
        });
        return { id };
      }),
    surfaces: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.getToothSurfaceConditions(input.patientId);
      }),
    setSurface: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          toothNumber: z.string().min(1).max(4),
          surface: z.enum([
            "mesial",
            "distal",
            "buccal",
            "lingual",
            "occlusal",
          ]),
          condition: z.enum([
            "healthy",
            "decay",
            "filling",
            "crown",
            "extraction",
            "implant",
            "root_canal",
            "missing",
            "veneers",
            "bridge",
          ]),
          note: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.setToothSurfaceCondition(input);
        return { id };
      }),
    plans: protectedProcedure
      .input(z.object({ patientId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.listTreatmentPlans(input.patientId);
      }),
    createPlan: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          title: z.string().min(1),
          diagnosis: z.string().nullable().optional(),
          estimatedCost: money("estimatedCost"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.createTreatmentPlan({
          ...input,
          estimatedCost: String(input.estimatedCost),
        });
        return { id };
      }),
    updatePlan: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            title: z.string().optional(),
            diagnosis: z.string().nullable().optional(),
            status: z
              .enum(["planned", "in_progress", "completed", "cancelled"])
              .optional(),
            estimatedCost: money("estimatedCost").optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        await db.updateTreatmentPlan(input.id, {
          ...input.data,
          estimatedCost:
            input.data.estimatedCost !== undefined
              ? String(input.data.estimatedCost)
              : undefined,
        });
        return { success: true } as const;
      }),
    procedures: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.listProceduresByPlan(input.planId);
      }),
    addProcedure: protectedProcedure
      .input(
        z.object({
          planId: z.number(),
          toothNumber: z.string().max(4).nullable().optional(),
          procedureName: z.string().min(1),
          description: z.string().nullable().optional(),
          cost: money("cost"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.createProcedure({
          ...input,
          cost: String(input.cost),
        });
        return { id };
      }),
    updateProcedure: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            status: z.enum(["planned", "done"]).optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        await db.updateProcedure(input.id, input.data);
        return { success: true } as const;
      }),
    notes: protectedProcedure
      .input(z.object({ patientId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.listClinicalNotes(input.patientId);
      }),
    addNote: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          appointmentId: z.number().nullable().optional(),
          dentistName: z.string().nullable().optional(),
          title: z.string().nullable().optional(),
          content: z.string().nullable().optional(),
          noteDate: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.createClinicalNote({
          ...input,
          noteDate: new Date(input.noteDate),
        });
        return { id };
      }),
    updateNote: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            title: z.string().nullable().optional(),
            content: z.string().nullable().optional(),
            noteDate: z.string().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        await db.updateClinicalNote(input.id, {
          ...input.data,
          noteDate: input.data.noteDate
            ? new Date(input.data.noteDate)
            : undefined,
        });
        return { success: true } as const;
      }),
    deleteNote: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        await db.deleteClinicalNote(input.id);
        return { success: true } as const;
      }),
  }),

  // ---------------------------------------------------------------------------
  // Billing & payments
  // ---------------------------------------------------------------------------
  billing: router({
    invoices: protectedProcedure
      .input(z.object({ patientId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listInvoices(input);
      }),
    getInvoice: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.getInvoiceById(input.id);
      }),
    balance: protectedProcedure
      .input(z.object({ invoiceId: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.getInvoiceBalance(input.invoiceId);
      }),
    createInvoice: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          treatmentPlanId: z.number().nullable().optional(),
          discount: money("discount").optional(),
          tax: money("tax").optional(),
          dueDate: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          items: z
            .array(
              z.object({
                description: z.string().min(1),
                quantity: z.number().int().min(1),
                unitPrice: money("unitPrice"),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        const discount = input.discount ?? 0;
        const tax = input.tax ?? 0;
        const subtotal = input.items.reduce(
          (acc, item) => acc + item.quantity * item.unitPrice,
          0
        );
        const total = subtotal - discount + tax;
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(
          Math.floor(Math.random() * 9000) + 1000
        )}`;
        const invoiceId = await db.createInvoice({
          invoiceNumber,
          patientId: input.patientId,
          treatmentPlanId: input.treatmentPlanId ?? null,
          subtotal: String(subtotal),
          discount: String(discount),
          tax: String(tax),
          total: String(total),
          status: "sent",
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes ?? null,
        });
        for (const item of input.items) {
          await db.createInvoiceItem({
            invoiceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
            amount: String(item.quantity * item.unitPrice),
          });
        }
        return { id: invoiceId, invoiceNumber };
      }),
    updateInvoiceStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "sent", "paid", "partial", "cancelled"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        await db.updateInvoice(input.id, { status: input.status });
        return { success: true } as const;
      }),
    items: protectedProcedure
      .input(z.object({ invoiceId: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listInvoiceItems(input.invoiceId);
      }),
    payments: protectedProcedure
      .input(
        z.object({
          patientId: z.number().optional(),
          invoiceId: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listPayments(input);
      }),
    recordPayment: protectedProcedure
      .input(
        z.object({
          invoiceId: z.number(),
          patientId: z.number(),
          amount: money("amount"),
          method: z.enum(["cash", "card", "bank_transfer", "insurance"]),
          reference: z.string().nullable().optional(),
          type: z.enum(["payment", "refund"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        const balance = await db.getInvoiceBalance(input.invoiceId);
        const amount =
          input.type === "refund"
            ? input.amount
            : Math.min(input.amount, balance.balance);
        if (amount <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Amount must be greater than zero",
          });
        }
        const id = await db.createPayment({
          invoiceId: input.invoiceId,
          patientId: input.patientId,
          amount: String(amount),
          method: input.method,
          reference: input.reference ?? null,
          type: input.type ?? "payment",
        });
        const newBalance = await db.getInvoiceBalance(input.invoiceId);
        const status =
          newBalance.balance <= 0
            ? "paid"
            : newBalance.paid > 0
              ? "partial"
              : "sent";
        await db.updateInvoice(input.invoiceId, { status });
        return { id, newBalance, invoiceStatus: status };
      }),
  }),

  // ---------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------
  inventory: router({
    items: protectedProcedure.query(async ({ ctx }) => {
      requireRoles(ctx, ["admin", "dentist", "staff"]);
      return db.listInventoryItems();
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          category: z.string().nullable().optional(),
          sku: z.string().nullable().optional(),
          quantity: z.number().int().min(0),
          unit: z.string().max(32),
          lowStockThreshold: z.number().int().min(0),
          unitCost: money("unitCost"),
          supplier: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "staff"]);
        const id = await db.createInventoryItem({
          ...input,
          unitCost: String(input.unitCost),
        });
        return { id };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            name: z.string().optional(),
            category: z.string().nullable().optional(),
            sku: z.string().nullable().optional(),
            lowStockThreshold: z.number().int().min(0).optional(),
            unitCost: money("unitCost").optional(),
            supplier: z.string().nullable().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "staff"]);
        await db.updateInventoryItem(input.id, {
          ...input.data,
          unitCost:
            input.data.unitCost !== undefined
              ? String(input.data.unitCost)
              : undefined,
          lowStockThreshold: input.data.lowStockThreshold,
        });
        return { success: true } as const;
      }),
    adjust: protectedProcedure
      .input(
        z.object({
          itemId: z.number(),
          type: z.enum(["stock_in", "stock_out", "adjustment"]),
          quantity: z.number().int().min(1),
          reason: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "staff"]);
        return db.adjustInventory(
          input.itemId,
          input.type,
          input.quantity,
          input.reason ?? undefined,
          ctx.user?.id
        );
      }),
    movements: protectedProcedure
      .input(z.object({ itemId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "staff"]);
        return db.listInventoryMovements(input);
      }),
  }),

  // ---------------------------------------------------------------------------
  // Insurance
  // ---------------------------------------------------------------------------
  insurance: router({
    providers: protectedProcedure.query(async ({ ctx }) => {
      requireRoles(ctx, receptionistAccess);
      return db.listInsuranceProviders();
    }),
    addProvider: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          contactPhone: z.string().nullable().optional(),
          website: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        const id = await db.createInsuranceProvider(input);
        return { id };
      }),
    updateProvider: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            name: z.string().optional(),
            contactPhone: z.string().nullable().optional(),
            website: z.string().nullable().optional(),
            isActive: z.boolean().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        await db.updateInsuranceProvider(input.id, input.data);
        return { success: true } as const;
      }),
    patientInsurance: protectedProcedure
      .input(z.object({ patientId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listPatientInsurance(input.patientId);
      }),
    addPatientInsurance: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          providerId: z.number(),
          policyNumber: z.string().min(1),
          groupNumber: z.string().nullable().optional(),
          memberName: z.string().nullable().optional(),
          relationship: z.string().nullable().optional(),
          coPay: money("coPay"),
          deductible: money("deductible"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        const id = await db.createPatientInsurance({
          ...input,
          coPay: String(input.coPay),
          deductible: String(input.deductible),
        });
        return { id };
      }),
    updatePatientInsurance: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            coPay: money("coPay").optional(),
            deductible: money("deductible").optional(),
            isActive: z.boolean().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        await db.updatePatientInsurance(input.id, {
          ...(input.data.coPay ? { coPay: String(input.data.coPay) } : {}),
          ...(input.data.deductible
            ? { deductible: String(input.data.deductible) }
            : {}),
          ...(input.data.isActive !== undefined
            ? { isActive: input.data.isActive }
            : {}),
        });
        return { success: true } as const;
      }),
    claims: protectedProcedure
      .input(z.object({ patientId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listClaims(
          input.patientId ? { patientId: input.patientId } : undefined
        );
      }),
    createClaim: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          patientInsuranceId: z.number().nullable().optional(),
          invoiceId: z.number().nullable().optional(),
          amount: money("amount"),
          description: z.string().nullable().optional(),
          filedDate: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        const claimNumber = `CLM-${new Date().getFullYear()}-${String(
          Math.floor(Math.random() * 9000) + 1000
        )}`;
        const id = await db.createClaim({
          patientId: input.patientId,
          patientInsuranceId: input.patientInsuranceId ?? null,
          invoiceId: input.invoiceId ?? null,
          claimNumber,
          amount: String(input.amount),
          status: "pending",
          description: input.description ?? null,
          filedDate: input.filedDate ? new Date(input.filedDate) : null,
        });
        return { id, claimNumber };
      }),
    updateClaimStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "submitted", "approved", "denied"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        await db.updateClaim(input.id, { status: input.status });
        return { success: true } as const;
      }),
  }),

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  reports: router({
    appointments: protectedProcedure
      .input(
        z.object({
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const rows = await db.listAppointments(input);
        const total = rows.length;
        const byStatus: Record<string, number> = {};
        const byType: Record<string, number> = {};
        rows.forEach(r => {
          byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
          byType[r.type] = (byType[r.type] ?? 0) + 1;
        });
        return { total, byStatus, byType, rows };
      }),
    revenue: protectedProcedure
      .input(
        z.object({
          month: z.string().optional(), // YYYY-MM
        })
      )
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const payments = await db.listPayments();
        const byMonth: Record<string, number> = {};
        let total = 0;
        payments.forEach(p => {
          const m = new Date(p.paidAt).toISOString().slice(0, 7);
          if (input.month && m !== input.month) return;
          const amt = Number(p.amount) * (p.type === "refund" ? -1 : 1);
          byMonth[m] = (byMonth[m] ?? 0) + amt;
          total += amt;
        });
        const byMethod: Record<string, number> = {};
        payments.forEach(p => {
          if (
            input.month &&
            new Date(p.paidAt).toISOString().slice(0, 7) !== input.month
          )
            return;
          byMethod[p.method] =
            (byMethod[p.method] ?? 0) +
            Number(p.amount) * (p.type === "refund" ? -1 : 1);
        });
        return { total, byMonth, byMethod };
      }),
    patients: protectedProcedure.query(async ({ ctx }) => {
      requireRoles(ctx, dentistOrAdmin);
      const all = await db.listPatients();
      const total = all.length;
      const byGender: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const monthly: Record<string, number> = {};
      all.forEach(p => {
        byGender[p.gender ?? "unknown"] =
          (byGender[p.gender ?? "unknown"] ?? 0) + 1;
        byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
        const m = new Date(p.registeredAt).toISOString().slice(0, 7);
        monthly[m] = (monthly[m] ?? 0) + 1;
      });
      return { total, byGender, byStatus, monthly };
    }),
  }),

  // ---------------------------------------------------------------------------
  // Users / staff management (admin only)
  // ---------------------------------------------------------------------------
users: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    requireRoles(ctx, ["admin"]);
    return db.listStaffUsers();
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(128),
        email: z.string().trim().email().max(320).transform(value => value.toLowerCase()),
        password: z.string().min(8).max(128),
        role: z.enum(["admin", "dentist", "receptionist", "staff"]),
        phone: z
          .string()
          .trim()
          .max(32)
          .optional()
          .transform(value => value || null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        requireRoles(ctx, ["admin"]);

        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists",
          });
        }

        const passwordHash = createHash("sha256")
          .update(input.password)
          .digest("hex");

        const userId = await db.createLocalUser({
          openId: `local:${randomUUID()}`,
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
          phone: input.phone,
        });

        try {
          await appendAuditLog(ctx, {
            action: "admin",
            resourceType: "user",
            resourceId: String(userId),
            purpose: null,
            outcome: "success",
            metadata: JSON.stringify({
              procedure: "users.create",
              role: input.role,
              loginMethod: "local",
            }),
          });
        } catch (auditError) {
          // The account exists already; do not report a false account-creation
          // failure just because the separate audit insert failed.
          console.error("Failed to write account creation audit log", auditError);
        }

        return { success: true, id: userId } as const;
      } catch (error) {
        try {
          await appendAuditLog(ctx, {
            action: "admin",
            resourceType: "user",
            resourceId: null,
            purpose: null,
            outcome:
              error instanceof TRPCError && error.code === "FORBIDDEN"
                ? "denied"
                : "error",
            metadata: JSON.stringify({
              procedure: "users.create",
              requestedRole: input.role,
            }),
          });
        } catch (auditError) {
          console.error("Failed to write account creation failure audit log", auditError);
        }

        throw error;
      }
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        role: z.enum(["admin", "dentist", "receptionist", "staff"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireRoles(ctx, ["admin"]);
      if (input.id === ctx.user!.id && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }
      await db.updateUserRoleAndStatus(input.id, { role: input.role });
      return { success: true } as const;
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireRoles(ctx, ["admin"]);
      if (input.id === ctx.user!.id && !input.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate your own account",
        });
      }
      await db.updateUserRoleAndStatus(input.id, { isActive: input.isActive });
      return { success: true } as const;
    }),
}),


  // ---------------------------------------------------------------------------
  // Clinic settings (admin only)
  // ---------------------------------------------------------------------------
  settings: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      requireRoles(ctx, ["admin"]);
      return db.listSettings();
    }),
    upsert: protectedProcedure
      .input(
        z.object({
          key: z.string().min(1).max(128),
          value: z.string().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin"]);
        await db.setSetting(input.key, input.value);
        return { success: true } as const;
      }),
    bulk: protectedProcedure
      .input(
        z.object({
          clinicName: z.string().optional(),
          address: z.string().nullable().optional(),
          phone: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
          workingHours: z.string().nullable().optional(),
          currency: z.string().max(8).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin"]);
        const keys: Record<string, string | null | undefined> = {
          "clinic.name": input.clinicName ?? undefined,
          "clinic.address": input.address ?? undefined,
          "clinic.phone": input.phone ?? undefined,
          "clinic.email": input.email ?? undefined,
          "clinic.workingHours": input.workingHours ?? undefined,
          "clinic.currency": input.currency ?? undefined,
        };
        for (const [key, value] of Object.entries(keys)) {
          if (value !== undefined) await db.setSetting(key, value);
        }
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;