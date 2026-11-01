# CARD-TYPES-001 — 단어 하나에 카드 셋 (단어 → 뜻 · 뜻 → 단어 · 듣기)

> 상태: **설계 (오너 방향 승인 2026-11-01 KST)** — 구현 전 이 문서와 실렌더 시안으로 합의한다.
> 시안: 실렌더 https://claude.ai/artifact/3nb9HadDqJMoy2PBHUreeA (실제 부품 · 실제 CSS) · 규칙 시안 https://claude.ai/artifact/2Y2T1DNaRx6Udc9tosxVi2 ④ · ④-2 · ⑤ · ⑥.
> 오너 결정: 카드 셋 · 예문은 따로 두지 않고 답 면에 · 듣기는 예문 기준 · 형제 카드 하루 한 장(Anki) · 종류 켜고 끄기 · 종류 글씨 없음 ·
> 보기 탭은 없앤다(A안, 2026-11-01 KST 「A안 권장대로」) · 덱별 옵션은 보류(언어별 하루 새 단어만 백로그).

## 1. 순환에서의 자리 (제품 나침반 3문)

1. **정거장**: 복습(FSRS) — 자료 읽기 순환의 「단어 저장 → FSRS 복습 → 본문 귀환」과 /study 순환이 공유하는 일정 하나에 카드 종류를 더한다.
2. **재사용**: 일정 엔진(`fsrsScheduler` · `fsrs_apply_operation`) · 하루 몫(입장 정책) · 연산 기록(`fsrs_operations`) · 복습실 줄 · 단어 페이지 줄을 그대로 쓴다.
   새 엔진 · 새 기록 표를 만들지 않는다. 카드의 정체(card_id)만 「단어」에서 「단어 × 종류」로 넓힌다.
3. **이음새**: 채점은 지금처럼 카드 단위 연산 하나 → `review_events` · 활동 기록이 그대로 이어진다. 연습 탭(문장 · 뜻 · 소리)의
   `review_events` 기록은 지우지 않고 역사로 남긴다(읽기만).

## 2. 카드 세 종류

| 종류 (내부 이름) | 문제 면 | 답 면 | 생기는 조건 |
|---|---|---|---|
| 단어 → 뜻 (`recognition`) — 지금 카드 | 표제어(후리가나 없음) | 읽기 · 뜻 · 한자 풀이 · 예문(후리가나) · 해석 | 단어를 담으면(지금과 같음) |
| 뜻 → 단어 (`production`) | 뜻(한국어) — 표제어와 같은 크기 규칙 | 표제어 · 읽기 · 한자 풀이 · 예문 · 해석 | 단어 → 뜻이 날 단위로 넘어간 **다음 학습일** |
| 듣기 (`listening`) | 소리 단추만(글자 없음) | 예문(후리가나) · 해석 · 표제어 줄 | 뜻 → 단어가 생긴 **다음 학습일** · 예문이 있을 때만 |

- 종류 글씨는 어디에도 붙이지 않는다 — 문제 면(단어 · 뜻 · 소리)만으로 구분된다(오너).
- 문제 면 글자 크기는 언어와 무관한 한 규칙(지금 `lw-card__hw` · `lw-one__hw`): 글자 수 기준, 로마자는 반 칸. 줄 높이 고정 · 세로 가운데.
- 아래 네 칸 위 글자(안내 줄)는 문제 면과 같다: 뜻 → 단어는 뜻, 듣기는 소리 아이콘(답을 흘리지 않게).

## 3. 일정 규칙

- **카드마다 기억 상태가 따로**다(안정도 · 난이도 · 기한). 기한만 복제하면 「단어 → 뜻이 쉬움」이 다른 방향에 옮겨가 간격이 틀린다.
- **형제 카드 하루 한 장** (Anki 「bury siblings」): 같은 단어의 카드는 학습일(04:00 KST) 하나에 한 장만 묻는다.
  - 한 장을 채점하면 그날 나머지 형제는 다음 학습일로 미룬다(기한을 바꾸지 않고 **줄에서만 뺀다** — 파생 규칙, 새 표 없음).
  - 같은 날 둘 이상이 차례면 **더 오래 밀린 것**(기한이 이른 것) 하나, 같으면 단어 → 뜻 · 뜻 → 단어 · 듣기 순.
  - 학습 단계(분 단위) 카드는 그날 끝까지 이어 푼다(1분 · 10분 단계를 끊지 않음) — 미루는 대상은 **그날 처음 꺼낼 형제**뿐이다.
- **차례로 붙이기**: 새 단어는 단어 → 뜻 하나로 시작 → 날 단위로 넘어간 다음 학습일에 뜻 → 단어 → 그다음 학습일에 듣기.
  Anki는 새 카드를 한꺼번에 만들고 형제만 미룬다 — 우리는 처음 며칠 부담을 더 줄인다.
