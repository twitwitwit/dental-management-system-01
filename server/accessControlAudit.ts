import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { auditLogs, type InsertAuditLog } from "../drizzle/schema";
import { getDb } from "./db";

export type Role = "admin" | "dentist" | "receptionist" | "staff" | "patient";
export type AccessAction = "read" | "write" | "delete" | "admin";
export type AccessArea =
  | "medical"
  | "billing"
  | "appointments"
  | "inventory"
  | "settings"
  | "audit";

type Permission = AccessAction | "conditional_read" | "limited_read" | "none";

/** Server-side source of truth. Never rely on hidden navigation for security. */
export const ACCESS_MATRIX: Record<AccessArea, Record<Role, Permission>> = {
  medical: {
    admin: "conditional_read",
    dentist: "write",
    receptionist: "read",
    staff: "limited_read",
    patient: "none",
  },
  billing: {
    admin: "admin",
    dentist: "read",
    receptionist: "write",
    staff: "none",
    patient: "none",
  },
  appointments: {
    admin: "read",
    dentist: "write",
    receptionist: "write",
    staff: "read",
    patient: "none",
  },
  inventory: {
    admin: "admin",
    dentist: "read",
    receptionist: "read",
    staff: "write",
    patient: "none",
  },
  settings: {
    admin: "admin",
    dentist: "none",
    receptionist: "none",
    staff: "none",
    patient: "none",
  },
  audit: {
    admin: "admin",
    dentist: "none",
    receptionist: "none",
    staff: "none",
    patient: "none",
  },
};

export function roleOf(ctx: { user: { role?: unknown } | null }): Role | null {
  const role = ctx.user?.role;
  return role === "admin" || role === "dentist" || role === "receptionist" || role === "staff" || role === "patient"
    ? role
    : null;
}

export function requireAccess(
  ctx: { user: { role?: unknown } | null },
  area: AccessArea,
  action: AccessAction,
  purpose?: string | null,
) {
  const role = roleOf(ctx);
  const permission = role ? ACCESS_MATRIX[area][role] : "none";

  const allowed =
    permission === "admin" ||
    permission === action ||
    (action === "read" && permission === "write") ||
    (action === "read" && permission === "limited_read") ||
    (action === "read" && permission === "conditional_read");

  if (!role || !allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Access denied for ${area}` });
  }

  // Admin medical access is technical/conditional, not normal clinical access.
  if (area === "medical" && role === "admin" && action === "read") {
    const cleanPurpose = purpose?.trim();
    if (!cleanPurpose || cleanPurpose.length < 8) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Admin medical-record access requires a justification of at least 8 characters",
      });
    }
  }

  return role;
}

export function requestAuditFields(ctx: {
  req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
}) {
  const forwarded = ctx.req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : ctx.req.socket?.remoteAddress;
  const userAgent = ctx.req.headers["user-agent"];
  return {
    ipAddress: ipAddress ?? null,
    userAgent: Array.isArray(userAgent) ? userAgent.join(" ") : userAgent ?? null,
  };
}

export async function appendAuditLog(
  ctx: {
    user: { id?: number; role?: unknown } | null;
    req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } };
  },
  entry: Omit<InsertAuditLog, "actorUserId" | "actorRole" | "ipAddress" | "userAgent">,
) {
  const db = await getDb();
  if (!db) return 0;
  const actorRole = roleOf(ctx);
  const request = requestAuditFields(ctx);
  const result = await db.insert(auditLogs).values({
    ...entry,
    actorUserId: ctx.user?.id ?? null,
    actorRole,
    ...request,
  });
  return Number(result[0].insertId);
}

export async function listAuditLogs(input: {
  actorUserId?: number;
  action?: string;
  resourceType?: string;
  outcome?: "success" | "denied" | "error";
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (input.actorUserId !== undefined) conditions.push(eq(auditLogs.actorUserId, input.actorUserId));
  if (input.action) conditions.push(eq(auditLogs.action, input.action));
  if (input.resourceType) conditions.push(eq(auditLogs.resourceType, input.resourceType));
  if (input.outcome) conditions.push(eq(auditLogs.outcome, input.outcome));
  if (input.dateFrom) conditions.push(gte(auditLogs.createdAt, input.dateFrom));
  if (input.dateTo) conditions.push(lte(auditLogs.createdAt, input.dateTo));
  return db
    .select()
    .from(auditLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 500));
}

/* Add this to server/routers.ts. The audit router intentionally has no update/delete procedures. */
export const auditRouterExample = `
  audit: router({
    list: protectedProcedure
      .input(z.object({
        actorUserId: z.number().optional(),
        action: z.string().optional(),
        resourceType: z.string().optional(),
        outcome: z.enum(["success", "denied", "error"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }))
      .query(async ({ ctx, input }) => {
        requireAccess(ctx, "audit", "read");
        return db.listAuditLogs({
          ...input,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        });
      }),
  }),
`;

/*
  Use this pattern in sensitive procedures:

  const purpose = input.auditPurpose;
  requireAccess(ctx, "medical", "read", purpose);
  await db.appendAuditLog(ctx, {
    action: "read",
    resourceType: "patient",
    resourceId: String(input.id),
    purpose: purpose ?? null,
    outcome: "success",
    metadata: JSON.stringify({ route: "patients.get" }),
  });
  return db.getPatientById(input.id);

  For mutations, call appendAuditLog only after the DB mutation succeeds. For
  failed/denied actions, add an error-handling middleware or explicit catch that
  writes outcome='denied'/'error' without exposing sensitive payload values.
*/
