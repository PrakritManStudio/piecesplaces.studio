-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('tattoo', 'nail', 'lash', 'class', 'other');

-- CreateEnum
CREATE TYPE "GuestEngagement" AS ENUM ('none', 'guest_sourced', 'shop_overflow');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('open', 'awaiting_close_approval', 'closed');

-- CreateEnum
CREATE TYPE "CloseOutcome" AS ENUM ('completed', 'forfeit_deposit', 'refund_deposit');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('inbound_shop', 'inbound_held_by_guest', 'shop_cut_from_guest', 'payout_to_guest', 'refund_to_customer');

-- CreateEnum
CREATE TYPE "EntitlementRole" AS ENUM ('artist', 'referral', 'forfeit_share');

-- CreateEnum
CREATE TYPE "PayoutBatchKind" AS ENUM ('cycle', 'advance');

-- CreateEnum
CREATE TYPE "PayoutBatchStatus" AS ENUM ('pending', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "guestEngagement" "GuestEngagement" NOT NULL DEFAULT 'none',
    "artistPct" INTEGER NOT NULL,
    "referralPct" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "split_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "styleNote" TEXT,
    "customerName" TEXT,
    "estimatedTotalSatang" INTEGER,
    "guestEngagement" "GuestEngagement" NOT NULL DEFAULT 'none',
    "ownerUserId" TEXT,
    "ownerGuestId" TEXT,
    "referralUserId" TEXT,
    "splitTemplateId" TEXT,
    "artistPct" INTEGER NOT NULL,
    "referralPct" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'open',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_collaborator" (
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_collaborator_pkey" PRIMARY KEY ("jobId","userId")
);

-- CreateTable
CREATE TABLE "payment_entry" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "evidenceUrl" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_close" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "outcome" "CloseOutcome" NOT NULL,
    "depositPaymentId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "baseSatang" INTEGER,
    "ownerSatang" INTEGER,
    "referralSatang" INTEGER,
    "shopSatang" INTEGER,
    "refundSatang" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_entitlement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobCloseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EntitlementRole" NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "payoutBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_batch" (
    "id" TEXT NOT NULL,
    "kind" "PayoutBatchKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleDate" TIMESTAMP(3),
    "status" "PayoutBatchStatus" NOT NULL DEFAULT 'pending',
    "totalSatang" INTEGER NOT NULL,
    "evidenceUrl" TEXT,
    "note" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "evidenceUrl" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "split_template_key_key" ON "split_template"("key");

-- CreateIndex
CREATE INDEX "split_template_serviceType_guestEngagement_idx" ON "split_template"("serviceType", "guestEngagement");

-- CreateIndex
CREATE INDEX "job_status_idx" ON "job"("status");

-- CreateIndex
CREATE INDEX "job_ownerUserId_idx" ON "job"("ownerUserId");

-- CreateIndex
CREATE INDEX "job_ownerGuestId_idx" ON "job"("ownerGuestId");

-- CreateIndex
CREATE INDEX "job_referralUserId_idx" ON "job"("referralUserId");

-- CreateIndex
CREATE INDEX "job_scheduledAt_idx" ON "job"("scheduledAt");

-- CreateIndex
CREATE INDEX "job_collaborator_userId_idx" ON "job_collaborator"("userId");

-- CreateIndex
CREATE INDEX "payment_entry_jobId_status_idx" ON "payment_entry"("jobId", "status");

-- CreateIndex
CREATE INDEX "payment_entry_status_receivedAt_idx" ON "payment_entry"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "job_close_jobId_idx" ON "job_close"("jobId");

-- CreateIndex
CREATE INDEX "job_close_status_decidedAt_idx" ON "job_close"("status", "decidedAt");

