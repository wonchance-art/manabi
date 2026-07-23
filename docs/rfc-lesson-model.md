# F1 RFC — 코스·레슨 도메인 모델 설계

**상태**: Report-only (merge 금지)  
**근거**: #150 코멘트 5064589852 (구조 수술) · docs/audit-textbook-track.md (#537)

---

## 1. 현행 콘텐츠 구조 실측

### 1.1 트랙별 레벨 체계

| 트랙 | 레벨 구분 | 문법 파일 | 어휘 파일 | 번키 파일 |
|---|---|---|---|---|
| **일본어** (Japanese) | OT, N5, N4, N3, N2, N1 | ot.js, n5.js, n4.js, n3.js, n2.js, n1.js | n5.js, n4.js, n3.js, n2.js, n1.js (각 JLPT 서브세트) | n5.js, n4.js, n3.js, n2.js, n1.js |
| **프랑스어** (French) | A0, A1, A2, B1, B2, C1, C2 | a0.js, a1.js, a2.js, b1.js, b2.js, c1.js, c2.js | (vocab/) | (bunkei/) |
| **영어** (English) | OT, A1, A2, B1, B2, C1, C2 | ot.js, a1.js, a2.js, b1.js, b2.js, c1.js, c2.js | (vocab/) | (bunkei/) |
| **중국어** (Chinese) | H1~H6 (HSK) | h1.js, h2.js, h3.js, h4.js, h5.js, h6.js + h*_examples.js | (vocab/) | (bunkei/) |

- **일본어**: 콘텐츠 최다. N 레벨(JLPT) + 부가 어휘(문화·온마토페·속어)
- **프랑스어/영어**: CEFR 레벨 (A0~C2)
- **중국어**: HSK 단계 (H1~H6) + 예시 분리 파일

### 1.2 문법 파일 내부 구조 (`chapters` 배열)

```javascript
// src/content/japanese/grammar/ot.js 예시
const chapters = [
  {
    slug: "ot-01-known-japanese",
    level: "OT",               // 레벨 키
    order: 1,                   // 챕터 순서
    title: "단어만 갈아 끼우면 문장이 된다",
    topic: "어순·조사·수식어",
    titleFr: "ごじゅん・じょし・しゅうしょく",
    summary: "한국어와 문장 뼈대가 같아요...",
    duration: "약 8분",
    sections: [
      {
        heading: "당신은 이미 일본어를 안다",
        pattern: "うどん(우동)=우동 · すごい(스고이)=대단해",
        patternKo: "한국 속 일본어",
        body: "...",
        examples: [ { ja, yomi, ko, note }, ... ],
        tip: "...",
      },
      // 다음 섹션들
    ],
  },
  // 다음 챕터들
];

export { chapters };
```

**핵심 필드**:
- `slug`: 고유 식별자 (URL·DB 키)
- `level`: 레벨 문자열 (e.g., "N5", "A1", "H1")
- `order`: 레벨 내 순서
- `sections[]`: 문법 개념별 소단원 (보통 3~5개 섹션 per 챕터)
- `examples[]`: 각 섹션의 구체 예시 (ja, ko, ipa, note 필드)

### 1.3 어휘 파일 구조 (`themes` 배열)

```javascript
// src/content/japanese/vocab/n5.js 예시
const themes = {
  level: "N5",
  title: "N5 기초 어휘",
  desc: "JLPT N5 필수 어휘 약 170개...",
  themes: [
    {
      name: "인사와 교실 표현",
      icon: "🙇",
      words: [
        {
          ja: "おはようございます",
          yomi: "おはようございます",
          ko: "안녕하세요 (아침 인사)",
          pos: "표현",
          ex: { ja, yomi, ko },
        },
        // 다음 단어들
      ],
    },
    // 다음 테마들
  ],
};

export { themes };
```

**구조**:
- 어휘는 **테마 그룹**으로 조직화 (예: 인사·교실·가족·음식)
- 각 단어: 표제·요미·한국어뜻·품사·예문
- 텍스트 기반 (아직 DB 스키마 없음)

### 1.4 소비 페이지 (현행 연결)

