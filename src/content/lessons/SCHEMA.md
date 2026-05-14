# 강의 콘텐츠 형식 (Lesson Content Schema)

`src/content/lessons/<id>-<slug>.js` 에 default export하고, `index.js`의 `LESSONS` 배열에 import 추가.

DB의 `reading_materials.id`가 매핑 키. DB 행은 빈 껍데기로 유지 (진행도/단어장 FK 보존). 콘텐츠는 코드가 단일 소스.

## 전체 모양

```js
export default {
  id: 45,                       // 필수. reading_materials.id (bigint)
  title: '[N5 문법 #1] ...',     // 참고용. 화면 표시는 DB title

  // ── 메타 (헤더 + 마무리 카드) ──
  intro: '...',                 // 한 줄. "이 챕터 끝나면 ___" 학습 결과 약속
  duration: '약 8분',             // 헤더 메타에 ⏱로 표시
  nextPreview: '...',           // 마무리 카드에 다음 강의 안내

  // ── 어휘 ──
  vocab: [
    { ja: 'わたし', ko: '저, 나' },
    // romaji는 kanaRomaji가 자동 생성. 직접 지정도 가능: { ja, ko, romaji: 'watashi' }
  ],

  // ── 정리 본문 (sections) ──
  sections: [
    // 패턴 카드 (기본)
    {
      heading: '오늘의 패턴 — A は B です',
      lead: '한 줄 안내',
      examples: [
        { ja: '...', ko: '...' },
      ],
      cfu: {
        q: '이해 확인 질문',
        options: ['보기1', '보기2', '보기3', '보기4'],
        answer: 0,                // 정답의 옵션 index (mount 시 자동 셔플됨)
        explain: '해설 한 줄',
      },
    },
    // 콜아웃 (정보 박스)
    {
      kind: 'callout',
      tone: 'pronunciation',     // 'pronunciation' | 'warning' | 'tip'
      heading: '🔊 발음 약속 — は는 "와"',
      body: '...',
    },
  ],

  // ── 실전 대화 ──
  conversation: [
    { ja: '...', ko: '...' },
  ],

  // ── 한→일 번역 미션 ──
  practice: [
    {
      ko: '저는 학생입니다.',
      ja: 'わたしは がくせいです。',
      // cloze — fail 시 힌트 (빈칸+보기 4개)
      cloze: {
        template: 'わたしは ___ です。',
        answer: 'がくせい',
        options: ['がくせい', 'せんせい', 'にほんじん', 'かんこくじん'],
      },
      // accepts — 추가 허용 표현 (lessonAccepts가 회화/격식 변형 자동 처리하므로 보통 불필요)
    },
  ],
};
```

## 가이드라인

### 어휘 (vocab)
- N5 입문: 5~10개. 첫 챕터는 6~8개.
- ja는 띄어쓰기 v2 정책에 따라 조사·어미 포함 (예: 「わたしは」 X / 「わたし」 O).
- ko는 가장 흔한 한국어 뜻 하나. 콤마로 동의어 (예: '저, 나').
- vocab 단어는 본문에서 점선 밑줄·popover로 자동 강조됨.

### sections
- 패턴 카드 2~4개 + 콜아웃 0~2개 권장.
- 한 패턴 카드에 examples 3~5개.
- CFU는 패턴마다 1개. callout에는 두지 않음.
- 콜아웃 tone:
  - `pronunciation` — 발음 약속 (파랑 띠)
  - `warning` — 헷갈리는 점 (주황 띠)
  - `tip` — 보너스 정보 (초록 띠)

### conversation
- 4~8 turns. 첫 챕터는 4 OK.
- A/B 말풍선 — 짝수 idx는 좌측, 홀수는 우측.
- vocab 단어는 자동 시각 강조됨.

### practice
- 5~8문항.
- 같은 문항에 cloze 추가 권장 (입문자가 fail 시 빈칸 모드로 풀이 가능).
- accepts는 보통 불필요 — 「じゃないです↔じゃありません」은 lessonAccepts.js가 자동.
- chips 모드(IME 우회)에서 distractor는 vocab 중에서 자동 선택.

### intro / nextPreview
- intro: 한 문장. "이 한 챕터로 ___ 가능해져요." 같은 학습 결과 약속.
- nextPreview: 한~두 문장. 다음 강의가 무엇을 더 다루는지.
- duration: '약 N분' 형식. 5분 단위 권장.

## 자동 처리

콘텐츠 작성자가 직접 해야 할 수동 vs 자동:

| 항목 | 자동 |
|---|---|
| 단어 카드 로마자 | `kanaRomaji.toRomaji()` |
| 본문 「は」 ruby 「わ」 | `jaSegments` — vocab 직후 「は」 자동 감지 |
| 본문 vocab 시각 강조 | `jaSegments` |
| chips 토큰화 | `jaTokenize` — vocab → 어미 → 조사 → 구두점 순 |
| 정답 변형 인정 (회화/격식) | `lessonAccepts` |
| CFU 옵션 셔플 | mount + reset 시 자동 |
| 매칭 게임 | vocab만 있으면 됨 |
| 마무리 카드 통계 | vocab/CFU/practice localStorage 기반 |

## 디자인 토큰 (참고)

`.lesson-viewer` scope:
- `--lp-pad: 20px` (일반 카드)
- `--lp-pad-sm: 16px` (인라인 박스)
- `--lp-pad-lg: 22px` (큰 카드)
- `--lp-radius: var(--radius-md)`
- `--lp-gap: 36px` (섹션 간)
- `--lp-trans: 0.18s ease`
- `--lp-trans-fast: 0.12s ease`

primary 좌측 띠는 **마무리 카드(LessonSummary)에만**. 그 외 강조는 다른 패턴 (배경 톤, primary 라벨 등).
