# FSRS learning integration — 2026-10-03

Task: `LEARNING-FOLLOWUP-018`; user instruction: “다음 작업 ㄱㄱ + 놀고 있는 에이전트는 할 일 진행해”.

## Release status

This is an integration candidate, **not an activated production release**. Production still serves the reviewed word-inspector release `eace1cb79468723a77b5df8c7d5f676420f11626` (deployment `dpl_7WDSztscPXiDgrjokE5ETfLjKWNC`). The public version endpoint was checked again during this task. GitHub authenticated API access still returns HTTP 401; no PR, merge, owner SQL execution or real-account verification is claimed here.

The candidate adds a complete-state FSRS API, personal review component, persistent ordered operations and a separately reviewed SQL draft. Deployment requires the passive SQL contract **before** the app: a missing/unreadable registry blocks legacy review because the app cannot infer that no enrolled cards exist. An installed, disabled contract with a verified empty registry keeps legacy review available.

## Boundaries

- The existing four grade labels, colors, shapes and horizontal arrangement remain. The new question/reveal flow belongs to personal review, not the reading viewer or classroom features.
- Enrollment is restricted to confirmed new manual vocabulary inserts after activation, with zero repetitions/interval, no last review and no review history. Existing cards, duplicate saves, imports and viewer initial grades are not bulk converted.
- Reading, saving and seeing an answer do not become successful recall. First question receipts are separate from grades. Hinted/ineligible attempts cannot grade.
- The server owns user identity, timestamps and schedule calculation. Offline grade delivery uses the already persisted answer-reveal time. Browser requests cannot supply memory, due dates, owner overrides or authoritative clocks.
- Grades and compensating undo use stable operation IDs, expected revisions and immutable records. Undo restores the previous memory/due exactly while advancing revision; a separate 30-second exposure cooldown prevents immediate repeated recall.
- Pending/conflicting operations quarantine the affected card. Legacy event, grade, undo and replay paths reject enrolled cards before applying legacy effects. SQL guards remain the final authority.
- Exact missing-function compatibility in the legacy boundary is only a rollout compatibility path; it is not proof of an empty enrollment registry. Positive enrollment evidence is retained per account across reloads where local storage is available. An unsynchronized device can still retain an unknown offline legacy intent; replay rechecks the server boundary before any remote grade/reward. This pending intent is not a successful server grade.

## Storage and preservation

SQL drafts and reproducible isolated verification live outside the repository in `/workspace/cloud-services/agent-runtime/learning-followup018/storage/`. No migration or production SQL was applied.

Passive installation creates disabled storage and service-only mutation RPCs. Activation verifies the exact supported Korean capability template and existing catalog, adds only reviewed FSRS guards, and updates only the embedded expected fingerprint in that template. The runtime fingerprints functions, ownership, ACLs, RLS, schema and role dependencies; catalog drift fails closed. This successor contract must be checked against the actual owner database before any activation.

Existing meaning, source, ownership, schedules and review rows are compared as whole rows in isolated fixtures. Those fixtures do not establish production-wide preservation. Rollback disables new mutations and retains states, logs, first-question receipts and enrolled-card legacy protection.

Frozen Korean support SQL remains blob `030099a8d84afe292964e78d31f5d2d8ccf4909a`; its rollback remains blob `564ba5320020965b42ca5a18e6f9d50575443d65`. `M09-KO-DB-003` owner execution and real Korean save validation remain separate pending gates.

## Chinese explanation quality

The Korean morphology guard now rejects an explicit `-게` adjective/verb-derived analysis whose model output contradicts the lexical-head POS contract. It returns a failed original line instead of inventing a corrected POS. Source text is preserved.

Both Simplified and Taiwan Traditional Chinese explanation variants were assessed. The bounded live sample had 12 successful transport/schema/source checks, but **0/12 complete semantic passes**. Noun/stem confusion, omitted contractions and mixed terminology remain. No native-language quality or production readiness claim follows from these calls. Prompt changes and guards are a narrow mitigation, not a solved meaning-quality gate.

## Remaining activation gates

1. Add a read adapter for full FSRS state in vocabulary stage, home/library mastered counts and recent-output-word selection. These consumers still read legacy schedule columns, which this change intentionally preserves.
2. Reconcile streak/reward side effects with idempotent grades, undo and delayed delivery. Compatible review events already support event-based reports; they do not themselves update profile streak fields.
3. Make new vocabulary save and FSRS enrollment atomic before activating the pilot. Confirmed manual INSERT currently precedes durable enrollment-intent storage; a tab crash or IndexedDB failure between those two writes can leave a saved card without an enrollment intent. Once the intent commits, reload/retry is protected. Broader viewer/import enrollment also needs separate review; do not relax old-card checks to widen it.
4. Pass actual owner catalog preflight and preservation checks, install the disabled contract, run required CI and authenticated Preview checks, then validate the reviewed activation against the real account before enabling it. Multi-backend concurrency and operational timeout/load checks remain; single-backend PGlite does not establish them.
5. Complete Korean operational storage and Chinese semantic-quality gates independently.

## Verification evidence

Final repository gate: **455 Vitest files / 4,919 tests passed**; changed JavaScript lint passed. Separate evidence includes 22 SQL storage scenarios, 14 real server-to-SQL scenarios (94 RPC calls), 18 native browser IndexedDB/reload checks, 34 independent pure-state probes, and five component browser scenarios covering widths 320/390/1440, timed enrollment and loading with fresh arrays. These suites overlap in behavior and are not a claim of production verification. Build results are attached to the exact committed source in the external handoff.

The actual app regression exposed a loading-time React update loop that the initial isolated component cases did not cover. Unchanged queues now avoid redundant publications, with a dedicated hook regression. The real Node PostgreSQL gate also exposed an extensionless import; that import is corrected and all 20 Korean SQL checks pass. Failure logs are preserved. Three existing browser backends now explicitly model an installed, disabled, empty FSRS registry; unexpected FSRS mutations fail and existing assertions/timeouts/skips are unchanged.

Final source hashes, test counts, SQL checks, browser screenshots and exact handoff artifacts are recorded in the external task report. Synthetic browser and PostgreSQL fixtures are explicitly distinguished from normal-account and production checks. Existing Korean outbox tests received a scoped mock-dispatch extension for the new boundary RPC; original preservation/error assertions were retained. Existing progress-store and inline-review event assertions retain their original payload checks and now additionally require strict error propagation before schedule/reward side effects. No checks were removed, skipped or given looser timeouts.