| 페이지 | 경로 | 입력 데이터 | 역할 |
|---|---|---|---|
| **LessonsPage** | `/lessons` | `refManifest` (문법 경량 목차) | 레벨별·언어별 챕터 목록 제공 |
| **ReferenceChapterPage** | `/lessons/:lang/:level/:slug` | 문법 파일 import | 챕터 본문·섹션 렌더링 |
| **VocabPage** | `/vocab` | 어휘 파일 + user_vocabulary (DB) | 어휘 목록·복습 FSRS 연동 |
| **LearnPage** | `/learn` | user_vocabulary + grammar_review | due 어휘·due 문법 카운트·전체 학습 허브 |
| **StudySessionPage** | (읽기 자료 연계) | study_paragraphs + user_vocabulary | 본문 단어 인라인 복습 |

---

## 2. 공통 모델 제안: Course → Unit → Lesson → Review

### 2.1 타입 정의 (TypeScript 스키마)

```typescript
// 최상위: 학습 방향 = 트랙(언어) × 레벨
type Course = {
  id: string;                    // e.g., "japanese-n5", "french-a1"
  language: "Japanese" | "French" | "English" | "Chinese";
  level: string;                 // "N5", "A1", "H1", etc.
  title: string;                 // "일본어 N5 기초", "프랑스어 A1 입문"
  description: string;
  targetLearners: "beginner" | "intermediate" | "advanced";
  estimatedDuration: number;     // 주 단위 (e.g., 4 for 4 weeks)
  prerequisites?: string[];      // e.g., ["japanese-ot"] for japanese-n5
};

// 단계 1: 주/테마 단위
type Unit = {
  id: string;                    // e.g., "japanese-n5-u01"
  courseId: string;
  week: number;                  // 1~4 (F0: 레벨 1주차=4주 기준)
  title: string;                 // "첫 주: 기초 문자와 인사"
  themeName: string;             // 테마/주제 (예: "생존 회화", "일상 명사")
};

// 단계 2: 학습 콘텐츠 묶음 (15~20분)
type Lesson = {
  id: string;                    // e.g., "japanese-n5-u01-l01"
  unitId: string;
  order: number;                 // 단위 내 순서
  
  // 타이틀
  title: string;                 // "「~です」로 자기소개하기"
  summary: string;               // 1~2줄 요약
  
  // 콘텐츠 구성
  grammar: {
    concepts: string[];          // 문법 개념 목록 (e.g., ["은/는 조사", "입니다"])
    chapterRefs: {
      chapterSlug: string;       // 원본 챕터 slug (e.g., "n5-01-introduction")
      sectionIndices: number[]; // 해당 챕터 섹션 인덱스 (일부 추출 가능)
    }[];
    explanation: string;         // 문법 단간 설명 (요약 또는 원문 링크)
  };
  
  vocabulary: {
    coreWords: string[];         // 핵심 어휘 목록 (10~20개, 단어 ID)
    themeRef: string;            // 원본 테마 slug (e.g., "n5-vocab-greetings")
    newWordsCount: number;       // 신규 단어 수
  };
  
  // 연습
  exercises: {
    type: "pattern-fill" | "conversation" | "writing" | "listening";
    description: string;
    estimatedMinutes: number;
  }[];
  
  // 메타
  estimatedMinutes: number;      // 15~20 권고
  difficultyRating?: number;     // 1~5 (같은 레벨 내 상대 난이도)
  
  // 이전·이후 네비게이션
  prerequisites?: string[];      // 선행 레슨 ID
  nextLesson?: string;
};

// 단계 3: 복습 연동
type Review = {
  id: string;                    // e.g., "vocab-ja-3094"
  lessonId: string;              // 원점 레슨
  type: "vocabulary" | "grammar" | "pattern";
  
  // FSRS 필드
  interval: number;              // 일 단위
  easeFactor: number;            // 1.3~2.5
  nextReviewAt: Date;
  lastReviewedAt?: Date;
  
  // 피드백
  quality?: number;              // 0~5 (사용자 답변 평가)
  repetitions?: number;          // 반복 횟수
};
```

### 2.2 설계 원칙

