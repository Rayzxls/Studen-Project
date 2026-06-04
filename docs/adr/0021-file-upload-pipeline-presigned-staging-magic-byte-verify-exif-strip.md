# ADR-0021 — File Upload Pipeline: Presigned PUT + Staging + Server-Side Magic-Byte Verify + EXIF Strip + Allow-List MIME

## Status

Accepted — 2026-06-04 (Phase 6 entry)

## Context

Phase 6 introduces Cloudflare R2 as the first external storage in the project. CLAUDE.md § Critical Files marks `lib/storage/signed-url.ts` as a leak-on-error file ("leak = นักเรียนเห็นไฟล์คนอื่นได้"). CLAUDE.md § Hard Rules adds:

- "ไฟล์ใน R2 — ทุก request → check ผ่าน signed URL ที่ generate หลัง permission check เท่านั้น" (signed URL only, generated after permission check).
- "Trust file extension — ตรวจ MIME magic bytes" (no extension-based MIME).
- "Allow upload executable types (exe, bat, sh, js, html, svg with script)" (allow-list, with SVG-with-script explicitly named as the executable to refuse).
- "Strip metadata จากรูป (EXIF location, etc.) ก่อนเก็บ" (EXIF strip).
- "ไฟล์ใหญ่ → upload ตรงไป R2 จาก client (presigned PUT) ไม่ผ่าน server" (no server proxy for upload bytes).
- "max 20 MB" per Performance Budget.

Five sub-decisions need to interlock — picking the wrong combination opens a security hole (SVG XSS, MIME spoof) or a DX/UX problem (server OOM, double upload).

### Question 1 — Pipeline shape

- **P1 — Proxy through Next API route.** Memory pressure on Vercel serverless (function memory limit ~1 GB; 20 MB × concurrent uploads risks OOM). Violates the CLAUDE.md "ไฟล์ใหญ่ → upload ตรงไป R2 จาก client" rule.
- **P2 — Presigned PUT direct to R2 staging prefix + post-upload commit endpoint** that fetches from R2, verifies magic bytes, re-encodes images, then moves to permanent prefix.
- **P3 — Cloudflare Worker R2 event hook.** Operationally heavier than Phase 6 needs; out of scope.

### Question 2 — Magic-byte verification location

- **M1 — Server-side enforcement** using `file-type` (~150 file types, reads first ~16 bytes).
- **M2 — Client + server** (client as UX hint; server as enforcement).
- **M3 — Client only.** Untrusted boundary.

### Question 3 — SVG policy

- **S1 — Block entirely** (no whitelist entry).
- **S2 — Allow with DOMPurify SVG sanitization on read.**
- **S3 — Allow with forced `Content-Disposition: attachment` only.**

### Question 4 — MIME whitelist and size

The whitelist scope drives the threat model. Block-list approaches miss novel MIME values; allow-list approaches risk over-restriction. Size and chunking interact: a 20 MB single PUT works on Cloudflare R2 without multipart; multipart adds complexity that resumable upload could justify but Phase 6 does not need.

### Question 5 — EXIF strip implementation

- **E1 — Server re-encode via `sharp`** (JPEG/PNG/HEIC → re-encoded JPEG/PNG/WEBP). EXIF disappears naturally.
- **E2 — Strip metadata segments only** (faster, but HEIC parsing is non-trivial; partial removal risks leaving fragments).
- **E3 — Skip** (defer to Phase 9).

## Decision

### 1. Pipeline: presigned PUT + staging + commit (Q1 → P2)

Three-step pipeline:

1. **Presign.** Client POSTs `{ ownerType, ownerId, declaredMime, declaredSize, originalFilename }` to `/api/storage/presign`. The server runs permission check (`assert.canUploadTo(ownerType, ownerId)`), validates `declaredMime` against the allow-list (§ 4), validates `declaredSize ≤ 20_971_520` (20 MB binary), generates a staging key `staging/<uploaderId>/<uuid>`, signs an R2 PUT URL with 5-min TTL, and returns `{ uploadUrl, commitToken }`. The `commitToken` is a JWT containing `{ uploaderId, stagingKey, ownerType, ownerId, declaredMime, exp: now+10min }` signed with `AUTH_SECRET`.

2. **Direct PUT.** Client PUTs file bytes directly to `uploadUrl`. R2 stores under `staging/...`. The server never sees the bytes during this step. Client tracks progress via XHR `progress` event for the UI.

3. **Commit.** Client POSTs `{ commitToken }` to `/api/storage/commit`. The server validates the JWT, fetches the file from R2 staging (HEAD + first 16 bytes for magic-byte check), runs § 2 verification, re-encodes images per § 5, copies to `permanent/<ownerType>/<ownerId>/<uuid>.<verifiedExt>`, deletes the staging object, inserts a `FileAttachment` row, fires audit `FILE_UPLOADED` (Important), and returns `{ fileId }`. On any verification failure: delete the staging object, fire `FILE_REJECTED` (Important) with the reason category, return 400.

