import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { cycleCutoff, upcomingCycleDate } from "@/domain/cycle";
import type { Prisma } from "@/generated/prisma/client";
import { PayoutBatchStatus } from "@/generated/prisma/enums";
import { badRequest } from "@/trpc/job-access";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { id, optionalText, reason } from "@/trpc/schemas";

const TX_OPTIONS = { timeout: 15_000 };

function parseCycle(cycleDate: string) {
  return cycleCutoff(cycleDate) ?? badRequest("รอบจ่ายต้องเป็นวันที่ 1 หรือ 16 (YYYY-MM-DD)");
}

function eligibleBefore(cutoff: Date): Prisma.PayoutEntitlementWhereInput {
  return { payoutBatchId: null, createdAt: { lt: cutoff } };
}

async function claimEntitlements(
  tx: Prisma.TransactionClient,
  batchId: string,
  entitlementIds: string[],
) {
  const { count } = await tx.payoutEntitlement.updateMany({
    where: { id: { in: entitlementIds }, payoutBatchId: null },
    data: { payoutBatchId: batchId },
  });
  if (count !== entitlementIds.length) {
    throw new TRPCError({ code: "CONFLICT", message: "มียอดบางรายการถูกจัดรอบไปแล้ว ลองใหม่" });
  }
}

const batchInclude = {
  user: { select: { id: true, name: true } },
  paidBy: { select: { name: true } },
  entitlements: {
    include: { job: { select: { id: true, title: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.PayoutBatchInclude;

export const payoutRouter = createTRPCRouter({
  upcomingCycleDate: protectedProcedure.query(() => upcomingCycleDate(new Date())),

  mine: protectedProcedure.query(async ({ ctx }) => {
    const [entitlements, batches] = await Promise.all([
      ctx.prisma.payoutEntitlement.findMany({
        where: { userId: ctx.user.id },
        include: {
          job: { select: { id: true, title: true } },
          payoutBatch: { select: { id: true, kind: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      ctx.prisma.payoutBatch.findMany({
        where: { userId: ctx.user.id },
        include: batchInclude,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { entitlements, batches };
  }),

  eligible: adminProcedure
    .input(z.object({ cycleDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const cutoff = parseCycle(input.cycleDate);
      const totals = await ctx.prisma.payoutEntitlement.groupBy({
        by: ["userId"],
        where: eligibleBefore(cutoff),
        _sum: { amountSatang: true },
        _count: true,
      });
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: totals.map((t) => t.userId) } },
        select: { id: true, name: true },
      });
      const nameOf = new Map(users.map((u) => [u.id, u.name]));
      return totals.map((t) => ({
        userId: t.userId,
        name: nameOf.get(t.userId) ?? t.userId,
        totalSatang: t._sum.amountSatang ?? 0,
        count: t._count,
      }));
    }),

  createCycleBatches: adminProcedure
    .input(z.object({ cycleDate: z.string() }))
    .mutation(({ ctx, input }) => {
      const cutoff = parseCycle(input.cycleDate);
      return ctx.prisma.$transaction(async (tx) => {
        const eligible = await tx.payoutEntitlement.findMany({
          where: eligibleBefore(cutoff),
          select: { id: true, userId: true, amountSatang: true },
        });
        const byUser = Map.groupBy(eligible, (e) => e.userId);
        const created = [];
        for (const [userId, rows] of byUser) {
          const batch = await tx.payoutBatch.create({
            data: {
              kind: "cycle",
              userId,
              cycleDate: cutoff,
              totalSatang: rows.reduce((a, r) => a + r.amountSatang, 0),
              createdById: ctx.user.id,
            },
          });
          await claimEntitlements(tx, batch.id, rows.map((r) => r.id));
          created.push(batch);
        }
        return created;
      }, TX_OPTIONS);
    }),

  requestAdvance: protectedProcedure
    .input(z.object({ jobIds: z.array(id).min(1), userId: id.optional() }))
    .mutation(({ ctx, input }) => {
      const userId = input.userId ?? ctx.user.id;
      if (userId !== ctx.user.id && !ctx.isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const jobIds = [...new Set(input.jobIds)];
      return ctx.prisma.$transaction(async (tx) => {
        const rows = await tx.payoutEntitlement.findMany({
          where: { userId, jobId: { in: jobIds }, payoutBatchId: null },
          select: { id: true, jobId: true, amountSatang: true },
        });
        const covered = new Set(rows.map((r) => r.jobId));
        if (jobIds.some((j) => !covered.has(j))) {
          badRequest("บางงานไม่มียอดค้างให้เบิก (ยังไม่ปิด หรือจัดรอบ/เบิกไปแล้ว)");
        }
        const batch = await tx.payoutBatch.create({
          data: {
            kind: "advance",
            userId,
            totalSatang: rows.reduce((a, r) => a + r.amountSatang, 0),
            createdById: ctx.user.id,
          },
        });
        await claimEntitlements(tx, batch.id, rows.map((r) => r.id));
        return batch;
      }, TX_OPTIONS);
    }),

  list: adminProcedure
    .input(z.object({ status: z.enum(PayoutBatchStatus).optional() }))
    .query(({ ctx, input }) =>
      ctx.prisma.payoutBatch.findMany({
        where: { status: input.status },
        include: batchInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ),

  markPaid: adminProcedure
    .input(z.object({ id, evidenceUrl: z.string().trim().min(1), note: optionalText }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.payoutBatch.updateMany({
        where: { id: input.id, status: "pending" },
        data: {
          status: "paid",
          evidenceUrl: input.evidenceUrl,
          note: input.note ?? null,
          paidById: ctx.user.id,
          paidAt: new Date(),
        },
      });
      if (count !== 1) throw new TRPCError({ code: "CONFLICT", message: "รอบจ่ายนี้ไม่ได้รอจ่ายอยู่" });
    }),

  cancel: adminProcedure
    .input(z.object({ id, reason }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const { count } = await tx.payoutBatch.updateMany({
          where: { id: input.id, status: "pending" },
          data: { status: "cancelled", cancelReason: input.reason },
        });
        if (count !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "รอบจ่ายนี้ไม่ได้รอจ่ายอยู่" });
        }
        await tx.payoutEntitlement.updateMany({
          where: { payoutBatchId: input.id },
          data: { payoutBatchId: null },
        });
      }, TX_OPTIONS),
    ),
});
