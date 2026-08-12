/**
 * Stands in for the `server-only` package under vitest.
 *
 * The real package throws on import unless React is resolving it inside a
 * Server Component, which no test runner is. Aliasing it here keeps the guard
 * where it matters — a client bundle importing `lib/meeting/livekit.ts` still
 * fails the build, which is the whole point of the marker — while letting the
 * module be unit-tested like any other.
 */
export {};
