# Korean storage and review candidate — 2026-10-03

Scope: PR #1339 integration on `codex/viewer-language-foundation`, assigned base `0737d089`. This report describes isolated SQL verification. The deployment's original `user_vocabulary`/`review_events` DDL and installed function bodies were not available through the authorized REST surface. No live database, account, environment file, credential, migration, or existing test was changed. Production Korean readiness is **unverified**.

## Reviewed storage contract

`docs/sql/korean-learning-support.sql` is an explicit application candidate. It requires the committed material-context RPC/schema, vocabulary-exclusion SQL, and known-word-controls SQL to exist already. It refuses unknown function implementations, missing guards, unreviewed learning triggers, unexpected dependent-table constraints/types, unsupported language checks, missing owner-policy command coverage, unsafe RLS/grants, and RLS-bypassing role memberships. Catalog identifiers in fixed policy hashes use canonical role names rather than deployment-specific role OIDs.

The bounded extension adds `Korean` to vocabulary/context/exclusion and, if present, review-event text-language checks; it adds the `ko` known-word mappings. Korean context saves require `kind='reading'`. Textbook/PDF/course/passage/dictionary checks remain outside this candidate. Optional absent vocabulary/review language checks are accepted only when the columns have the expected text type and no unknown CHECKs exist. Other original-table CHECKs require a separate reviewed baseline rather than being guessed. Additional restrictive policies on the original vocabulary/event tables likewise require review.

The four legacy languages retain their RPC insertion defaults, spelling/base-form matching, meaning confirmation, source identity, exclusion behavior, and SRS paths. Existing cards are never rescheduled by a repeated save. A complete optional Korean initial schedule (`interval`, `ease_factor`, `repetitions`, `next_review_at`) is validated and applied only after that transaction successfully inserts a new Korean card. Difficulty uses the current FSRS range 1–10. `last_reviewed_at` remains unset, and saving creates no review event. The application computes these values from a validated initial grade; a caller's display locale is not a schedule or identity key.

Existing known markers, meanings, schedules, sources, contexts, and review events retain their rows. Existing `ko` known markers gain corresponding exclusion rows through the committed normalization/base-form synchronization rule. Advisory locking, owner RLS, saved/unsaved uniqueness, and excluded-card/event guards remain intact. The apply transaction takes bounded table locks and a five-second lock timeout. It suspends only previously verified v1 Korean contract guards during administrative exclusion backfill, then restores them before publishing readiness. Application writes cannot enter this window.

## Authenticated readiness and write guards

Read-only `public.learning_language_capabilities()` returns exactly:

```json
{"version":1,"languages":{"Korean":{"save":true,"review":true,"known":true,"exclude":true}}}
```

Only authenticated callers receive EXECUTE; unauthenticated identities are also rejected inside the RPC. The function is stable, uses invoker privileges, and reads catalogs only. It recomputes a versioned installation fingerprint covering the relevant function definitions/ACLs/owners; table columns/defaults/checks/indexes/RLS/ACLs; policies; trigger definitions/enabled states; invoker views; schema ACLs; and authenticated/anonymous role attributes and membership closure. A relevant regression returns the same JSON with **all four booleans false**, rather than an installed-but-stale readiness flag. These fingerprints intentionally fail closed on relevant catalog changes; a reviewed reapplication plus the verification matrix is required to accept a changed contract.

Korean save/exclusion RPC paths and narrow invoker triggers on vocabulary/context/known/exclusion/review writes consult this readiness before mutating. Review/exclusion guards also inspect a referenced card's actual language, preventing a stale client from bypassing Korean checks by labeling a Korean card's event `English`. Legacy-language operations preserve their existing behavior. Display metadata must remain outside `p_source` and its locator: only top-level `translation` is excluded from the existing source-key hash. The application must not send UI locale or generated explanation envelopes as source identity.

## Safe rollback

`docs/sql/korean-learning-support-rollback.sql` replaces only the capability function with the all-false contract and maintains authenticated-only execution. It retains Korean-compatible checks, protection functions/triggers, and every old/new learner row. Korean writes freeze; legacy writes remain available. Restoring a restrictive four-language CHECK would reject new Korean rows and is deliberately excluded. To resume Korean writes, reapply the reviewed support SQL and repeat authenticated verification. Isolated tests cover rollback with active Korean known markers, successful reapplication, and known/exclusion restoration afterward.

## Verification performed

`node supabase/tests/korean-learning-support.mjs`: **13 grouped PostgreSQL checks passed** using PGlite and the actual candidate SQL plus real committed context/known/exclusion implementations. The explicit legacy fixture has language CHECKs, owner RLS, authenticated grants, and two synthetic owners. Coverage includes:

- Twelve negative preflight variants: changed function security; unknown language/dependent CHECK; missing known PK/required exclusion column; unreviewed event CHECK/trigger; disabled guard; missing write-policy coverage; permissive owner-policy widening; anonymous grant; RLS-bypassing role.
- Exact legacy/known/context/event preservation; existing `ko` marker backfill; authenticated read-only capability/anonymous denial; new Korean good/again/easy FSRS initialization and partial/invalid schedule rejection.
- Duplicate saves; three explanation locales with unchanged source identity; repeated source occurrences distinguished by locator; edited meanings and stale/current confirmation; spelling-language conflict; ambiguous legacy/base-form matches.
- Foreign private material, forged owner, foreign card and context access; Korean textbook/PDF rejection; Korean and English known/exclusion restoration; blocked SRS/events while excluded; owned review after restoration.
- Function/check/trigger/view/policy/grant/role-attribute/membership regressions returning all-false and blocking Korean direct writes; idempotent second application; rollback retaining all data and legacy usability; reapplication with active Korean known rows.

`npx --no-install eslint supabase/tests/korean-learning-support.mjs`: passed. Full repository tests, build, live SQL application, real-login checks, and deployment verification belong to the integration owner and are not claimed here.

## Operator application and verification

1. Capture protected before-snapshots of representative legacy card IDs, meanings, FSRS fields, sources, contexts, known/exclusion rows, and events. Keep private row contents out of PR/report artifacts. Inspect live catalogs with the read-only queries in `viewer-language-storage-contract-20261002.md`, including all RPC bodies and extra trigger implementations. Verify prerequisite SQL is already installed.
2. Execute the candidate transaction through an authorized SQL connection with stop-on-error. A prerequisite/body/constraint refusal is actionable drift, not permission to remove the check or overwrite a newer RPC. Preserve the reported signature/table/constraint name, compare the deployed implementation, and prepare a newly reviewed compatible candidate if necessary. Missing SQL/catalog access is a deployment blocker; REST success does not establish schema compatibility.
3. Compare protected snapshots. As a normal authenticated owner, call the capability RPC and run the isolated matrix's equivalent application paths with approved data: save/duplicate/meaning conflict, private-source ownership, initial grade, known/exclude/restore, and review. Verify a second owner cannot read/write the first owner's rows. Check legacy flows as well. Capture the exact app commit and deployed function fingerprints alongside results.
4. Enable Korean product actions only when all capability booleans are true and authenticated application verification passes. On failure, apply the safe capability rollback, verify all-false and retained rows, and keep the Korean path disabled. A schema fingerprint verifies installed integrity; it does not replace real-login end-to-end validation.

The available REST OpenAPI surface reportedly includes newer RPCs (`save_vocabulary_context_for`, `classroom_save_vocabulary`, `viewer_undo_vocabulary_save`) beyond the committed baseline audited here. Their presence does not expose their SQL bodies. This candidate may correctly refuse an evolved deployment; no production support or successful live application is asserted.
