import { describe, expect, it } from "vitest";
import {
  assertBaselineRehearsalDatabase,
  assertIsolatedTestDatabase,
  assertProductionBaselineAdoptionDatabase,
  assertQaBaselineAdoptionDatabase,
  databaseIdentity,
  prepareBaselineRehearsalEnv,
  prepareIsolatedDatabaseEnv,
  prepareProductionBaselineAdoptionEnv,
  prepareQaBaselineAdoptionEnv,
} from "@/tests/helpers/database-safety";

const PRIMARY =
  "postgresql://beagle:secret@ep-primary-pooler.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";
const QA =
  "postgresql://beagle:secret@ep-qa-pooler.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";
const REHEARSAL =
  "postgresql://beagle:secret@ep-rehearsal.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";
const QA_BACKUP =
  "postgresql://beagle:secret@ep-qa-backup.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";
const PRODUCTION_BACKUP =
  "postgresql://beagle:secret@ep-production-backup.ap-southeast-1.aws.neon.tech/beagle?sslmode=require";

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

describe("prepareQaBaselineAdoptionEnv", () => {
  it("targets QA only when its direct backup is a third identity", () => {
    const env = prepareQaBaselineAdoptionEnv({
      DATABASE_URL: PRIMARY,
      QA_DATABASE_URL: QA,
      QA_BASELINE_BACKUP_DATABASE_URL: QA_BACKUP,
    });

    expect(env.DATABASE_URL).toBe(QA);
    expect(env.BEAGLE_QA_BASELINE_ADOPTION).toBe("1");
    expect(() => assertQaBaselineAdoptionDatabase(env)).not.toThrow();
  });

  it("blocks Production or QA from masquerading as the backup", () => {
    expect(() =>
      prepareQaBaselineAdoptionEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        QA_BASELINE_BACKUP_DATABASE_URL: PRIMARY.replace("-pooler", ""),
      })
    ).toThrow("qa_baseline_backup_matches_primary");

    expect(() =>
      prepareQaBaselineAdoptionEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        QA_BASELINE_BACKUP_DATABASE_URL: QA.replace("-pooler", ""),
      })
    ).toThrow("qa_baseline_backup_matches_qa");
  });

  it("blocks a pooled Neon backup URL", () => {
    expect(() =>
      prepareQaBaselineAdoptionEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        QA_BASELINE_BACKUP_DATABASE_URL: QA_BACKUP.replace(
          "ep-qa-backup.",
          "ep-qa-backup-pooler."
        ),
      })
    ).toThrow("qa_baseline_backup_must_use_direct_connection");
  });
});

describe("prepareProductionBaselineAdoptionEnv", () => {
  it("targets Production only when its direct backup is a third identity", () => {
    const env = prepareProductionBaselineAdoptionEnv({
      DATABASE_URL: PRIMARY,
      QA_DATABASE_URL: QA,
      QA_BASELINE_BACKUP_DATABASE_URL: QA_BACKUP,
      PRODUCTION_BASELINE_BACKUP_DATABASE_URL: PRODUCTION_BACKUP,
    });

    expect(env.DATABASE_URL).toBe(PRIMARY);
    expect(env.BEAGLE_PRODUCTION_BASELINE_ADOPTION).toBe("1");
    expect(() => assertProductionBaselineAdoptionDatabase(env)).not.toThrow();
  });

  it("blocks Production or QA from masquerading as the backup", () => {
    expect(() =>
      prepareProductionBaselineAdoptionEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        PRODUCTION_BASELINE_BACKUP_DATABASE_URL: PRIMARY.replace("-pooler", ""),
      })
    ).toThrow("production_baseline_backup_matches_production");

    expect(() =>
      prepareProductionBaselineAdoptionEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        QA_BASELINE_BACKUP_DATABASE_URL: QA_BACKUP,
        PRODUCTION_BASELINE_BACKUP_DATABASE_URL: QA.replace("-pooler", ""),
      })
    ).toThrow("production_baseline_backup_matches_qa");

    expect(() =>
      prepareProductionBaselineAdoptionEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        QA_BASELINE_BACKUP_DATABASE_URL: QA_BACKUP,
        PRODUCTION_BASELINE_BACKUP_DATABASE_URL: QA_BACKUP,
      })
    ).toThrow("production_baseline_backup_matches_qa_backup");
  });

  it("blocks a pooled Neon backup URL", () => {
    expect(() =>
      prepareProductionBaselineAdoptionEnv({
        DATABASE_URL: PRIMARY,
        QA_DATABASE_URL: QA,
        PRODUCTION_BASELINE_BACKUP_DATABASE_URL: PRODUCTION_BACKUP.replace(
          "ep-production-backup.",
          "ep-production-backup-pooler."
        ),
      })
    ).toThrow("production_baseline_backup_must_use_direct_connection");
  });

  it("blocks commands that bypass or retarget the guarded runner", () => {
    expect(() =>
      assertProductionBaselineAdoptionDatabase({
        DATABASE_URL: PRIMARY,
        BEAGLE_PRIMARY_DATABASE_URL: PRIMARY,
        BEAGLE_QA_DATABASE_URL: QA,
        PRODUCTION_BASELINE_BACKUP_DATABASE_URL: PRODUCTION_BACKUP,
      })
    ).toThrow("production_baseline_adoption_gate_not_enabled");

    expect(() =>
      assertProductionBaselineAdoptionDatabase({
        DATABASE_URL: QA,
        BEAGLE_PRIMARY_DATABASE_URL: PRIMARY,
        BEAGLE_QA_DATABASE_URL: QA,
        PRODUCTION_BASELINE_BACKUP_DATABASE_URL: PRODUCTION_BACKUP,
        BEAGLE_PRODUCTION_BASELINE_ADOPTION: "1",
      })
    ).toThrow("active_database_is_not_production_database");
  });
});
