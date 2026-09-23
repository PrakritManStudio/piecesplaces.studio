import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { env } from "@/env";

const globalForR2 = globalThis as unknown as {
  r2Client: S3Client | undefined;
};

function requireR2Config() {
  const accountId = env.R2_ACCOUNT_ID;
  const bucket = env.R2_BUCKET_NAME;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

export function r2BucketName() {
  return requireR2Config().bucket;
}

export function getR2Client(): S3Client {
  if (!globalForR2.r2Client) {
    const { accountId, accessKeyId, secretAccessKey } = requireR2Config();
    globalForR2.r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return globalForR2.r2Client;
}