Staging cleanup of abandoned uploads (client crash between PUT and commit) is handled by an R2 lifecycle rule on the `staging/` prefix with 24-hour TTL — Cloudflare-native, no server cron.

### 2. Magic-byte verification: server-side, enforced (Q2 → M1)

The commit endpoint reads the first 16 bytes of the staging object and runs them through `file-type` (npm package, pure JS, no native deps). The detected MIME is compared against the JWT's `declaredMime`. Mismatch is a hard reject — there is no "best effort" path that accepts the file with a corrected MIME, because that would reward callers who lie about the MIME at presign time and discover at commit time that the file is something else entirely.

The verified extension (from `file-type`'s `ext` output) is what lands in the permanent key. The user-supplied `originalFilename` is stored in `FileAttachment.originalFilename` for display only, never used in the R2 path or in `Content-Disposition` directly (filename is sanitized for ASCII-only or RFC 5987 percent-encoded before serving).

### 3. SVG blocked (Q3 → S1)

`image/svg+xml` is not in the allow-list. The reasoning is direct: CLAUDE.md hard rules name "svg with script" as an executable type to refuse. Sanitization (S2) is defensible in principle, but DOMPurify's SVG config has had CVEs in its history, and the attack surface (`<script>`, `<foreignObject>`, CSS expression, animate-based event triggers) is broader than the value SVG attachments deliver in a school context. Vector worksheets are covered by PDF.

### 4. Allow-list and size (Q4)

| Category | MIME types | Notes |
|---|---|---|
| Documents | `application/pdf` | Primary worksheet format. |
| Images | `image/jpeg` · `image/png` · `image/webp` · `image/heic` · `image/heif` | iOS native HEIC/HEIF included; transcoded to JPEG on commit (§ 5). |
| Office | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX) · `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX) · `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX) | Thai schools rely on these heavily. Legacy `.doc/.xls/.ppt` excluded. |
| Excluded | SVG (§ 3), GIF (animation footgun, low value), TXT/MD (low value), ZIP/RAR/7Z (archive smuggling), all video/audio (no Phase 6 use case), all executables. | |

Max size: 20,971,520 bytes (20 MB binary). Single PUT, no chunking. Cloudflare R2 supports single PUT up to 5 GiB; 20 MB is well within. Resumable upload deferred to Phase 7+ if students report meaningful failure rate on poor connections.

### 5. EXIF strip: `sharp` re-encode (Q5 → E1)

JPEG, PNG, HEIC, HEIF inputs go through `sharp.toBuffer()` in the commit endpoint before R2 copy. The re-encoded output strips EXIF (including GPS coordinates — a PDPA concern for student-uploaded photos), strips alpha for JPEG, normalizes orientation (auto-rotate). HEIC/HEIF outputs are transcoded to JPEG (universal browser support; HEIC has poor cross-browser playback). The verified extension after re-encoding reflects the output format, not the input.

WEBP and PDF pass through unchanged — WEBP does not carry GPS EXIF natively in the spec used by schools, and PDF metadata fields are not subject to the same PII risk; PDF re-encoding is heavier than the gain warrants.

CPU budget: ~150–500 ms per image (HEIC slowest). Acceptable for the student submission flow because the wait happens in a single commit request, not during the long-running PUT.

### 6. Signed URL strategy at read time (Q6 — inline lock, not a separate ADR)

- TTL = 300 s (5 min) per CLAUDE.md hard rule.
- Render-time signing for inline previews (PDF + image embedded in `<a>`/`<img>` on submission detail pages).
- Click-time signing for office docs: page renders `<a href="/api/storage/download/<fileId>">` → API route runs `assert.canViewFile(fileId)` → 302 redirect to a freshly signed R2 GET URL.
- `Content-Disposition: inline` for `image/*` and `application/pdf` · `attachment` for office docs.
- No `FILE_ACCESSED` audit event in Phase 6 — permission check at sign time + 5-min TTL cover the threat model. Audit noise budget reserved for mutations.

## Consequences

### Positive

