# VOA Learning English 1차 반입 — 26편 검증 기록 (EN-SOURCE-001 ⓒ · 2026-11-09 KST)

마이그레이션 `supabase/migrations/20261112040000_voa_learning_english_import.sql` · 복원 `docs/sql/voa-import-20261109-rollback.sql` ·
계약 `supabase/tests/voa-learning-english-import.mjs`(PGlite 16 checks) · 생성기 `scripts/voa-seed.mjs`(단위 `scripts/voa-seed.test.js` 6).

## 병합 선행 조건

**출처 줄 표시 코드(`metadata.source` kind `web` · 호스트 허용 목록)가 운영에 먼저 들어간 뒤에만 병합한다.**
VOA 사용 조건이 「with credit」이라 공개 노출과 출처 표시가 동시 조건이다(오케스트레이터 04:47 KST). 표시는 화면 변화라
Design 목업 → 오너 승인 → WEB 구현 순서다. 지금 `attributionParts`는 kind `youtube`만 그리므로, 이 데이터가 먼저 들어가면
출처 줄 없이 공개된다.

## 데이터 모양 (표시 코드가 읽을 칸)

`processed_json.metadata.source`:

```json
{ "kind": "web", "site": "voa_le", "channel": "VOA Learning English",
  "url": "https://learningenglish.voanews.com/a/<slug>/<id>.html", "license": "public-domain",
  "section": "Everyday Grammar", "credit": "John Russell wrote this story for Learning English. Caty Weaver was the editor.",
  "feed_date": "2025-03-06" }
```

- 링크 호스트 허용 목록 = `learningenglish.voanews.com`(https만), 다른 호스트면 링크를 그리지 않는다(기존 문학 출처 줄과 같은 원칙).
- `feed_date`는 피드에 실린 날이다. 옛 글이 다시 실린 경우가 있어 첫 게재일이 아닐 수 있다(예: 3702382 · 3714862). 화면에 날짜를 쓴다면 이 점을 고려한다.
- 시리즈 이름 `writing`(Academic Writing 두 편)은 `SERIES_LABEL_KO`에 없어 영어로 보인다 — 표시 PR에서 「작문」을 더하면 된다(M5 원칙).

## 고른 글 · 뺀 글

- 권리: VOA는 미국 정부 저작물로 퍼블릭 도메인이다. 단 AP · Reuters · AFP 기사(와 그 각색)는 아니다. 26편 전부 원문 기자 줄을 확인했다 —
  VOA 직원이 쓴 글(「… wrote this story/lesson for VOA Learning English」) 또는 VOA 자체 글의 각색(Nancy Steinbach · Marilyn Rice Christiano · Jerilyn Watson 원고),
  Chicken Little은 「adapted … from stories in the public domain」. 통신사 표시는 Mary Kay · Philadelphia의 **사진 설명**(AP Photo)에만 있고 사진은 반입하지 않는다.
- **승인 27편 중 1편을 뺐다**: 「WHO Launches New Cancer Drug Plan for Children」 — 기자 줄 「Robin Millard reported on this story for Agence France-Presse.
  John Russell adapted it for VOA Learning English.」 AFP 기사 각색이라 퍼블릭 도메인이 아니다(1차 선별 때 놓친 것 — 반입 전 기자 줄 전수 대조에서 찾았다).