-- CreateIndex
CREATE INDEX "payout_entitlement_userId_payoutBatchId_idx" ON "payout_entitlement"("userId", "payoutBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_entitlement_jobId_userId_role_key" ON "payout_entitlement"("jobId", "userId", "role");

-- CreateIndex
CREATE INDEX "payout_batch_userId_status_idx" ON "payout_batch"("userId", "status");

-- CreateIndex
CREATE INDEX "payout_batch_status_paidAt_idx" ON "payout_batch"("status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "expense_category_name_key" ON "expense_category"("name");

-- CreateIndex
CREATE INDEX "expense_status_spentAt_idx" ON "expense"("status", "spentAt");

-- CreateIndex
CREATE INDEX "expense_categoryId_idx" ON "expense"("categoryId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_ownerGuestId_fkey" FOREIGN KEY ("ownerGuestId") REFERENCES "guest_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_referralUserId_fkey" FOREIGN KEY ("referralUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_splitTemplateId_fkey" FOREIGN KEY ("splitTemplateId") REFERENCES "split_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_collaborator" ADD CONSTRAINT "job_collaborator_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_collaborator" ADD CONSTRAINT "job_collaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_entry" ADD CONSTRAINT "payment_entry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_entry" ADD CONSTRAINT "payment_entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_entry" ADD CONSTRAINT "payment_entry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_close" ADD CONSTRAINT "job_close_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_close" ADD CONSTRAINT "job_close_depositPaymentId_fkey" FOREIGN KEY ("depositPaymentId") REFERENCES "payment_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_close" ADD CONSTRAINT "job_close_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_close" ADD CONSTRAINT "job_close_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_entitlement" ADD CONSTRAINT "payout_entitlement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_entitlement" ADD CONSTRAINT "payout_entitlement_jobCloseId_fkey" FOREIGN KEY ("jobCloseId") REFERENCES "job_close"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_entitlement" ADD CONSTRAINT "payout_entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_entitlement" ADD CONSTRAINT "payout_entitlement_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "payout_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch" ADD CONSTRAINT "payout_batch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch" ADD CONSTRAINT "payout_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch" ADD CONSTRAINT "payout_batch_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants Prisma schema cannot express
ALTER TABLE "split_template" ADD CONSTRAINT "split_template_rates_check"
  CHECK ("artistPct" >= 0 AND "referralPct" >= 0 AND "artistPct" + "referralPct" <= 100
    AND ("guestEngagement" = 'none' OR "referralPct" = 0));

ALTER TABLE "job" ADD CONSTRAINT "job_rates_check"
  CHECK ("artistPct" >= 0 AND "referralPct" >= 0 AND "artistPct" + "referralPct" <= 100);

ALTER TABLE "job" ADD CONSTRAINT "job_owner_check"
  CHECK (
    ("guestEngagement" = 'none' AND "ownerUserId" IS NOT NULL AND "ownerGuestId" IS NULL)
    OR ("guestEngagement" <> 'none' AND "ownerGuestId" IS NOT NULL AND "ownerUserId" IS NULL
        AND "referralUserId" IS NULL AND "referralPct" = 0)
  );

ALTER TABLE "job" ADD CONSTRAINT "job_referral_check"
  CHECK (("referralUserId" IS NULL) = ("referralPct" = 0));

ALTER TABLE "payment_entry" ADD CONSTRAINT "payment_entry_amount_check" CHECK ("amountSatang" > 0);

ALTER TABLE "job_close" ADD CONSTRAINT "job_close_snapshot_check"
  CHECK ("status" <> 'approved' OR ("baseSatang" IS NOT NULL AND "ownerSatang" IS NOT NULL
    AND "referralSatang" IS NOT NULL AND "shopSatang" IS NOT NULL AND "refundSatang" IS NOT NULL));

ALTER TABLE "job_close" ADD CONSTRAINT "job_close_deposit_check"
  CHECK (("outcome" = 'completed') = ("depositPaymentId" IS NULL));

ALTER TABLE "payout_entitlement" ADD CONSTRAINT "payout_entitlement_amount_check" CHECK ("amountSatang" > 0);

ALTER TABLE "expense" ADD CONSTRAINT "expense_amount_check" CHECK ("amountSatang" > 0);
