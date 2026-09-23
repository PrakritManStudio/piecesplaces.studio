import { createTRPCRouter } from "@/trpc/init";
import { dashboardRouter } from "@/trpc/routers/dashboard";
import { expenseRouter } from "@/trpc/routers/expense";
import { guestProfileRouter } from "@/trpc/routers/guest-profile";
import { jobRouter } from "@/trpc/routers/job";
import { paymentRouter } from "@/trpc/routers/payment";
import { payoutRouter } from "@/trpc/routers/payout";
import { splitTemplateRouter } from "@/trpc/routers/split-template";
import { tagRouter } from "@/trpc/routers/tag";
import { userRouter } from "@/trpc/routers/user";

export const appRouter = createTRPCRouter({
  user: userRouter,
  splitTemplate: splitTemplateRouter,
  guestProfile: guestProfileRouter,
  job: jobRouter,
  payment: paymentRouter,
  payout: payoutRouter,
  expense: expenseRouter,
  dashboard: dashboardRouter,
  tag: tagRouter,
});

export type AppRouter = typeof appRouter;
