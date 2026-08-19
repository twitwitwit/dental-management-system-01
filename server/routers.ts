import { COOKIE_NAME } from "@shared/const";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";

type Role = "admin" | "dentist" | "receptionist" | "staff";

function roleOf(ctx: { user: { role?: unknown } | null }): Role | null {
  return (ctx.user?.role as Role | undefined) ?? null;
}

/** Require one of the allowed roles; otherwise forbidden. */
function requireRoles(
  ctx: { user: { role?: unknown } | null },
  allowed: Role[],
) {
  const role = roleOf(ctx);
  if (!role || !allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied for your role" });
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
  phone: z.string().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  bloodType: z.string().max(4).nullable().optional(),
  allergies: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
  dentalNotes: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const money = (name: string) =>
  z
    .union([z.string(), z.number()])
    .transform(v => Number(v))
    .refine(n => !Number.isNaN(n) && n >= 0, name);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        const passwordHash = createHash("sha256").update(input.password).digest("hex");
        if (!user || !user.isActive || user.passwordHash !== passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const token = await sdk.signSession({ openId: user.openId, appId: "local", name: user.name ?? user.email ?? "User" });
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 365 * 24 * 60 * 60 * 1000 });
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
        z.object({ search: z.string().optional(), status: z.string().optional() }),
      )
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listPatients(input);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.getPatientById(input.id);
      }),
    create: protectedProcedure
      .input(patientInput)
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        const id = await db.createPatient({ ...input, dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null });
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: patientInput.partial() }))
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        await db.updatePatient(input.id, {
          ...input.data,
          dateOfBirth: input.data.dateOfBirth ? new Date(input.data.dateOfBirth) : undefined,
        });
        return { success: true } as const;
      }),
  }),

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
        }),
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
          status: z.enum(["scheduled", "confirmed", "completed", "no_show"]).optional(),
          notes: z.string().nullable().optional(),
        }),
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
            status: z.enum(["scheduled", "confirmed", "completed", "no_show"]).optional(),
            notes: z.string().nullable().optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, everyone);
        // Staff may only update status of appointments
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
        return { success: true } as const;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        await db.deleteAppointment(input.id);
        return { success: true } as const;
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.setToothCondition({ ...input, mode: input.mode ?? "status" });
        return { id };
      }),
    setToothConditionsBulk: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          teeth: z.array(
            z.object({
              toothNumber: z.string().min(1).max(4),
              condition: z.enum([
                "healthy", "decay", "filling", "crown", "extraction",
                "implant", "root_canal", "missing", "veneers", "bridge",
              ]),
              mode: z.enum(["status", "plan"]).optional(),
              note: z.string().nullable().optional(),
            }),
          ).min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        return db.setToothConditionsBulk(
          input.patientId,
          input.teeth.map(t => ({ ...t, mode: t.mode ?? "status" })),
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
          pd: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]),
          recession: z.number().optional(),
          mobility: z.enum(["0", "1", "2", "3"]).optional(),
          bleeding: z.boolean().optional(),
          plaque: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const [pd1, pd2, pd3, pd4, pd5, pd6] = input.pd;
        const clampPd = (v: number) => Math.max(0, Math.min(25, Number(v) || 0));
        const id = await db.setPeriodontalStatus({
          patientId: input.patientId,
          toothNumber: input.toothNumber,
          pd1: String(clampPd(pd1)),
          pd2: String(clampPd(pd2)),
          pd3: String(clampPd(pd3)),
          pd4: String(clampPd(pd4)),
          pd5: String(clampPd(pd5)),
          pd6: String(clampPd(pd6)),
          recession: String(Math.max(0, Math.min(25, Number(input.recession) || 0))),
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
          surface: z.enum(["mesial", "distal", "buccal", "lingual", "occlusal"]),
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
        }),
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.createTreatmentPlan({ ...input, estimatedCost: String(input.estimatedCost) });
        return { id };
      }),
    updatePlan: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            title: z.string().optional(),
            diagnosis: z.string().nullable().optional(),
            status: z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
            estimatedCost: money("estimatedCost").optional(),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        await db.updateTreatmentPlan(input.id, {
          ...input.data,
          estimatedCost: input.data.estimatedCost !== undefined ? String(input.data.estimatedCost) : undefined,
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.createProcedure({ ...input, cost: String(input.cost) });
        return { id };
      }),
    updateProcedure: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            status: z.enum(["planned", "done"]).optional(),
          }),
        }),
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        const id = await db.createClinicalNote({ ...input, noteDate: new Date(input.noteDate) });
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, dentistOrAdmin);
        await db.updateClinicalNote(input.id, {
          ...input.data,
          noteDate: input.data.noteDate ? new Date(input.data.noteDate) : undefined,
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
              }),
            )
            .min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        const discount = input.discount ?? 0;
        const tax = input.tax ?? 0;
        const subtotal = input.items.reduce(
          (acc, item) => acc + item.quantity * item.unitPrice,
          0,
        );
        const total = subtotal - discount + tax;
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(
          Math.floor(Math.random() * 9000) + 1000,
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
        }),
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
        z.object({ patientId: z.number().optional(), invoiceId: z.number().optional() }),
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "receptionist"]);
        const balance = await db.getInvoiceBalance(input.invoiceId);
        const amount = input.type === "refund" ? input.amount : Math.min(input.amount, balance.balance);
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
          newBalance.balance <= 0 ? "paid" : newBalance.paid > 0 ? "partial" : "sent";
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "staff"]);
        const id = await db.createInventoryItem({ ...input, unitCost: String(input.unitCost) });
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "staff"]);
        await db.updateInventoryItem(input.id, {
          ...input.data,
          unitCost: input.data.unitCost !== undefined ? String(input.data.unitCost) : undefined,
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "dentist", "staff"]);
        return db.adjustInventory(
          input.itemId,
          input.type,
          input.quantity,
          input.reason ?? undefined,
          ctx.user?.id,
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
        }),
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
        }),
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        const id = await db.createPatientInsurance({ ...input, coPay: String(input.coPay), deductible: String(input.deductible) });
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        await db.updatePatientInsurance(input.id, {
          ...(input.data.coPay ? { coPay: String(input.data.coPay) } : {}),
          ...(input.data.deductible ? { deductible: String(input.data.deductible) } : {}),
          ...(input.data.isActive !== undefined ? { isActive: input.data.isActive } : {}),
        });
        return { success: true } as const;
      }),
    claims: protectedProcedure
      .input(z.object({ patientId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        requireRoles(ctx, receptionistAccess);
        return db.listClaims(input.patientId ? { patientId: input.patientId } : undefined);
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireRoles(ctx, ["admin", "receptionist"]);
        const claimNumber = `CLM-${new Date().getFullYear()}-${String(
          Math.floor(Math.random() * 9000) + 1000,
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
        }),
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
        }),
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
        }),
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
          if (input.month && new Date(p.paidAt).toISOString().slice(0, 7) !== input.month) return;
          byMethod[p.method] =
            (byMethod[p.method] ?? 0) + Number(p.amount) * (p.type === "refund" ? -1 : 1);
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
        byGender[p.gender ?? "unknown"] = (byGender[p.gender ?? "unknown"] ?? 0) + 1;
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
      .input(z.object({ key: z.string().min(1).max(128), value: z.string().nullable() }))
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
        }),
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
