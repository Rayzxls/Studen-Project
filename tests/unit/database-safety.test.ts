import { describe, expect, it } from "vitest";
import {
  assertBaselineRehearsalDatabase,
  assertIsolatedTestDatabase,
  databaseIdentity,
  prepareBaselineRehearsalEnv,
  prepareIsolatedDatabaseEnv,
} from "@/tests/helpers/database-safety";

const PRIMARY =
  "postgresql://beagle:secret@ep-primary-pooler.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";
const QA =
  "postgresql://beagle:secret@ep-qa-pooler.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";
const REHEARSAL =
  "postgresql://beagle:secret@ep-rehearsal.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";

describe("databaseIdentity", () => {
  it("treats pooled and direct Neon URLs for one branch as identical", () => {
    expect(databaseIdentity(PRIMARY)).toBe(
      databaseIdentity(PRIMARY.replace("-pooler", ""))
    );
  });
});

describe("prepareIsolatedDatabaseEnv", () => {
  it("switches the child process to a separate QA database", () => {
    const env = prepareIsolatedDatabaseEnv({
      DATABASE_URL: PRIMARY,
      QA_DATABASE_URL: QA,
    });

    expect(env.DATABASE_URL).toBe(QA);
    expect(env.BEAGLE_PRIMARY_DATABASE_URL).toBe(PRIMARY);
    expect(env.BEAGLE_MUTATING_TEST_DATABASE).toBe("1");
    expect(() => assertIsolatedTestDatabase(env)).not.toThrow();
  });

  it("blocks a missing QA database", () => {
    expect(() => prepareIsolatedDatabaseEnv({ DATABASE_URL: PRIMARY })).toThrow(
      "qa_database_url_required"
    );
  });

  it("blocks the primary database even when one URL uses a pooler", () => {
    expect(() =>
      prepareIsolatedDatabaseEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: PRIMARY.replace("-pooler", ""),
      })
    ).toThrow("qa_database_matches_primary");
  });
});

describe("assertIsolatedTestDatabase", () => {
  it("blocks direct test commands that bypass the runner", () => {
    expect(() =>
      assertIsolatedTestDatabase({
        DATABASE_URL: QA,
        QA_DATABASE_URL: QA,
        BEAGLE_PRIMARY_DATABASE_URL: PRIMARY,
      })
    ).toThrow("mutating_test_database_gate_not_enabled");
  });

  it("blocks an active database that is not QA", () => {
    expect(() =>
      assertIsolatedTestDatabase({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        BEAGLE_PRIMARY_DATABASE_URL: PRIMARY,
        BEAGLE_MUTATING_TEST_DATABASE: "1",
      })
    ).toThrow("active_database_is_not_qa_database");
  });
});

describe("prepareBaselineRehearsalEnv", () => {
  it("switches the child process to a distinct direct rehearsal database", () => {
    const env = prepareBaselineRehearsalEnv({
      DATABASE_URL: PRIMARY,
      QA_DATABASE_URL: QA,
      BASELINE_REHEARSAL_DATABASE_URL: REHEARSAL,
    });

    expect(env.DATABASE_URL).toBe(REHEARSAL);
    expect(env.BEAGLE_BASELINE_REHEARSAL_DATABASE).toBe("1");
    expect(() => assertBaselineRehearsalDatabase(env)).not.toThrow();
  });

  it("blocks Production and QA identities", () => {
    expect(() =>
      prepareBaselineRehearsalEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        BASELINE_REHEARSAL_DATABASE_URL: PRIMARY.replace("-pooler", ""),
      })
    ).toThrow("baseline_rehearsal_database_matches_primary");

    expect(() =>
      prepareBaselineRehearsalEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        BASELINE_REHEARSAL_DATABASE_URL: QA.replace("-pooler", ""),
      })
    ).toThrow("baseline_rehearsal_database_matches_qa");
  });

  it("blocks pooled Neon and non-public schema URLs", () => {
    expect(() =>
      prepareBaselineRehearsalEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        BASELINE_REHEARSAL_DATABASE_URL: REHEARSAL.replace(
          "ep-rehearsal.",
          "ep-rehearsal-pooler."
        ),
      })
    ).toThrow("baseline_rehearsal_database_must_use_direct_connection");

    expect(() =>
      prepareBaselineRehearsalEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        BASELINE_REHEARSAL_DATABASE_URL: `${REHEARSAL}&schema=shadow`,
      })
    ).toThrow("baseline_rehearsal_database_must_use_public_schema");
  });
});
