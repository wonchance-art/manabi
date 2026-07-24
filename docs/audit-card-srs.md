# manabi G1 — 어휘/문법 SRS 카드 체계 품질 감사

**감사 대상**: 현행 SRS 아키텍처 vs Anki 공개 개념 모델  
**범위**: report-only · draft PR 준비  
**기한**: #150 코멘트 기반 (오너: Anki 기반 재정의 검토)

---

## 1. 현행 실측: 데이터 모델

### 1.1 어휘 학습 (vocabulary SRS)

| 축 | 구현 | 코드 위치 |
|---|---|---|
| **저장소** | `user_vocabulary` 테이블 (Supabase) | — |
| **단위** | 단어 행 1개 = 1장의 "카드" | src/lib/vocabStudy.js:13 `isNewWord = !last_reviewed_at` |
| **SRS 필드** | `interval`, `ease_factor`, `repetitions`, `next_review_at` | src/lib/fsrs.js:37-40 (DB→ts-fsrs 변환) |
| **상태 추적** | `last_reviewed_at` (NULL = 신규) | src/lib/studySession.js:249~287 (warmup 콜드스타트) |
| **스케줄러** | FSRS v5 (ts-fsrs 라이브러리) | src/lib/fsrs.js 전체; SM-2 구 구현 src/lib/srs.js (폐기됨) |
| **복습 판정** | `next_review_at ≤ now` 인 행 조회 | src/lib/vocabIO.js:28 (due 쿼리) |
| **카드 파생** | **없음** — 단어당 정확히 1행 | — |

**추가 맥락:**
- 신규 어휘 일일 제한: `DEFAULT_NEW_PER_DAY = 15` (사용자 설정 가능) → src/lib/vocabStudy.js:6
- 비로그인 학습자: localStorage `vocab_new_intro` (날짜별 신규 단어 ID 세트 추적)
- 세션 큐: due 어휘 최대 3개 (→ buildVocabItems src/lib/studySession.js:84)

### 1.2 문법 학습 (grammar SRS)

| 축 | 구현 | 코드 위치 |
|---|---|---|
| **저장소** | `grammar_review` 테이블 | src/lib/grammarSrs.js 전체 |
| **단위** | 챕터 행 1개 = 1장의 "카드" (chapterslugging) | src/lib/grammarSrs.js:22~32 (initialQueueRow) |
| **SRS 필드** | `interval`, `ease_factor`, `repetitions`, `next_review_at` | 동일 컬럼 규약 (src/lib/fsrs.js 주석 4~5) |
| **상태 추적** | `last_reviewed_at` (신규 = interval 0) | src/lib/grammarSrs.js:29~31 |
| **스케줄러** | 동일 FSRS v5 | src/lib/grammarSrs.js:116 (calculateFSRS 호출) |
| **복습 판정** | `next_review_at ≤ now` 인 행 조회 | src/lib/grammarSrs.js:86 (fetchDueGrammar) |
| **등록 트리거** | 챕터 퀴즈 통과 시 자동 등록 | src/lib/grammarSrs.js:67~76 (enqueueGrammarReview) |
| **정답률 → rating** | `right/total ≥ 1.0 → rating 4` / `≥ 0.75 → 3` / `≥ 0.5 → 2` / `< 0.5 → 1` | src/lib/grammarSrs.js:12~19 |

---

## 2. Anki 공개 개념 모델 vs 격차표

### 2.1 Anki 아키텍처 개요 (공개 자료 기반)

Anki의 핵심 구조:
1. **노트 ↔ 카드 분리**: 1개 노트 = 다중 카드 파생 (템플릿 기반)
   - 예: 한국어 단어 노트 → "뜻 맞추기" + "음성 맞추기" + "역방향" = 3개 카드
2. **카드 상태 머신**: New / Learning / Review / Relearning
3. **스케줄러 파라미터 노출**: 
   - New 카드: `initialFactor` (기본 2.5), `initialInterval` (1일, 10일)
   - Review 카드: `IntervalModifier`, `easyBonus`, `hardPenalty`
