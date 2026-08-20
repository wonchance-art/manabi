# manabi — 아키텍처 & 인수인계

이 문서는 코드만 봐서는 드러나지 않는 **설계 결정·함정·미검증 가설·게이트**를 다음 작업자(사람 또는 AI 세션)에게 넘기기 위한 지도다. "무엇이 있나"는 코드가 말하고, 여기서는 "왜 그렇게 됐고, 건드릴 때 뭘 조심해야 하나"를 말한다.

최종 갱신: 2026-08-20 (4축 전수 조사 + 구조 정리 3종 반영 — §1.1 순환 지도·§4.9-0 최근 지뢰 신설)

---

## 0. 한 문단 요약

manabi(UI명 Anatomy Studio)는 **한국어 화자를 위한 4개 언어(일·영·불·중) 학습 웹앱**이다. 메인은 **공부 모드(/study)** — AI가 매일 생성하는 문단 하나에 새 문법·새 단어·복습이 전부 녹아 있고, 모든 문항이 거기서 파생된다. 정체성은 *"내 복습 항목이 등장인물로 돌아오는, 매일 이어지는 이야기"*(연재 스토리). 나머지(교재·어휘장·자료실·뷰어·듣고읽기)는 조연.

---

## 1. 설계 헌법 (불변 원칙 — 어기기 전에 반드시 재고)

1. **모든 노출은 인출 기회** (retrieval practice), 목표 성공률 ~85% (desirable difficulty).
2. **미지는 한 번에 하나** (cognitive load), 같은 항목은 다른 맥락으로 재등장.
3. **스키마·컬럼 추가 최소** — 상태는 가능한 한 `review_events`에서 유도. 신규 테이블은 최후의 수단.
4. **XP 금지** — 과거 폐기됨(효과 없음). 보상은 스트릭 + 성장 지표(아는 단어·통과 챕터)로만. `award_xp` RPC는 죽은 채 DB에 남아 있다(호출처 0). 절대 재도입 금지.
5. **모든 AI 경로에 결정적 폴백** — AI가 죽어도 세션은 나온다. 문단 생성 실패 → 조립 세션, 자막 실패 → 직접 입력.
6. **미니멀리즘** — 기계장치(rung·EWMA·프리페치·dial)는 화면에 문자열로 새면 안 된다. 같은 정보 두 번 말하지 않기. 내부 용어(due·SRS·토큰·세그먼트) 사용자 노출 금지.
7. **홈(/home)·글로벌 네비 불가침** — 사용자가 직접 배치를 결정한다. 임의 카드 추가 금지.

### 1.1 두 학습 순환 지도 (2026-08-20 4축 전수 조사 — 시각화는 순환도 아티팩트)

앱은 두 순환으로 돈다. 새 기능은 반드시 이 지도 위의 정거장에 꽂혀야 한다(CLAUDE.md '제품 나침반' 3문).

```
[자료 읽기 순환]  콘텐츠 공급(직접·PDF·책·원문 수정=바뀐 줄만) → 자동 분석(줄 토큰·공유 사전)
                → 뷰어(조판·집중·문장 이동·단어 카드: 확대·글자 탐색·유의/반의)
                → 저장(단어장·문법 노트) → FSRS 복습 → **본문 귀환**(due 하이라이트·'내 단어' 칩)
[일일 세션 순환]  서버 조립(/study — due 어휘4·문법2·이벤트400·연재 프리페치 48h)
                → 문항(rung/EWMA 적응) → 채점(review_events) → 산출(작문→연재 재주입)
[연결점]          뷰어 '이 자료로 오늘 학습'(study_source_) · 공유 FSRS/review_events · 정본 챕터([자세히])
[받침]            동기·진단(스트릭·히트맵·예보) · 3단 공유 캐시(형태소 사전·단어 상세·TTS CDN)
```

**이음새 지도** — 끊김에는 두 종류가 있다. 헷갈리면 사고 난다:

| 이음새 | 종류 | 비고 |
|---|---|---|
| 드릴 SRS ↔ 일일 세션 (studyMaterials가 `drill:`·`rt:` 명시 제외) | **의도적** | 소비처는 /review/grammar |
| 산출(작문) → FSRS·챕터 통과 미반영 | **의도적** (v2 헌법 M7) | rung 상단·연재 재주입만 |
| assist 열람 이벤트 → rung 미반영 | **의도적** | 데이터만 적재 |
| 드릴 ↔ 단어장 SRS 무연동 | 부채 | drillSrs는 문법 전용 |
| 챕터 → 자료(뷰어) 역방향 없음 | 부채 | [자세히]는 뷰어→챕터만 |
| 게스트 어휘 복습·이벤트 이력 없음 (드릴 큐만 이관) | 부채 | progressStore no-op |
| 기억 통계 이중 진실 (VocabStats 사제 지수식 vs forecast의 FSRS 곡선) | 부채 | 통일은 표시 수치 변경 — 오너 확인 후 |
| PDF 뷰어 = 자료 뷰어의 이중 구현 | 부채 | 프롬프트 표류는 2026-08-20 수렴 완료, 패널 통합은 기능 동봉 대기 |

