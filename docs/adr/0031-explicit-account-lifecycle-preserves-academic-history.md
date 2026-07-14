# Explicit account lifecycle preserves academic history

User access and academic history have different lifecycles. The product will model one mutually exclusive Account Status: Active, Suspended, Terminated, or Anonymized. This supersedes treating combinations of legacy activation, deletion, and role-specific anonymization flags as canonical state.

Suspension is reversible and affects authentication only. Termination removes a person from current use while retaining historical submissions, scores, attendance, comments, and audit evidence. Anonymization is an explicit, irreversible privacy action after termination; it removes identifying login/profile data while preserving pseudonymous academic evidence. No lifecycle action physically deletes academic history.

Admin is the global lifecycle operator but remains a read-only observer of teaching data. Teacher and Student may submit a termination request, which changes nothing until Admin decides it. Admin cannot act on their own account or leave the system without an active Admin. Each transition requires an internal reason, a separate safe user-facing message, risk-appropriate confirmation, session revocation where access closes, and audit evidence.

A Teacher with an active owned CourseOffering may be suspended but not terminated. The Teacher must archive owned courses first; ownership transfer is deferred as a separate decision. Terminating a Student withdraws active enrollments while preserving prior work and allowing Teacher review to finish. Restoring a terminated account does not reopen archived courses or rejoin prior enrollments, and requires a temporary password with first-login reset. An anonymized account cannot be restored.
