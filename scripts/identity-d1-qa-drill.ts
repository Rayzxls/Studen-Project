import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient, type ThemeMode } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  assertIsolatedTestDatabase,
  prepareIsolatedDatabaseEnv,
} from "../tests/helpers/database-safety";
import { getR2Bucket, getR2Client } from "../lib/storage/r2-client";

type DrillMode = "export" | "reset" | "verify";

type PreservedConsent = {
  document: "TERMS_OF_USE" | "PRIVACY_NOTICE";
  version: string;
  acceptedAt: string;
};

type PreservedAvatar = {
  id: string;
  r2Key: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
} | null;

type PreserveBundle = {
  version: 1;
  sourceUserId: string;
  role: "ADMIN";
  email: string;
  emailVerifiedAt: string;
  firstName: string;
  lastName: string;
  accountStatus: "ACTIVE";
  isActive: true;
  themeMode: ThemeMode;
  consentedAt: string | null;
  consentVersion: string | null;
  consentAcceptances: PreservedConsent[];
  avatar: PreservedAvatar;
};

const mode = process.argv[2] as DrillMode | undefined;
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="));
const bundleDir = path.join(process.cwd(), ".local-storage", "identity-d1");
const bundlePath = path.join(bundleDir, "qa-admin-preserve.json");
const checksumPath = `${bundlePath}.sha256`;

if (mode !== "export" && mode !== "reset" && mode !== "verify") {
  throw new Error("usage: identity-d1-qa-drill <export|reset|verify>");
}

Object.assign(process.env, prepareIsolatedDatabaseEnv(process.env));
assertIsolatedTestDatabase();

const db = new PrismaClient();

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key.toLowerCase()}_required`);
  return value;
}

function normalizedEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("identity_preserve_email_invalid");
  }
  return email;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function writeBundle(bundle: PreserveBundle): void {
  mkdirSync(bundleDir, { recursive: true });
  const content = `${JSON.stringify(bundle, null, 2)}\n`;
  writeFileSync(bundlePath, content, { encoding: "utf8", mode: 0o600 });
  writeFileSync(checksumPath, `${sha256(content)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function readBundle(): PreserveBundle {
  if (!existsSync(bundlePath) || !existsSync(checksumPath)) {
    throw new Error("identity_preserve_bundle_missing");
  }
  const content = readFileSync(bundlePath, "utf8");
  const expected = readFileSync(checksumPath, "utf8").trim();
  if (sha256(content) !== expected) {
    throw new Error("identity_preserve_bundle_checksum_mismatch");
  }
  const bundle = JSON.parse(content) as PreserveBundle;
  if (
    bundle.version !== 1 ||
    bundle.role !== "ADMIN" ||
    bundle.accountStatus !== "ACTIVE" ||
    bundle.isActive !== true ||
    !bundle.sourceUserId ||
    !bundle.firstName ||
    !bundle.lastName
  ) {
    throw new Error("identity_preserve_bundle_invalid");
  }
  return bundle;
}

async function avatarExists(r2Key: string): Promise<boolean> {
  try {
    await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: r2Key })
    );
    return true;
  } catch {
    return false;
  }
}

async function exportPreservedAdmin(): Promise<void> {
  const legacyIdentifier =
    process.env.IDENTITY_PRESERVE_LEGACY_IDENTIFIER?.trim() ?? "Razyxls";
  const email = normalizedEmail(required("IDENTITY_PRESERVE_EMAIL"));
  if (process.env.IDENTITY_PRESERVE_EMAIL_VERIFIED !== "1") {
    throw new Error(
      "identity_preserve_email_verification_attestation_required"
    );
  }

  const candidates = await db.user.findMany({
    where: {
      identifier: { equals: legacyIdentifier, mode: "insensitive" },
      role: "ADMIN",
      isActive: true,
      accountStatus: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      themeMode: true,
      consentedAt: true,
      consentVersion: true,
      admin: { select: { firstName: true, lastName: true } },
      consentAcceptances: {
        select: { document: true, version: true, acceptedAt: true },
      },
      profileImageId: true,
    },
  });
  if (candidates.length !== 1) {
    throw new Error("identity_preserve_admin_must_match_exactly_once");
  }

  const source = candidates[0]!;
  const firstName = source.firstName?.trim() || source.admin?.firstName.trim();
  const lastName = source.lastName?.trim() || source.admin?.lastName.trim();
  if (!firstName || !lastName) {
    throw new Error("identity_preserve_real_name_required");
  }

  const emailOwnerCount = await db.user.count({
    where: {
      OR: [
        { identifier: { equals: email, mode: "insensitive" } },
        { email: { equals: email, mode: "insensitive" } },
      ],
      NOT: { id: source.id },
    },
  });
  if (emailOwnerCount > 0) {
    throw new Error("identity_preserve_email_already_owned");
  }

  let avatar: PreservedAvatar = null;
  if (source.profileImageId) {
    const attachment = await db.fileAttachment.findFirst({
      where: {
        id: source.profileImageId,
        ownerType: "PROFILE_IMAGE",
        ownerId: source.id,
        deletedAt: null,
      },
      select: {
        id: true,
        r2Key: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
      },
    });
    if (attachment && (await avatarExists(attachment.r2Key))) {
      avatar = {
        ...attachment,
        uploadedAt: attachment.uploadedAt.toISOString(),
      };
    }
  }

  writeBundle({
    version: 1,
    sourceUserId: source.id,
    role: "ADMIN",
    email,
    emailVerifiedAt: new Date().toISOString(),
    firstName,
    lastName,
    accountStatus: "ACTIVE",
    isActive: true,
    themeMode: source.themeMode,
    consentedAt: source.consentedAt?.toISOString() ?? null,
    consentVersion: source.consentVersion,
    consentAcceptances: source.consentAcceptances.map((consent) => ({
      ...consent,
      acceptedAt: consent.acceptedAt.toISOString(),
    })),
    avatar,
  });

  console.log("QA preserve export complete.");
  console.log(`Bundle: ${path.relative(process.cwd(), bundlePath)}`);
  console.log(`Avatar preserved: ${avatar ? "yes" : "no"}`);
  console.log(`Consent records preserved: ${source.consentAcceptances.length}`);
}

