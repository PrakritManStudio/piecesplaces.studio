import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { id, optionalText } from "@/trpc/schemas";

const guestInput = z.object({
  name: z.string().trim().min(1),
  phone: optionalText,
  note: optionalText,
  active: z.boolean().default(true),
});

export const guestProfileRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.guestProfile.findMany({
        where: input?.includeInactive ? {} : { active: true },
        orderBy: { name: "asc" },
      }),
    ),

  create: adminProcedure
    .input(guestInput)
    .mutation(({ ctx, input }) => ctx.prisma.guestProfile.create({ data: input })),

  update: adminProcedure
    .input(guestInput.extend({ id }))
    .mutation(({ ctx, input: { id, ...data } }) =>
      ctx.prisma.guestProfile.update({ where: { id }, data }),
    ),

  delete: adminProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    const used = await ctx.prisma.job.count({ where: { ownerGuestId: input.id } });
    if (used > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Guest นี้มีงานแล้ว ให้ปิดใช้งานแทน",
      });
    }
    return ctx.prisma.guestProfile.delete({ where: { id: input.id } });
  }),
});
