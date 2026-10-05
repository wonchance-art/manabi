# FSRS activation prerequisites 020

Date: 2026-10-04 Asia/Seoul. Base: `bc79c735d048fab0a79cc511e67437e448148274`; branch `codex/learning-activation-020`.

This implements the outstanding product prerequisites before an operations handoff. The user's direction is to complete this implementation and integrated verification first. Final executed commit/tree, SQL hashes, checks and live status are recorded in the external `learning-activation020/final-report.md` and `completion.json`. This document does not itself assert deployment or real-account acceptance.

## One authoritative daily-new budget

Saved legacy and full-state FSRS cards use the same actor/day budget. The server owns the configured limit and policy revision; changing the limit is an idempotent compare-and-swap command. GET status does not write preferences. A stale tab cannot choose a different limit for one admission. The learning day is the pinned Asia/Seoul 04:00 boundary; growth statistics retain their existing display calendar.

A first question consumes an immutable first-exposure receipt before the question is displayed. Admission takes the same actor advisory lock as the existing FSRS operation path. Existing FSRS receipts and new legacy receipts count each card once. The UI persists the request before sending it and commits the validated receipt before showing the question. An unknown reply is retried with the same identity. Answer/reveal/grade, abandon and undo do not refund actual exposure. Already introduced New cards can resume without spending again.

Legacy migration is forward-only from an explicitly planned next learning-day boundary. Old localStorage introductions, lapses, saved timestamps and prior raw schedules do not become invented server receipts. A future activation epoch and a stopped contract are distinct states. 020 rollback stops new first exposure while preserving normal review of already introduced/reviewed cards, complete reads, receipts and accepted grades. The existing 018 rollback is the separate whole-FSRS stop.

Missing or damaged 020 contracts never turn an enabled installation into a legacy fallback. Compatibility requires a verified healthy disabled predecessor, including the existing complete snapshot. The installed snapshot successor emits `learningAdmissionVersion:1` using the existing RPC signature, so a stale PostgREST cache that cannot see the new RPC names cannot masquerade as an old installation. The original 018/019 SQL files stay frozen; the exact installed-function successor is separately attested.

## Learning activity and profile reads

An eligible, committed FSRS grade appends its activity receipt inside the grade transaction. Its time comes from the verified operation's actual revealed/reviewed time, not arrival time or a browser claim. Exact replay cannot produce a second reward or activity. A reveal before the forward epoch remains historical. Undo compensates the scheduler while retaining the real completed study day.

The activity adapter attests the exact known freeze-earn predecessor policy, owner, ACL and executable profile schema dependencies. Its activity day remains the attested UTC-midnight legacy contract, separate from the KST 04:00 budget day. A baseline captures the existing profile streak/freeze triple once; only actual receipt days after that baseline are replayed in order. Delayed D/D+1 arrival converges, existing freeze consumption/earning rules remain, and unrelated profile fields are untouched. Unknown live policies or schema behavior reject activation instead of being adopted into a trusted fingerprint.

`fetchProfile` now aliases a SELECT-only `refreshProfileReadOnly`. Refresh, initial session and token renewal do not advance a streak or create a missing profile. Actual sign-in separately creates a missing profile with database defaults and writes only last_login_at. Actor/generation/unmount checks discard late results. The FSRS settlement path refreshes the profile display after the atomic server activity; it does not invoke a second activity mutation.

## Remaining consumers

Materials and Viewer due indicators use the complete vocabulary projection, with original vocabulary and source content separate from effective schedule. Unknown registries do not produce a false zero. Existing inline, study and Quest modes have no new-FSRS/admission session, so only previously reviewed eligible legacy cards enter those paths, before sorting/limiting. This is a selection correction, not a new world feature. Quest late grade/undo responses cannot alter another account's progress or lock.

A prefetched study paragraph is reused only if every saved review target still matches current owned, eligible, reviewed legacy data and is due. Changed cohort, identity, meaning, source or schedule prevents reuse; the stored paragraph is retained and the live session supplies current material.

Server notification forecasts use the same full memory projections as the main screens, including cards whose preserved legacy columns still look new. An unavailable snapshot is recorded as unavailable and does not cause fallback notification delivery.

CSV keeps its existing content columns and exports the actual ISO review time with full-precision stability/difficulty. `schedule_meta_json` identifies the scheduler, exact current memory, actionable review gate and original raw schedule separately. Unknown legacy state remains unknown. Import still accepts only content and creates its own new schedule; it does not treat exported projection metadata as writable legacy state. This CSV describes a current schedule snapshot; the append-only operation/activity history remains in the database.

## Integration and verification

External evidence root: `/workspace/cloud-services/agent-runtime/learning-activation020/`.

- Each owner supplies contract/runtime tests and exact source/SQL hashes. Independent probes include true PostgreSQL backends for locking/concurrency as well as isolated PGlite for deterministic faults. Synthetic accounts are not normal-account acceptance.
- Meaningful browser tests exercise durable intent/receipt aborts, lost replies, account switches and no question DOM before admission. Existing four review button labels/colors/order/one-row layout remain.
- Authorized old tests change only protocol fixtures or moved source-location pins. Existing behavior, error, preservation, timeout and skip assertions remain. The old concurrent-grade wait is strengthened to require each actual timestamp to advance.
- Whole-suite Vitest, lint, isolated prebuild/production build and browser regression results must be tied to the final source candidate. Earlier failures and their corrections remain in the external evidence.
- SQL installer, activation and rollback attest exact predecessors/successors and preserve existing rows/settings except explicit reviewed schema metadata and activation gates. No migration, environment file, world asset or live database was modified for implementation.

## Operations acceptance

The completed candidate still requires actual deployment access, exact-head remote CI, the real database catalog/version/connection policy and normal-account Preview/preservation checks. M09-KO-DB-003 protected Korean storage and language semantic acceptance remain independently evidenced; local fixtures are not those live results. No same-scope reapproval is required.

Do not send an apply request while an implementation or integration gate is failing. The final external handoff must give exact code/SQL hashes, installation/activation order and rollback boundaries, and separate remaining live evidence from unimplemented product work.