async function resetQaAndImportAdmin(): Promise<void> {
  if (confirmation !== "--confirm=D1_QA_RESET") {
    throw new Error("qa_reset_confirmation_required");
  }

  const bundle = readBundle();
  const password = required("IDENTITY_PRESERVE_QA_PASSWORD");
  if (password.length < 12) {
    throw new Error("identity_preserve_qa_password_too_short");
  }

  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  const tables = rows.map(
    ({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`
  );
  if (tables.length === 0) {
    throw new Error("qa_reset_no_application_tables_found");
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`
    );

    await tx.user.create({
      data: {
        id: bundle.sourceUserId,
        role: "ADMIN",
        identifier: bundle.email,
        email: bundle.email,
        emailVerifiedAt: new Date(bundle.emailVerifiedAt),
        passwordHash: await bcrypt.hash(password, 12),
        firstName: bundle.firstName,
        lastName: bundle.lastName,
        accountStatus: "ACTIVE",
        isActive: true,
        themeMode: bundle.themeMode,
        consentedAt: bundle.consentedAt ? new Date(bundle.consentedAt) : null,
        consentVersion: bundle.consentVersion,
        admin: {
          create: {
            firstName: bundle.firstName,
            lastName: bundle.lastName,
          },
        },
        consentAcceptances: {
          create: bundle.consentAcceptances.map((consent) => ({
            document: consent.document,
            version: consent.version,
            acceptedAt: new Date(consent.acceptedAt),
          })),
        },
      },
    });

    if (bundle.avatar) {
      await tx.fileAttachment.create({
        data: {
          id: bundle.avatar.id,
          r2Key: bundle.avatar.r2Key,
          originalFilename: bundle.avatar.originalFilename,
          mimeType: bundle.avatar.mimeType,
          sizeBytes: bundle.avatar.sizeBytes,
          ownerType: "PROFILE_IMAGE",
          ownerId: bundle.sourceUserId,
          uploadedById: bundle.sourceUserId,
          uploadedAt: new Date(bundle.avatar.uploadedAt),
        },
      });
      await tx.user.update({
        where: { id: bundle.sourceUserId },
        data: { profileImageId: bundle.avatar.id },
      });
    }
  });

  console.log(`QA reset complete: ${tables.length} application tables wiped.`);
  console.log("Exactly one preserved active Admin was imported.");
  console.log("Production was not connected or modified.");
}

async function verifyDrill(): Promise<void> {
  const bundle = readBundle();
  const [users, admins, preserved, schemaColumns] = await Promise.all([
    db.user.count(),
    db.admin.count(),
    db.user.count({
      where: {
        id: bundle.sourceUserId,
        role: "ADMIN",
        identifier: bundle.email,
        email: bundle.email,
        emailVerifiedAt: { not: null },
        accountStatus: "ACTIVE",
        isActive: true,
      },
    }),
    db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'User' AND column_name = 'mustResetPwd') -- dependency-gate-allow(temporary-password): post-migration schema absence assertion only
          OR (table_name = 'User' AND column_name = 'displayName') -- dependency-gate-allow(legacy-display-name): post-migration schema absence assertion only
          OR (table_name = 'Student' AND column_name = 'studentId') -- dependency-gate-allow(student-id-symbol-review): post-migration schema absence assertion only
        )
    `,
  ]);

  if (users !== 1 || admins !== 1 || preserved !== 1) {
    throw new Error("identity_d1_qa_preserved_admin_verification_failed");
  }
  if (schemaColumns.length > 0) {
    throw new Error("identity_d1_qa_legacy_columns_still_present");
  }

  console.log("D1 QA verification passed.");
  console.log("Users: 1; Admins: 1; legacy identity columns: 0.");
  console.log("Production was not connected or modified.");
}

async function main(): Promise<void> {
  if (mode === "export") await exportPreservedAdmin();
  if (mode === "reset") await resetQaAndImportAdmin();
  if (mode === "verify") await verifyDrill();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
