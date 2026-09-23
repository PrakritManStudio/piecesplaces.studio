-- AlterTable
ALTER TABLE "job" ADD COLUMN "jobNo" INTEGER;

-- Backfill existing rows in createdAt order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS n
  FROM "job"
)
UPDATE "job"
SET "jobNo" = ordered.n
FROM ordered
WHERE "job".id = ordered.id;

-- Empty table: leave nullable until we set NOT NULL; assign sequence default for safety
UPDATE "job" SET "jobNo" = 1 WHERE "jobNo" IS NULL;

CREATE SEQUENCE IF NOT EXISTS "job_job_no_seq";
SELECT setval(
  'job_job_no_seq',
  GREATEST(COALESCE((SELECT MAX("jobNo") FROM "job"), 0), 1)
);

ALTER TABLE "job" ALTER COLUMN "jobNo" SET NOT NULL;
CREATE UNIQUE INDEX "job_jobNo_key" ON "job"("jobNo");