4. **세션 큐 구성**:
   - 신규/복습 혼합 비율 설정 (예: "신규 3개마다 복습 9개")
   - 복습-신규 배치 순서 (선택: 신규 먼저, 복습 먼저, 교차)
5. **망각률(forgetting) 기반 재스케줄**:
   - FSRS: 목표 망각률 설정 (예: 5%) 후 안정성(stability)·난이도 동적 조정
6. **학습 세션 설정**:
   - 매일 신규 카드 수 (기본 20)
   - 매일 복습 상한 (기본 200)
   - 학습 시간 제한 기능

### 2.2 격차표: 현행 vs Anki 개념

| 축 | Anki 개념 | 현행 manabi | 격차 | 심각도 |
|---|---|---|---|---|
| **노트↔카드 분리** | 1 노트 → N 카드 (템플릿 파생) | 1 단어 = 1행 (파생 없음) | **근본적 부재** | 🔴 높음 |
| **카드 타입 다양성** | 정의형 / 청취형 / 역방향 등 자유 | 문항 타입: choice/cloze/typing/listening (서버 배정) | 타입 고정(큐 단계에서 선택) | 🟡 중간 |
| **상태 머신** | New/Learning/Review/Relearning | 신규(interval=0) vs due(next_review_at≤now) | **4-state vs 2-state** | 🔴 높음 |
| **대기열 구성** | 신규/복습 비율 설정 + 순서 제어 | 인터리브 고정 패턴 (신규1→어휘→신규2→문법…) | 설정 불가·비율 고정 | 🟡 중간 |
| **스케줄러 파라미터** | 사용자/덱별 노출 (`initialFactor` 등) | 내부 상수 (ts-fsrs 기본값) | **파라미터 숨김** | 🟡 중간 |
| **망각률 설정** | FSRS: `desired_retention` 설정 (기본 0.9) | FSRS 사용하되, 설정 인터페이스 없음 | **로직만 존재·설정 미노출** | 🟡 중간 |
| **학습 세션 상한** | 신규/복습 일일 한도 | 신규 한도만 (`newPerDay`), 복습 무제한 | **복습 상한 부재** | 🟡 중간 |
| **망각 통계** | 데이터 시각화 (retention curve 등) | `review_events` 이벤트 적재·집계 미미 | **원시적·분석 도구 부재** | 🟡 중간 |
| **재학습 상태** | Relearning (오답 후 재진입) | 재학습 상태 미분화 (rating 1 → interval=1로 리셋) | **상태 미분화** | 🟠 낮음 |
| **게임화 + SRS** | 독립 트랙 (Anki 자체는 순수 학습) | 숙련도(rung) 기반 문항 배정 + 세션 인터리브 | **하이브리드 설계** | ✅ 강점 |
| **어휘 vs 문법 통합** | 노트 타입별 템플릿 분리 | 동일 FSRS 컬럼·로직 재사용 | **일관성** | ✅ 강점 |

---

## 3. 현행 코드 품질 평가

### 3.1 강점

1. **FSRS 현대화**: SM-2 구 알고리즘에서 FSRS v5 마이그레이션 완료 (망각률 기반)
2. **양쪽 SRS 통일**: 어휘·문법 동일 컬럼 규약 → 로직 재사용 (grammarSrs.js 패턴 동일)
3. **서버 재료 조립**: 콘텐츠 레지스트리와 due 큐를 따로 페칭해 인터리브 세션 조립 (studyMaterials.js)
4. **상태 제약**: 신규 제한(newPerDay)으로 과부하 방어
5. **테스트 커버리지**: 
   - `fsrs.test.js`: 평정 → rating 변환, 카드 객체 매핑
   - `studySession.test.js`: 문항 조립·인터리브 패턴
   - `grammarSrs.test.js`: 정답률 → rating, 백필 스케줄
6. **폴백 설계**: 모듈 로드 실패 시 이벤트 기록은 유지 (recordStudyReviewCompleted)

### 3.2 부채

