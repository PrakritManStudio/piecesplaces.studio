import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isInbound, PAYMENT_KINDS } from "@/domain/split";
import { PaymentKind } from "@/generated/prisma/enums";
import { badRequest, loadJob } from "@/trpc/job-access";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { evidenceUrl, id, optionalText, reason, satang } from "@/trpc/schemas";

export const paymentRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        jobId: id,
        kind: z.enum(PaymentKind),
        amountSatang: satang,
        receivedAt: z.coerce.date().optional(),
        note: optionalText,
        evidenceUrl,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await loadJob(ctx, input.jobId, "edit");
      if (!PAYMENT_KINDS[job.guestEngagement].includes(input.kind)) {
        badRequest("ชนิดรายการเงินนี้ใช้กับประเภทงานนี้ไม่ได้");
      }
      // Same-day Guest settlement / refund may be recorded after close; inbound cannot.
      if (isInbound(input.kind) && job.status === "closed") {
        badRequest("งานปิดแล้ว เพิ่มรายการรับเงินไม่ได้");
      }
      return ctx.prisma.paymentEntry.create({
        data: {
          jobId: input.jobId,
          kind: input.kind,
          amountSatang: input.amountSatang,
          receivedAt: input.receivedAt,
          note: input.note ?? null,
          evidenceUrl: input.evidenceUrl ?? null,
          createdById: ctx.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id,
        kind: z.enum(PaymentKind),
        amountSatang: satang,
        receivedAt: z.coerce.date(),
        note: optionalText,
        evidenceUrl,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.prisma.paymentEntry.findUnique({
        where: { id: input.id },
      });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
      if (payment.status !== "pending") {
        badRequest("แก้ได้เฉพาะรายการที่รออนุมัติ");
      }
      const job = await loadJob(ctx, payment.jobId, "edit");
      if (!PAYMENT_KINDS[job.guestEngagement].includes(input.kind)) {
        badRequest("ชนิดรายการเงินนี้ใช้กับประเภทงานนี้ไม่ได้");
      }
      if (isInbound(input.kind) && job.status === "closed") {
        badRequest("งานปิดแล้ว แก้รายการรับเงินไม่ได้");
      }
      const { count } = await ctx.prisma.paymentEntry.updateMany({
        where: { id: input.id, status: "pending" },
        data: {
          kind: input.kind,
          amountSatang: input.amountSatang,
          receivedAt: input.receivedAt,
          note: input.note ?? null,
          evidenceUrl: input.evidenceUrl ?? null,
        },
      });
      if (count !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ถูกตัดสินแล้ว" });
      }
      return ctx.prisma.paymentEntry.findUniqueOrThrow({ where: { id: input.id } });
    }),

  delete: protectedProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    const payment = await ctx.prisma.paymentEntry.findUnique({
      where: { id: input.id },
    });
    if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
    if (payment.status !== "pending") {
      badRequest("ลบได้เฉพาะรายการที่รออนุมัติ");
    }
    await loadJob(ctx, payment.jobId, "edit");
    const { count } = await ctx.prisma.paymentEntry.deleteMany({
      where: { id: input.id, status: "pending" },
    });
    if (count !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ถูกตัดสินแล้ว" });
    }
  }),

  listForJob: protectedProcedure
    .input(z.object({ jobId: id }))
    .query(async ({ ctx, input }) => {
      await loadJob(ctx, input.jobId, "view");
      return ctx.prisma.paymentEntry.findMany({
        where: { jobId: input.jobId },
        orderBy: { receivedAt: "asc" },
      });
    }),

  pending: adminProcedure.query(({ ctx }) =>
    ctx.prisma.paymentEntry.findMany({
      where: { status: "pending" },
      include: {
        createdBy: { select: { id: true, name: true } },
        job: {
          select: {
            id: true,
            title: true,
            guestEngagement: true,
            ownerUser: { select: { name: true } },
            ownerGuest: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  approve: adminProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.paymentEntry.updateMany({
      where: { id: input.id, status: "pending" },
      data: { status: "approved", reviewedById: ctx.user.id, reviewedAt: new Date() },
    });
    if (count !== 1) throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ถูกตัดสินแล้ว" });
  }),

  reject: adminProcedure
    .input(z.object({ id, reason }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.paymentEntry.updateMany({
        where: { id: input.id, status: "pending" },
        data: {
          status: "rejected",
          rejectReason: input.reason,
          reviewedById: ctx.user.id,
          reviewedAt: new Date(),
        },
      });
      if (count !== 1) throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ถูกตัดสินแล้ว" });
    }),
});
