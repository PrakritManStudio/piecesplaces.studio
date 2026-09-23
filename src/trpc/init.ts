import { initTRPC, TRPCError } from "@trpc/server";
import { headers as nextHeaders } from "next/headers";
import { cache } from "react";
import superjson from "superjson";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const createTRPCContext = cache(async (opts?: { headers: Headers }) => {
  const headers = opts?.headers ?? (await nextHeaders());
  const session = await auth.api.getSession({ headers });

  return {
    prisma,
    headers,
    session,
    user: session?.user ?? null,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      isAdmin: isAdmin(ctx.session.user.role),
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

function isAdmin(role: string | null | undefined) {
  return role?.split(",").includes("admin") ?? false;
}
