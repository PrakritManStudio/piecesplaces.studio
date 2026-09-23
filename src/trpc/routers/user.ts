import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    image: ctx.user.image ?? null,
    isAdmin: ctx.isAdmin,
  })),

  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.user.findMany({
      where: { OR: [{ banned: false }, { banned: null }] },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    }),
  ),
});