1. **카드 파생 미구현**
   - 단어당 정확히 1행 → 양방향(forward/reverse) 또는 여러 타입 카드 생성 불가
   - **파급**: 사용자가 "뜻→단어" 복습을 따로 추적 불가. 회상 난이도 비대칭 무시.

2. **상태 머신 단순화**
   - interval=0 vs next_review_at 비교만으로 신규/due 판정 → Learning/Relearning 상태 미분화
   - **파급**: 새로 배운 카드의 짧은 반복(1일→6일 점프) 효과 불명확. 재학습 통계 분석 불가.

3. **세션 큐 유연성 부재**
   - 신규/복습 비율 고정 (인터리브 패턴 hardcoded)
   - **파급**: 사용자가 "복습에 집중" 또는 "신규만" 선택 불가. EWMA 난이도 다이얼(easy/normal/hard)만 존재.

4. **파라미터 설정 미노출**
   - FSRS `desired_retention`, `weight` 등이 ts-fsrs 기본값으로 고정
   - **파급**: 특정 난이도·언어별로 학습 강도 조절 불가.

5. **대대적 통계 미구현**
   - `review_events` 테이블은 있으나 retention curve, 카드별 복습 빈도 분석 도구 없음
   - **파급**: 약점 진단이 EWMA(최근 정답률)만 의존. 단기/장기 진도 추적 부족.

6. **복습 일일 상한 미구현**
   - 신규는 `newPerDay` 제한, **복습은 무제한** (리뷰 수가 폭증하면 수행 불가)
   - **파급**: 복습 누적으로 학습 부담 경험 증대.

7. **테스트 커버리지 취약**
   - warm-up 문항(recent 이벤트 조기 복습) 통합 테스트 미흡
   - 그레이딩 후 이벤트 저장 통합 흐름(`recordStudyReviewCompleted`) 테스트 부분적

---

## 4. 재편 vs 개선 판정

### 4.1 재편 필요 축 (구조적 변경)

#### A. **카드 파생 모델** (심각도: 🔴)

**현행**: 1 단어 = 1행

**Anki 방식**: 1 노트(단어) → N 카드(템플릿) 예:
- Forward: 뜻→단어 선택형
- Reverse: 단어→뜻 선택형  
- Listening: 음성→단어 입력형

**영향**: 사용자가 회상 난이도(뜻 맞추기 vs 역방향)를 분리 추적 불가

**권고 안**:
- [ ] `user_vocabulary`에 `card_type` enum 추가 (forward/reverse/listening 등) 또는
- [ ] 새 테이블 `vocabulary_cards` (vocab_id, card_type, interval, ease_factor, …) 신설
- **마이그레이션**: 기존 행은 forward 타입으로 자동 매핑. 역방향 카드는 선택적 생성.
- **하한선**: 단어별 최소 1장은 유지. 상한 없음 (사용자 선택).

#### B. **상태 머신 정규화** (심각도: 🔴)

**현행**: new (interval=0) ↔ due (next_review_at ≤ now)

**Anki 방식**:
```
new → learning (1m, 10m) → review → (오답) relearning (1d) → review
```

**영향**: 새로 배운 카드의 초기 반복 효과 추적 불가. 재학습(실수 후) 통계 미분화.

**권고 안**:
- [ ] `grammar_review` / `user_vocabulary`에 `state` enum 추가 (new/learning/review/relearning)
- [ ] 상태 전이 로직:
  - new + (rating ≥ 3) → learning (1~10분 만료 후 review로 자동 승격) **또는**
  - new → 즉시 review (현 동작 유지, 단지 state='review' 기록)
  - review + (rating < 3) → relearning (interval 1일로 리셋)
- **기존 데이터**: 모두 state='review'로 일괄 설정 (backward compat).

#### C. **세션 큐 제어** (심각도: 🟡→🔴 기획에 따라)

**현행**: 인터리브 고정 패턴 (신규1→어휘→신규2→문법…)

