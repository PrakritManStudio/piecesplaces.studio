import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ratesError } from "@/domain/split";
import { GuestEngagement, ServiceType } from "@/generated/prisma/enums";
import { badRequest } from "@/trpc/job-access";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { id, pct } from "@/trpc/schemas";

const templateFields = z.object({
  label: z.string().trim().min(1, "ใส่ชื่อหมวด"),
  serviceType: z.enum(ServiceType),
  guestEngagement: z.enum(GuestEngagement),
  artistPct: pct,
  referralPct: pct,
  active: z.boolean().default(true),
});

const templateCreateInput = templateFields.extend({
  key: z.string().trim().min(1).optional(),
});

const templateUpdateInput = templateFields.extend({ id });

type TemplateRates = z.infer<typeof templateFields>;

function assertRates(input: TemplateRates) {
  const error = ratesError(input.guestEngagement, input, input.referralPct > 0);
  if (error) badRequest(error);
}

function slugKey(label: string, serviceType: string, engagement: string) {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\u0e00-\u0e7f]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "template";
  return `${serviceType}_${engagement}_${base}_${Date.now().toString(36)}`;
}

export const splitTemplateRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.splitTemplate.findMany({
        where: input?.includeInactive ? {} : { active: true },
        orderBy: [{ serviceType: "asc" }, { label: "asc" }],
      }),
    ),

  create: protectedProcedure.input(templateCreateInput).mutation(({ ctx, input }) => {
    assertRates(input);
    const { key: maybeKey, ...data } = input;
    return ctx.prisma.splitTemplate.create({
      data: {
        ...data,
        key: maybeKey?.trim() || slugKey(data.label, data.serviceType, data.guestEngagement),
      },
    });
  }),

  update: protectedProcedure.input(templateUpdateInput).mutation(({ ctx, input: { id, ...data } }) => {
    assertRates(data);
    return ctx.prisma.splitTemplate.update({ where: { id }, data });
  }),

  deactivate: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) =>
    ctx.prisma.splitTemplate.update({
      where: { id: input.id },
      data: { active: false },
    }),
  ),

  delete: protectedProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    const used = await ctx.prisma.job.count({ where: { splitTemplateId: input.id } });
    if (used > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "หมวดนี้ถูกใช้กับงานแล้ว ให้ปิดใช้งานแทน",
      });
    }
    return ctx.prisma.splitTemplate.delete({ where: { id: input.id } });
  }),
});
