import { TRPCError } from "@trpc/server";

import type { PrismaClient } from "@/generated/prisma/client";

type Ctx = {
  prisma: PrismaClient;
  user: { id: string };
  isAdmin: boolean;
};

export async function loadJob(ctx: Ctx, jobId: string, need: "view" | "edit") {
  const job = await ctx.prisma.job.findUnique({
    where: { id: jobId },
    include: { collaborators: { select: { userId: true } } },
  });
  if (!job) throw new TRPCError({ code: "NOT_FOUND" });
  if (ctx.isAdmin) return job;

  const uid = ctx.user.id;
  const canEdit =
    job.ownerUserId === uid || job.collaborators.some((c) => c.userId === uid);
  const canView =
    canEdit || job.referralUserId === uid || job.createdById === uid;
  if (need === "edit" ? !canEdit : !canView) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return job;
}

export function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