**Anki 방식**:
```
신규/복습 비율 설정 (예: 신규 3, 복습 9)
배치 순서 (신규 먼저 / 복습 먼저 / 교차)
```

**영향**: 학습 스타일 선택 불가. 복습 집중 세션 불가.

**권고 안**:
- [ ] 사용자 설정 추가: `queue_ratio` (예: {new: 3, due: 7}) 및 `queue_order` (enum: interleaved/new-first/due-first)
- [ ] 런타임: user_vocabulary / grammar_review due 조회 시 비율만큼 샘플링 (현재: 무조건 due 모두)
- [ ] 영역성: 온보딩 또는 Study Library 페이지에 UI 추가.

---

### 4.2 개선 충분 축 (파라미터/도구)

#### A. **복습 일일 상한** (심각도: 🟡)

**현행**: 신규 제한만. 복습 무제한.

**권고**:
- [ ] DB: `user_settings` 또는 프로필에 `max_reviews_per_day` (기본 200) 추가
- [ ] 세션 조립: 복습 due 조회 시 limit 적용
- [ ] UX: 오늘 복습 상한 도달 메시지 + 내일 예약 표시

#### B. **스케줄러 파라미터 노출** (심각도: 🟡)

**현행**: FSRS 기본값 고정 (ts-fsrs 내부)

**권고**:
- [ ] 고급 설정 페이지: `desired_retention` (기본 0.9) 슬라이더
- [ ] 스냅샷: 선택한 값을 `user_settings.fsrs_config` JSON으로 저장
- [ ] 런타임: `calculateFSRS` 호출 시 설정값 주입

#### C. **망각률 대시보드** (심각도: 🟡)

**현행**: `review_events` 적재만. 분석 없음.

**권고**:
- [ ] 쿼리 추가: 기간별(주/월) retention rate, 타입별(choice/cloze/typing) 정확도
- [ ] 페이지: StudyLibraryPage에 "통계" 탭 추가
  - 지표: Today's accuracy, weekly retention, cards mastered
  - 차트: Retention curve (7일, 30일)

#### D. **카드별 복습 이력** (심각도: 🟠)

**현행**: review_events는 있으나 단어별·챕터별 상세 이력 뷰 없음

**권고**:
- [ ] VocabDetailCard / StudyLibraryPage: 단어/챕터 상세 모달
  - 지표: 총 복습 수, 정답률, 마지막 복습, 예상 다음 복습
  - 이력: 최근 5회 이벤트 (날짜, 타입, 정오답)

---

## 5. 재편/개선 우선순위 & 단계별 계획

### 5.1 1순위: 카드 파생 모델 (A)
**이유**: Anki 기본 기능. 회상 난이도 추적 핵심.  
**규모**: DB 마이그레이션 + 웹 UI 2~3주  
**하한 선**: forward만 구현. reverse는 v2 가능.

### 5.2 2순위: 상태 머신 (B)
**이유**: 부채는 낮음(state enum만) → 높은 가치 대비 비용 저.  
**규모**: 1주 (enum 추가 + 전이 로직)  
**호환성**: 기존 interval/ease_factor 로직 무변경.

### 5.3 3순위: 복습 상한 (A)
**이유**: 사용성 (과부하 방어).  
**규모**: 3~4일 (설정 페이지 + 쿼리)

### 5.4 4~5순위: 큐 제어 / 파라미터 노출
**이유**: 나이스-투-해브. 기본 동작 미변경.  
**규모**: 각 1주

---

## 6. 기존 학습 데이터 무손실 마이그레이션 전략

DB 스키마 변경 금지 제약 하에서:

### 방안 A: 별도 테이블 (선호)
```sql
-- 신설: vocabulary_cards (기존 user_vocabulary 병행)
CREATE TABLE vocabulary_cards (
  user_id uuid,
  word_id text,
  card_type enum('forward', 'reverse', 'listening'),
  interval numeric,
  ease_factor numeric,
  repetitions int,
  next_review_at timestamptz,
  state enum('new', 'learning', 'review', 'relearning'),
  last_reviewed_at timestamptz,
  PRIMARY KEY (user_id, word_id, card_type)
);

-- 마이그레이션: INSERT ... SELECT를 통해 기존 행 → (word_id, 'forward') 카드로 복사
-- 기존 user_vocabulary 읽기 권한만 유지 (backward compat)
```