1. **무손실 매핑**: 현행 `chapters` + `themes` 모두를 Lesson으로 표현 가능
2. **점진적 마이그레이션**: 기존 파일 → 어댑터 계층 → 새 스키마
3. **특수 필드 허용**: 트랙별 확장 (예: 일본어 `kanjiExempt`, 중국어 `pinyin`)
4. **불변 조건**:
   - 한 Lesson은 1개 이상의 문법 개념 + 어휘 세트 포함
   - 레슨 ID는 불변 (참조 무결성)
   - duration은 15~20분 범위 (F0 권고)

---

## 3. 트랙별 무손실 매핑 검증

### 3.1 일본어 (Japanese)

**현행 구조**:
- **OT**: 챕터 3개 (문자 체계 + 기초 문법)
- **N5**: 챕터 ~15개 + 어휘 테마 8개 + 번키 1개

**매핑 예시** (N5 첫 주):

| 원본 | 매핑 대상 |
|---|---|
| `n5-01-あいさつ-敬語` (OT 챕터) | Unit 0 (오리엔테이션), Lesson 1~3 |
| `n5-vocab-greetings` (테마) | Lesson 1 vocabulary |
| `n5-vocab-numbers` (테마) | Lesson 2 vocabulary |

**검증**: ✅ 완전히 가능. 각 챕터는 2~3개 레슨으로 쪼갤 수 있고, 어휘 테마는 1:1 매핑.

**트랙 특수성**:
- 한자 예외 필드 (`kanjiExempt`) → Lesson.grammar.specialFields.kanjiExempt
- 요미(히라가나) → 필수 필드 유지
- JLPT 부가 어휘 (sub-vocabularies) → Unit/Lesson order로 계층화

---

### 3.2 프랑스어 (French)

**현행 구조**:
- **A0**: 알파벳·악상 (가벼운 입문)
- **A1~C2**: 각 7~8개 챕터

**매핑 예시** (A1 첫 주):

| 원본 | 매핑 대상 |
|---|---|
| `a1-01-pronouns-etre` (챕터) | Unit 1, Lesson 1 |
| `a1-02-verb-avoir` (챕터) | Unit 1, Lesson 2 |
| (vocab/) 미분리 | 현행 테마 없음 → F2에서 추출 |

**검증**: ✅ 가능. 다만 **프랑스어 어휘가 테마로 분리되지 않았음** → 현재 구조 손상 없이 진행 (F2에서 어휘 테마 생성 예정).

**트랙 특수성**:
- 성(genre) 명시 필요 (le/la 구분) → Vocabulary.gender 필드 추가
- 발음 IPA 필수 (프랑스 학습자 특성)

---

### 3.3 영어 (English)

**현행 구조**:
- **OT**: 가벼운 입문
- **A1~C2**: 각 7~8개 챕터

**매핑 예시**: 프랑스어와 동일 (CEFR 기반)

**검증**: ✅ 가능. 어휘 테마 미분리는 프랑스어와 동일.

---

### 3.4 중국어 (Chinese)

**현행 구조**:
- **H1~H6** (HSK): 각 챕터 + `_examples.js` 분리

**매핑 예시** (H1):

| 원본 | 매핑 대상 |
|---|---|
| `h1.js` (챕터) | Unit 1~2, Lesson 1~4 |
| `h1_examples.js` (예시) | Lesson 1~4 examples (통합) |

**검증**: ✅ 가능. 예시 파일은 단순 합병.

**트랙 특수성**:
- 성조 (tone marks) 필수
- 번체/간체 구분
- 한자 급수 (HSK level)

---

## 4. 마이그레이션 경로 (단계별 계획)

### 4.1 Phase 1: 어댑터 계층 (F1 내 / 콘텐츠 파일 수정 금지)

**목표**: 기존 파일을 Lesson 모델로 읽는 매퍼