- **CLAUDE.md hard rules satisfied as a single coherent pipeline.** Each rule maps to a step (presign permission check, magic-byte verify, EXIF strip, presigned PUT direct-to-R2). There is no rule the pipeline silently fails to honor.
- **Server memory bounded.** Bytes never traverse the Next API function during upload. The commit step reads only the first 16 bytes for magic-byte check, plus the full image bytes for `sharp` re-encode — the largest single allocation is one 20 MB image, which fits comfortably in Vercel's function memory.
- **Staging vs permanent split makes failure idempotent.** A client that PUTs successfully but never calls commit leaves an orphan in `staging/` that the lifecycle rule reaps in 24 h. A client that retries commit on a valid token gets the same outcome. A token whose `exp` passes is rejected before any side effect.
- **Magic-byte verification eliminates extension-spoof and most MIME-spoof attacks.** A `.pdf` file with executable payload is rejected; the verified extension is what ships to the permanent key, so downstream `Content-Type` headers from R2 reflect the actual content.
- **Allow-list is honest.** Adding a MIME requires an explicit code change and a security review; nothing slips in by default. The list is short enough to fit in one Zod enum.
- **PDPA-relevant metadata is gone.** Student photo uploads cannot leak home GPS coordinates.

### Negative

- **No resumable upload.** A 20 MB upload that fails at 18 MB restarts from zero. Acceptable for a school context where most attachments are under 5 MB; revisit if Phase 7+ telemetry shows ≥ 5 % upload failure rate.
- **HEIC transcoding cost.** iPhone-shot photos pay ~500 ms server CPU at commit. The alternative (storing HEIC, transcoding on read) is worse — every download would pay the cost, and not all student browsers render HEIC reliably.
- **No AV scanning.** A file that passes magic-byte verification but contains embedded malware (e.g., a real PDF with a malicious JavaScript action) is stored intact. The threat model accepts this because:
  - The download path serves files with `Content-Disposition: attachment` (office docs) or `inline` (images/PDF) without executing in the page context;
  - The 95th-percentile threat in a school context is not weaponized PDF;
  - ClamAV (or R2 Enterprise scan) is targeted for Phase 9 hardening (HANDOFF Known Deferrals).
- **Staging orphans incur R2 cost for up to 24 h.** Bounded and small in practice; the lifecycle rule is the cleanup.
- **`commitToken` is a JWT with the staging key encoded.** A user could in principle replay a valid token to re-trigger commit, but the staging object will have been deleted on first successful commit (or by the rejection path), making replay a no-op. The token itself contains no secret beyond what the user already knows from their own upload.
- **No `FILE_ACCESSED` audit.** PDPA inquiries cannot answer row-level "who downloaded which file when". Acceptable for Phase 6; the permission gate at sign time bounds exposure.

### Rejected Alternatives

- **P1 — Proxy through Next API.** Violates CLAUDE.md's "ไฟล์ใหญ่ → upload ตรงไป R2" rule. Risks OOM on concurrent uploads. Defeats the bandwidth-economy of R2.
- **P3 — Cloudflare Worker R2 event hook.** Operationally heavier (deploy + secret management on a second platform). Phase 6 has no use case that the simpler commit endpoint cannot serve.
- **M2 — Client + server magic-byte.** Adds bundle weight for the client check with no security gain over server-only enforcement; client check at best is UX (fail fast before PUT) and we leave that as a future enhancement.
- **M3 — Client only.** Untrusted. CLAUDE.md hard rule prohibits.
- **S2 — Allow SVG with DOMPurify.** Adds attack surface (CVE history in DOMPurify SVG mode, novel vectors via `<foreignObject>` + JS event handlers) that the rare legitimate use case does not justify.
- **S3 — Allow SVG with attachment-only.** Reduces inline XSS risk but does not eliminate it (a user can save and open the SVG locally; if the school browser is configured to render SVG in the `file://` scheme, the embedded script runs).
- **E2 — Metadata-only strip.** HEIC's nested box structure makes partial EXIF removal error-prone; partial removal can leave residual fragments. `sharp` re-encode is the safer code path.
- **E3 — Skip EXIF.** Ships GPS coordinates of student bedrooms in uploaded photos. PDPA risk is real and avoidable.
- **Block-list MIME (instead of allow-list).** Loses to novel MIME values; loses to spoofed extensions that the magic-byte check would catch but that human reviewers would miss when reading the block-list.
- **Multipart / chunked upload.** Not needed at the 20 MB cap. Adds client-side state machine and server-side reassembly logic. Defer.
- **Stream proxy on download.** Defeats the CDN benefit of R2. Doubles bandwidth cost (R2 → Next function → client). 302 redirect is the standard S3/R2 pattern.

## References

- CONTEXT.md § FileAttachment · § Signed URL
- CLAUDE.md § Critical Files (`lib/storage/signed-url.ts`) · § Hard Rules (extension/MIME, SVG, EXIF, presigned PUT, max 20 MB) · § Performance Budget
- HANDOFF.md § Patterns — Pattern 2 (authz inside `$transaction` for the `FileAttachment` row insert), Pattern 10 (past-tense audit family — `FILE_UPLOADED`, `FILE_REJECTED`, `FILE_DELETED`, `FILE_INFECTED_BLOCKED` reserved)
- HANDOFF.md § Known Deferrals (AV scan → Phase 9)
- Security.md § 7 (Phase 6 audit family addition — same commit)
