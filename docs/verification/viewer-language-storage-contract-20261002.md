# Viewer language storage compatibility — 2026-10-02

Baseline: `main` `c9ad8a` as assigned; integration branch `codex/viewer-language-foundation`. This is a code/schema audit and focused pure-module verification. No runtime DB query, schema change, backfill, account write, or deployment was performed. Korean saving remains blocked until the deployed contract is verified.

## Preservation contract

`language` on an existing card remains its legacy target-language key (`Japanese`, `Chinese`, `English`, `French`). The new target-language registry also recognizes `Korean`; registry membership does not establish DB support. UI and explanation locales are independent canonical `ko`, `zh-CN`, `zh-TW` values. Regionless `zh`, `zh-Hans`, and `zh-Hant` cannot label persisted explanations without a deliberate locale selection.

Changing either display locale must retain card `id`, `user_id`, target language, user-edited `meaning`, source sentence/material, contexts, FSRS fields, and review events. It must not invoke save, grade, exclusion, or known-word writes. A localized generated meaning is display data; it does not replace the learner's existing `meaning`, automatically confirm a meaning conflict, or create a new card.

`src/lib/viewerLocalizedContext.js` provides these bounded helpers:

| Export | Contract |
| --- | --- |
| `absoluteSourceSpan(rawText, span)` | Validates `{start,end,unit:'utf16'}`; optional zero-based `lineIndex` maps offsets within that raw line to document offsets. Preserves CRLF/LF/CR and rejects out-of-line ranges and split surrogate pairs. |
| `exactSourceQuote(rawText, span, expectedSurface?)` | Returns the literal raw slice or `null`; no whitespace removal, NFC conversion, lemma reconstruction, or first-occurrence search. |
| `viewerSourceIdentity(scope)` | In-memory source identity includes material, target language, raw revision, offsets, and literal quote. UI/explanation locale is excluded. This does not replace deployed `source_key` or card IDs. |
| `withLocalizedExplanation(record, explanation)` | Returns a copy with optional versioned `localizedExplanations`; all original card/token fields remain unchanged. Requires a canonical locale, source revision, explanation version, and string explanation fields. Unknown future envelope versions cannot be overwritten. |
| `readLocalizedExplanation(record, options)` | Reads only the requested locale at the supplied current source revision and optional explanation version. Legacy `meaning` is read only as `ko`; it is never relabeled as Chinese. Invalid/stale/future metadata returns `null`. |

Optional metadata example (a pure JSON contract, not an already-deployed DB column):

```json
{
  "meaning": "learner's original meaning",
  "localizedExplanations": {
    "version": 1,
    "sourceRevision": "raw-source-r1",
    "byLocale": {
      "zh-CN": {"explanationVersion": "reviewed-v1", "meaning": "学校"},
      "zh-TW": {"explanationVersion": "reviewed-v1", "meaning": "學校"}
    }
  }
}
```

Replacing the source revision invalidates previous generated locale entries. It preserves the original `meaning` and all other record fields. The caller owns creation of a trustworthy source revision; a UI locale or token ID is not a source revision. A raw Korean token span denotes the written eojeol, e.g. `갔어요`; its analyzed lemma `가다` must remain separate. New readers accept legacy records without this envelope. The helper performs no persistence and grants no Korean save capability.

## Existing save/check paths and DB blockers

1. `POST /api/learning/vocabulary` authenticates via `requireUser`, calls `resolveSave` in `src/lib/server/learningContext.js`, then calls `save_vocabulary_context(p_word jsonb,p_source jsonb,p_confirm_id uuid,p_confirm_meaning text)`.
2. `resolveSave` validates against `LEARNING_LANGUAGES` in `src/lib/learningSources.js`, currently four languages. It verifies material ownership/public visibility. The reading path resolves a token or checks the selected quote against raw text; the note candidate path additionally checks private ownership, candidate review state, meaning, and language.
3. `supabase/migrations/20260905065205_textbook_material_contexts.sql` defines the same four-language RPC allowlist and `vocabulary_contexts.lang` CHECK. Thus allowing `Korean` in the client or route alone cannot enable the committed DB contract.
4. That RPC looks up `user_id + word_text`, then a unique target-language/base-form match. New inserts use `ON CONFLICT(user_id,word_text) DO NOTHING`; an existing different-language card produces `vocabulary_language_conflict`. Multiple base matches produce `vocabulary_ambiguous_match`. Different meanings require exact existing ID/meaning confirmation. The RPC does not update existing card meaning, source, or SRS fields. Preserve these guards rather than substituting a locale as identity or automatically confirming a translated meaning.
5. `source_key` is `md5((p_source - 'translation')::text)`. Only top-level `translation` is excluded. Putting UI/explanation locale or generated localized text into `locator` or another `p_source` field changes context identity and produces duplicate contexts. Do not pass the optional explanation envelope into the existing RPC source payload. Raw revision and source offsets are source identity, but adding them to existing legacy contexts requires an explicit compatibility policy; do not rewrite historical rows.
6. Existing context return uses `GET /api/learning/vocabulary?contextId=<uuid>&materialId=<id>`, scoped to user and readable material; per-card listing uses `?id=<vocabulary-id>`. Context deletion is scoped to user. Preserve those access checks and keep private source quotes out of URLs.
7. Known-word storage is not a fully verified Korean path. `user_known_words.lang` originally checks a two-letter code, so its table alone can admit `ko`; `knownWordControl.KNOWN_LANGUAGES`, exclusion allowlists, and `docs/sql/known-word-controls.sql` synchronization/restore mappings cover only `ja/zh/en/fr`. A successful isolated `ko` insert does not prove exclusion or review consistency. Korean known/review actions remain blocked.
8. Adjacent DB limits: `20260908060607_source_passage_study.sql` has four-language passage RPC/trigger checks; `vocabulary_exclusions` candidate SQL is four languages plus `Unknown`; `morpheme_dictionary` and `content_sources` checks are four languages after their language-extension migrations. Korean course/textbook support is a separate unsupported capability. Do not expand every subsystem merely to display Korean raw text.

