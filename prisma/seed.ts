import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { auth } from "../src/lib/auth";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Temporary email/password admin for local/staff bootstrap. */
const TEMP_ADMIN = {
  email: "admin@admin.admin",
  password: "admin@admin.admin",
  name: "Admin",
} as const;

// Forfeit (50/50, no referral) is a fixed rule in src/domain/split.ts, not a template.
const templates: Prisma.SplitTemplateCreateInput[] = [
  { key: "tattoo_resident", label: "ช่างสักประจำ", serviceType: "tattoo", artistPct: 60 },
  {
    key: "tattoo_resident_referral",
    label: "ช่างสักประจำ + Referral",
    serviceType: "tattoo",
    artistPct: 60,
    referralPct: 5,
  },
  {
    key: "guest_sourced",
    label: "Guest หาลูกค้าเอง (A)",
    serviceType: "tattoo",
    guestEngagement: "guest_sourced",
    artistPct: 70,
  },
  {
    key: "shop_overflow",
    label: "Guest ร้านส่งงาน (B)",
    serviceType: "tattoo",
    guestEngagement: "shop_overflow",
    artistPct: 50,
  },
  { key: "nail", label: "ทำเล็บ", serviceType: "nail", artistPct: 70 },
  { key: "lash", label: "ต่อขนตา", serviceType: "lash", artistPct: 70 },
  { key: "class", label: "คลาส", serviceType: "class", artistPct: 60 },
  {
    key: "class_referral",
    label: "คลาส + Referral",
    serviceType: "class",
    artistPct: 60,
    referralPct: 10,
  },
];

const expenseCategories = ["แอลกอฮอล์", "ค่าเรียนช่าง", "ถุงมือ", "ทิชชู่", "ค่าน้ำไฟ/ค่าเช่า"];

async function main() {
  for (const t of templates) {
    await prisma.splitTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }
  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const existing = await prisma.user.findUnique({
    where: { email: TEMP_ADMIN.email },
  });
  if (!existing) {
    await auth.api.signUpEmail({
      body: {
        name: TEMP_ADMIN.name,
        email: TEMP_ADMIN.email,
        password: TEMP_ADMIN.password,
      },
    });
    console.log(`created temp admin ${TEMP_ADMIN.email}`);
  } else {
    console.log(`temp admin ${TEMP_ADMIN.email} already exists`);
  }

  await prisma.user.update({
    where: { email: TEMP_ADMIN.email },
    data: { role: "admin", emailVerified: true },
  });
  console.log(`ensured ${TEMP_ADMIN.email} is admin`);

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  if (seedAdminEmail && seedAdminEmail !== TEMP_ADMIN.email) {
    const { count } = await prisma.user.updateMany({
      where: { email: seedAdminEmail },
      data: { role: "admin" },
    });
    console.log(
      count
        ? `promoted ${seedAdminEmail} to admin`
        : `${seedAdminEmail} has not signed in yet; sign in, then re-run the seed`,
    );
  }

  console.log(
    `seeded ${templates.length} split templates, ${expenseCategories.length} expense categories`,
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
