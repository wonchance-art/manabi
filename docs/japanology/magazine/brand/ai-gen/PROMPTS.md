# AI 마크 생성 프롬프트 팩 (2026-10-16 KST)

생성은 오너가 하고, 결과물은 `inbox/`에 넣는다(README 참고).

- 프롬프트는 영어로 쓴다. 생성기들이 영어 지시를 가장 잘 따른다.
- 일본어 글자는 따옴표 안에 그대로 넣고, 글자 구성을 말로 한 번 더 적는다. 그래야 가나 오자가 줄어든다.

## 공통 규칙 (모든 프롬프트 끝에 붙인다)

```
flat solid black on plain white background, single wordmark only, centered with generous margin,
no mockup, no paper texture, no shadow, no gradient, no 3D, no extra words, no tagline, no icon, no frame
```

- 이 규칙의 이유는 추적(trace.py)이 **한 색 + 평평한 바탕**일 때 가장 깨끗하기 때문이다.
- 색은 버린다. 표지에서는 표지 토큰 색(밤 #151b2c / 눈 #eef0f4 / 주홍 #d4462a)을 입힌다.
- **금지**: 다른 잡지명·브랜드명·디자이너명·로고명을 프롬프트에 넣지 않는다. "in the style of ○○"도 쓰지 않는다.
  - 근거 ①: 브랜드 정책 ⑴은 시각 재현을 금지한다.
  - 근거 ②: 출력이 남의 마크를 닮을 위험이 있다.
  - 원하는 느낌은 아래처럼 **구조와 질감으로 묘사**한다.

## 글자 지정

| 역할 | {TEXT} 자리에 넣을 문구 |
|---|---|
| TONARI | `the word "TONARI" (six Latin capital letters T-O-N-A-R-I)` |
| hira | `the Japanese hiragana word "となり" (three hiragana: と, な, り), written horizontally` |
| kata | `the Japanese katakana word "トナリ" (three katakana: ト, ナ, リ), written horizontally` |

TONARI는 대문자와 소문자 `tonari` 둘 다 시도할 만하다.

## 방향 6가지

각 방향은 `{TEXT}`를 바꿔 끼워 그대로 붙여 넣으면 된다.

### A. 隣り合う — 이웃 글자가 맞닿는 짜임
```
Custom hand-lettered wordmark of {TEXT}. Neighbouring letters touch and share strokes, as if leaning on each other —
a tight, interlocking logotype where each pair of letters connects at exactly one point. Bold, confident, modern editorial lettering.
```

### B. 高コントラスト・セリフ — 잡지 표제다운 고대비 세리프
```
Custom display lettering of {TEXT} for a premium travel and culture magazine masthead.
High stroke contrast, razor-thin hairlines and heavy verticals, sharp wedge serifs, slightly condensed proportions,
custom ligature-free spacing, crafted by a type designer, elegant and calm.
```

### C. 昭和の描き文字 — 레트로 간판 손글씨
```
Hand-painted sign lettering of {TEXT}, Japanese Showa-era shop-sign feeling: chunky rounded strokes,
slightly irregular but deliberate letter widths, warm and friendly, bold weight, made by a sign painter with a brush, crisp edges.
```

### D. 切り絵 — 종이를 오려 낸 형태
```
Paper-cut lettering of {TEXT}: every letter cut from a single sheet with scissors, straight cuts and confident angles,
small sharp notches where curves would be, no outlines, solid black shapes, minimal and graphic.
```

### E. 幾何モノライン — 원과 직선으로만
```
Geometric monoline lettering of {TEXT}, built only from perfect circles, arcs and straight lines of one uniform stroke weight,
rounded stroke ends, generous open counters, airy and clear, modern Japanese graphic design.
```

### F. 一筆 — 붓 한 번에
```
Brush lettering of {TEXT} written in one continuous flowing stroke with a soft calligraphy brush, visible speed and pressure changes,
dry-brush ends kept minimal, expressive but legible, balanced as a logotype.
```

## 도구별 설정

이 표의 정보는 2026-10-16 조사 기준이다. 근거는 `../design-quality-survey.md`에 있다.

| 도구 | 잘하는 것 | 설정 | 권리 메모 |
|---|---|---|---|
| ChatGPT(gpt-image-2) | **가나 정확도가 가장 높다는 보고** | 품질 high, 1536×1024(가로), 배경 white | 상업 이용 가능. 저작권은 불명이다 |
| Recraft V4 | **SVG 직접 출력**, 라틴 워드마크 | Vector 모드, 스타일은 "Line art"나 "Flat" 계열 | **유료 플랜**일 때만 상업 권리가 있다 |
| Ideogram 3 | 타이포 전반 | Design 스타일, Magic Prompt **끔** | 무료 출력은 공개된다 → **비공개(유료)** 로 생성한다 |
| Midjourney V8 | 분위기 탐색 | `--style raw` | 일본어는 약하다. 라틴 TONARI 아이디어에만 쓴다 |

## 회차 운영

- 한 회차의 범위
  - 역할 하나(예: TONARI) × 방향 6개 × 도구 1~2개.
  - 방향마다 4장씩 뽑고, 마음에 드는 1~2장만 `inbox/`에 넣는다.
- 고른 이유를 `log.csv` note 칸에 한 줄 적는다. 다음 회차 프롬프트를 고칠 때 근거로 쓴다.
- 고친 프롬프트는 `prompt_extra` 칸에 남긴다.
  - 예: 「A + heavier weight」.
  - 예: 「C, fewer irregularities」.