The repository does not include the original `user_vocabulary` table DDL. Its live language constraints, unique indexes, triggers, grants, and deployed RPC body must be inspected; do not invent a runtime schema conclusion from client code. The migration evidence establishes blockers in the committed contract, not whether every migration is deployed.

## Required deployed-contract checks

An authorized DB operator should capture these read-only catalog results for the specific deployment before considering a non-destructive Korean extension. This audit did not run them:

```sql
SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions',
  'reading_materials','morpheme_dictionary','content_sources');

SELECT tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('user_vocabulary','vocabulary_contexts');

SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer,
 pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('save_vocabulary_context','viewer_replace_analysis','sync_known_word_review_exclusion',
  'guard_known_word_review_exclusion','lock_vocabulary_exclusion_owner');

SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN
 ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','reading_materials');

SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN
 ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','reading_materials');
```

Also inspect authenticated grants and RPC execution privileges. Use the actual authenticated application path, not a service-role-only success, to verify ownership and RLS. Capture a protected before/after snapshot of representative existing card IDs, user meanings, schedules, sources, contexts, and review events; do not publish private row contents. A proposed SQL extension must only relax necessary checks/add optional data, preserve existing uniqueness/conflict rules and RLS, and have a reviewed rollback that does not delete newly created Korean data.

An isolated verification matrix should cover new Korean save; same-source duplicate save; changed UI/explanation locale; existing edited meaning; same spelling across languages; multiple legacy base matches; private material owned by another account; repeated source words; old/new JSON; old-client RPC calls; known/exclusion restore; and review schedule/event preservation. Record the deployed function signature/body and exact app commit alongside results. Enable capabilities only after this matrix passes; never store Korean under `Chinese` to bypass checks.

## Old writing notes and relocation audit

Legacy `direction='write'` materials contain the user's writing and declare the foreign target language they intend to translate into. That metadata is not proof that the raw Korean writing is a Korean learning material. Preserve `direction`, `raw_text`, original target language, note document, owner, origin, and import/revision keys. `isStudyNote` checks the structured `metadata.studyNote.version` independently. Neither Hangul detection nor a UI locale change may automatically reclassify/reanalyze these records or move them into Korean vocabulary saving.

Two concrete existing issues were reproduced read-only with synthetic data:

| Priority | Reproduction | Observed result / implication |
| --- | --- | --- |
| P1 | Two identical `眼前有海。` sentences; originally saved second occurrence; a reanalysis reuses the saved ID for the first occurrence. `readingSourceTarget(json,{locator:{tokenId:'new_0_0',surface:'眼前'},quote:'眼前有海。'})`. | Returns `new_0_0`. The exact-ID fast path accepts reused IDs inside any matching quote range, despite the quote being repeated. Without trusted revision+offsets, duplicate quote ranges should remain unresolved. |
| P2 | Raw `Hello,  world!`; tokens `Hello`, `,`, `world`, `!`; language `English`; `tokenContext(json,wordId)`. | Returns `Hello , world !`. Punctuation gains spaces and the original double space is lost. EN/FR token reconstruction cannot produce an exact raw quote; JA/ZH concatenation likewise loses any original whitespace not represented in tokens. |

No existing source resolver, RPC, or historical quote was modified by this task. A source offset is reliable only with the matching raw revision and literal surface; an offset alone must not silently recover a changed source. For legacy relocation with ambiguous repeated quotes, keep the source document accessible and decline to assert an occurrence. Existing token IDs and normalized surface matching remain compatibility hints, not proof of the original occurrence.

## Verification performed