- **하루 새 단어 몫**: 단어 → 뜻(새 단어 도입)만 센다. 뒤따르는 두 종류의 도입은 몫을 쓰지 않는다 — 하루 도입 수는 전날 날 단위로
  넘어간 단어 수 이하이고 형제 규칙이 하루 한 장으로 묶으므로 따로 셀 이유가 없다. (Anki는 모든 새 카드를 센다 — 부분 채택)
- **하루 복습량**: 단어 하나에 하루 한 장 → 하루 채점 수 ≤ 차례가 된 단어 수(지금과 같은 상한). 예: 복습 차례 단어 50개 → 최대 50장.
- **미리 학습(LEARN-AHEAD-001)** 과 함께 동작한다: 할 카드가 없을 때 20분 안 학습 단계 카드를 앞당긴다 — 종류와 무관.
- **켜고 끄기** (학습 옵션 시트 「카드」 줄 · 계정 설정 — 복습실과 같은 값):
  - 단어 → 뜻은 늘 켜짐(다른 카드가 붙는 기준).
  - 끄면 그 종류는 새로 붙지 않고, 있는 카드는 **쉰다**(오늘 줄 · 몫 · 통계에서 빠짐, 기억 상태 보존). 다시 켜면 남은 간격 그대로.
  - 기본값: 뜻 → 단어 켬 · 듣기 켬.

## 4. 데이터 모델

지금: `fsrs_cards.card_id` = `user_vocabulary.id`(PK · FK), `fsrs_operations` · `fsrs_new_receipts`가 card_id로 참조, DB 함수 14개가
「card_id = 단어 id」를 전제한다(2026-11-01 KST 카탈로그 조회 — `fsrs_apply_operation` · `next_question_at` · 스냅샷 4종 · 등록 · 가드 등).

| 안 | 내용 | 판단 |
|---|---|---|
| A. card_id 독립 + `vocabulary_id` · `kind` 열 | 카드 정체는 card_id 그대로. 기존 행은 `vocabulary_id = card_id` · `kind = 'recognition'`으로 채움. 새 종류는 새 uuid. 단어 FK는 `vocabulary_id`로 옮김. 연산 · 영수증 FK는 card_id 그대로 | **채택** — 연산 · 영수증 · 채점 경로가 그대로이고 바뀌는 것은 「단어 ↔ 카드」를 잇는 함수(스냅샷 · 등록 · 가드)뿐 |
| B. (card_id, kind) 복합 키 | 모든 FK · 연산 기록 · 클라이언트 키가 둘로 | 배제 — 연산 · 영수증 · 보낼함 키 전부가 바뀜 |
| C. 별도 표(variant) + 별도 연산 | 엔진 · 기록 중복 | 배제 — 정본 중복(나침반 ⑵) |

- 제약: `UNIQUE (user_id, vocabulary_id, kind)` · `kind IN ('recognition','production','listening')` · `vocabulary_id` FK(지금 card_id FK와 같은 ON DELETE).
- 설정: 계정별 `card_kinds`(켜진 종류 집합) — 입장 정책 행에 열 하나(새 표 없음). 하루 새 단어 수와 같은 configure 경로.
- 마이그레이션은 단계로 나누고 각 단계가 **동작 무변경 → 검증 → 다음**이다(지문 재게시 · 복원 SQL · PGlite 관측 재생 — 20261101030000 틀).

### 4.1 단계 1 결정 (2026-11-01 KST · `supabase/migrations/20261101090000_fsrs_cards_kind.sql`)

