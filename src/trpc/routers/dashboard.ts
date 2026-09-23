import { z } from "zod";

import { summarize } from "@/domain/dashboard";
import { GuestEngagement, ServiceType } from "@/generated/prisma/enums";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { id } from "@/trpc/schemas";

export const dashboardRouter = createTRPCRouter({
  summary: adminProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
        ownerUserId: id.optional(),
        ownerGuestId: id.optional(),
        serviceType: z.enum(ServiceType).optional(),
        guestEngagement: z.enum(GuestEngagement).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const range = { gte: input.from, lt: input.to };
      const [closes, expenses, paidOut] = await Promise.all([
        ctx.prisma.jobClose.findMany({
          where: {
            status: "approved",
            decidedAt: range,
            job: {
              ownerUserId: input.ownerUserId,
              ownerGuestId: input.ownerGuestId,
              serviceType: input.serviceType,
              guestEngagement: input.guestEngagement,
            },
          },
          include: {
            job: {
              select: {
                guestEngagement: true,
                ownerUser: { select: { id: true, name: true } },
                ownerGuest: { select: { id: true, name: true } },
              },
            },
          },
        }),
        ctx.prisma.expense.findMany({
          where: { status: "approved", spentAt: range },
          select: { amountSatang: true, category: { select: { name: true } } },
        }),
        ctx.prisma.payoutBatch.aggregate({
          where: { status: "paid", paidAt: range },
          _sum: { totalSatang: true },
        }),
      ]);

      const summary = summarize(
        closes.map((c) => {
          const owner = c.job.ownerUser ?? c.job.ownerGuest;
          return {
            engagement: c.job.guestEngagement,
            ownerKey: owner?.id ?? "unknown",
            ownerName: owner?.name ?? "-",
            split: {
              baseSatang: c.baseSatang ?? 0,
              ownerSatang: c.ownerSatang ?? 0,
              referralSatang: c.referralSatang ?? 0,
              shopSatang: c.shopSatang ?? 0,
              refundSatang: c.refundSatang ?? 0,
            },
          };
        }),
        expenses.map((e) => ({ category: e.category.name, amountSatang: e.amountSatang })),
      );
      return { ...summary, payoutsPaidSatang: paidOut._sum.totalSatang ?? 0 };
    }),
});
