import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";

const googleConfigured =
  Boolean(env.GOOGLE_CLIENT_ID) && Boolean(env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    "http://localhost:3000",
    "https://tunnel-prakrit-3000.patavee.space",
  ],
  emailAndPassword: {
    // Temporary staff login until Google OAuth is fully wired.
    enabled: true,
  },
  socialProviders: {
    ...(googleConfigured
      ? {
          google: {
            prompt: "select_account" as const,
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  advanced: {
    database: {
      joins: true,
    },
  },
  plugins: [admin(), nextCookies()],
});
