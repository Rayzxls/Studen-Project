/**
 * Cloudflare R2 client setup — Phase 6 · ADR-0021 § 1
 *
 * R2 is S3-compatible — we use `@aws-sdk/client-s3` with the R2 endpoint
 * URL and `region = "auto"`. Credentials come from env at first use;
 * importing this module does not require R2 to be configured (lets local
 * dev / unit tests run without R2 creds).
 *
 * Bucket layout (ADR-0021 § 1):
 *   staging/<uploaderId>/<uuid>                  — 24h Cloudflare lifecycle TTL
 *   permanent/<ownerType>/<ownerId>/<uuid>.<ext> — long-lived
 */

import { S3Client } from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;
let cachedBucket: string | null = null;

interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

function readR2Env(): R2Env {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "r2_env_missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

/**
 * Return the (lazily-created) shared R2 client.
 * Re-reads env on first miss so test setups that mutate env between
 * suites can override credentials.
 */
export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const env = readR2Env();
  cachedBucket = env.bucketName;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
  return cachedClient;
}

/** Returns the bucket name from env. Memoised alongside the client. */
export function getR2Bucket(): string {
  if (!cachedBucket) {
    // Side-effect of getR2Client is caching the bucket name.
    getR2Client();
  }
  return cachedBucket!;
}

/**
 * Test-only — reset the cached client + bucket so a subsequent
 * `getR2Client()` re-reads env. Not exported to production code paths.
 */
export function __resetR2ClientForTesting(): void {
  cachedClient = null;
  cachedBucket = null;
}