---

## 2. 운영 규약 (개발 프로세스)

- **Fable 5 = 기획·설계·오케스트레이션·리뷰 게이트.** 구현은 Opus/Sonnet 서브에이전트에 위임한다. 오너 지시: "Opus·Sonnet이 할 수 있는 건 Fable이 하지 마라."
- **검증 루프 (오너 명시)**: "됐다"고 하기 전에 **실행 증거**(테스트·빌드·grep 결과)를 보여라. 검증 못 한 건 "미검증"이라고 정직하게 말한다. 컨테이너에서 못 하는 것(vercel·supabase·youtube egress 차단) → 프리뷰에서 오너가 첫 검증자.
- **Git**: 단일 브랜치 `claude/french-grammar-vocab-ref-x6me5f`. 커밋 전 `git checkout public/sw.js`(prebuild가 캐시 버전 bump). PR은 draft로 생성 → 오너 "merge" → draft 해제·squash 머지 → main 동기화 → `git checkout -B <branch> origin/main`으로 재시작 → 새 draft. 커밋 메시지에 **제어문자·화살표(→) 금지**(Bash InputValidationError) — 파일(`git commit -F`)로 우회.
- **머지 마이그레이션은 CI 자동 적용 안 됨** (GitHub Secrets 미설정 — workflow가 조용히 skip). 오너가 Supabase SQL Editor에 붙여넣어 실행. **코드에는 테이블/컬럼 부재 시 무해 폴백 필수.**
- **Claude ↔ Codex 직접 인계**는 `docs/ai-relay.md`의 서버 전용 큐를 우선 사용하고 GitHub를 폴백·최종 감사 기록으로 유지한다. Relay가 꺼져도 앱과 기존 GitHub 인계는 정상이어야 한다.
- 커밋/PR/코드에 모델 ID(claude-fable-5 등) 노출 금지.
- **제안·구현 전 3문 체크(오너 승인 2026-08-20, CLAUDE.md '제품 나침반'과 동일)**:
  ⑴ 두 순환(§1.1)의 어느 정거장인가 ⑵ 기존 정본·부품 재사용인가(중복 신설 금지 —
  persistVocabGrade·speechLang·fetchSavedWordSet·buildContextPrompt 선례) ⑶ 이음새를
  새로 만들지 않나(§1.1 이음새 지도 — 의도적 단절을 부채로 오인해 임의로 잇는 것도 금지).

---

## 3. 학습 엔진 핵심 (공부 모드 v2)

