# AI 마크 생성 프롬프트 팩 v2 — Claude가 이어받기 쉬운 출력 (2026-10-16 KST)

분업은 다음과 같다.

| 단계 | 담당 | 하는 일 |
|---|---|---|
| 1 | 오너 | 생성기로 형태를 탐색한다 |
| 2 | Claude | 벡터 추적, 정밀화, 변형, 표지 적용 |

이 팩의 모든 지시는 **Claude가 2단계에서 손대기 쉬운 이미지**를 받기 위한 것이다. 왜 필요한지는 지시마다 적었다.

## 0. 원칙 — 이어받기 조건 9개

| # | 지시 | 이유(2단계에서 생기는 일) |
|---|---|---|
| 1 | **순흑 한 색, 순백 바탕**(또는 투명 PNG) | 이진화가 깨끗하다. 색은 표지 토큰으로 다시 입힌다 |
| 2 | **질감·그레인·그림자·그라디언트·입체 금지** | 질감은 추적하면 수천 개 잡점이 된다 |
| 3 | **단어만**. 부제·장식·아이콘·테두리 금지 | 자동 자르기가 단어 상자를 정확히 잡는다 |
| 4 | **가로 한 줄, 가운데, 사방 여백 15% 이상** | 글자가 잘리지 않는다 |
| 5 | **최대 해상도**. 글자 높이 600px 이상 | 곡선 정밀도가 해상도에 비례한다 |
| 6 | **가장 가는 획도 글자 높이의 1/40 이상** | 16px 파비콘·작은 인쇄에서 획이 사라지지 않는다 |
| 7 | **글자 사이에 분명한 틈**(일부러 잇는 방향 A만 예외) | Claude가 글자별로 떼어 자간을 다시 짤 수 있다 |
| 8 | **정면, 원근·목업 없음** | 왜곡을 되돌리는 보정이 필요 없다 |
| 9 | 가나는 **글자별로 철자를 풀어 쓰고, 표준 획 구조를 지정한다** | な·り의 획 누락·추가 오자를 줄인다 |

**금지**: 다른 잡지·브랜드·디자이너·로고 이름이나 "in the style of ○○"를 쓰지 않는다. 브랜드 정책 ⑴과 유사 마크 위험 때문이다. 원하는 느낌은 구조와 질감으로 묘사한다.

## 1. 공통 꼬리말 (모든 생성 프롬프트 끝에 붙인다)

