// @vitest-environment node
//
// jose signs over real Uint8Array buffers. Under the default jsdom environment
// the cross-realm `instanceof` check fails, so this suite pins Node.

import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { createGoogleIdTokenVerifier } from "@/lib/identity/google-id-token";

const CLIENT_ID = "beagle-client-id.apps.googleusercontent.com";
const NONCE = "nonce-from-the-authorization-request";

let signingKey: CryptoKey;
let localJwks: JWTVerifyGetKey;
let foreignKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.alg = "RS256";
  // A local key set stands in for Google's published certificates.
  const { createLocalJWKSet } = await import("jose");
  localJwks = createLocalJWKSet({ keys: [publicJwk] });

  const foreignPair = await generateKeyPair("RS256");
  foreignKey = foreignPair.privateKey;
});

async function signIdToken(
  claims: Record<string, unknown> = {},
  options: { key?: CryptoKey; expiresIn?: string } = {}
) {
  return new SignJWT({
    email: "student@example.com",
    email_verified: true,
    nonce: NONCE,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject((claims.sub as string) ?? "google-subject-1")
    .setIssuer((claims.iss as string) ?? "https://accounts.google.com")
    .setAudience((claims.aud as string) ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "5m")
    .sign(options.key ?? signingKey);
}

function createVerifier() {
  return createGoogleIdTokenVerifier({ clientId: CLIENT_ID, jwks: localJwks });
}

describe("Google ID token verifier", () => {
  it("refuses to build without a configured client id", () => {
    expect(() =>
      createGoogleIdTokenVerifier({ clientId: "  ", jwks: localJwks })
    ).toThrowError();
  });

  it("returns a verified assertion for a well-formed token", async () => {
    const idToken = await signIdToken();

    await expect(
      createVerifier().verify({ idToken, expectedNonce: NONCE })
    ).resolves.toEqual({
      providerAccountId: "google-subject-1",
      email: "student@example.com",
      emailVerified: true,
    });
  });

  it("accepts both Google issuer spellings", async () => {
    for (const iss of ["accounts.google.com", "https://accounts.google.com"]) {
      const idToken = await signIdToken({ iss });
      await expect(
        createVerifier().verify({ idToken, expectedNonce: NONCE })
      ).resolves.toMatchObject({ providerAccountId: "google-subject-1" });
    }
  });

  it("rejects a token signed by another key", async () => {
    const idToken = await signIdToken({}, { key: foreignKey });

    await expect(
      createVerifier().verify({ idToken, expectedNonce: NONCE })
    ).rejects.toMatchObject({ code: "google_id_token_invalid" });
  });

  it("rejects a foreign issuer or audience", async () => {
    const wrongIssuer = await signIdToken({ iss: "https://evil.example.com" });
    await expect(
      createVerifier().verify({ idToken: wrongIssuer, expectedNonce: NONCE })
    ).rejects.toMatchObject({ code: "google_id_token_invalid" });

    const wrongAudience = await signIdToken({ aud: "another-client-id" });
    await expect(
      createVerifier().verify({ idToken: wrongAudience, expectedNonce: NONCE })
    ).rejects.toMatchObject({ code: "google_id_token_invalid" });
  });

  it("rejects an expired token", async () => {
    const idToken = await signIdToken({}, { expiresIn: "-1s" });

    await expect(
      createVerifier().verify({ idToken, expectedNonce: NONCE })
    ).rejects.toMatchObject({ code: "google_id_token_invalid" });
  });

  it("binds the token to the request nonce", async () => {
    const replayed = await signIdToken({ nonce: "nonce-from-another-request" });
    await expect(
      createVerifier().verify({ idToken: replayed, expectedNonce: NONCE })
    ).rejects.toMatchObject({ code: "google_id_token_nonce_mismatch" });

    const missingNonce = await signIdToken({ nonce: undefined });
    await expect(
      createVerifier().verify({ idToken: missingNonce, expectedNonce: NONCE })
    ).rejects.toMatchObject({ code: "google_id_token_nonce_mismatch" });

    const valid = await signIdToken();
    await expect(
      createVerifier().verify({ idToken: valid, expectedNonce: "   " })
    ).rejects.toMatchObject({ code: "google_id_token_nonce_missing" });
  });

  it("rejects an unverified or missing email", async () => {
    for (const claims of [
      { email_verified: false },
      { email_verified: undefined },
      { email: undefined },
    ]) {
      const idToken = await signIdToken(claims);
      await expect(
        createVerifier().verify({ idToken, expectedNonce: NONCE })
      ).rejects.toMatchObject({ code: "google_email_not_verified" });
    }
  });

  it("accepts the string form of email_verified and normalizes the address", async () => {
    const idToken = await signIdToken({
      email_verified: "true",
      email: "  Student@Example.COM ",
    });

    await expect(
      createVerifier().verify({ idToken, expectedNonce: NONCE })
    ).resolves.toMatchObject({ email: "student@example.com" });
  });
});