| 항목 | 단계 1 | 이유 · 단계 2 |
|---|---|---|
| `vocabulary_id` 채우기 | `uuid NOT NULL GENERATED ALWAYS AS (card_id) STORED` | 등록 경로(`fsrs_apply_operation`의 `INSERT … (card_id,user_id,card)`)가 열을 몰라도 값이 정해진다 → 함수 본문 무변경(지문 재게시 최소). 숨은 BEFORE INSERT 트리거가 아니라 표 정의에 보이는 규칙이고, 트리거를 더하면 admission 추적 트리거 · 입장 무결성 검사(그 표의 사용자 트리거 = `learning_guard_enrollment` 하나)까지 건드린다. 채우기는 표 재작성 때 계산(UPDATE 없음 → 행 트리거 안 돎). 단계 2: `ALTER COLUMN vocabulary_id DROP EXPRESSION`(재작성 없음) + 등록 경로가 명시해 쓴다 |
| `kind` | `text NOT NULL DEFAULT 'recognition'` · CHECK 세 값(영구) | 단계 2 등록 경로가 종류를 명시 |
| 단어 → 뜻 = 단어 id | CHECK `kind <> 'recognition' OR vocabulary_id = card_id`(영구) | 연산 · 영수증 · 옛 입장 기록 · 화면 키가 「카드 id = 단어 id」로 이어진 것이 단어 → 뜻 카드에서는 영원히 맞는다 → 단계 2가 바꿀 곳이 종류 카드 경로로 줄어든다 |
| 다른 종류 막기 | CHECK `kind = 'recognition'`(`fsrs_cards_kind_stage1_check`, 단계 1 전용) | 등록 경로 없이 생긴 종류 행이 단어 id 자리(card_id)를 차지하는 것을 막는다. 단계 2가 종류 카드를 만드는 마이그레이션에서 지운다 |
| 옛 FK `card_id → user_vocabulary(id)` | **유지** | 모든 행이 여전히 만족하고(카드 = 단어 → 뜻뿐), 지우면 「카드 id = 단어 id」 보장이 생성 열 하나에만 남는다. 단계 2(종류 카드 = 새 uuid)에서 생성식 걷기와 함께 지운다 |
| 새 FK · 고유 · 인덱스 | `vocabulary_id → user_vocabulary(id) ON DELETE RESTRICT`(옛 FK와 같은 동작) · `UNIQUE (user_id, vocabulary_id, kind)` · 인덱스 `(vocabulary_id)` | 인덱스: 단어 삭제 때 FK 검사가 `vocabulary_id = $1`로 찾는다(PK는 card_id라 못 씀) |
| 지문 | core(public.fsrs_* 열 · 제약 · 인덱스) · admission(fsrs_cards 트리거 — FK가 내부 RI 트리거 둘을 단다) 재게시. manual · activity profile · 한국어 capability 그대로 | PGlite: 복원 뒤 네 게시값이 적용 전 값으로 정확히 돌아온다 |

### 4.2 단계 2 인벤토리 — 「카드 id = 단어 id」를 전제하는 곳 (단계 1 PGlite 사슬의 실제 본문에서 읽음)

`fsrs_cards`를 언급하는 DB 함수 14개(운영 카탈로그 2026-11-01 KST와 같은 목록). 「지금」은 단어 ↔ 카드를 잇는 식, 「단계 2」는 종류 카드가 생긴 뒤 바꿀 것.

| 함수 | 지금 | 단계 2 |
|---|---|---|
| `public.fsrs_apply_operation` | `op.cardId`를 단어 id로 씀: `user_vocabulary WHERE id=cid` · `fsrs_cards WHERE card_id=cid` · 등록 `INSERT (card_id,user_id,card)` · `blocked(p_actor,cid)` · 등록 가능 검사 `review_events.detail.word_id=cid` · 채점 이벤트 `detail.word_id=cid` · `item_key=v.word_text` · 하루 새 단어 영수증 `fsrs_new_receipts(card_id)` | 카드를 먼저 읽고 단어는 `f.vocabulary_id`로 · 종류 카드 등록(`vocabulary_id` · `kind` 명시, 날 단위 졸업 다음 학습일 조건) · `blocked(p_actor, vocabulary_id)` · 이벤트 `word_id = vocabulary_id`(+ 종류) · 하루 몫은 `kind='recognition'` 첫 질문만 센다 |
| `public.fsrs_apply_learning_operation` | `fsrs_cards WHERE card_id=cid`가 New이고 영수증이 없으면 입장 몫 · 허가 | 몫 · 허가는 `kind='recognition'`만(§3 하루 새 단어 몫) |
| `public.fsrs_legacy_boundary` | `fsrs_cards f JOIN user_vocabulary v ON v.id=f.card_id` · `f.card_id=p_card_id` | `v.id=f.vocabulary_id` · `f.vocabulary_id=p_card_id`(부르는 쪽은 단어 id) |
| `public.fsrs_list_states` | 카드 전부 · `cardId=f.card_id` · `blocked(p_actor,f.card_id)` · 영수증 `r.card_id=f.card_id` | 항목에 `vocabularyId` · `kind` · `blocked(p_actor,f.vocabulary_id)` · 쉬는 종류(켜고 끄기) 표시 |
| `fsrs_private.admission_contract_hash_live` | `public.fsrs_cards` 트리거 · 규칙 추적(잇기 없음) | 본문 그대로 — 그 표 트리거 · FK를 바꾸면 admission 재게시(단계 1과 같음) |
| `fsrs_private.guard_legacy_event` | `fsrs_cards f JOIN user_vocabulary v ON v.id=f.card_id` · `detail.word_id=f.card_id` | `v.id=f.vocabulary_id` · `word_id=f.vocabulary_id` |
| `fsrs_private.guard_legacy_vocabulary` | `fsrs_cards f WHERE f.card_id=OLD.id` | `f.vocabulary_id=OLD.id`(단어 → 뜻이 늘 있어 지금 식도 맞지만, 인덱스 · 의미상 권장) |
| `fsrs_private.next_question_at` | 카드 단위(`fsrs_cards.card_id` · `fsrs_operations.card_id`) | 본문 그대로 — 부르는 쪽이 단어 id(`v.id`)가 아니라 카드 id를 넘기게(스냅샷 셋) |
| `fsrs_private.vocabulary_registry_entry` | `user_vocabulary.id=p_card_id` · `fsrs_cards.card_id=p_card_id` · 영수증 · `blocked` · `next_question_at` 모두 같은 id | 단어 항목 = `vocabulary_id=v.id AND kind='recognition'` · 종류 카드는 따로(항목 배열 또는 종류별 칸) |
| `public.fsrs_read_state` | `user_vocabulary.id=p_card_id` · `fsrs_cards.card_id=p_card_id` · 연산 `card_id` | 입력 = 카드 id → 단어는 `f.vocabulary_id`(지금 식이면 종류 카드에서 `word_not_available`) · `blocked(p_actor, vocabulary_id)` |
| `public.fsrs_vocabulary_snapshot` | 일관성 검사 `f LEFT JOIN v ON v.id=f.card_id` 둘 · 줄 `LEFT JOIN fsrs_cards f ON f.card_id=v.id` · `next_question_at(p_actor,v.id)` · 영수증 `r.card_id=x.id` · `cardId=v.id` | **꼭** — `vocabulary_id`로만 이으면 단어 줄이 종류 수만큼 늘어난다: 단어 줄은 `f.vocabulary_id=v.id AND f.kind='recognition'`, 종류 카드는 별도 목록 · 검사는 `f.vocabulary_id` · `next_question_at(p_actor,f.card_id)` · 영수증 `f.card_id` |
| `public.fsrs_vocabulary_snapshot_cards` | 같은 WITH(스냅샷과 바이트 단위 같음) + `v.id=ANY(p_ids)` | 스냅샷과 같이(입력 id는 단어 id 유지) |
| `public.fsrs_vocabulary_snapshot_light` | 같은 WITH + 언어 · 요약 · 기본 항목 생략 | 스냅샷과 같이 |
| `public.learning_admit_legacy` | `fsrs_cards WHERE card_id=cid` → `learning_card_enrolled` | `vocabulary_id=cid`(단어의 카드 하나라도 있으면 등록됨 — 옛 입장은 단어 단위) |