```
Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

방향 A(이웃 글자 맞닿음)는 마지막 줄을 아래로 바꾼다.
```
Neighbouring letters touch at exactly one clear point each; elsewhere keep visible gaps.
```

## 2. 글자 지정 ({TEXT})

| 역할 | 문구 |
|---|---|
| TONARI | `the word "TONARI" — six Latin capital letters, T, O, N, A, R, I, in that order` |
| tonari | `the word "tonari" — six Latin lowercase letters, t, o, n, a, r, i, in that order` |
| hira | `the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana` |
| kata | `the Japanese word "トナリ" written in katakana, exactly three characters in this order: ト (to), ナ (na), リ (ri). Each character keeps its standard stroke structure: ト has two strokes, ナ has two strokes, リ has two strokes. No hiragana, no kanji` |

## 3. 방향 6가지 (생성 프롬프트 = 방향 문장 + 공통 꼬리말)

**A. 隣り合う — 이웃 글자가 맞닿는 짜임**
```
Custom hand-lettered wordmark of {TEXT}. Neighbouring letters lean on each other and share a single touching point,
like neighbours standing shoulder to shoulder — a tight, interlocking logotype. Bold, confident, modern editorial lettering.
```

**B. 高コントラスト・セリフ — 표제용 고대비 세리프**
```
Custom display lettering of {TEXT} for a calm, premium travel-and-culture magazine masthead.
High stroke contrast with heavy verticals and fine (but not hairline) horizontals, sharp wedge serifs,
slightly condensed proportions, crafted by a type designer.
```

**C. 昭和の描き文字 — 레트로 간판 손글씨**
```
Hand-lettered {TEXT} in the spirit of a mid-century Japanese shop sign painted by a sign painter:
chunky rounded strokes, slightly varied but deliberate letter widths, warm and friendly, heavy weight, crisp clean edges.
```

**D. 切り絵 — 종이를 오려 낸 형태**
```
Paper-cut lettering of {TEXT}: each letter cut from one sheet with scissors, straight cuts and confident angles,
small sharp notches instead of smooth curves, solid filled shapes, minimal and graphic.
```

**E. 幾何モノライン — 원과 직선으로만**
```
Geometric monoline lettering of {TEXT}, built only from perfect circles, arcs and straight lines of one uniform, fairly thick stroke weight,
rounded stroke ends, open counters, airy and clear, modern Japanese graphic design.
```

**F. 一筆 — 붓 한 번에**
```
Brush lettering of {TEXT} written with a soft brush in confident, continuous strokes, visible speed and pressure changes,
but smooth solid edges with no dry-brush texture, expressive yet legible, balanced as a logotype.
```

## 4. 이어받기 옵션 — 고른 안이 생기면 같은 대화에서 덧붙인다

생성기 대화창에 고른 이미지를 첨부한 채로 쓴다. 각 출력이 Claude 쪽에서 무엇이 되는지 함께 적었다.

**4-1. 정리판(가장 중요)** — 형태는 그대로 두고 추적 방해 요소만 걷어 낸다
```
Redraw the attached wordmark exactly: keep every letterform, proportion and stroke shape the same.
Only clean it: perfectly smooth edges, uniform solid black fill, remove any texture or noise, pure white background,
same centered layout with wide margins, maximum resolution.
```
→ 이 판이 추적의 원본이 된다. 원본과 정리판을 둘 다 보낸다.

**4-2. 글리프 시트** — 글자를 낱개로 받아 자간·조합을 Claude가 다시 짠다
```
Using exactly the same lettering style as the attached image (same stroke weight, contrast, terminals, proportions),
draw each character separately on a grid: {GLYPHS}, one character per cell, all the same height, aligned on one baseline,
black on white, generous space between cells, no labels.
```
{GLYPHS}에 넣을 것:
- TONARI는 `T, O, N, A, R, I`.
- となり는 `と, な, り`.
- トナリ는 `ト, ナ, リ`.

→ Claude가 글자별로 잘라 광학 자간을 다시 짜고, 다른 문자열(호수·코너명)로 넓힐 때 재료로 쓴다.

**4-3. 패밀리 확장** — 같은 손으로 다른 문자 세트를 쓴다
```
Using exactly the same lettering style as the attached image — same stroke weight, contrast, stroke endings,
proportions and spirit — write {TEXT}. Keep the same height and the same spacing rhythm.
```
→ TONARI·となり·トナリ가 한 손에서 나온 형제가 된다. 역할 체계(국제·일본·하이브리드)에 필요하다.

**4-4. 골격판** — 획의 중심선만 받는다(E·F 방향에 특히 유용)
```
Trace the centerline skeleton of the attached wordmark as a single thin uniform black line (about 1/60 of the letter height),
same letter shapes and positions, no fill, white background.
```
→ Claude가 중심선에 원하는 두께를 다시 입힌다. 굵기·끝 모양을 결정적으로 바꿀 수 있다.

**4-5. 부분 수정** — 한 군데만 고친다
```
Keep everything in the attached image identical except: {CHANGE}.
```
{CHANGE} 예시:
- `make the な slightly narrower`
- `remove the serif on the T`
- `close the gap between R and I`
- `make all strokes 10% heavier`

→ 생성기는 국소 수정이 약하므로 2~3회 안에 안 되면 멈춘다. 그 수정은 Claude가 벡터에서 한다.

## 5. 도구별 설정

UI 메뉴 이름은 버전마다 바뀔 수 있다.

| 도구 | 쓸 곳 | 설정 | 권리·주의 |
|---|---|---|---|
| **ChatGPT 이미지(gpt-image-2)** | 가나 전반, 4-1·4-3 편집 | 가로형 최대 크기, 품질 높음. 투명 배경을 요청할 수 있다 | 일본어가 가장 낫다는 보고가 있다 |
| **Gemini(Nano Banana Pro)** | 4-5 부분 수정, 4-3 확장 | 원본을 첨부한 편집 모드 | 일본어는 약 10자까지라는 보고가 있어 우리 단어 길이(3~6자)면 충분하다 |
| **Recraft V4** | 라틴 TONARI, **SVG 직접 출력** | 벡터 모드, 팔레트 검정 1색, SVG 다운로드 | **유료 플랜**일 때만 상업 권리가 있다 |
| **Ideogram 3** | 타이포 탐색 | 스타일 Design, **Magic Prompt 끔**, 비율 3:1, 네거티브 칸에 `texture, shadow, gradient, mockup, color, extra text` | 무료 출력은 공개된다 → **유료·비공개**로 생성 |
| **Midjourney V8** | 라틴 분위기 탐색 | `--ar 3:1 --style raw --stylize 50 --no texture, shadow, gradient, mockup, color, extra text` | 일본어는 쓰지 않는다 |

시드를 보여 주는 도구라면 시드를 꼭 기록한다. 같은 시드로 미세 변형이 가능하다.

## 6. 회차 운영

1. **탐색 회차**: 역할 TONARI 하나 × 방향 A~F × 도구 1~2개. 방향마다 4장씩 뽑는다.
2. **고르기**: 마음에 드는 1~3안을 `inbox/`에 넣는다(원본 그대로).
3. **이어받기 회차**: 고른 안마다 4-1 정리판과 4-3 확장(となり·トナリ)을 받는다. 가능하면 4-2 글리프 시트까지 받는다.
4. **Claude 처리**: `intake.mjs`로 비교 시트를 만든다. 고른 안을 정밀화하고, 소형·1색·반전 변형을 만들고, 표지에 앉힌다.

파일 이름 규칙: `<역할>-<도구>-<안번호><판>.<확장자>`.

| 판 | 뜻 |
|---|---|
| `o` | 원본 |
| `c` | 정리판 |
| `g` | 글리프 시트 |
| `s` | 골격판 |

예: `TONARI-gptimage-03o.png`, `TONARI-gptimage-03c.png`, `hira-gptimage-03c.png`.

같은 안번호는 한 계열(같은 손)로 묶어 본다.

`log.csv`에 한 줄씩 남긴다.
- 도구 / 모델 / 플랜
- 생성 일시(KST)
- 시드
- 방향(A~F)
- 덧붙인 지시
- 고른 이유
