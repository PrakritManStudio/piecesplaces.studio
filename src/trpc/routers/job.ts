import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  closeMovements,
  INBOUND_KINDS,
  isInbound,
  ratesError,
  settleClose,
  toCloseInput,
} from "@/domain/split";
import { CloseOutcome, JobStatus, ServiceType } from "@/generated/prisma/enums";
import { nextJobNo } from "@/lib/job-code";
import { badRequest, loadJob } from "@/trpc/job-access";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { id, optionalText, pct, reason, satang } from "@/trpc/schemas";

const jobBase = z.object({
  title: z.string().trim().min(1),
  serviceType: z.enum(ServiceType),
  scheduledAt: z.coerce.date(),
  styleNote: optionalText,
  customerName: optionalText,
  estimatedTotalSatang: satang.nullish(),
  splitTemplateId: id.nullish(),
  artistPct: pct,
  referralPct: pct,
  collaboratorIds: z.array(id).default([]),
  tagIds: z.array(id).default([]),
});

const jobInput = z.discriminatedUnion("guestEngagement", [
  jobBase.extend({
    guestEngagement: z.literal("none"),
    ownerUserId: id,
    referralUserId: id.nullish(),
  }),
  jobBase.extend({
    guestEngagement: z.enum(["guest_sourced", "shop_overflow"]),
    ownerGuestId: id,
  }),
]);

type JobInput = z.infer<typeof jobInput>;

function toJobData(input: JobInput) {
  const owner =
    input.guestEngagement === "none"
      ? {
          ownerUserId: input.ownerUserId,
          ownerGuestId: null,
          referralUserId: input.referralUserId ?? null,
        }
      : { ownerUserId: null, ownerGuestId: input.ownerGuestId, referralUserId: null };

  const error = ratesError(input.guestEngagement, input, owner.referralUserId !== null);
  if (error) badRequest(error);

  return {
    title: input.title,
    serviceType: input.serviceType,
    scheduledAt: input.scheduledAt,
    styleNote: input.styleNote ?? null,
    customerName: input.customerName ?? null,
    estimatedTotalSatang: input.estimatedTotalSatang ?? null,
    splitTemplateId: input.splitTemplateId ?? null,
    guestEngagement: input.guestEngagement,
    artistPct: input.artistPct,
    referralPct: input.referralPct,
    ...owner,
  };
}

const MONEY_FIELDS = [
  "guestEngagement",
  "ownerUserId",
  "ownerGuestId",
  "referralUserId",
  "artistPct",
  "referralPct",
] as const;

const TX_OPTIONS = { timeout: 15_000 };

