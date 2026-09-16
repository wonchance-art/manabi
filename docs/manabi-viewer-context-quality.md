# Viewer context quality and source return

Status: source-return implementation verified in draft #1296; contextual external Japanese lookup remains on hold. Parent implementation: #1294, `c96610faf0357617fd7c4d9d08ac39eec2ec7b30`. Claude subsequently merged #1293/#1294 and preserved this PR's base tree; this branch is not rebased or force-pushed.

## Implemented scope

- Reading context links use an authenticated `sourceContext` UUID instead of putting a private quote into a URL. Existing token/text links continue to work.
- The context API scopes reads to the current user, requires the requested material to match, and checks current owner/public access again. It returns private, no-store responses.
- A saved token is accepted only when its surface and saved sentence still agree. If token IDs were regenerated, one unique match within the saved sentence may recover the position. Missing or ambiguous matches show an explanation instead of picking the first occurrence.
- A late lookup cannot override an intentional click or key action. Source navigation also takes precedence over ordinary scroll restore and original-composer routing.
- Review shows one primary saved sentence with one source link. Additional contexts stay collapsed; opening a source leaves the ungraded review card in its original tab.
- The existing displayed-meaning save and FSRS operations are retained. A context-attachment meaning conflict now has a specific message rather than being described as a connection failure.
- Japanese references distinguish the existing dictionary from an AI lookup. Explicit sense-level POS conflicts and contradictory `diff` metadata are withheld pending confirmation. This is consistency screening, not semantic validation.
- Glyph-table loading is retryable. A viewer-local correction preserves the current Japanese shared glyphs 出, 表, 家 instead of expanding them into the Chinese variants 齣, 錶, 傢. The generated shared table is unchanged. This remains character conversion, not word translation.

## Outstanding approval and accuracy work

The automatic approval reviewer rejected the proposed addition of a private source sentence to the existing Gemini lookup payload because authorization for that external transmission was not established. The user has been asked specifically about sending the selected sentence, word, meaning and POS only on explicit lookup. No sentence field or new contextual transmission was added. Existing word/meaning/glyph lookup behavior is unchanged.

Pending that decision: contextual request identity/cache, explicit sentence recheck, uncertainty versus transport failure, and a completed accuracy audit of contextual results. None should be described as delivered by this change.

## Read-only baseline audit

Forty initial multi-character samples were inspected locally across an older and newer Chinese analysis (20 each). Twenty-three had a dictionary Japanese form attached to the exact displayed Korean meaning, while seventeen did not. Presence does not establish correctness. The sample is an initial baseline, not a representative accuracy score or a completed 40-case acceptance audit.

Findings included incorrect Japanese readings, a cross-language false friend, and ambiguous reverse glyph mappings. Existing Korean meanings, readings and personal records were not bulk corrected. Private source sentences and the full audit JSON remain outside the repository and must not be uploaded with this PR. Public tests use small synthetic source sentences and fake accounts.

Reference checks:

- [文化庁 常用漢字表](https://www.bunka.go.jp/kokugo_nihongo/pdf/jouyoukanjihyou_h22.pdf): current Japanese glyph forms.
- [漢字ペディア 眼](https://www.kanjipedia.jp/kanji/0001160300) and [話す](https://www.kanjipedia.jp/kotoba/0007408400): Japanese reading checks.
- [小学館 dictionaries: 斯文](https://kotobank.jp/word/%E6%96%AF%E6%96%87-523296) and [台湾教育部: 斯文](https://dict.concised.moe.edu.tw/dictView.jsp?ID=38558&la=0&powerMode=1): same glyphs can denote different senses.
- [小学館 dictionaries: 目光](https://kotobank.jp/word/%E7%9B%AE%E5%85%89-396495): reading and lexical nuance check.

## Verification

- New source resolver and route tests cover repeated words, regenerated IDs, mismatched quotes, multi-token ranges, private URL behavior, current-user filtering, revoked access, malformed requests and database errors.
- New browser suite `e2e/viewer-context-return.e2e.mjs`: ten checks passed on the local application with synthetic API fixtures. It covers exact/ambiguous/unavailable sources, retry, request races, 320/390/768/1440px layout, save payload and review → source return without grading.
- Existing delayed-scroll-restore browser regression passed.
- Desktop review and mobile inspector screenshots were inspected. Physical iOS Safari remains untested.
- Application commit `5c4d4aee1d05c478357bf2494ead3b2303e5dd01`: clean CI [34331883477](https://github.com/wonchance-art/manabi/actions/runs/34331883477) succeeded, including lint, content gates, full unit tests, production build and existing browser suites. Final focused tests: 57 passed.
- The first local full-test attempt exhausted temporary disk. After removing this worktree's generated build cache, the full run found one obsolete source-contract assertion; updating that assertion to the POS-aware call passed focused verification and the clean CI above.
- The first Vercel build failed with `out_of_memory`; local production compilation also hit the default 2 GB Node heap ceiling, followed by filesystem cache `ENOSPC` with a larger heap. Production filesystem cache was replaced with memory cache and the isolated Webpack build worker was explicitly retained, following [Next.js memory guidance](https://nextjs.org/docs/app/guides/memory-usage#disable-webpack-cache). Development caching is unchanged. With a 4 GB local heap, compilation and all 473 pages completed. This is a build resource mitigation, not proof that cache was the sole cause of the original Vercel failure.
- Build-setting commit `7a71c919c7c90f9555807ce89f98b74e0735aa2f`: [CI 34355199703](https://github.com/wonchance-art/manabi/actions/runs/34355199703) succeeded. Vercel `dpl_HyikD5MFpLWvxZCAzRYMHqwB9LJE` is READY; compilation completed in 3.8 minutes, the complete build in approximately 5 minutes. Immutable preview: https://manabi-aq6jlzoxx-wonchance-arts-projects.vercel.app/viewer/211 . `/api/version` matches the exact runtime commit.
- The same ten browser checks passed against the deployed production bundle, with no page errors. Desktop review and 390px inspector screenshots were inspected. All fixture writes were intercepted; no personal vocabulary, review schedule or material was changed. The real unauthenticated context endpoint returned 401 with `private, no-store`.
- Connecting to the existing user browser timed out twice. Therefore this release does not claim a new authenticated real-account or physical iOS Safari check. Existing real-material inspection from the baseline audit is separate from these fixture interaction tests.
- Fixed preview promotion is limited to `manabi-web-v2-preview.vercel.app`. Production baseline at verification: `b42d863564b1c9d5448b99cde29bd2cfcf010bea` / `dpl_6FQQEJJqnRCoEEu4aUGHe21ecDW3`; this task does not promote production.

## Follow-up boundary

Claude's #1296 review requested the following for this or the next viewer iteration: resume analysis missing-index merge, offline queued undo locking, convergence on `persistVocabGrade`, obsolete localStorage keys, and unused viewer-sheet CSS. These are tracked as the next reliability iteration rather than mixed into source-return validation. Contextual Japanese lookup still requires the separate external-transmission decision above.

No schema, RLS, auth configuration, PDF layout, new audio, production promotion, merge or force push is part of this change.