`fsrs_cards`를 이름으로 부르지 않지만 같은 전제를 쓰는 곳: `fsrs_private.guard_learning_enrollment`(BEFORE INSERT — `legacy_admissions.card_id=NEW.card_id`: 종류 카드는 검사 대상 아님) ·
`fsrs_private.admission_status` · `guard_learning_first_question`(하루 몫 = `fsrs_new_receipts` 행 수 → 종류 카드 첫 질문은 영수증을 쓰지 않거나 종류로 걸러야 몫이 단어 → 뜻만 센다) ·
`fsrs_private.blocked(actor, id)`(제외는 단어 단위 — 부르는 쪽이 `vocabulary_id`를 넘긴다) · `public.fsrs_save_manual_vocabulary`(새 단어 = 단어 → 뜻 등록 `cardId = 단어 id` — 그대로) ·
`fsrs_read_operation` · `record_fsrs_activity` · `append_activity`(카드 단위 — 그대로).

클라이언트(JS)에서 「registry/카드 `cardId` = 단어 `id`」를 전제하는 곳(단어 → 뜻 카드에는 계속 맞는다 — 종류 카드는 `vocabularyId` · `kind`로 단어를 찾게):

| 파일 | 전제 |
|---|---|
| `src/lib/vocabularyLearningRead.js` | `registry.cardId !== vocabulary.id` · `attempt.cardId !== vocabulary.id`면 실패 |
| `src/lib/server/fsrsVocabulary.js` | 스냅샷 검사 `entry.cardId !== row.id` · `attempt.cardId !== row.id` · id 묶음 거르기 `wanted.has(entry.cardId)` · 저장 영수증 `row.id === request.cardId` |
| `src/lib/fsrsLearningClient.js` | `state.cardId === body.vocabularyId` · `vocabularyId === payload.cardId` |
| `src/lib/levelFsrsGrade.js` | 채점 요청 `cardId: row.id`(단어 줄) |
| `src/lib/useFsrsReview.js` | `visibleWord(cardId)` = `word.id === cardId` · 줄 항목 `id: entry.cardId` · 등록 `cardId: row.id` |
| `src/lib/levelWordStatus.js` | 기본 항목 `{ cardId: row.id }` |
| `src/lib/vocabularyLearningRows.js` · `vocabularyDueIndex.js` · `vocabularySnapshotLight.js` | registry를 `cardId`(= 단어 id) 열쇠로 · 단어당 기본 항목 하나 |
| `src/lib/reviewScope.js` · `reviewRoomFirstScreen.js` | `cardId: p.vocabulary.id` · 카드 id 집합으로 단어 판정(`canLegacy`) |
| `src/lib/fsrsLegacyBoundary.js` · `inlineGradeUndo.js` · `reviewEvents.js` · `learn/progressStore.js` · `fsrs.js` | 옛 경계 `cardId` = 단어 id(`detail.word_id`) — 단어 단위라 그대로 |
| `src/lib/learningAdmission.js` · `useLearningAdmission.js` | 입장 `cardId` = 단어 id(단어 → 뜻만 — 그대로) |
| `src/views/VocabPage.jsx` | `admission.current.cardId === candidateWord.id` · `vocab.find(v => v.id === cardId)` · 줄 단계 `id = cardId` |
| `src/views/LevelListPage.jsx` | 새 단어 저장 `cardId: newId()`(새 단어 = 새 단어 → 뜻 카드 id = 단어 id — 그대로) |

