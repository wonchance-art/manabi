# Korean storage and review candidate — 2026-10-03

Scope: PR #1339, `codex/viewer-language-foundation`. The modern baseline comes from M09’s [read-only live catalog report](https://github.com/wonchance-art/manabi/issues/1337#issuecomment-5963522633) at exact head `4109513344f22f74a808e69d764eb401a32d33e8`, PostgreSQL 17.6. This supersedes the earlier assumption that no SQL/catalog connection was available. M09 obtained the definitions through authorized `execute_sql`; this implementation agent made **no live database calls or writes**. The revised candidate has passed isolated verification, not live application or normal-login verification. Production Korean readiness remains **unverified**.

## Exact modern preservation

The original candidate correctly refused the evolved deployment. The revised `docs/sql/korean-learning-support.sql` recognizes two reviewed baselines: the committed legacy PL/pgSQL save RPC, or the M09 modern SQL wrapper and owner-aware/classroom implementation.

| Modern dependency | Preserved baseline body MD5 |
| --- | --- |
| `save_vocabulary_context` SQL/invoker wrapper | `03b53aa8f7cdad5d23d503a26a873e61` |
| `save_vocabulary_context_for` pre-extension implementation | `1facb74b4b7d33a572cef9642341342f` |
| Unchanged `classroom_save_vocabulary` | `f563cf7209213aa03433ca30be0fe4a5` |
| Unchanged `active_vocabulary` invoker view | `008081605dbf386a9242ac58bbfbd02f` |
| Unchanged `vocabulary_with_exclusions` invoker view | `e171e8add613931bf2d3cbf25056a1f2` |

On the modern baseline, only the Korean reading branch of `save_vocabulary_context_for` is extended. `who=p_owner` and the existing owner/service-role/class access check remain intact. The wrapper/classroom functions are never replaced with the legacy implementation. Korean class/textbook/PDF saves are rejected, including Korean class calls by service role. Existing four-language classroom saves retain separate `p_initial` behavior and the complete created-card JSON response.

Modern views retain 22 card columns plus `is_excluded`, their column order, security-invoker setting, and linked-card/same-language NFC base-form exclusion rules. Existing `status`, `last_review`, `material_id`, `created_at`, `source_ref`, `etym`, `hanja`, all other values/defaults, class CHECK/locator arm, and eighth class-context SELECT policy are preserved. Modern vocabulary/event owner predicates stay `TO PUBLIC`; canonical fixed policy hashes explicitly represent PUBLIC OID 0 instead of dropping it.

The extension adds `Korean` only to necessary vocabulary/context/exclusion and optional review-event text-language CHECKs and adds `ko` known mappings. Observed modern vocabulary/event tables have no language CHECK; no unnecessary one is introduced. Existing ko markers acquire exclusion rows through the committed normalization/base-form rule. Application of SQL never rewrites existing card/context/known/event rows. Courses/passages/dictionaries remain outside scope.

New Korean reading cards alone consume a complete optional server-computed initial schedule (`interval`, `ease_factor`, `repetitions`, `next_review_at`); partial/invalid tuples fail, and difficulty follows FSRS range 1–10. The schedule applies only after a successful new insert. Duplicates/confirmed meaning conflicts retain every existing field. Saving creates no review event and leaves `last_reviewed_at` unset; the modern `last_review` default is retained. Display metadata stays outside `p_source`/locator; only top-level `translation` is excluded from the preserved source-key hash. Locale changes neither change source identity nor confirm a meaning conflict.

## Catalog-only preflight and protective reduction

Initial `DO $preflight$` is catalog-only. It accepts exact observed broad learner ACLs or the already-reduced safe state. It rejects unreviewed bodies, function languages/security/owners/default-expression values, grant options, column grants, dependent constraints/types, policies, indexes and all 15 noninternal triggers across seven relevant tables. Confirmation defaults must remain NULL; an omitted argument cannot silently become a meaning confirmation. Shared owner-aware/classroom/undo/analysis and six source-protection functions are explicit reviewed dependencies, including the legitimate existing SECURITY DEFINER undo. No unknown implementation is accepted merely by recording its hash.

Fixed baseline hashes canonicalize role names; installation fingerprints may use installation OIDs. Modern functions and existing capability/guard functions must belong to the observed vocabulary-table owner `postgres`; the applying operator must use that owner. M09’s initial report omitted explicit function `proowner` and service-role attributes. These strict eligibility conditions are **requirements awaiting the next read-only M09 preflight/metadata result**, not claims those values were already observed. Modern class preservation requires nonsuperuser service role with BYPASSRLS; the isolated service role is explicitly synthetic. Authenticated/anonymous inherited superuser/BYPASSRLS privileges are rejected. No role attributes/memberships are changed.

A separate hardening stage performs only the approved protective reductions:

- `REVOKE ALL` on `user_vocabulary` and `review_events` from `anon`.
- `REVOKE TRUNCATE` on `user_vocabulary`, `review_events`, and `user_known_words` from `authenticated`.

