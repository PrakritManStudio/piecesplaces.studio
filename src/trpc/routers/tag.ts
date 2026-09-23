import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { id } from "@/trpc/schemas";

const tagFields = z.object({
  name: z.string().trim().min(1, "ใส่ชื่อ tag"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "สีต้องเป็น #RRGGBB")
    .nullish(),
  active: z.boolean().default(true),
});

export const tagRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.tag.findMany({
        where: input?.includeInactive ? {} : { active: true },
        orderBy: { name: "asc" },
      }),
    ),

  create: adminProcedure.input(tagFields).mutation(({ ctx, input }) =>
    ctx.prisma.tag.create({
      data: {
        name: input.name,
        color: input.color ?? null,
        active: input.active,
      },
    }),
  ),

  update: adminProcedure
    .input(tagFields.extend({ id }))
    .mutation(({ ctx, input: { id: tagId, ...data } }) =>
      ctx.prisma.tag.update({
        where: { id: tagId },
        data: {
          name: data.name,
          color: data.color ?? null,
          active: data.active,
        },
      }),
    ),

  deactivate: adminProcedure.input(z.object({ id })).mutation(({ ctx, input }) =>
    ctx.prisma.tag.update({
      where: { id: input.id },
      data: { active: false },
    }),
  ),

  delete: adminProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    const used = await ctx.prisma.jobTag.count({ where: { tagId: input.id } });
    if (used > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "tag นี้ถูกใช้กับงานแล้ว ให้ปิดใช้งานแทน",
      });
    }
    return ctx.prisma.tag.delete({ where: { id: input.id } });
  }),
});