### 4.3 단계 2 결정 (2026-11-01 KST · `supabase/migrations/20261101120000_fsrs_card_kinds.sql` · 복원 `docs/sql/fsrs-card-kinds-rollback.sql`)

**동작 무변경(화면 3단계 전까지)**: 켜진 종류의 기본값이 단어 → 뜻 하나라 종류 카드가 하나도 생기지 않는다(등록 함수가 거절). 사후 검사가
단어 · 카드가 있는 사용자 전원의 단어장 셋(snapshot · cards · light) · 입장 상태(덧붙인 `cardKinds` 제외) · 카드 목록(덧붙인 세 칸 제외)을 비교한다
(PGlite: `post-observation-migrations.mjs` · `fsrs-card-kinds.mjs` ②).

**3단계 스위치 = `fsrs_private.admission_settings.default_card_kinds` 한 값** (지금 `'{recognition}'`). 화면(3 · 4단계)이 생긴 뒤 마이그레이션 한 줄
`UPDATE fsrs_private.admission_settings SET default_card_kinds = '{recognition,production,listening}'`(설계 §3 기본값: 뜻 → 단어 켬 · 듣기 켬)로 켠다 —
데이터라 지문(core · admission)이 움직이지 않는다. 계정이 고른 값(`admission_policies.card_kinds`, NULL = 기본값)이 있으면 그것을 쓴다.
JS에는 기본값이 없다 — 입장 상태에 `cardKinds`가 없으면 단어 → 뜻 하나로 본다(`fsrsCardKinds.admissionCardKinds` — 「모르면 지금처럼」).