```typescript
// lib/lessonAdapters.js
export function chapterToLesson(chapter, chapterFile) {
  // chapter = grammar file의 한 챕터 객체
  // chapterFile = 원본 파일명 (e.g., "japanese/grammar/n5.js")
  
  const [lang, "grammar", level] = chapterFile.split('/');
  
  return {
    id: `${lang}-${level}-${chapter.slug}`,
    unitId: `${lang}-${level}-u${Math.ceil(chapter.order / 3)}`,
    title: chapter.title,
    grammar: {
      concepts: extractConcepts(chapter),
      chapterRefs: [{
        chapterSlug: chapter.slug,
        sectionIndices: range(0, chapter.sections.length),
      }],
    },
    // ... 나머지 필드
  };
}

export function themesToLessonVocab(themeGroup, themeFile) {
  // themeGroup = vocab file의 한 테마 객체
  return {
    coreWords: themeGroup.words.map(w => w.id || slugify(w.ja)),
    themeRef: themeFile,
    newWordsCount: themeGroup.words.length,
  };
}
```

**구현 위치**: `src/lib/lessonAdapters.js` (신규 파일)

**영향도**: 낮음 (기존 파일 수정 없음, 새 코드만)

### 4.2 Phase 2: DB 스키마 + 진도 저장 (F2 / 이번 RFC 범위 외)

**DB 테이블 신규**:
- `courses` (course_id PK)
- `units` (unit_id PK, fk: course_id)
- `lessons` (lesson_id PK, fk: unit_id)
- `user_lesson_progress` (fk: user_id, lesson_id)

**DataLoader 작성**: 어댑터 → 이 테이블로 초기 로드

### 4.3 Phase 3: 페이지 마이그레이션 (F3+)

**우선순위**:
1. LearnPage: due 레슨 카운트 추가
2. LessonsPage: Lesson 기반 목차
3. ReferenceChapterPage: Lesson context 표시

---

## 5. 결정 필요 사항

### 5.1 어휘 테마 분리 정책 (프랑스어·영어)

**문제**: 프랑스어·영어 어휘가 아직 테마로 분리되지 않음.

**선택지**:
- **A. 현행 유지**: F2에서 문법 챕터와 어휘를 느슨히 연결 (unit 기반)
- **B. F2에서 후처리**: 각 챕터 목표 어휘를 별도 테마로 추출 (work-heavy)
- **C. RFC 외 이슈로 분리**: 이번엔 A 선택, #538 별개 RFC (권고)

### 5.2 특수 필드 정책 (확장성)

**문제**: 트랙별 특수 필드 (일본어 kanjiExempt, 중국어 tone, 프랑스어 gender)

**결정**:
- Lesson 스키마에 `specialFields: Record<string, unknown>` 추가
- 각 트랙이 필요한 필드만 저장 (스키마 오염 최소화)
- 타입 안전성은 어댑터 계층에서 보장

### 5.3 레슨 분할 기준 (duration 규칙)

**문제**: 현행 챕터는 10~30분 범위 (F0 목표=15~20분)

**결정**:
- F1: 제안만 (어댑터가 순진하게 1:1 매핑)
- F2: 챕터를 부챕터로 명시적으로 쪼갤 때 (overkill 막기)
- 임계: 25분 이상 챕터 → 2개 레슨으로 분할 검토 (저자 수동)

### 5.4 이전·이후 네비게이션 (Lesson graph)

**문제**: Lesson.prerequisites / Lesson.nextLesson을 DB에서 자동 계산할 것 vs 수동 명시할 것?

**결정**:
- 동일 Unit 내: 자동 계산 (order 순서)
- 다른 Unit/Course: 수동 명시 (author comment 필요)
- F2에서 graph 시각화 + 검증 스크립트

---

## 6. 리스크 및 반례

### 6.1 트랙 특수성이 공통 모델을 깨는 경우

| 케이스 | 해결책 |
|---|---|
| 일본어 한자 읽기 (요미) 필수 | specialFields 추가 (⚠ 모든 단어가 가져야 함) |
| 중국어 성조 분석 (tone) | Vocabulary 타입 확장 (특수 필드) |
| 프랑스어 동사 활용표 (conjugation) | Grammar 섹션 전용 구조 (`conjugationTable`) |

**리스크**: 특수 필드가 너무 많아지면 공통 모델 무의미화  
**방어**: F1 RFC에서 3개 이상 특수 필드는 거절 (별개 RFC로 분리)

### 6.2 무손실 매핑이 실패하는 경우

