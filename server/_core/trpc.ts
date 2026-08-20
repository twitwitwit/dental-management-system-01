import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

import { appendAuditLog } from "../accessControlAudit";

const auditMiddleware = t.middleware(async opts => {
  const result = await opts.next();
  const path = String(opts.path);

  // The audit reader is excluded to avoid recursive self-logging.
  if (!path.startsWith("audit.")) {
    const action = opts.type === "query" ? "read" : "write";
    const outcome = result.ok ? "success" : "error";

    // Never store raw input: it may contain medical or financial data.
    await appendAuditLog(opts.ctx, {
      action,
      resourceType: path.split(".")[0] ?? "unknown",
      resourceId: null,
      purpose: null,
      outcome,
      metadata: JSON.stringify({ procedure: path, procedureType: opts.type }),
    });
  }

  return result;
});

export const auditedProtectedProcedure =
  protectedProcedure.use(auditMiddleware);
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