It then checks effective anonymous learner-table privileges and authenticated TRUNCATE are absent. Legitimate authenticated CRUD and every service-role grant remain intact. Reading/PDF/public-content grants and existing owner/class policies are unchanged. Unexpected ACLs/grant options/column grants abort. New capability execution is authenticated-only plus its trusted owner; default privileges cannot add new service/other-role execution. Existing service-role functions keep their permissions. Apply uses table locks and a five-second lock timeout.

## Readiness and safe rollback

Authenticated read-only `public.learning_language_capabilities()` returns exactly:

```json
{"version":1,"languages":{"Korean":{"save":true,"review":true,"known":true,"exclude":true}}}
```

The stable invoker RPC reads catalogs only and recomputes relevant installed function definitions/defaults/ACLs/owners; columns/defaults/identity/column ACLs/checks/indexes; RLS/policies/table ACLs; triggers/enabled states; views; schema ACLs; role attributes/membership closure. It includes wrapper, owner-aware, classroom, undo, analysis and source-protection dependencies. Relevant regression returns the same JSON with all booleans false. Private-schema dependencies are resolved by catalog OID/signature text, without granting authenticated schema USAGE. Installed integrity does not replace normal-login verification.

Korean RPC/direct vocabulary/context/known/exclusion/review guards check readiness before writes. Referenced-card language prevents an English event label from bypassing a Korean card’s check. Legacy class/service paths with null learner JWT remain usable; Korean guards do not impose learner authentication on those existing paths.

`korean-learning-support-rollback.sql` sets capability all-false with authenticated-only execution and retains widened checks, every old/new row, guards, class contracts and protective ACL reductions. **It never restores anonymous grants or TRUNCATE.** Korean writes freeze; legacy/classroom writes remain available. Reapplication under locks temporarily suspends only verified v1 Korean guards for administrative ko backfill, restores them, then fingerprints the contract. Both SQL files issue transactional `NOTIFY pgrst,'reload schema'`, delivered only on successful commit.

## Isolated verification

`node supabase/tests/korean-learning-support.mjs`: **20 grouped PostgreSQL checks passed** (13 committed-legacy, seven audited-modern). `npx --no-install eslint supabase/tests/korean-learning-support.mjs`: passed. Tests execute actual candidate/rollback SQL. Existing tests were not edited; full suite/build/CI belongs to root.

The self-contained modern test embeds the independently verified M09 fixture: seven tables/83 columns, 40 constraints, 23 indexes, 21 policies, 15 triggers, 18 exact function bodies and two exact views. External fixture SHA-256: `3fda7ae2410f5511d050b1cad2dd0e24ea70aaa8d4bf6e3609ad9f41370ac1fc`. Auth scaffolding/helpers, service-role attributes and sequence grants are labeled synthetic. Ancillary content/dictionary tables with uncaptured full DDL are omitted; source-protection implementations are copied exactly.

Coverage includes complete row/cardinality snapshots of cards, contexts, known/exclusions, existing review events, materials and PDFs; exact modern function/view/class/default preservation; service-grant parity/minimal learner reductions; initial good/again/easy schedules; duplicates/three locales; edited meanings/current confirmation; spelling-language conflict/ambiguous base matches; private-source/forged-owner checks; known/exclusion restoration/SRS/event guards; normal owner review; null-JWT service classroom saves/initial stats/immutable reuse; class generation/source/locator failures; Korean class rejection; shared body/security/owner/ACL/default/grant-option/trigger/index drift; capability/guard owner takeover rejection; idempotence; rollback retention/legacy-class usability/reductions; re-enable with active Korean markers.

## Operator handoff

1. Freeze the revised exact app commit/SQL. Have M09 run initial `DO $preflight$` in a read-only transaction with `search_path=''`, together with explicit function-owner/security/default/ACL and actual service-role metadata. This eligibility report needs no REVOKE/DDL. Review any refusal against the catalog; never remove guards or overwrite newer code to force a pass.
2. Capture protected complete before-snapshots and row counts. Execute the candidate with stop-on-error through authorized SQL, then compare snapshots. Existing ko markers may add exclusions; card/context/known/event contents must remain unchanged. Keep private meanings/source contents out of public artifacts.
3. Verify schema-cache reload, then normal authenticated application capability, Korean reading save/initial grade/duplicate/meaning conflict/private sources, known/exclude/restore, review and source return. Verify second-owner isolation and legacy ordinary-reading/service-only classroom behavior. Operator/service success is not normal-authenticated verification.
4. Capture deployed fingerprints and exact app head. Enable Korean only with all-true capability and completed normal-login verification. On failure apply safe rollback, verify all-false/retained rows/reduced privileges, and retain the Korean gate. Live application, real-account/Preview/production/deployment checks remain root/M09 responsibilities and are not claimed by this isolated report.