export const jobRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["mine", "all"]).default("mine"),
        status: z.enum(JobStatus).optional(),
        ownerUserId: id.optional(),
        ownerGuestId: id.optional(),
        tagIds: z.array(id).default([]),
        scheduledFrom: z.coerce.date().optional(),
        scheduledTo: z.coerce.date().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      if (input.scope === "all" && !ctx.isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const uid = ctx.user.id;
      return ctx.prisma.job.findMany({
        where: {
          status: input.status,
          ownerUserId: input.ownerUserId,
          ownerGuestId: input.ownerGuestId,
          scheduledAt: {
            gte: input.scheduledFrom,
            lt: input.scheduledTo,
          },
          ...(input.tagIds.length > 0 && {
            tags: { some: { tagId: { in: input.tagIds } } },
          }),
          ...(input.scope === "mine" && {
            OR: [
              { ownerUserId: uid },
              { referralUserId: uid },
              { createdById: uid },
              { collaborators: { some: { userId: uid } } },
            ],
          }),
        },
        include: {
          ownerUser: { select: { id: true, name: true } },
          ownerGuest: { select: { id: true, name: true } },
          referralUser: { select: { name: true } },
          tags: {
            include: { tag: { select: { id: true, name: true, color: true } } },
          },
        },
        orderBy: { scheduledAt: "desc" },
        take: 200,
      });
    }),

  byId: protectedProcedure.input(z.object({ id })).query(async ({ ctx, input }) => {
    const access = await loadJob(ctx, input.id, "view");
    const job = await ctx.prisma.job.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        ownerUser: { select: { id: true, name: true } },
        ownerGuest: { select: { id: true, name: true } },
        referralUser: { select: { id: true, name: true } },
        splitTemplate: { select: { id: true, label: true } },
        collaborators: { include: { user: { select: { id: true, name: true } } } },
        tags: {
          include: { tag: { select: { id: true, name: true, color: true, active: true } } },
        },
        payments: {
          include: {
            createdBy: { select: { name: true } },
            reviewedBy: { select: { name: true } },
          },
          orderBy: { receivedAt: "asc" },
        },
        closes: {
          include: {
            requestedBy: { select: { name: true } },
            decidedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        entitlements: {
          include: {
            user: { select: { name: true } },
            payoutBatch: { select: { id: true, kind: true, status: true } },
          },
        },
      },
    });

    const approvedClose = job.closes.find((c) => c.status === "approved");
    const settlement = approvedClose
      ? closeMovements(job.guestEngagement, approvedClose.outcome, {
          baseSatang: approvedClose.baseSatang ?? 0,
          ownerSatang: approvedClose.ownerSatang ?? 0,
          referralSatang: approvedClose.referralSatang ?? 0,
          shopSatang: approvedClose.shopSatang ?? 0,
          refundSatang: approvedClose.refundSatang ?? 0,
        }).map((m) => {
          const ofKind = job.payments.filter((p) => p.kind === m.kind);
          const sum = (status: string) =>
            ofKind
              .filter((p) => p.status === status)
              .reduce((a, p) => a + p.amountSatang, 0);
          return {
            kind: m.kind,
            dueSatang: m.amountSatang,
            approvedSatang: sum("approved"),
            pendingSatang: sum("pending"),
          };
        })
      : [];

    const uid = ctx.user.id;
    const canEdit =
      ctx.isAdmin ||
      access.ownerUserId === uid ||
      access.collaborators.some((c) => c.userId === uid);

    return { ...job, settlement, canEdit };
  }),

  create: protectedProcedure.input(jobInput).mutation(({ ctx, input }) => {
    const data = toJobData(input);
    const collaboratorIds = new Set(input.collaboratorIds);
    if (data.ownerUserId !== ctx.user.id) collaboratorIds.add(ctx.user.id);
    const tagIds = [...new Set(input.tagIds)];

    return ctx.prisma.$transaction(async (tx) => {
      if (tagIds.length > 0) {
        const active = await tx.tag.count({
          where: { id: { in: tagIds }, active: true },
        });
        if (active !== tagIds.length) badRequest("มี tag ที่ไม่พร้อมใช้งาน");
      }
      const agg = await tx.job.aggregate({ _max: { jobNo: true } });
      return tx.job.create({
        data: {
          ...data,
          jobNo: nextJobNo(agg._max.jobNo),
          createdById: ctx.user.id,
          collaborators: {
            create: [...collaboratorIds].map((userId) => ({ userId })),
          },
          tags: {
            create: tagIds.map((tagId) => ({ tagId })),
          },
        },
      });
    }, TX_OPTIONS);
  }),

  update: protectedProcedure
    .input(z.object({ id, data: jobInput }))
    .mutation(async ({ ctx, input }) => {
      const job = await loadJob(ctx, input.id, "edit");
      const data = toJobData(input.data);

      if (job.status !== "open") {
        if (!ctx.isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "งานที่ส่งปิดหรือปิดแล้ว แก้ได้เฉพาะ admin",
          });
        }
        if (MONEY_FIELDS.some((f) => job[f] !== data[f])) {
          badRequest("งานที่ส่งปิดหรือปิดแล้ว แก้เจ้าของ/Referral/อัตราไม่ได้");
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        const tagIds = [...new Set(input.data.tagIds)];
        if (tagIds.length > 0) {
          const active = await tx.tag.count({
            where: { id: { in: tagIds }, active: true },
          });
          if (active !== tagIds.length) badRequest("มี tag ที่ไม่พร้อมใช้งาน");
        }
        await tx.jobCollaborator.deleteMany({ where: { jobId: input.id } });
        await tx.jobTag.deleteMany({ where: { jobId: input.id } });
        return tx.job.update({
          where: { id: input.id },
          data: {
            ...data,
            collaborators: {
              create: [...new Set(input.data.collaboratorIds)].map((userId) => ({ userId })),
            },
            tags: {
              create: tagIds.map((tagId) => ({ tagId })),
            },
          },
        });
      }, TX_OPTIONS);
    }),

  setTags: protectedProcedure
    .input(z.object({ jobId: id, tagIds: z.array(id).default([]) }))
    .mutation(async ({ ctx, input }) => {
      await loadJob(ctx, input.jobId, "edit");
      const tagIds = [...new Set(input.tagIds)];
      return ctx.prisma.$transaction(async (tx) => {
        if (tagIds.length > 0) {
          const active = await tx.tag.count({
            where: { id: { in: tagIds }, active: true },
          });
          if (active !== tagIds.length) badRequest("มี tag ที่ไม่พร้อมใช้งาน");
        }
        await tx.jobTag.deleteMany({ where: { jobId: input.jobId } });
        if (tagIds.length > 0) {
          await tx.jobTag.createMany({
            data: tagIds.map((tagId) => ({ jobId: input.jobId, tagId })),
          });
        }
        return tx.job.findUniqueOrThrow({
          where: { id: input.jobId },
          include: {
            tags: {
              include: { tag: { select: { id: true, name: true, color: true } } },
            },
          },
        });
      }, TX_OPTIONS);
    }),

  requestClose: protectedProcedure
    .input(
      z.object({
        jobId: id,
        outcome: z.enum(CloseOutcome),
        depositPaymentId: id.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await loadJob(ctx, input.jobId, "edit");
      const approvedInbound = await ctx.prisma.paymentEntry.findMany({
        where: { jobId: input.jobId, status: "approved", kind: { in: INBOUND_KINDS } },
        select: { id: true, amountSatang: true },
      });
      const close = toCloseInput(
        input.outcome,
        approvedInbound,
        input.depositPaymentId ?? null,
      );
      if ("error" in close) badRequest(close.error);

      return ctx.prisma.$transaction(async (tx) => {
        const moved = await tx.job.updateMany({
          where: { id: input.jobId, status: "open" },
          data: { status: "awaiting_close_approval" },
        });
        if (moved.count !== 1) badRequest("งานนี้ไม่ได้อยู่ในสถานะเปิด");
        return tx.jobClose.create({
          data: {
            jobId: input.jobId,
            outcome: input.outcome,
            depositPaymentId: input.depositPaymentId ?? null,
            requestedById: ctx.user.id,
          },
        });
      }, TX_OPTIONS);
    }),

  pendingCloses: adminProcedure.query(({ ctx }) =>
    ctx.prisma.jobClose.findMany({
      where: { status: "pending" },
      include: {
        requestedBy: { select: { name: true } },
        depositPayment: { select: { amountSatang: true, kind: true } },
        job: {
          include: {
            ownerUser: { select: { name: true } },
            ownerGuest: { select: { name: true } },
            payments: { select: { kind: true, status: true, amountSatang: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  approveClose: adminProcedure
    .input(z.object({ closeId: id }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const close = await tx.jobClose.findUnique({
          where: { id: input.closeId },
          include: { job: { include: { payments: true } } },
        });
        if (!close) throw new TRPCError({ code: "NOT_FOUND" });
        if (close.status !== "pending") {
          throw new TRPCError({ code: "CONFLICT", message: "คำขอปิดงานนี้ถูกตัดสินแล้ว" });
        }
        const { job } = close;
        const inbound = job.payments.filter((p) => isInbound(p.kind));
        if (inbound.some((p) => p.status === "pending")) {
          badRequest("มีรายการรับเงินรออนุมัติ ให้อนุมัติหรือ reject ก่อนปิดงาน");
        }
        const closeInput = toCloseInput(
          close.outcome,
          inbound.filter((p) => p.status === "approved"),
          close.depositPaymentId,
        );
        if ("error" in closeInput) badRequest(closeInput.error);

        const { split, entitlements, movements } = settleClose(
          job.guestEngagement,
          job,
          closeInput,
        );

        const decided = await tx.jobClose.updateMany({
          where: { id: close.id, status: "pending" },
          data: {
            ...split,
            status: "approved",
            decidedById: ctx.user.id,
            decidedAt: new Date(),
          },
        });
        if (decided.count !== 1) throw new TRPCError({ code: "CONFLICT" });
        await tx.job.update({ where: { id: job.id }, data: { status: "closed" } });

        const beneficiary = { owner: job.ownerUserId, referral: job.referralUserId };
        if (entitlements.length > 0) {
          await tx.payoutEntitlement.createMany({
            data: entitlements.map((e) => {
              const userId = beneficiary[e.to];
              if (!userId) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: `job ${job.id} has no ${e.to} user`,
                });
              }
              return {
                jobId: job.id,
                jobCloseId: close.id,
                userId,
                role: e.role,
                amountSatang: e.amountSatang,
              };
            }),
            skipDuplicates: true,
          });
        }

        if (movements.length > 0) {
          await tx.paymentEntry.createMany({
            data: movements.map((m) => ({
              jobId: job.id,
              kind: m.kind,
              amountSatang: m.amountSatang,
              note: `สร้างอัตโนมัติตอนอนุมัติปิดงาน (${close.outcome})`,
              status: "pending" as const,
              createdById: ctx.user.id,
            })),
          });
        }

        return { split, entitlementCount: entitlements.length, movementCount: movements.length };
      }, TX_OPTIONS),
    ),

  rejectClose: adminProcedure
    .input(z.object({ closeId: id, reason }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const close = await tx.jobClose.findUnique({ where: { id: input.closeId } });
        if (!close) throw new TRPCError({ code: "NOT_FOUND" });
        const decided = await tx.jobClose.updateMany({
          where: { id: close.id, status: "pending" },
          data: {
            status: "rejected",
            rejectReason: input.reason,
            decidedById: ctx.user.id,
            decidedAt: new Date(),
          },
        });
        if (decided.count !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "คำขอปิดงานนี้ถูกตัดสินแล้ว" });
        }
        return tx.job.update({ where: { id: close.jobId }, data: { status: "open" } });
      }, TX_OPTIONS),
    ),
});