| 항목 | 단계 2 | 이유 |
|---|---|---|
| `fsrs_cards.vocabulary_id` | `ALTER COLUMN … DROP EXPRESSION`(값 그대로 · 재작성 없음) · NOT NULL · 기본값 없음 → 등록 경로가 `INSERT (card_id,user_id,card,vocabulary_id,kind)`로 명시 | 종류 카드의 card_id = 새 uuid. 빠뜨린 INSERT는 23502로 멈춘다 |
| 지운 제약 | `fsrs_cards_kind_stage1_check` · 옛 `fsrs_cards_card_id_fkey` | 남는 것: 단어 FK(`vocabulary_id`, RESTRICT) · UNIQUE (user_id, vocabulary_id, kind) · 단어 → 뜻 = 단어 id CHECK(영구) · 세 값 CHECK |
| 설정 저장 | `admission_policies.card_kinds text[]`(NULL = 기본값) · `admission_settings.default_card_kinds text[] NOT NULL DEFAULT '{recognition}'` · 둘 다 CHECK 네 집합(단어 → 뜻 늘 포함 · 정해진 순서) | 새 표 없음(§4 「입장 정책 행에 열 하나」) · 계정 값과 전체 기본값을 나눠야 기본값을 바꿀 때 고른 계정을 덮지 않는다 |
| 설정 경로 | `learning_configure_admission`의 선택 칸 `cardKinds`(하루 새 단어 수와 같은 요청 · 같은 판본 +1 · 생략하면 그대로) · `admission_status.cardKinds` · JS `normalizeAdmissionRequest`(순서 정리) · 영수증 검증 | 같은 경로 하나(§4) — 시트의 「하루」 · 「카드」 줄이 같은 판본으로 경합을 막는다 |
| 종류 카드 등록 | `enroll` 연산의 `cardKind`('production' · 'listening') · `vocabularyId`(그 단어) · 듣기는 `hasExample: true` · 새 함수 `fsrs_private.variant_enrollment_open` | 조건: ① 그 종류가 켜짐 ② 새 카드 id가 단어 id가 아님(자리 차지 금지) ③ 그 종류 카드가 없고 오늘(04:00 KST 학습일 — `admission_day`) 붙인 종류 카드가 없음(단어당 하루 한 장) ④ 단어 → 뜻이 Review이고 마지막 채점이 앞 학습일(= 날 단위로 넘어간 다음 학습일 이후 · 오늘 채점했으면 형제 규칙과 같이 다음 날) ⑤ 듣기: 뜻 → 단어가 앞 학습일에 생긴 뒤 — 뜻 → 단어가 꺼져 있고 없으면 단어 → 뜻 바로 뒤 |
| 듣기의 예문 | 서버는 모른다 → 등록 요청이 `hasExample: true`를 주장해야 한다(없거나 false면 거절) | 레벨 단어의 예문은 정적 콘텐츠(`e.ex`)라 DB에 없다. 3단계 화면이 예문 유무로 보낸다 |
| 하루 새 단어 몫 | 종류 카드의 첫 질문은 영수증(`fsrs_new_receipts`)을 남기지 않고 입장 허가도 받지 않는다 → 몫 = 단어 → 뜻 첫 질문만(§3) · `firstQuestionAt`은 늘 null | 몫 계산(`admission_status` · `guard_learning_first_question`)을 바꾸지 않고 몫에서 빠진다 |
| 쉬는 종류 | 꺼진 종류의 카드는 남고(기억 상태 보존) 묻기만 거절(`fsrs_card_kind_excluded` → JS `fsrs_card_excluded`) · `fsrs_list_states` · `fsrs_read_state`에 `resting` | 다시 켜면 남은 간격 그대로(§3) |
| 채점 이벤트 | `detail.word_id` = 단어 id(지금과 같은 값) · 종류 카드만 `card_id` · `card_kind` 덧붙임(되돌리기 이벤트도) | 단어 → 뜻 이벤트 모양은 그대로 · 통계(5단계)가 종류를 가른다 |
| 단어 ↔ 카드 | 스냅샷 셋 · `vocabulary_registry_entry` = 그 단어의 단어 → 뜻 카드(`vocabulary_id = v.id AND kind = 'recognition'`, 단어당 한 줄) · `next_question_at`에 카드 id · `fsrs_read_state`(입력 = 카드 id → 단어 = `vocabulary_id`) · `fsrs_list_states`(+ `vocabularyId` · `kind` · `resting`, 제외 = 단어 단위) · `fsrs_legacy_boundary` · `learning_admit_legacy`(단어 단위) | 종류 카드는 카드 목록(복습실 상태 읽기)에만 있다. 3단계 단어 페이지가 단어장 읽기에서 종류 카드가 필요하면 그때 덧붙임 칸을 정한다 |
| 그대로 둔 것 | 옛 경계 트리거 둘(`guard_legacy_event` · `guard_legacy_vocabulary`) · `next_question_at` · 입장 무결성 · 지문 함수 | 두 트리거 함수는 한국어 capability 지문 안이라 바꾸면 운영 한국어 학습이 꺼진다(PGlite 재현 — #1504 선례). 지금 식(`f.card_id` = 단어 id)도 같은 답이다: 종류 카드는 단어 → 뜻 카드가 있는 단어에만 생기고(④) 단어 → 뜻 카드 id = 단어 id(영구 CHECK) |
| 응답 모양 | DB 응답(반영 · 상태 · 목록)에 `vocabularyId` · `kind` 덧붙임 · 서버 JS `publicState`는 **종류 카드에만** `kind` · `vocabularyId` · `resting`을 싣는다 | 단어 → 뜻 카드 항목 · HTTP 응답은 지금 모양 그대로 |
| 지문 | core · manual(registry entry · snapshot) · admission 재게시(_live) · activity profile · 한국어 capability 그대로 | PGlite 지역값: core 0cd85b7b… → e23833d8… · manual 459a51a0… → cb6354bb… · admission e3e1eff6… → e8cec0ac… · profile 47c4c72c… 그대로(운영 값은 OID가 달라 다르다) |
| 복원 | 종류 카드 · 고른 종류가 없을 때만(잃는 정보 없음) — 12개 본문 옛 원문 · 새 함수 · 열 지우기 · 단계 1 CHECK · 옛 FK · `vocabulary_id`를 지우고 생성 열로 다시(재작성) | PostgreSQL은 보통 열을 생성 열로 바꾸지 못한다. 모양 · 본문 · 출력 · manual · profile은 정확히 돌아오고 core · admission 값은 열 번호가 바뀌어 다르다(일치는 그대로). 단계 1 복원이 이어서 돈다 |

바꾼 함수 12개 · 새 함수 2개(본문 md5 — 단계 1 뒤 PGlite 재생 사슬 → 이 파일. 운영 `fsrs_apply_operation` 9bf0c861…은 사슬과 같다):

| 함수 | md5 |
|---|---|
| `public.fsrs_apply_operation(uuid,jsonb)` | 9bf0c8612988174843d69731a953390c → 58997c6ff7c3a20ed32a47a4ab3da50f |
| `public.fsrs_apply_learning_operation(uuid,jsonb)` | b30fcf098af0fb53e71b67b5529ae569 → c2f2e2e187263ef39a531541a941c60a |
| `public.fsrs_read_state(uuid,uuid)` | 413224503b1a27dfc537b73ca7b2779e → 8f961a9e2e47bf027601b1b21188c9df |
| `public.fsrs_list_states(uuid)` | 988a10d4324bc2b9fafc08322f4a3a2d → 8eb21a27465c303e872e7ff1c9bdaea5 |
| `fsrs_private.vocabulary_registry_entry(uuid,uuid)` | 771d6c4f3ecc170b6ae0eb685771ce4e → 965f8d73cad6f2c38c939fb56fbc36b7 |
| `public.fsrs_vocabulary_snapshot(uuid)` | 90cb5fb52d43d00eeb4b5c5a41ba8b19 → 32647a452dc4c8a8c5449ab6a93c4eb9 |
| `public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])` | 40cea98a04cf45be087f024b6b4aea67 → d33e1c2c65571c80bc4109fc0c5f0dae |
| `public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)` | 3093ad73ed356efd792114f5aab27985 → 32401c0c1e32163215c7edbbf692c7ba |
| `public.fsrs_legacy_boundary(uuid,text,text)` | 3e907c04af571ac9f4c9554a277bed48 → c84cf97ea0e8ea3b3bd7819778dd5cdd |
| `public.learning_admit_legacy(uuid,jsonb)` | 65e769b7f890cd88f04dc53ae0616c8c → bcb673e08e0726d36d4392c0ca8c8b99 |
| `fsrs_private.admission_status(uuid,timestamptz)` | fc34a8acb06246ddbaf6ec7ffd0df5d4 → 20f1ca38a4c7bcd5d45344b7325cf5a0 |
| `public.learning_configure_admission(uuid,jsonb)` | e49594d272b7336ab1a0047bcb0136ca → 88ef7531f27fdcaf67daa6262608bee9 |
| `fsrs_private.card_kinds(uuid)` (새) | 277fe504e9fd1de2aabf0cbad9c40b14 |
| `fsrs_private.variant_enrollment_open(uuid,uuid,uuid,text,boolean,timestamptz)` (새) | 791c633fb91a9d7c61f34da96fe6fef2 |

공유 JS(화면 없음 — `src/lib/fsrsCardKinds.js`): `cardKindOf` · `cardVocabularyId`(칸이 없으면 단어 → 뜻 · 카드 id = 단어 id) · `normalizeCardKinds` ·
`admissionCardKinds` · `fsrsTakesNewQuota`(몫 = 단어 → 뜻 첫 질문만) · `pickSiblings`(형제 규칙 — 오늘 채점한 카드는 이어 풀고, 같은 단어의 다른 카드를
오늘 채점했으면 그날 처음 꺼낼 카드는 다음 학습일로, 아니면 기한이 이른 것 · 같으면 단어 → 뜻 · 뜻 → 단어 · 듣기 — 파생 규칙: 카드의 `lastReview` 학습일) ·
`nextVariantKind`(등록 조건의 거울). 복습실 줄(`useFsrsReview`)이 `fsrsTakesNewQuota` · `pickSiblings`를 거친다 — 단어마다 카드가 한 장이면 줄 그대로(계약 테스트).
이 화면은 아직 단어 → 뜻만 그리므로 보이는 카드 = 카드 id가 단어 id인 카드(`visibleWord(cardId)`) — 종류 카드는 4단계 화면 전까지 줄에 서지 않는다.
단어 페이지(`levelWordSession`)는 단어장 읽기(단어당 단어 → 뜻 한 줄)를 쓰므로 단계 2에서 바꾸지 않는다(3단계). 서버 JS: `parseFsrsRequest` ·
보낼함 `normalizeFsrsRequest`가 등록의 종류 칸을 받고, 종류 카드 등록은 아직 없는 카드 id라 상태 읽기의 「단어 없음」을 없는 카드로 본다 · 한 번 채점의
첫 문제 몫 판정 = `fsrsTakesNewQuota`.

## 5. 화면

- **보기 탭(단어 · 문장 · 뜻 · 소리 · 전체) 없앰** (A안): 카드 종류가 연습 탭을 흡수한다. 카드가 55px 위에서 시작.
  - 「전체 훑어보기」 입구 → 끝 화면 단추(지금 `switchView('all')` 대신).
  - 네 영역 줄(`AreaRow` 단어 · 문장 · 뜻 · 소리)은 카드 셋의 기억률로 다시 짠다(단어 → 뜻 · 뜻 → 단어 · 듣기).
  - 연습 탭 전용 부품(`PracticeIntro` · 연습 줄)은 쓰는 곳이 없어지면 지운다(죽은 CSS 계약).
- **학습 옵션 시트**: 「하루」 아래 「카드」 줄 — 세 칸 다중 선택 · 단어 → 뜻 잠금 · 아래 회색 한 줄.
- **리스트**: 행마다 문제 면만(단어 / 뜻 / 소리 단추) · 높이 · 시작선 같음 · 종류 글씨 없음.
- **복습실(/vocab)**: 같은 줄 규칙(형제 · 차례로 붙이기 · 켜고 끄기)을 공유 줄 짜기(`reviewQueue`)에 넣어 두 화면이 같은 카드를 낸다.

## 6. 통계 영향 (통계 세션 STATS-MAP-001과 함께 정할 것)

- 「카드 = 단어」 가정이 깨진다: 카드 수 · 기억률 표(TRUE-RET-001) · 복습 대기 · 하루 학습량.
- 권장: 화면의 큰 숫자는 **단어 단위**(단어 하나에 카드 몇 장이든 하나), 기억률 표는 **카드 종류별 줄**을 더한다(단어 → 뜻 / 뜻 → 단어 / 듣기).
- 통계 세션에 2026-11-01 14:03 KST 공유함.

## 7. 단계 (각 단계 = PR 하나 · 운영 검수 뒤 다음)

1. **스키마 1단계** — `vocabulary_id`(생성 열 = card_id) · `kind` 열 · 제약 추가 · 옛 card_id FK 유지 · 함수 본문 무변경(§4.1). 동작 무변경(스냅샷 · 목록 출력 동일 검사).
2. **종류 카드 생성 · 형제 규칙 · 켜고 끄기(서버 설정)** — 생성식 걷기(DROP EXPRESSION) · 단계 1 전용 CHECK · 옛 card_id FK 지우기 · 14개 함수의 「단어 ↔ 카드」 잇기를 `vocabulary_id` + `kind`로(§4.2) ·
   뜻 → 단어 · 듣기 등록 경로(날 단위 졸업 다음 학습일) · 줄 짜기 형제 규칙 · configure.
   → 한 결과는 §4.3(`20261101120000_fsrs_card_kinds`): 함수 12개 + 새 2개, 옛 경계 트리거 둘은 capability 지문 때문에 그대로(같은 답) · 기본값 = 단어 → 뜻 하나(꺼짐).
3. **단어 페이지 화면** — 세 문제 면 · 답 면 · 「카드」 줄 · 보기 탭 제거 · 끝 화면 「전체 훑어보기」 · 영역 줄 재구성.
   화면(3 · 4단계)이 다 생긴 뒤 스위치 `fsrs_private.admission_settings.default_card_kinds`를 켠다(§4.3 — 마이그레이션 UPDATE 한 줄).
4. **복습실 화면** — 같은 줄 규칙 · 세 문제 면.
5. **통계** — 단어 단위 · 종류별 기억률(통계 세션과).

## 8. 선례 · 판단

| 선례 | 내용 | 판단 |
|---|---|---|
| Anki 노트 · 카드 모델 (정방향 · 역방향 카드) | 노트 하나에 카드 여럿, 카드마다 일정 | 채택 — 단어 = 노트, 종류 = 카드 |
| Anki bury siblings (새 · 복습 · 학습일 넘는 학습 카드 형제 미루기) | 같은 노트의 형제를 다음 날로 | 채택 — 학습 단계는 그날 이어 풂 |
| Anki 새 카드 일괄 생성 · 몫에 모든 새 카드 계산 | 노트를 만들면 모든 카드가 새 카드 | 부분 채택 — 차례로 붙이고 첫 종류만 몫 계산 |
| Anki 덱별 옵션 | 덱마다 몫 · 단계 | 보류 — 레벨이 덱 역할 · 언어별 하루 새 단어만 백로그 |
| 우리 연습 탭(문장 · 뜻 · 소리) | 일정 밖 연습 · `review_events` 기록 | 흡수 — 카드 종류로 대체, 기록은 보존 |
| 별도 variant 표(안 C) | 엔진 · 기록 복제 | 배제 — 정본 중복 |
| Anki 스케줄러 코드(AGPL) | 형제 · 미리 학습 구현 | 코드 이식 없음 — 동작 규칙만 참고(라이선스 · 우리 FSRS 연산 모델과 결합도) |
