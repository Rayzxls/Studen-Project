import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { Forbidden, NotFound } from "@/lib/errors";
import { normalizeVerifiedEmail } from "./foundation";

/**
 * Google publishes tokens under both spellings, and both are legitimate.
 */
export const GOOGLE_ISSUERS = [
  "accounts.google.com",
  "https://accounts.google.com",
] as const;

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

/**
 * A Google assertion that has been cryptographically verified. Every identity
 * service in this module takes this shape and trusts it, so nothing may build
 * one without passing through a verifier.
 */
export type VerifiedGoogleAssertion = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
};

export type GoogleIdTokenVerifierOptions = {
  clientId: string;
  /** Injectable so tests can verify against a local key pair. */
  jwks?: JWTVerifyGetKey;
  issuers?: ReadonlyArray<string>;
  clockToleranceSeconds?: number;
};

type GoogleIdTokenClaims = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  nonce?: unknown;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Google sends `email_verified` as a boolean, but some OpenID providers and
 * older Google responses send the string "true". Anything else is untrusted.
 */
function readEmailVerified(value: unknown): boolean {
  return value === true || value === "true";
}

export function createGoogleIdTokenVerifier(
  options: GoogleIdTokenVerifierOptions
) {
  if (!options.clientId.trim()) {
    throw new NotFound("google_oauth_not_configured");
  }

  const jwks = options.jwks ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const issuers = options.issuers ?? GOOGLE_ISSUERS;

  return {
    /**
     * Verifies signature, issuer, audience, and expiry through `jose`, then
     * checks the claims this product depends on. The nonce is required rather
     * than optional: without binding the token to the request that started the
     * flow, a token captured elsewhere could be replayed here.
     */
    async verify(input: {
      idToken: string;
      expectedNonce: string;
    }): Promise<VerifiedGoogleAssertion> {
      const expectedNonce = input.expectedNonce.trim();
      if (!expectedNonce) {
        throw new Forbidden("google_id_token_nonce_missing");
      }

      let claims: GoogleIdTokenClaims;
      try {
        const verified = await jwtVerify(input.idToken, jwks, {
          issuer: [...issuers],
          audience: options.clientId,
          clockTolerance: options.clockToleranceSeconds ?? 0,
        });
        claims = verified.payload as GoogleIdTokenClaims;
      } catch {
        // The underlying reason is deliberately not surfaced: it would tell an
        // attacker which part of the token to change next.
        throw new Forbidden("google_id_token_invalid");
      }

      const nonce = readString(claims.nonce);
      if (!nonce || nonce !== expectedNonce) {
        throw new Forbidden("google_id_token_nonce_mismatch");
      }

      const providerAccountId = readString(claims.sub);
      if (!providerAccountId) {
        throw new Forbidden("google_id_token_invalid");
      }

      const rawEmail = readString(claims.email);
      if (!rawEmail) {
        throw new Forbidden("google_email_not_verified");
      }

      // An unverified address proves nothing about ownership, so it never
      // reaches an onboarding or linking service.
      if (!readEmailVerified(claims.email_verified)) {
        throw new Forbidden("google_email_not_verified");
      }

      return {
        providerAccountId,
        email: normalizeVerifiedEmail(rawEmail),
        emailVerified: true,
      };
    },
  };
}

export function createConfiguredGoogleIdTokenVerifier(
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  return createGoogleIdTokenVerifier({
    clientId: env.GOOGLE_CLIENT_ID?.trim() ?? "",
  });
}
