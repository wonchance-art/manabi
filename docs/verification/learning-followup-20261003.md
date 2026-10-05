# Learning follow-up 017 — implementation and activation boundaries

The owner requested the remaining work after M09-WORD-INSPECTOR-001. Production base is
`eace1cb79468723a77b5df8c7d5f676420f11626`, tree
`9666ca1f06ab62a9835fb18b52c4d64ef1cf4032`. An immutable GitHub archive reproduced that
tree exactly. Local history imports three already-released browser-test changes; this
import commit is not a substitute for the production commit or its ancestry.

## Implemented

- `reviewOutbox`: wait for an IndexedDB commit; reject errors/aborts; preserve pending
  originals above 500 entries. Failed history/card reads or truncated exact-count
  responses retain intentions. A failed grade retains itself and later grades of the
  same card; independent cards can continue. Failed removal/read cannot claim successful
  offline undo. Historical event deduplication remains, with date-based legacy grade
  conflict handling. The legacy size calculator remains exported for compatibility but
  no longer deletes queued originals.
- `koreanMorphologyConsistency`: reject only supported, provable morphology conflicts
  (present 가/오 with a specific -어요 claim, reversed 걸어가다/걸어오다). The parser preserves
  the original failed line. Unsupported analyses stay unknown; no meaning/lemma rewrite.
  Valid past contractions and umbrella -아/어요 remain accepted. This is not semantic
  approval. Saved material and explanation caches are unchanged.
- `fsrsScheduler`: pinned ts-fsrs 5.3.2 / FSRS-6 memory API plus seconds policy, full
  state, one assessment time, 04:00 stored-zone learning-day calculations, DST tests,
  applied schedule logs and four card-specific previews. Introduction is not recall.
  Learning: Again 30s, first Hard 315s, Good 600s; later Hard 600s. Review Again enters
  Relearning 600s; one-step relearning Hard 900s. Easy graduates to Review, not known.
  Long intervals use the pinned memory/interval/date functions, preserving their UTC
  timestamp behavior; maximum-interval saturation is capped at 36500 days for all grades.
- `fsrsReviewSession`: question-before-reveal eligibility, exposure/hint refusal,
  revisioned grade/compensating-undo plans, owner/known/exclusion-aware exact-due queue,
  timer/focus/visibility refresh. These are pure planning contracts, not server authority.

The new FSRS modules are deliberately **not connected to production writes**. Existing
`fsrs.js`, grade buttons, user schedules, source material and vocabulary meanings are
unchanged. The implementation does not infer complete memory/history from four legacy
fields or claim that an existing word-inspector screen is a valid recall attempt.

## Evidence

- Final `npm test`: **445 files / 4752 tests passed**; changed-file ESLint clean.
  No existing test edits, added skips, timeout increases or weakened assertions.
- Frozen Korean protected-apply wrapper: 17 isolated preservation/failure/rollback
  checks passed again. Support blob `030099a8d84afe292964e78d31f5d2d8ccf4909a` and rollback
  blob `564ba5320020965b42ca5a18e6f9d50575443d65` are unchanged. Whole wrapper SHA256:
  `b1e750a8d0f009ec2bfd27256dabed0d4407a7dc9a468b0643292e58844076a5`.
- Actual isolated Chromium IndexedDB: 501 committed entries survive reload, including
  the oldest; a native abort returns failure and leaves all prior entries intact.
- Historical synthetic model outputs: 56 source-preserving replays, 4 supported
  contradictions blocked. This is not an overall semantic improvement percentage.
- Eight new synthetic Gemini light calls, two Chinese locales: HTTP200 and source/schema
  preservation. Initial Node transport failures were retained; retry used the session's
  existing proxy/CA. Noun/stem terminology, unsupported grammar labels and incomplete
  not-yet scope explanations remain. No native-speaker acceptance or quality pass claimed.
- Contract tests exercise exact intervals, repeated state transitions, pinned native
  memory/long-due parity, rollover/DST, exposure/undo/revision conflicts, timer wake,
  IndexedDB errors/aborts, partial sync failures and truncation. Existing tests unchanged.

## Remaining execution and integration

1. **Korean activation:** M09 must run the previously reviewed protected SQL on the
   authorized owner connection after fresh read-only preflight. Whole-call COMMIT and
   preservation evidence are distinct from `PASS_precommit_preservation`. Then verify
   all four capability flags with a normal signed-in user, actual save/duplicate/meaning
   conflict/known/exclusion/review/source flows, two-user isolation and legacy/classroom
   regression. The deployed capability hook/API already supports this activation.
2. **New FSRS storage:** reviewed versioned full-state persistence, idempotent operations,
   atomic revision/owner/exclusion checks, legacy-write protection, compensating undo and
   effective event logs. The Korean support SQL does not provide this new contract. Also
   required: durable operation ordering, first-question daily-budget receipts, all grade
   consumers, review queue UI wiring, real-account Preview and preservation/rollback proof.
   Existing outbox date checks are not atomic cross-device revision protection; truncated
   responses are retained, not claimed synchronized. Bulk pagination remains follow-up work.
3. **Language quality:** validated morphology/terminology resources, sentence-scope
   explanations and regional-speaker checks. Narrow consistency success is not a native
   Taiwan/Mainland quality gate. No automatic edits to existing learner data.
4. **Release:** current cloud GitHub authentication still returns HTTP401. No new PR,
   remote CI, merge, deployment, production SQL write or authenticated acceptance is
   claimed for this follow-up. Hand the exact scoped patch, hashes and evidence to M09;
   review and check the resulting real head before normal merge/deploy.