### 방안 B: JSON 컬럼 (무스키마)
```sql
ALTER TABLE user_vocabulary ADD COLUMN cards jsonb DEFAULT '[]';
-- 기존 행: cards = [{ type: 'forward', interval, ease_factor, ... }]
-- UI 어댑터: cards[0] → 기존 필드 읽기 / 역방향은 cards[1]
```

**선택**: 방안 A (관계형 정규화). 방안 B는 쿼리 복잡성 증대.

### 데이터 보존 검증
- ✅ 기존 interval/ease_factor 값 무변경
- ✅ next_review_at 기한 유지
- ✅ 마이그레이션 전후 정답률 동일 (FSRS 로직 불변)
- ✅ 롤백 가능 (기존 테이블 read-only 유지)

---

## 7. 오너 의사결정 포인트

| 항목 | 현황 | 결정 필요 |
|---|---|---|
| **카드 파생** | 미구현 | 1주기 v1에 포함할지 / v2 미연기할지 |
| **상태 머신** | 2-state (신규/due) | Learning/Relearning 상태 필요 여부 |
| **역방향 카드** | 미구현 | forward만 우선 / reverse 함께 |
| **큐 제어 UI** | 고정 패턴 | 사용자 설정 UI 필요 여부 (학습 스타일 다양성) |
| **파라미터 노출** | 기본값 고정 | 고급 설정 페이지 개발 우선순위 |
| **복습 상한** | 미구현 | 기본값(200/day) 설정 / 무제한 유지 |

---

## 8. 테스트 및 검증 계획

### 8.1 기존 테스트 유지
- ✅ `fsrs.test.js` (스케줄러 로직)
- ✅ `studySession.test.js` (세션 조립)
- ✅ `grammarSrs.test.js` (rating 변환)

### 8.2 신규 테스트 (재편 시)
- [ ] `vocabularyCards.test.js`: card_type별 상태 전이, 마이그레이션 데이터 검증
- [ ] 통합 테스트: 세션 조립 (forward/reverse 비율 검증)
- [ ] DB 검증: 마이그레이션 전후 due 카운트 동일성

---

## 결론

### 즉시 갈아엎기 범위 (v1.0)
1. **카드 파생 모델**: 단어 1개 → forward/reverse/listening 카드 분리
2. **상태 머신**: new/learning/review/relearning 4-state

### 개선 범위 (v1.0~v1.5)
1. **복습 상한**: 사용자 설정 추가
2. **망각률 대시보드**: StudyLibrary 통계 탭
3. **큐 제어**: 신규/복습 비율 선택 UI (고급)

### 유지 범위
- ✅ FSRS v5 스케줄러 (강점)
- ✅ 어휘/문법 통일 아키텍처
- ✅ 콘텐츠 인터리브 설계

**오너 결정 대기**: 1순위 범위(카드 파생·상태 머신) 개발 여부 및 기한.

---

## 부록: 파일 참조

- 어휘 SRS: `src/lib/fsrs.js`, `src/lib/vocabIO.js`, `src/lib/vocabStudy.js`
- 문법 SRS: `src/lib/grammarSrs.js`
- 세션 조립: `src/lib/studySession.js`, `src/lib/studyMaterials.js`
- UI 통합: `src/lib/studyExerciseBridge.js`, `src/views/VocabPage.jsx`, `src/views/StudySessionPage.jsx`
- 테스트: `src/lib/__tests__/fsrs.test.js`, `src/lib/__tests__/grammarSrs.test.js`, `src/lib/__tests__/studySession.test.js`
- DB: `supabase/migrations/` (user_vocabulary 정의는 기존 마이그레이션, grammar_review는 20260612000100_user_ref_progress.sql 이후)