- 뺀 글(하드리밋 ② 제3자 저작물 인용): 가사 · 영화 대사 · 시를 인용한 문법 글(#5 · #10 · #18 · #21), Academic Writing Part Three · Four,
  Golden Gate · Rappaccini · Kitchen-Table · Mars · Blue Hotel(오케스트레이터 04:42 KST 판정).
- 정치 · 국제 서술 글 없음(③④). Lincoln's Cottage · Philadelphia는 역사 · 건축 소개.

## 권리 거름 — 기자 줄 (재반입 · 추가분 공통)

- 원문 끝 기자 줄을 `source.credit`에 그대로 남긴다. 생성기(`voaCreditIsOwn`)와 마이그레이션 사전 검사가 같은 규칙으로 거른다:
  기자 줄에 작성 · 보도 · 각색 동사(wrote · reported · adapted)가 없거나, 통신사(Associated Press · Reuters · Agence France · 대문자 AP · AFP)가 나오거나,
  주소가 `learningenglish.voanews.com` https 글 주소가 아니면 생성기는 그 편을 빼고(이유 기록), 마이그레이션은 한 편이라도 있으면 하나도 넣지 않고 멈춘다.
- 이 규칙으로 승인 27편을 돌리면 WHO 글 1편이 `agency-credit`로 빠진다(실측).

## 본문 정리 (원문 표현은 고치지 않았다)

- 기사 본문 문단만, 문단 = 줄(705줄). 뺀 것: 사진 설명 · 「Words in This Story」 낱말 풀이 · 맺음 인사 · 기자 줄 · 주소 ·
  영상 자리 표시 「No media source currently available」(27곳) · 그림 출처 줄 1곳 · 폭 없는 공백(U+200B) · 겹친 공백.
- 운영 영어 토크나이저(`tokenizeEnLine`)로 705줄 모두 「토큰 이음 = 원문」(공백 제외) — 완료 판정(completeAnalysis)이 걸리지 않는다. 토큰 17,957개.
- 급수: Flesch-Kincaid 학년 7.5 미만 = A2 초급(18편), 이상 = B1 중급(8편). Academic Writing 두 편은 B1 시리즈로 묶었다.

## 경로 · 비용

- 기존 공개 시드와 같은 길(20261107040000 선례): 시드 작업(kind starter) 주인 소유 · 공개 · idle · direction read →
  작업 `material_ids` 끝(132 + 26 = 158 ≤ 200) → 작업이 done이면 running으로(20261106230000 선례, 진행 칸 그대로) →
  하루 한 번 예약 실행(02:45 KST)이 분석 → 뜻 채움(material_fill_empty_meanings) → 난이도(metadata.difficulty). 은퇴 표식 없음.
- 분석 비용 추정: 기존 starter 132편(22.5k자)이 입력 31만 · 출력 15만 토큰(대부분 Haiku)이었다. 이번 26편은 약 86k자로 약 3.8배 —
  입력 약 120만 · 출력 약 60만 토큰. 사용자 하루 분석 상한에 닿으면 실패로 세지 않고 다음 날 이어서 한다.

## 사후 확인 (병합 · db push 뒤)

1. `voa_le` 26행 · 시드 주인 · public · idle, 작업 1 running · material_ids 158.
2. 다음 02:45 KST 실행 뒤: completed 수 · 토큰 이음 · 빈 뜻 · difficulty 채움 · 실행 줄 오류 0.
3. 학습 계약 지문 넷 그대로(마이그레이션 사후 검사가 같은 트랜잭션에서 확인).

## 26편

| # | 제목(데이터) | 급수 | FK | 낱말 | VOA 분류 | 피드 날짜 | 원문 |
|---|---|---|---|---|---|---|---|
| 1 | [A2] 'Watching the Grass Grow' Is Not Fun | A2 초급 | 4.4 | 283 | Words and Their Stories | 2025-03-15 | [링크](https://learningenglish.voanews.com/a/watching-the-grass-grow-is-not-fun/8003108.html) |
| 2 | [A2] Adverb and Adjective Choices in Conversation | A2 초급 | 6.9 | 711 | Everyday Grammar | 2025-03-06 | [링크](https://learningenglish.voanews.com/a/adverbs-and-adjectives/3702382.html) |
| 3 | [A2] Chicken Little | A2 초급 | 6.5 | 1037 | American Stories | 2024-12-13 | [링크](https://learningenglish.voanews.com/a/american-stories-chicken-little/6947104.html) |
| 4 | [A2] Grammar for Making New Year’s Resolutions | A2 초급 | 7.1 | 735 | Everyday Grammar | 2024-12-26 | [링크](https://learningenglish.voanews.com/a/grammar-for-making-new-year-s-resolutions/5226829.html) |
| 5 | [A2] Grammar Games at Home: Jeopardy | A2 초급 | 6.5 | 564 | Everyday Grammar | 2025-03-20 | [링크](https://learningenglish.voanews.com/a/grammar-games-at-home-part-1-jeopardy/5345471.html) |
| 6 | [A2] Green Means Spring and Other Things | A2 초급 | 6.5 | 480 | Words and Their Stories | 2025-03-08 | [링크](https://learningenglish.voanews.com/a/words-and-their-stories-green-idioim-expressions-garden-jealousy/2688277.html) |
| 7 | [A2] How to 'Dish Up' Something Good | A2 초급 | 4.7 | 369 | Words and Their Stories | 2025-03-01 | [링크](https://learningenglish.voanews.com/a/how-to-dish-up-something-good/7980848.html) |
| 8 | [A2] Knee Jerk and Gut Reactions: When We Are Not in Control | A2 초급 | 6.3 | 419 | Words and Their Stories | 2025-01-18 | [링크](https://learningenglish.voanews.com/a/knee-jerk-when-you-are-not-in-control-/7937763.html) |
| 9 | [A2] Learn Prefixes, Suffixes to Expand Your Vocabulary | A2 초급 | 7.1 | 496 | Education | 2025-02-25 | [링크](https://learningenglish.voanews.com/a/learn-prefixes-and-suffixes-to-expand-your-vocabulary/4140658.html) |
| 10 | [A2] Lincoln's Cottage: a Country House for the President | A2 초급 | 6.6 | 365 | All About America | 2025-03-16 | [링크](https://learningenglish.voanews.com/a/lincoln-s-cottage-a-country-house-for-the-president-/7990415.html) |
| 11 | [A2] Mary Kay: A Leader in the Beauty Product Industry | A2 초급 | 7 | 445 | Arts & Culture | 2025-02-18 | [링크](https://learningenglish.voanews.com/a/mary-kay-a-leader-in-the-beauty-product-industry/7972740.html) |
| 12 | [A2] Questions, Answers about Holiday Activities | A2 초급 | 7.5 | 565 | Everyday Grammar | 2025-01-02 | [링크](https://learningenglish.voanews.com/a/questions-answers-about-holiday-activities/6904240.html) |
| 13 | [A2] Reviewing Your Birthday Message | A2 초급 | 4.9 | 616 | Everyday Grammar | 2025-02-27 | [링크](https://learningenglish.voanews.com/a/reviewing-your-birthday-message/6724744.html) |
| 14 | [A2] Skyscrapers, Made in America | A2 초급 | 6.9 | 481 | All About America | 2025-03-03 | [링크](https://learningenglish.voanews.com/a/skyscrapers-made-in-america-/7988815.html) |
| 15 | [A2] Sometimes We 'Spread Ourself Too Thin' | A2 초급 | 4.3 | 342 | Words and Their Stories | 2025-01-25 | [링크](https://learningenglish.voanews.com/a/sometimes-we-spread-ourself-too-thin-/7940837.html) |
| 16 | [A2] Teachers Use Games for More Enjoyable Learning | A2 초급 | 6.9 | 656 | Education | 2025-02-11 | [링크](https://learningenglish.voanews.com/a/teachers-use-games-for-more-enjoyable-learning/6474764.html) |
| 17 | [A2] The Importance of Being ‘Dialed In’ | A2 초급 | 6.3 | 349 | Words and Their Stories | 2025-02-22 | [링크](https://learningenglish.voanews.com/a/the-importance-of-being-dialed-in-/7979814.html) |
| 18 | [A2] Wilbur and Orville Wright: The First Airplane | A2 초급 | 5.9 | 435 | Science & Technology | 2025-03-17 | [링크](https://learningenglish.voanews.com/a/wilbur-and-orville-wright-the-first-airplane/7998765.html) |
| 19 | [B1 writing #1] Academic Writing: Common Sentence Patterns, Part One | B1 중급 | 9.5 | 726 | Everyday Grammar | 2025-01-23 | [링크](https://learningenglish.voanews.com/a/everyday-grammar-common-patterns/3988378.html) |
| 20 | [B1 writing #2] Academic Writing: Common Sentence Patterns, Part Two | B1 중급 | 9.3 | 685 | Everyday Grammar | 2025-01-30 | [링크](https://learningenglish.voanews.com/a/academic-writing-common-patterns-part-two-everyday-grammar/3997498.html) |
| 21 | [B1] Common Adverbs in Conversation: Amplifiers, Downtoners | B1 중급 | 8.3 | 908 | Everyday Grammar | 2025-03-13 | [링크](https://learningenglish.voanews.com/a/amplifiers-downtoners/3714862.html) |
| 22 | [B1] Grow Your Vocabulary by Learning Root Words | B1 중급 | 8.2 | 661 | Education | 2025-03-04 | [링크](https://learningenglish.voanews.com/a/grow-your-vocabulary-by-learning-root-words/4113426.html) |
| 23 | [B1] Improve Your Pronunciation By 'Shadowing' Others | B1 중급 | 9.9 | 807 | Education | 2024-11-26 | [링크](https://learningenglish.voanews.com/a/improve-your-english-pronunciation-shadowing-others/3339007.html) |
| 24 | [B1] Learning How to Ask Questions | B1 중급 | 10.8 | 560 | Education | 2024-12-10 | [링크](https://learningenglish.voanews.com/a/education-tips-improve-critical-thinking-ask-questions/3303557.html) |
| 25 | [B1] Philadelphia: a City Famous for its History | B1 중급 | 9.6 | 379 | All About America | 2025-03-09 | [링크](https://learningenglish.voanews.com/a/philadelphia-a-city-famous-for-its-history-/7983180.html) |
| 26 | [B1] Start New Year by Setting Reasonable Learning Goals | B1 중급 | 8.4 | 867 | Education | 2024-12-31 | [링크](https://learningenglish.voanews.com/a/start-the-new-year-by-setting-reasonable-learning-goals-/3637982.html) |

합계 낱말 14,941
