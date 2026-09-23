import "dotenv/config";

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "Missing R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY",
  );
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

await client.send(new HeadBucketCommand({ Bucket: bucket }));

console.log(`R2 HeadBucket OK: ${bucket}`);