`npx vitest run src/lib/__tests__/viewerLocalizedContext.test.js`: **1 file, 8 tests passed**. Coverage includes literal whitespace/punctuation/decomposed text, CRLF/LF/CR mapping, repeated occurrences, invalid units/ranges/surrogate boundaries, locale separation, protected card fields, stale revision/version rejection, and forward-version protection. No existing tests were edited; full-suite/Preview/runtime DB verification belongs to integration and has not been claimed here.

## Implemented explanation request/cache improvement

The separately expanded M07 allowlist includes `useGrammarDetail.js`, `useEasierText.js`, and the new `viewerExplanationRequests.test.js`. These previously allowed pending responses to repopulate a reset panel or overwrite a newer sentence/material/locale; their cache keys also truncated text at 200 characters.

Both hooks now accept optional `explanationLocale='ko'` and `scope=''`. Integration supplies the full account/material/raw-revision scope. Reset, unmount, and material/locale/scope changes cancel their shared request gate; responses additionally check request and scope ownership before applying state or cache. A 30-second deadline clears loading and aborts the request. A stale success, error, or `finally` cannot affect a newer request.

Actual cache keys use existing `viewerCacheKey` SHA-256 over the full text and target/locale/scope/prompt-version tuple. Legacy pure cache helper functions remain unchanged and supply only the namespace prefix. Old truncated cache entries are not read because their full-text/account identity cannot be proven. Cache failure remains optional; no learning records are changed.

Existing target languages with `ko` retain their grammar prompt/parser and easier-text behavior. Korean grammar uses the registered structured explanation module, including for `ko`, to avoid legacy English-axis fallback. Follow-up answers request the selected explanation language, and source/explanation/question are serialized as untrusted study data. Easier text stays in the same target language; locale affects headings rather than translating the paraphrase into Chinese.

New request tests: **24 passed**, covering reset/unmount, ignored aborts, out-of-order completion, stale failure/finally, account/material/locale changes, follow-ups, exact cache reuse, shared 200-character prefixes, unsupported inputs, and deadlines. Combined focused run with the source-contract and structured-explanation modules: **3 files, 60 tests passed**. Focused ESLint passed. An existing ViewerPage source-string assertion in `grammarDetail.test.js` failed during concurrent root integration (the expected legacy `callGemini(buildContextPrompt(...),request.signal)` expression had changed); M07 did not edit the existing test or root-owned file and reported the issue to M00.

## Implemented Korean reanalysis preservation

The final expanded allowlist adds `reanalysisPreservation.js`, `useReanalyze.js`, and new `viewerKoreanReanalysis.test.js`. The old final `{...result,metadata}` replaced generated metadata with the original metadata, losing Korean explanation locale and engine/version/quality provenance. The new merge preserves original source/book/import metadata, retains fresh generated `targetLanguage`, `explanationLocale`, `analysisVersion`, `analysisEngine`, `analysisQuality`, and forces a fresh commit `viewerRevision`/timestamp.

Only explicitly invoked Korean reanalysis receives the optional hook `explanationLocale`. Rendering/changing that prop alone calls no analysis or mutation. A no-analysis remap retains the original stored explanation locale, so display-only locale choices cannot relabel old meanings.

Preserved manual meanings retain their old token `meaningLocale`/`explanationLocale`, falling back to old material locale or legacy `ko`. They are not relabeled as the new generated Chinese meaning. Generated morphology from another locale is omitted or replaced with existing same-locale morphology. Root reads token meaning locale before material locale when choosing a display overlay.

After selective merge and identity/correction preservation, Korean offsets are rebuilt from the final raw text and dictionary, including CRLF, repeated words, whitespace, decomposed characters, and moved lines. Every quote must equal the raw slice; the full token stream must reconstruct the raw source exactly. Whitespace changes and split surrogate pairs fail before the material replacement RPC. Client spans explicitly carry global `start/end`, `lineIndex`, and relative `lineStart/lineEnd`. `absoluteSourceSpan`/`exactSourceQuote` now recognize and validate that explicit dual representation; existing per-line span behavior remains unchanged.

The committed `viewer_replace_analysis` RPC has ownership, exact initial-snapshot conflict, commit-revision, and source-run lease guards, with no target-language allowlist in its function body. This is distinct from the four-language vocabulary RPC. Live reading-material constraints/triggers, RLS/grants, and the deployed function remain unverified; source-passage material triggers/RPCs still explicitly restrict Korean. No successful production Korean material write is claimed.

Focused Korean verification: **11 new tests passed**; combined with existing reanalysis and source helper tests, **3 files / 27 tests passed**. ESLint passed for the changed reanalysis/hook/helper files and new test. Tests cover provenance precedence, unchanged protected snapshots, correction locale/morphology, exact moved/selectively merged spans, CRLF/NFD, whitespace and surrogate rejection, no-analysis locale preservation, unknown locale rejection, hook prop-only inactivity, and explicit Korean-only locale forwarding.
