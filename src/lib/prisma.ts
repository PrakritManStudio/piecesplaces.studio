import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import { Prisma, PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaModelFingerprint: string | undefined;
};

/** Changes when models are added/removed — forces a fresh client after `prisma generate`. */
const modelFingerprint = Object.values(Prisma.ModelName).sort().join(",");

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

if (
  env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  globalForPrisma.prismaModelFingerprint !== modelFingerprint
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaModelFingerprint = modelFingerprint;
}