**발견된 반례**:
- 현행 "복합 챕터" (예: 일본어 N1 "한자 + 관용구" 섞임) → 2개 개념으로 분할 필요
- 프랑스어 "문화 읽기" 챕터 (순수 콘텐츠, 문법 최소) → Lesson 스키마 변형 필요

**대응**: 이런 반례는 현행 구조 감사 후 F2에서 처리 (콘텐츠 컨설팅 필수)

### 6.3 진도 데이터 손실 위험

**시나리오**: user_vocabulary (기존 DB)와 user_lesson_progress (신규 DB) 사이 불일치

**대응**:
- F2에서 마이그레이션 스크립트 필수
- Lesson ← → vocabulary 양방향 매핑 유지 (거울 구조)
- 로컬 테스트: 소수 사용자 동시 진행 후 검증

---

## 7. F2 진도 스토어 및 F3 스키마와의 접점

### 7.1 F2 역할 (별개 RFC 예정)

- 어댑터 활성화 (LearnPage, LessonsPage)
- DB 마이그레이션 (현행 user_vocabulary → user_lesson_progress 양방향 매핑)
- 진도 UI 갱신 (이어서 학습 카드가 Lesson 단위로)

### 7.2 F3 스키마와의 동기화

**목표**: 스탬프·보상 루프·앨범이 Lesson 단위로 작동

**설계 원칙**:
- Lesson.id ← FK → user_lesson_progress.lesson_id
- user_lesson_progress.status: "not_started" | "in_progress" | "completed" | "mastered"
- Reward trigger: status → "completed" (기존 reading_progress와 동치)

---

## 8. 완성도 요약

### 8.1 모델 요약 (5줄)

**F1 RFC는 Course(트랙×레벨) → Unit(주차) → Lesson(15~20분 번들) → Review(FSRS 복습) 의 4단계 계층을 제안합니다.** 이 모델은 현행 `chapters` + `themes` 모두를 무손실로 매핑하면서, 점진적 마이그레이션(어댑터 계층 우선)을 가능하게 합니다. 트랙 특수성(일본어 한자, 중국어 성조 등)은 specialFields로 확장하고, 불변 조건(duration 15~20분, 불변 ID)을 명시합니다. 어휘 테마 분리(프랑스어/영어), 레슨 분할 기준, 이전·이후 네비 자동화는 F2에서 처리하며, F3에서 게임 시스템(스탬프·보상·앨범)과 동기화합니다.

### 8.2 무손실 매핑 가능 여부 (트랙별)

| 트랙 | 가능성 | 비고 |
|---|---|---|
| **일본어** | ✅ 완전 가능 | JLPT 부가 어휘 포함, 한자 필드 명시 필요 |
| **프랑스어** | ✅ 가능 (어휘 테마 미분리) | 성(gender) 필드 추가 필요, 어휘 추출은 F2 |
| **영어** | ✅ 가능 (어휘 테마 미분리) | 프랑스어와 동일 |
| **중국어** | ✅ 완전 가능 | 성조·번체 필드 명시, h*_examples.js 통합 |

**결론**: 4개 트랙 모두 무손실 매핑 가능. 다만 어휘 테마 분리 정책(A/B/C 선택) 필요.

### 8.3 결정 필요 항목

1. **어휘 테마 분리** (A. 현행 유지 / B. F2 추출 / C. 별개 RFC)
2. **트랙 특수 필드 상한** (3개 이상 → 별개 RFC)
3. **레슨 분할 기준** (duration 임계값, F2 검토 정책)
4. **Lesson graph 자동화** (same-unit 자동 vs 모두 수동명시)
5. **진도 마이그레이션 정책** (user_vocabulary ↔ user_lesson_progress 순서)

---

## 9. 다음 단계 (이 RFC 이후)

1. **이 RFC 병합 후 논의**: 오너·Claude 본체 의견 수집 (결정 필요 5개 항목)
2. **F2 RFC 작성**: 어댑터 구현 + DB 스키마 + UI 마이그레이션 계획
3. **F3 RFC 또는 이슈**: 게임 시스템(스탬프·보상·앨범) Lesson 연동

---

**작성일**: 2026-07-24  
**저자**: Claude F1  
**상태**: Report-only, merge 금지 (검수 대기)
