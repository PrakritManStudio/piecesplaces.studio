import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ReviewStatus } from "@/generated/prisma/enums";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { evidenceUrl, id, optionalText, reason, satang } from "@/trpc/schemas";

const categoryInput = z.object({
  name: z.string().trim().min(1),
  active: z.boolean().default(true),
});

export const expenseRouter = createTRPCRouter({
  categories: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.expenseCategory.findMany({
        where: input?.includeInactive ? {} : { active: true },
        orderBy: { name: "asc" },
      }),
    ),

  createCategory: adminProcedure
    .input(categoryInput)
    .mutation(({ ctx, input }) => ctx.prisma.expenseCategory.create({ data: input })),

  updateCategory: adminProcedure
    .input(categoryInput.extend({ id }))
    .mutation(({ ctx, input: { id, ...data } }) =>
      ctx.prisma.expenseCategory.update({ where: { id }, data }),
    ),

  create: protectedProcedure
    .input(
      z.object({
        categoryId: id,
        amountSatang: satang,
        spentAt: z.coerce.date(),
        note: optionalText,
        evidenceUrl,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.expense.create({
        data: {
          categoryId: input.categoryId,
          amountSatang: input.amountSatang,
          spentAt: input.spentAt,
          note: input.note ?? null,
          evidenceUrl: input.evidenceUrl ?? null,
          createdById: ctx.user.id,
        },
      }),
    ),

  list: protectedProcedure
    .input(
      z
        .object({
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          categoryId: id.optional(),
          status: z.enum(ReviewStatus).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.prisma.expense.findMany({
        where: {
          createdById: ctx.isAdmin ? undefined : ctx.user.id,
          categoryId: input?.categoryId,
          status: input?.status,
          spentAt: { gte: input?.from, lt: input?.to },
        },
        include: {
          category: { select: { name: true } },
          createdBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
        orderBy: { spentAt: "desc" },
        take: 500,
      }),
    ),

  pending: adminProcedure.query(({ ctx }) =>
    ctx.prisma.expense.findMany({
      where: { status: "pending" },
      include: {
        category: { select: { name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  approve: adminProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.expense.updateMany({
      where: { id: input.id, status: "pending" },
      data: { status: "approved", reviewedById: ctx.user.id, reviewedAt: new Date() },
    });
    if (count !== 1) throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ถูกตัดสินแล้ว" });
  }),

  reject: adminProcedure
    .input(z.object({ id, reason }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.expense.updateMany({
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
