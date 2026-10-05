# FSRS learning follow-up 019 — complete reads and atomic manual save

Date: 2026-10-04 Asia/Seoul. Base: `9f32f9908f8f95151f08218dcc86f45f0134f400`; branch `codex/learning-followup-019`.

This implements the next bounded learning task after 018. Existing enrolled cards retain their original `user_vocabulary` columns, so filtering those columns previously produced incorrect due lists/statistics. A manual INSERT also preceded durable enrollment, allowing a tab close/storage failure to leave a saved word without an enrollment request.

## Resulting behavior

- The authenticated vocabulary endpoint adds `GET ?view=learning`, retaining its existing context GET/source POST/DELETE behavior. A service-only scalar JSON RPC reads all owned vocabulary and an exactly matching registry in one database snapshot. Missing/extra/foreign/malformed entries are unavailable; a missing schema is never an empty or legacy registry. Scalar JSON avoids the usual REST row cap. Summary readers receive only the explicit slim field allowlist.
- Pure projections keep the original vocabulary separate from `memory` and `review`. Full-state exact due/stability/history feed the vocabulary list/detail/statistics, home, library and profile. Cooldown affects actionable `nextQuestionAt` without rewriting the stored schedule. Legacy repetitions remain lapses; legacy successful reps/state are unknown. Existing stage thresholds and KST report helpers remain in growthStats. FSRS scheduler days retain the pinned 04:00 policy.
- Today’s output words are selected from eligible, undo-filtered review events by stable word ID, then fetched from owned active vocabulary. Complete pagination checks exact counts and rejects duplicate/missing IDs. Original last-review timestamps are no longer used to discard newly graded FSRS words. Offset pagination is not a multi-query MVCC snapshot; concurrent backdated event changes remain a limitation distinct from the single-snapshot vocabulary RPC.
- A manual save in enabled FSRS first commits an immutable intent to IndexedDB, then calls one server transaction for vocabulary INSERT, New memory/enrollment and the durable request receipt. A duplicate existing expression returns its existing row and current state without resetting, enrolling or overwriting it. An excluded/retired UUID cannot be reused to bypass exclusion. Lost responses replay the same request, including after a later grade. A mismatched request ID fails; a blocked recoverable request is retried explicitly with its original payload.
- Settled results invalidate actor-scoped reads. Pending or failed saves are not shown as confirmed success. Switching accounts rejects stale responses. Cached vocabulary remains readable offline, with the existing cache notice and unavailable memory/readonly controls; an unverified cached row cannot re-enable grading or become an empty registry. This deliberately limits offline fallback compared with old mutable legacy-cache flows.
- The four review buttons retain labels, colors, order and one row, including the legacy review component at 320px. Existing title lookups stay in authenticated RLS queries; service-role vocabulary reads do not disclose arbitrary material titles.

Raw rows, source context, ownership, previous schedules and review events are preserved. No projection is passed back as a writable legacy schedule. Viewer/import bulk enrollment, grammar queues and new product areas are outside this task.

## SQL and preservation boundary

SQL candidates are external to the repository, under `learning-followup019/storage/`; no migration was added. `install.sql` attests the exact 018 predecessor, preserves its active/disabled setting and all existing rows, adds only the reviewed successor objects and refreshes only the expected FSRS catalog fingerprint. Both installation orders were exercised: 018 passive → 019 → frozen 018 activation, and 018 active → 019.

The 019 rollback disables new manual-save mutations while preserving complete reads, 018 memory/operations/receipts and its grading gate. It is not a downgrade that sends enrolled cards to legacy scheduling.

Frozen Korean SQL Git blobs remain:

- support: `030099a8d84afe292964e78d31f5d2d8ccf4909a`
- rollback: `564ba5320020965b42ca5a18e6f9d50575443d65`

The protected M09-KO-DB-003 wrapper and the three 018 SQL candidates are unchanged. Do not re-run the original Korean installer or reset a fingerprint to bypass a mismatch.

## Verification and reproducibility

External evidence root: `/workspace/cloud-services/agent-runtime/learning-followup019/`.

- Full Vitest, lint, isolated production build, prebuild and the existing browser CI suites are the release checks. Final source hashes, executed commands, counts and build commit are recorded in `final-report.md`, `completion.json` and the handoff manifest. Earlier failed logs remain alongside successful reruns.
- SQL author verification covers exact preservation, both installation orders, >1000-row completeness, owner isolation, duplicate/replay, known/exclusion, post-INSERT and post-enrollment failures, metadata precision and rollback. Actual JavaScript API → PGlite RPC integration is separate evidence.
- Independent Chromium/IndexedDB tests exercise durable abort, lost-response reload, receipt-commit failure, duplicate identities, explicit retry and account switching. Real React components exercise 320/390/1440 widths, memory displays, readonly cache fallback and review button geometry.
- Prior source-location tests were updated only where the protocol moved: required fields/slim payload/error propagation now target the actual summary contract; manual save now asserts the atomic command rather than INSERT → enroll. Existing functional assertions, colors/order, timeouts and skips are retained. SPEC amendments and the original failing run document each change.
- Existing inactive E2E fixtures gained only the explicit installed-disabled snapshot protocol over their existing mutable synthetic rows. Active FSRS scenarios are separate tests. Synthetic accounts and single-backend PGlite are not authenticated Preview or production verification.

## Outstanding activation gates

Broad activation remains held. This task does not claim production SQL, real-user Preview acceptance, PR, merge or deployment.

1. Read and attest actual deployed `update_streak`/profile definitions and ACLs using `review/streak-catalog-preflight.sql`. Eligible committed grade IDs and effective review time need an atomic activity receipt; do not call the login-mutating `fetchProfile` as a read-only refresh or duplicate legacy review events.
2. Unify the daily-new budget at a server receipt boundary. Legacy localStorage uses UTC/day and grade/undo accounting; full FSRS uses actor-scoped first-question receipts and KST 04:00. Adding the two counts in the browser is not an authoritative shared limit.
3. Complete M09-KO-DB-003 protected live SQL and normal-account Korean save checks. Simplified and Taiwan Traditional semantic quality remain incomplete.
4. Remaining full-state consumers include material/viewer hints, push/cron forecast, query-before-LIMIT study/quest selection and a lossless full-state/history export. Existing raw CSV is not a full FSRS backup.
5. Attest real owner catalog, multi-backend concurrency, operating data volume/lock cost and normal-account preservation before activation. Install the verified passive 018 and 019 contracts before deploying code that requires the new snapshot API.

At the last read-only operation check, GitHub `/user` returned 401 and production `/api/version` remained `eace1cb79468723a77b5df8c7d5f676420f11626`, deployment `dpl_7WDSztscPXiDgrjokE5ETfLjKWNC`. The local production-tree import is not true upstream ancestry: use the cumulative verified patch on actual reviewed main, not a fabricated merge base. The M09 archive is a reviewable handoff, not proof of automatic delivery.