- **학습자 상태 = FSRS 기억(user_vocabulary 컬럼) × 숙련 rung(유도값, 컬럼 없음)**. rung은 `review_events`의 최근 이벤트에서 순수 함수로 계산(`skillRung.js`의 `computeRung`·`deriveVocabRungs`). **0~5단계(choice→cloze→typing→listening→produce)**, 2연속 승급/강등. cloze(단서회상=예문 빈칸 채우기)는 인지(선다)와 자유회상(타이핑) 사이의 간극을 메우는 완충 단계다. rung은 이벤트 유도 순수함수라 이 재번호가 저장 상태를 깨지 않는다(전부 재계산). cloze 문항 유형(`vocab-cloze`)은 예문이 있어야 성립하며, 예문 조회는 서버 조립(`buildVocabExampleMap` — 레지스트리 ex → user_vocabulary.source_sentence 순)에서 수행해 payload에 실어 보낸다(§4.1 준수). 예문 부재 시 typing으로 폴백(빈 문항 금지).
- **난이도 다이얼**: 언어별 EWMA 정답률(α=0.15) → easy/normal/hard. easy는 신규 0(주 경로 문단 재료에서도 차단됨 — `gateNewMaterialsByDial`), hard는 신규↑·산출 강제.
- **세션 예산**: 채점 문항 하드캡 10 (워밍업 2 + 문단 파생 ≤7 + 산출 0~1).
- **사이드이펙트는 settle(문항 확정) 시점에 마이크로배치 기록** — 중도 이탈해도 FSRS·이벤트 보존. `pagehide`에서 flush + 스트릭(가드는 종료 이펙트와 분리 — bfcache 안전).
- **결정적 검증** `verifyParagraph` — AI 재검증이 아니라 순수 함수로 cloze 복원문·vocab key 실재·오답 위장(표기/읽기) 제거. `stripInlineReadings`로 `漢字(かな)` 인라인 독음 정화(저장·사용 양쪽).
- **연재**: `deriveArc`가 최근 used 문단의 `arcSummary`·`episode`(jsonb, 스키마 0)를 읽어 다음 화로 이어감(7일 이내·최대 10화·약점 세션 제외).
- **이벤트 규약**: `item_key`(어휘=word_text, 문법=순수 slug), `detail.qtype`(choice/cloze/typing/listening/order/produce/read/**flash**/**assist**/**explain**), `detail.rt_ms`. **플래시는 비대칭 신뢰** — 자기채점 성공은 rung 승급 크레딧 0, 오답 자인만 강등 인정.

---

## 4. 지뢰밭 (건드릴 때 반드시 알아야 할 함정)

### 4.1 클라이언트 번들 — 서버 전용 모듈 유입 (재발 1급 주의)
`src/lib/studyMaterials.js`와 `src/content/refLangs.js`(REF_LANGS)는 **`src/content` 레지스트리(~6.3MB)를 전이 import**한다. 이걸 `'use client'` 컴포넌트에 물리면 교재 전체가 클라 번들에 편입돼 **라우트가 1.8MB로 폭발**한다. #55가 /vocab·/viewer에서 이 함정을 밟았고(웨이브1에서 수정: deriveVocabRungs→skillRung 이전, REF_LANGS→정적 키 상수), **useReadingCompletion 경유의 전이 유입까지 있었다**. 규칙: 클라 컴포넌트·훅에서 studyMaterials/refLangs를 import하지 마라. 언어 목록이 필요하면 `['Japanese','English','French','Chinese']` 로컬 상수(ListenLabPage.jsx 상단 패턴). **새 클라 파일 추가 시 `grep 'content/refLangs\|studyMaterials'` 로 확인.**

### 4.2 회원가입이 개방돼 있다 → "로그인 유저 = 인터넷 아무나"
allowlist 없음(Google + 이메일 가입). 따라서 LLM 호출 라우트는 로그인만으로 뚫리면 비용 노출이다. 웨이브1에서 방어: media/* 라우트 requireAdmin 승격(`src/lib/server/auth.js` 공유 헬퍼), /api/gemini 모델 화이트리스트·입력 캡, analyze·translate 입력 캡, cron fail-closed. **새 LLM 라우트 추가 시 반드시 requireUser/requireAdmin + 입력 크기 캡 + rate limit.** rate limit은 인메모리(서버리스 다중 인스턴스에서 느슨) — 개인용이라 수용, 사용자 늘면 Upstash 등 공유 카운터로.

### 4.3 듣고 읽기(/listen)는 비공식 라이브러리 위에 서 있다 — 언젠가 깨진다
`youtubei.js@17.2.0`(Innertube). YouTube 내부 변경 때 파손 예약됨. 자막 경로는 4단 폴백(get_transcript → WEB → ANDROID → iOS) + **Supadata(step 5, `SUPADATA_API_KEY` 있을 때·무료 100콜/월)** + 직접 입력. get_transcript 400은 데이터센터 IP 지속 차단(업스트림 오픈 버그 #1102) — 근본 해결 불가, Supadata가 실질 주력일 가능성. 파손 시 로그의 `[media/captions] step N` 줄이 단계 진단. **admin 전용 실험이며 배치 안 됨**(오너 결정 — 실사용 후 /learn 타일 배치 판단 대기). 상태는 세대 ref(genRef)로 영상 전환 오염 방지 — 상태 추가 시 reset()·loadVideo 정리 목록에 넣어라.

### 4.4 어휘 저장 규약 이원화 (미완 정합)
- **다수파(사전형/base_form)**: 세션 신규단어, 참조, 수동추가, **listen**.
- **소수파(표면형/surface)**: viewer 3개 저장 경로.
`onConflict('user_id,word_text')`는 규약이 다르면 이중 등록을 못 막는다. 웨이브1에서 listen에 base+surface 존재 확인 방어를 넣었지만, **viewer를 base로 통일하는 근본 수정은 안 함**(범위). viewer 손댈 때 정리 후보. 문맥 퀴즈 마스킹은 base_form 폴백 추가됨(`splitSentenceAroundWord`).

### 4.5 형태소 분할(listen 어절 탭)의 알려진 구멍
kuromoji 상위 품사만 받아 보조동사·접미사 병합이 휴리스틱 의존(`groupTokensToUnits`). 思います·届いたら류는 잡히지만 실사용에서 이상 분할 나오면 케이스별로. `Intl.Segmenter`는 미분석 큐 임시 렌더용(저품질 인지) — 분석 도착하면 어절 단위로 교체.

### 4.6 베이스 스키마가 리포에 없다
`user_vocabulary`·`reading_materials`·`profiles`의 CREATE 마이그레이션이 없다(ALTER만). 빈 DB에 `db push` 재현 불가. 신규 컬럼 참조 시 `ADD COLUMN IF NOT EXISTS` + 코드 방어 폴백 필수.

### 4.7 콘텐츠 어휘는 코드 하드코딩 — 확장 방식과 함정
어휘/문형은 DB가 아니라 `src/content/<lang>/vocab/*.js` 코드가 단일 소스. `index.js`의 `mergeVocab(base, ...adds)`가 `zh`(중국어) 기준 **급 내부** 중복만 제거하고 **급 간 중복은 안 막는다** — 같은 단어가 여러 급에 뜰 수 있으니 소스 큐레이션으로 관리(현재 급간 중복 7건은 손작성 유래·상용어라 방치). 대량 확장 시: ① 어휘 골격(한자·병음·품사)은 **오픈소스에서 그대로**(예: HSK는 drkameleon/complete-hsk-vocabulary MIT), 뜻·예문만 LLM 생성 — 골격을 생성하면 환각. ② 오픈소스의 `exclusive/new`(급별 신규분)는 **다음자에 성씨·부수·희귀 독음만 담기는 파편**이 있다 — 단일 한자 표제어는 상용 독음/뜻으로 반드시 검수(2026-07 HSK 3.0 보강 때 단일 한자 ~65개가 이 함정에 걸려 사후 패치: 뜻/독음 오류 32건 재작성 + 대문자 병음 정규화·성씨 예문 교정). ③ 생성 후 **결정적 검증**(개수·zh·병음 성조부호식·예문에 단어 실재)을 python으로 전수. ④ 급별 `_hsk30.js` 같은 보강 파일로 추가하고 `index.js`의 import + mergeVocab에 등록(기존 파일 무수정). check-content 오류 0 확인.

### 4.8 사전 마스킹('단어만'/'뜻만')의 구조
`ReferenceVocabPage`·`ReferencePatternIndexPage`의 두 배타 토글은 컨테이너(`fr-vrow__body`) 통짜에 `is-hidden`을 걸면 예문까지 숨는다 — 반드시 **개별 요소별로** 가려라(뜻 텍스트·어원·예문뜻은 `fr-vrow__hide-extra`, 발음은 `row-hide-yomi`가 rt/IPA/병음 함께 처리). 단어만=뜻·발음 가리고 단어+예문원문 노출(읽기 연습), 뜻만=단어·예문원문 가리고 뜻+예문뜻 노출(작문 연습). 정답 누출 방지가 핵심.

### 4.9-0 최근 지뢰 3건 (2026-08-20 전수 조사·수리 과정에서 실측)

- **드래그 중 바텀시트 성장 가로채기**: 시트 높이는 비동기 데이터 도착(정본 예문·유의어)으로
  드래그 도중에도 자란다 — 자란 시트가 `elementFromPoint`를 가로채 범위 지정이 목표 토큰에
  못 미쳤다(main 3연속 red). 수리 = 드래그 동안 시트 `pointer-events:none`(#1076). **시트 위
  좌표 상호작용을 만들 때 반드시 이 성장을 전제하라.**
- **테스트 목이 성공 경로를 은폐할 수 있다**: progressStore 테스트의 supabase 목에 `update().eq()`
  체인이 없어 성공 경로가 조용히 throw했고, 반환값을 안 보던 테스트라 수년 통과했다. 반환
  계약(`{ok}`) 도입이 드러냄(#1078). **목은 실제 체인 형태를 재현하고, 결과를 단언하라.**
- **쿼리 다이어트 오판**: "메타만 쓸 것"이라 짐작한 두 곳(자료실 목록·fetchVocab)이 실은 통짜
  실사용(자료별 due 배지 = dictionary 순회 / 단어장 = etym·hanja까지 전 컬럼 소비)이었다.
  정정은 계약 테스트(queryDiet.test.js)로 고정 — **다이어트 전에 소비 필드를 grep으로 실측하라.**

### 4.9 ui 이벤트 규약 (행동 계측 — review_events 재사용, 마이그레이션 0)
예보 탭·푸시 같은 **행동 계측**은 신규 테이블 없이 `review_events`에 `source:'ui'`로 적재한다 (헌법 3 — 신규 테이블 최후의 수단). 형태: `{source:'ui', item_key:'-', correct:true, detail:{qtype, ...}}`. `correct`는 NOT NULL이라 의미 없이 `true`로 채우고, **종류는 `detail.qtype`로 구분**한다(집계는 `detail->>'qtype'` 필터 — `admin_v3_metrics`). qtype 종류: `forecast_tap`(예보 카드 탭), `push_optin`(구독 동의), `push_sent`(발송), `push_open`(알림 클릭). **rung·FSRS 계산은 `source:'vocab'`만 보므로 ui 이벤트와 무간섭**(skillRung/fsrs 필터). **EWMA 다이얼은 필터가 없어 구멍이었다** — studyMaterials의 gradedEvents가 `ui`·`dict`를 제외하고 공급한다(2026-07 정정). 새 source 추가 시 이 세 필터(skillRung·fsrs·gradedEvents)를 모두 점검하라. 저용량(하루 수 건) 전제이며, **월 1만 건을 초과하면 분리 테이블로 승격**한다(레드팀 응답 §7). 적재는 `logReviewEvents`(reviewEvents.js) 재사용, 실패는 조용히 무시.

---

## 5. 관측 & 게이트 (다음 기능의 방아쇠)

계기판 `/admin/metrics`(본인 데이터, DB 변경 없음)가 세 게이트를 실측으로 판정한다:
- **어휘 산출 문항 도입** ← rung 4+ 단어 ≥ 20 (화면에 "현재 N" 표시). ※ 사다리 재번호(cloze 삽입)로 상단이 한 칸 밀렸다 — 구 "rung 3+(listening 이상)"의 취지는 신 "rung 4+(listening 이상)"에 대응. produce는 이제 rung 5.
- **rt_ms → FSRS rating 세분화** ← rt 표본 ≥ 500
- **leech 니모닉** ← 반복 실패(lapse) 단어 발생

이것들은 **설계 초안만 있고 확정 아님** — 게이트 열릴 때 실제 rung/rt 분포를 보고 세부를 정한다. 계기판이 채워지기 전엔 착수 금지(감으로 만들지 말 것).

---

## 6. 미검증 가설 (경험적으로 입증 안 됨 — "설계됨"이지 "증명됨"이 아니다)

- D1/D7 재인률이 실제로 좋은가 (워밍업 이벤트를 source='vocab'로 정정해 표본이 생기게 함 — 아직 관측 전)
- 연재가 실제 재방문을 만드는가
- 세션이 정말 6~8분인가
- 온보딩이 신규 사용자에게 서는가
- **영·불·중은 일본어만큼 두들겨지지 않았다** (집중 검증은 ja만)

→ 이 앱의 다음 완성도는 코드가 아니라 **실사용 데이터**에서 나온다.

---

## 7. 열린 항목 (우선순위 순)

**당신(오너) 결정 대기**
- /study·/listen 등의 홈·네비 최종 배치 (현재 /learn 허브 + 네비 "학습"으로 1차 배치됨, /listen은 admin만)
- 전체 유저 지표 집계 여부(is_admin SELECT 정책 마이그레이션 필요 — 현재 본인만)

**관측 후 (게이트)**: §5의 3종.

**선택**: 죽은 award_xp RPC 정리 SQL, 웹푸시 리마인더, viewer 표면형→base 통일, listen 배치, 에러 모니터링·비용 알림(타인에게 열 때).

**전략 (냉정한 평가, 별도 문서 `evaluation-and-strategy.md` 참고)**: 범용 언어앱 정면승부는 승산 낮음. **"한국인을 위한 일본어 읽기 앱"으로 전선을 좁히고**, 품질 일관성(불량 문항률 0 수렴)과 리텐션 증명이 성장 투자보다 먼저.

---

## 8. 실행해야 할 SQL (미적용 시 조용히 기능 비활성)

`docs/deployment-checklist.md`에 목록 유지. 이번 웨이브: `20260701_grammar_review`, `20260702_writing_studio`, `20260703_study_paragraphs`, `20260703_streak_freeze_earn`. 신규 env: `SUPADATA_API_KEY`(자막 폴백), `CRON_SECRET`(cron 인증).
