import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const appRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string().optional() }))
    .query(({ input }) => {
      return {
        greeting: `hello ${input.text ?? "world"}`,
      };
    }),
});

export type AppRouter = typeof appRouter;
