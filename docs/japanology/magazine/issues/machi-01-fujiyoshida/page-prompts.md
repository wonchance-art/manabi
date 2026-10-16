# 一つの町 01 富士吉田 — 16쪽 완성 지면 프롬프트 v3 (2026-10-16 KST)

**상태.**
- 프롬프트로서는 완성이다.
- 다만 아래 **결정 4개** 가운데 ①②는 시작 전에, ③④는 해당 단계 전에 정해야 한다.

**변경 이력.**
| 판 | 내용 |
|---|---|
| v1 | 초안 |
| v2 | 에이전트 5종 검토 반영. 방위·시점·후반 재배열·본문 RESERVE·로고 RESERVED |
| v3 | 에이전트 2종 재검토 반영 |
| v3.1 | 오너 기준 반영: 학습자 배려 없이 실제 일본 매거진 기준. 루비는 일본 잡지 관행대로, 쪽 참조는 「→P.n」. 金鳥居에 「富士山」 현판이 실제로 있다(山梨県立富士山世界遺産センター 리플릿)는 확인에 따라 현판은 그리되 글자는 읽히지 않게 |

v3에서 고친 것:
- **SERIES 공통 모순 4개.** 안전 띠 문구가 반대로 읽혔고, 폴리오가 「한 번만」 규칙과 충돌했고, 어두운 면 RESERVE가 정의되지 않았고, 회색 글자색이 없었다.
- **15쪽 지도 방위 2건.** 직선부는 산정을 거의 정확히 겨눈다. 富士山駅은 金鳥居와 같은 높이 오른쪽이다.
- **剣ヶ峯 표기.** 金鳥居에서는 剣ヶ峯이 보이지 않으므로 「방향」으로만 쓴다.
- **숫자 판 문구.** 8日·2000人·5軒을 원고 유보 그대로 옮기고, 단위를 통일했다.
- **奥付.** 「神社」를 추가했다.
- **9쪽 1964 라벨.** 「急に衰えた」를 되살렸다.
- **10–11쪽 출처.** 「山梨県立」 경로를 밝혔다.
- **2–3쪽 산 크기.** 과장을 고쳐 실측 앙각 약 12°에 맞췄다.
- **쪽 참조.** 글이 실제로 있는 쪽으로 맞췄다.
- **위치 지정.** 쪽마다 겹치기 쉬운 요소의 위치를 지정했다.
- **첨부.** 첨부 파일을 한 폴더(`attach/`)로 모았다.

**원칙.**
- 본문·인용·숫자는 원고 `../../ja/machi-fujiyoshida.md`(1차 원문 대조 완료)에서 가져왔다.
- 원고에 없는 지면 문구는 **[신규]** 로 표시했다. 새 사실은 없다.
- 세 잡지(BRUTUS·POPEYE·&Premium)에서는 편집 사고방식만 빌렸다. 그들의 로고·판형·표지 구조는 쓰지 않고, 프롬프트에도 이름을 넣지 않는다.

---

## A. 결정 (오너 2026-10-16 KST 「권장대로」)

- ① 12쪽 라벨·폴리오 [신규] 문구: **승인**.
- ② 스타일 앵커 승인 기준: **그림·타이포 인상으로만 승인**한다. 본문은 Claude가 원문으로 덮는다.
- ③ 「本町通り」 단락: **남김**. 일본 잡지도 「市が取材に答えた」 형식으로 싣는다. 원고의 2차 출처 표기를 그대로 쓴다.
  - ③에는 원래 권고가 없었다. Claude 권고로 정했고, 바꾸려면 말해 달라.
- ④ 표지: **1A**(Claude 조판).

아래 표는 결정 전의 기록이다.

### 결정 전 기록 (결정 4개)

| # | 결정 | 언제까지 | 권고 | 영향 |
|---|---|---|---|---|
| ① | 12쪽 라벨과 폴리오의 [신규] 문구 승인. 라벨 「最初の鳥居（富士講の信者が建てた）」 「今の鳥居」, 폴리오 「となり　一つの町　01　富士吉田」 | STEP 1 전 | 그대로 승인 | 폴리오는 16쪽 전부에 구워진다 |
| ② | 스타일 앵커 승인 기준 | STEP 1 전 | 그림·타이포 인상으로만 승인한다. 12쪽 본문이 틀려도 Claude가 원문으로 덮는다 | — |
| ③ | 원고 ⑺-3 「本町通り」 단락: 남김 / 주의 문장만 / 삭제 | STEP 3(8쪽) 전 | 오너 판단(2000人·2017年·警備員은 보도에 대한 시의 회답, 2차) | 8쪽 본문, 14쪽 B7, 15쪽 T18, 16쪽 T7 |
| ④ | 표지: 1A(Claude가 실측 지도 표지에 새 마크 조판) / 1B(그림 표지, 생성) | STEP 10(마지막) 전 | 1A. 1B는 8쪽과 같은 풍경이 된다(같은 시점) | 1B면 16쪽 T3에 「表紙と」 추가 |

③에서 「삭제」를 고르면 바꿀 곳:
- 8쪽은 본문 없이 그림과 주의 박스만 남긴다.
- 14쪽은 B7을 빼고 11칸으로 둔다.
- 15쪽은 T18 줄을 뺀다.
- 16쪽 T7에서는 「・報道」를 뺀다.

(Claude가 해당 블록을 고쳐 준다)

---

## A2. 수정 가능한 형태로 받기 — 「시안 + 플레이트」 두 장

ChatGPT가 주는 것은 글자까지 구워진 한 장짜리 래스터 이미지다. 그대로 쓰면 오자 한 자, 문구 한 줄을 고칠 때마다 그림 전체를 다시 뽑아야 한다. 해상도도 인쇄용으로 부족하다(긴 변 1536px, A4 300dpi에는 약 3508px가 필요하다). 그래서 그림이 있는 쪽은 **두 장을 받는다**.

1. **시안(comp)**: 지금 프롬프트 그대로 뽑는다.
   - 배치·위계·글자 크기·여백을 ChatGPT가 정한 결과물이다.
   - 레이아웃 기준으로만 쓰고, 최종본에는 쓰지 않는다.
2. **플레이트(plate)**: 시안을 승인한 뒤, **같은 대화에서** 아래 블록을 보내 같은 그림을 글자 없이 받는다.
   ```
   Output the same page again with every piece of text removed: no headlines, numbers, captions, labels, quotes, credits or folios. Keep the illustration, the paper colour, all rules, lines, boxes, panels and their positions exactly the same. Where text was, show only what was underneath it.
   ```

**최종본은 Claude가 조립한다.**
- 플레이트 위에 모든 글자(T·B·F)와 선·박스를 **HTML/SVG 레이어**로 시안 위치에 맞춰 얹는다.
- 이렇게 하면 다음이 된다.
  - 글자는 원고와 한 글자도 다르지 않다.
  - 문구를 고칠 때 그림을 다시 뽑지 않는다.
  - 글자·선·로고는 벡터라 인쇄 해상도와 상관없다.
- 그림 부분만 래스터로 남는다.
  - 인쇄할 때는 오픈소스 업스케일러로 키운다. Real-ESRGAN(BSD-3) 등으로 하고, 확정 시 라이선스를 다시 확인한다.
  - 웹 판은 그대로 쓴다.

**적용 범위**

| 쪽 | 받을 것 |
|---|---|
| 그림 쪽: 2–3, 6–7, 8, 10–11, 12, 표지 1B | 시안 + 플레이트 |
| 15 | 시안 + 플레이트. 지도 선만 남기고, 라벨은 Claude가 조판해 정확한 위치에 둔다 |
| 4–5 | 시안 + 플레이트. 도해 위 라벨도 레이어로 얹는다 |
| 글자만 있는 쪽: 9, 13, 14, 16 | 시안만 받는다. 전부 Claude가 시안을 따라 조판한다 |

**플레이트 검수**
- 시안과 겹쳐 보아 그림이 바뀌지 않았는지 확인한다. 생성기는 다시 그리면서 조금씩 바꿀 수 있다.
- 크게 바뀌었으면 플레이트를 기준으로 삼고, 글자 위치만 시안을 따른다.
- 8쪽과 1B는 능선 수치 검수를 **플레이트로** 한다.

## B. 진행 순서 (오너) — 무엇을 붙여 넣고 무엇을 첨부하나

**공통 규칙 (모든 단계)**
- **ChatGPT 새 대화**를 쪽마다 하나씩 연다.
- 메시지 하나 = **§0 SERIES SYSTEM v3 블록 전체 + 그 쪽 PAGE 블록 전체**를 이어 붙인 것. 첨부 파일은 같은 메시지에 함께 붙인다.
- **첨부 순서 = 프롬프트의 Image 1, Image 2 순서**를 지킨다.
- **비율은 ChatGPT의 비율 선택기로** 고른다. 단면은 세로 2:3, 펼침은 가로 3:2. 프롬프트의 문구만으로는 지켜지지 않는다.
- 받은 이미지는 **새 메시지에 첨부**해서 Claude에게 보내고 쪽 번호를 적는다. 작업 도중에 보낸 이미지는 파일로 저장되지 않는다.
- 고칠 때는 같은 대화에서 `Keep everything identical except: ___`로 한 군데씩 고친다. 3번 안에 안 되면 Claude에게 넘긴다.
- **그림 쪽은 시안을 받아 Claude 승인 → 같은 대화에서 플레이트 요청**(§A2 블록). 두 장 모두 Claude에게 보낸다.
- **첨부 금지 파일**: `guide-notes.png`(빨간 글자 있음), `14-view/out/guide.png`(v1 시점), `out-honcho-p8/guide.png`(1:1).

첨부 파일은 모두 이 폴더에 있다: **`docs/japanology/magazine/issues/machi-01-fujiyoshida/attach/`**

| STEP | 쪽 | 비율 | 붙여 넣을 블록 | 첨부 (순서대로) | 받은 뒤 Claude가 하는 일 |
|---|---|---|---|---|---|
| 0 | — | — | — | — | 결정 ①② |
| 1 | **12 (스타일 앵커)** | 세로 2:3 | §0 + 12쪽 | 없음 | 그림(동색 鳥居·눈 없음·기둥 사이 산)과 글자 대조 → 승인. 승인본 = `p12.png` |
| 2 | — | — | — | — | 결정 ③ |
| 3 | **8** | 세로 2:3 | §0 + 8쪽 | Image 1 `attach/08-geometry-guide.png`, Image 2 `p12.png` | 능선 수치 검수(위 정사각 영역), 표시 문구 대조 |
| 4 | **9** | 세로 2:3 | §0 + 9쪽 | Image 1 `p12.png` | 숫자 대조, 8쪽과 마주 보는 짝 확인 |
| 5 | **2–3** | 가로 3:2 | §0 + 2–3쪽 | Image 1 `p12.png` | 사람 0·시점·문구 확인 |
| 6 | **4–5** | 가로 3:2 | §0 + 4–5쪽 | Image 1 `p12.png` | 방위(동=왼쪽)·라벨 확인 |
| 7 | **6–7** | 가로 3:2 | §0 + 6–7쪽 | Image 1 `p12.png` | 박스 문장 대조 |
| 8 | **10–11** | 가로 3:2 | §0 + 10–11쪽 | Image 1 `p12.png` | 횃불 모양·산의 불빛·눈 없음 확인 |
| 9 | **14 → 15** (마주 보는 짝) | 세로 2:3 각각 | §0 + 14쪽 / §0 + 15쪽 | 각각 Image 1 `p12.png` | 숫자 12칸 대조, 지도 방위 검수 |
| 10 | **표지** | 세로 2:3 | 1A: 생성 없음 / 1B: §0 + 1B | 1B: Image 1 `attach/01B-geometry-guide.png`, Image 2 `p12.png` | 1A: Claude가 조판 / 1B: 능선 수치 검수, 로고 합성 |
| 11 (선택) | **13, 16** | 세로 2:3 | §0 + 13쪽 / §0 + 16쪽 | 각각 Image 1 `p12.png` | 시안으로만 쓴다(정본은 Claude의 HTML 조판) |
| 12 | — | — | — | — | Claude 마무리(부록 참조): 빈 본문 자리 측정 → 원고 원문 조판, 루비, 로고, 최종 검수 |

---

## §0. SERIES SYSTEM v3 — 모든 메시지 맨 앞에 붙인다

```
SERIES SYSTEM v3 — read all of this before drawing.

DELIVERABLE: one finished page image of a printed Japanese editorial magazine (a single page, a two-page spread, or the cover, as the PAGE block says). Calm, literate, generous white space. A typeset magazine page, not a poster, flyer or infographic template.

FORMAT: use the aspect ratio stated in the PAGE block (single pages portrait 2:3; spreads landscape 3:2, where the left page is the left half and the right page is the right half). The page fills the whole canvas: no mock-up, no photographed paper, no page curl, no drop shadow, no border.
SAFE AREA: no type in the top 7% or the bottom 7% of the canvas height. On spreads, also keep type at least 5% of the canvas width away from the left and right edges.

ATTACHMENTS — each one has a single role, named in the PAGE block:
- STYLE REFERENCE = an approved earlier page of this series. Match its paper colour, ink colours, typefaces, type sizes, rules, margins and illustration style. Do not copy its text, layout or picture content.
- GEOMETRY GUIDE = a black line drawing on the same canvas as the output. Use its lines only for the positions the PAGE block names. Never draw the guide lines.
- Logos are never drawn. Where the PAGE block says RESERVED, leave that area as plain paper or plain sky; it is filled later.

PALETTE: paper "snow" #eef0f4 (a very pale, cool grey-white). Ink "night" #151b2c (deep navy) for all type unless stated. Grey type = #7a8090. One accent, vermilion #d4462a, only on the elements the PAGE block names; never as a large filled area. Muted greens and greys are allowed inside illustrations.

TYPE: Japanese headlines in a bold, high-contrast Mincho (serif). Captions, labels and numerals in a clean Gothic (sans). VERTICAL means tategaki: characters upright, read top to bottom, columns ordered right to left; never a horizontal line rotated 90°.

GRID: outer margins about 7% of the page width. Text areas: 2 columns per single page; 4 columns across a spread, with an empty gutter at the centre fold. Align every block to the grid. Nothing crowded.

ILLUSTRATION: calm editorial gouache illustration, flat colour areas, soft natural light, no outlines, not photographic. People only as small distant figures or silhouettes, no recognisable faces. Every surface that could carry writing (shop fronts, signs, posters, banners, number plates, bowls, packaging) is plain and blank. A gate tablet, where a PAGE block asks for one, is drawn small with indistinct, unreadable marks.

HOW TEXT IS GIVEN:
- Every string to render has an ID in the PAGE block: T1, T2 … display text; B1, B2 … text set in RENDER mode; F = folio.
- The text is exactly what stands between the straight double quotes " ". Never draw the double quotes. Japanese brackets 「」 and 『』 inside a string are part of the text.
- A vertical bar | inside a string is a line break. Never draw the bar.
- Render each listed string exactly once (unless the PAGE block says otherwise), character for character, with its punctuation (、。「」（）・〜→). Do not translate, shorten, re-punctuate or reword anything.
- No other text anywhere: no magazine name outside the folio, no extra titles, captions, dates, labels, signatures, watermarks or logos.

BODY MODE (stated in each PAGE block):
- RESERVE: the page has a body text area whose size and place the PAGE block gives. Design and place it, and leave it completely blank: flat paper colour, no lines, no grey bars, no placeholder or imitation text. If the PAGE block says the area lies on a "calm dark image", leave it as calm dark image with no characters instead of paper. Text is added later.
- RENDER: set every B string in full where the PAGE block says. If a string cannot be set exactly, leave its place blank. Never write approximate or invented characters.

FOLIO (F): very small Gothic, ink colour unless the PAGE block says otherwise, at the bottom outer corner of each page, sitting just ABOVE the bottom 7% strip (never inside it): the page number, a space, then the F string. On a spread, F is drawn once on each page.

FINAL CHECK before you output: every T and B string appears exactly once (or as many times as the PAGE block says) and matches character for character; F appears once per page; no other text exists; vermilion appears only where stated; RESERVED and RESERVE areas are blank.
```

공통 폴리오(쪽 블록에서 쪽 번호와 함께 지정): `F "となり　一つの町　01　富士吉田"` [신규]

---

## STEP 1 — 12쪽 「終わりの一枚」 (세로 2:3) · 스타일 앵커 · 첨부 없음

**에디터 관점**
- 원고 마지막 단락을 그대로 그림으로 옮긴다: 「鳥居の柱のあいだに、富士山を見ることができる」.
- 쪽은 표지 문장의 숫자로 끝난다. 「30メートルほど」로 끝내서 표지의 질문에 답한다.

**검수 포인트**
- 鳥居는 동색이어야 한다. 주홍이면 즉시 탈락이다.
- 기둥 사이에 산이 있어야 한다.
- 산에 눈이 없어야 한다(8월 27일).
- B1을 한 자씩 대조한다.
- 주홍은 「30メートルほど」에만 쓴다.

```
PAGE 12 — closing page. Portrait 2:3.
BODY MODE: RENDER
ATTACHMENTS: none (this page becomes the STYLE REFERENCE for all others).

ILLUSTRATION (top 58% of the page, full bleed top and sides): We stand on the town street close to a large torii gate, near the west side of the road, looking south-southwest. The two copper-clad pillars of the gate (dark weathered-copper colour, NOT vermilion or red) rise as dark vertical bands near the left and right edges of the picture, and the crossbeams cross the top. Between the pillars, small and clear in the distance, Mount Fuji with NO snow (late August). Upper half mostly pale sky. Soft early-morning light. No people. Between its top beams the gate carries a framed tablet; keep the tablet small and its characters indistinct — no legible text.

BELOW THE ILLUSTRATION (snow paper):
T1 (left column, Gothic numerals, ink): "1788"
T2 (tiny Gothic label under T1): "最初の鳥居（富士講の信者が建てた）"
T3 (left column, Gothic numerals, ink, under T2): "1957"
T4 (tiny Gothic label under T3): "今の鳥居"
B1 (body Gothic, ink, one column to the right of the numbers; the characters 30メートルほど set slightly larger and in vermilion; nothing else in vermilion):
"翌27日の祭りは、金鳥居で行われる。鳥居の柱のあいだに、富士山を見ることができる。最初の鳥居は1788年に富士講の信者が建てた。1957年にできた今の鳥居は、もとの場所より30メートルほど富士山に近い。"
T5 (tiny grey Gothic, bottom right, just above the bottom 7% strip): "イラスト：生成AI"

FOLIO: bottom-left: "12" then F.
F "となり　一つの町　01　富士吉田"
This page contains exactly these strings: T1–T5, B1 and the folio.
```
[신규] T2·T4는 원고 문장을 줄인 라벨이다. 폴리오 F도 [신규]다.

---

## STEP 3 — 8쪽 「本町通り」 (세로 2:3) · 첨부: Image 1 `attach/08-geometry-guide.png`, Image 2 `p12.png`

**에디터 관점**
- 이 호에서 처음 보는 "그 풍경"이다.
- 가이드는 실제 本町通り 직선부(金鳥居 북쪽 800m)에서 본 실측이다. 근경의 길이 산정과 0.4° 차이라서, 원고 「正面に富士山が続くように見える」와 맞는다.

**검수 포인트**
- 능선 어긋남은 중앙값 6px 이하여야 한다.
- 차도 위에 사람이 0이어야 한다.
- 간판 글자가 0이어야 한다.
- 결정 ③에 따라 본문 자리가 바뀐다.

```
PAGE 8 — "本町通り". Portrait 2:3.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = GEOMETRY GUIDE (same canvas: the drawing occupies the top two-thirds, down to a thin grey line; the bottom third is blank and is the text area). Image 2 = STYLE REFERENCE.

ILLUSTRATION (top two-thirds, full bleed top and sides, bottom edge exactly at the grey line in Image 1): follow Image 1 exactly. The thick curve is the true skyline of Mount Fuji from this spot — same shape, height and position; do not make it taller, steeper or more symmetrical. The dashed line is the centre of a two-lane town street running straight away toward the mountain; in the near and middle distance it points almost exactly at the summit — keep it so. Far away, the dashed line jogs a little to the right just before the small cross and continues to the right beyond it — follow it exactly. At the small cross, a torii gate spans the street: copper-clad, dark weathered-copper colour, NOT red. Between its top beams the gate carries a framed tablet; keep the tablet small and its characters indistinct — no legible text. Low shop buildings, utility poles and wires on both sides. Mid-morning light, late summer, NO snow on the summit. A few tiny distant figures on the pavements only, never in the roadway, no faces.

CAPTION ON THE ILLUSTRATION (lower-left of the picture, small Gothic, snow colour):
T1 "正面に富士山が続くように見える"

TEXT AREA (bottom third, snow paper):
T2 (left, large bold Mincho, ink): "本町通り"
Body area (RESERVE): to the right of T2, two columns, for one paragraph of about 230 characters. Leave it blank paper.
T3 (small note box at the right end of the text area, thin vermilion outline, small Gothic, ink, wrapped to the box): "地元の観光案内は、車道に出て撮るのは危ないのでやめてほしいと呼びかけている。"
T4 (tiny grey Gothic, right-aligned at the bottom right of the text area, just above the bottom 7% strip): "イラスト：生成AI（構図は国土地理院の標高データとOpenStreetMapによる実測）"

FOLIO: bottom-left: "8" then F.
F "となり　一つの町　01　富士吉田"
This page contains exactly these strings: T1–T4 and the folio.
```
- **조판 본문**: 「本町通り」 한 단락(229자). 결정 ③을 따른다.
- [신규] T4. T1·T3은 원고 문구다. T3은 본문과 같은 문장인데, 박스로 다시 보여 준다.

---

## STEP 4 — 9쪽 「鳥居の先」 글·인포그래픽 (세로 2:3) · 첨부: Image 1 `p12.png`

**에디터 관점**
- 8쪽 그림과 마주 보는 문턱의 쪽이다. 「神域」을 크게 띄운다.
- 8日은 원고 문장을 그대로 두 마디와 합계로 나눈다. 귀로 일수는 지어내지 않는다.
- 86과 5는 화살표 없이 나란히 둔다.
- 1964가 낳은 쇠퇴 다음에 「それでも」로 19,860명을 잇는다.

**검수 포인트**
- 숫자 대조: 86·5·1964·1万9,860·3日·2日·8日.
- 「健脚でも」는 「片道3日」에만 붙는다.

```
PAGE 9 — "鳥居の先". Portrait 2:3. Typography and simple infographics only, no illustration.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE.

T1 (top-left, large bold Mincho, ink): "鳥居の先"
T2 (full width under T1, bold Mincho at about 60% of the size of T1, ink): "「そこから先が富士山の神域」"
T3 (small grey Gothic under T2, right-aligned): "——山梨県の資料"

INFOGRAPHIC A: one thin horizontal line in exactly two segments. Left segment in ink with label T4 above it; right segment drawn in vermilion with label T5 (ink) above it; T6 in bold ink Gothic just after the right end of the line. Do not draw or label any third segment.
T4 "江戸→吉田　健脚でも片道3日"
T5 "吉田⇄山頂　往復に少なくとも2日"
T6 "合わせて8日の旅"

INFOGRAPHIC B: two very large Gothic numbers side by side, NO arrow between them, ink.
T7 "86" with small label under it: T8 "御師の家（多いとき）"
T9 "5" with small label under it: T10 "今も講社を迎えている家"
T11 (one line of small Gothic spanning under both): "御師の家は多いときで86軒を数えた。今も講社を迎えている家は5軒だという。"

INFOGRAPHIC C: one row — a small number with its label, then a word, then a large number with its label.
T12 (small Gothic number, ink): "1964"
T13 (tiny label under T12): "富士スバルライン開通。吉田口登山道と富士講は急に衰えた"
T14 (bold Mincho, vermilion): "それでも"
T15 (large Gothic number, ink): "1万9,860人"
T16 (tiny label under T15): "2026年の登山シーズンに、麓の馬返しを通って歩いて登った人（富士吉田市）"

Body area (RESERVE): from 54% to 91% of the page height, two columns, for three paragraphs of about 100, 245 and 115 characters. Leave it blank paper.

FOLIO: bottom-right: "9" then F.
F "となり　一つの町　01　富士吉田"
This page contains exactly these strings: T1–T16 and the folio.
```
- **조판 본문**: 「鳥居の先」 세 단락(97·243·114자). 「鳥居の先が、冒頭の上吉田である。」는 한 줄 띄워 따로 세운다.
- [신규]
  - T3(원고 「県の資料は…と書く」)
  - T4–T6: 원고 문장 「江戸から吉田までは健脚でも片道3日かかり、吉田から山頂の往復に少なくとも2日、合わせて8日の旅だった」를 나눈 것이다.
  - T8·T10·T13·T16: 원고 문구로 만든 라벨이다.

---

## STEP 5 — 2–3쪽 펼침 「門の奥の水」 (가로 3:2) · 첨부: Image 1 `p12.png`

**에디터 관점**
- 첫 장면은 사람 없이 물소리로 연다.
- 시점은 中門을 막 지나 물길 옆에서 몸을 돌린 자리다. 원고 「振り返って空を見ると」를 따른다.
- 산은 옆집 지붕 위에 넓게 앉는다. 실측 앙각은 약 12°다.

**검수 포인트**
- 사람이 0이어야 한다.
- 산이 골목 정면 끝에 있으면 안 된다.
- 산이 과장되지 않아야 한다(넓고 낮게).

```
PAGE 2–3 — OPENING SPREAD "門の奥の水". Landscape 3:2.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE.

LAYOUT MAP (approximate, % of the whole spread):
- Illustration: x 0–64, full bleed top, bottom and left; its right edge is a clean vertical cut on the right page.
- Text column: x 68–94 on plain paper.

ILLUSTRATION: We have just stepped through a small one-bay roofed wooden inner gate (yakuimon style) at the end of a long, narrow private lane, and we stand beside a narrow channel of clear mountain water running fast across the ground at our feet. We have turned around: over the low roofs of the neighbouring house, Mount Fuji rises large — broad rather than tall, its summit only about 12 degrees above the horizon, with open sky above it. The gate and a glimpse of the lane are at one edge of the picture; the mountain is NOT at the far end of the lane. No people. Early morning, cool air, late summer, no snow on the summit.

TEXT (text column):
T1 (top, small Gothic, letter-spaced, vermilion): "一つの町　第1回　富士吉田"
T2 (VERTICAL headline, large bold Mincho, ink, under T1 at the right of the column): "門の奥の水"
Body area (RESERVE): to the left of T2, one column, from about 30% to 84% of the spread height, for two paragraphs of about 170 and 95 characters with a blank line between. Leave it blank paper.
T3 (bottom of the column at about 86–92% of the height, tiny grey Gothic, two lines): "冒頭の場面は資料をもとにした再構成です。|イラスト：生成AI"

FOLIOS: left page bottom-left "2" then F, on the illustration, in snow colour; right page bottom-right "3" then F, in ink.
F "となり　一つの町　01　富士吉田"
This spread contains exactly these strings: T1–T3 and F on each page.
```
- **조판 본문**: 「門の奥の水」 두 단락(171·95자). タツミチ·間の川는 굵게 하고 주홍 점을 찍어 13쪽과 잇는다.
- [신규] T3 첫 줄. 원고 머리의 「冒頭場面: 再構成」을 독자 표기로 옮겼다.

---

## STEP 6 — 4–5쪽 펼침 「山へ引かれた道」 (가로 3:2) · 첨부: Image 1 `p12.png`

**에디터 관점**
- 구조를 보여 주는 펼침이다. 「聖なる町と俗なる町」의 축을 처음 지도로 세운다.
- 풀쿼트를 감정의 중심으로 둔다.

**검수 포인트**
- **위=남, 東町(31軒)=왼쪽, 西町(39軒)=오른쪽.**
- 집은 필지 안쪽 깊숙이 있어야 한다.
- 필지 개수는 따지지 않는다.

```
PAGE 4–5 — SPREAD "山へ引かれた道". Landscape 3:2.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE.

LEFT PAGE — DIAGRAM (flat illustration, top-down view, ink lines and soft muted fills on snow paper). SOUTH IS AT THE TOP, so EAST IS ON THE LEFT and WEST IS ON THE RIGHT.
- A single straight street runs from the bottom of the page up to the top, where a simple flat silhouette of Mount Fuji sits at the top edge.
- On both sides, many long, narrow strip-shaped lots (like the teeth of a comb) run back from the street. In each lot a narrow lane leads in from the street, and a small house sits set back deep inside the lot, away from the street. Draw the lots as an even pattern; do not try to draw an exact number.
- Below the lots the street continues and fades out toward the bottom.
Labels (small Gothic, ink unless stated):
T1 (top, beside the mountain): "富士山"
T2 (on the LEFT row): "東町　31軒"
T3 (on the RIGHT row): "西町　39軒"
T4 (small arrow along the street pointing up): "南へ"
T5 (grey area label over the lots): "「聖なる町」（上吉田）"
T6 (grey area label below the lots, near the faded street): "「俗なる町」（下吉田）"
T7 (lower-left of the left page at about 68–82% of the height, above the folio; large Gothic numerals, vermilion): "1572"
T8 (directly under T7, small Gothic): "元亀3年（1572年）"
T9 (tiny grey caption under the diagram): "町割りの概念図（軒数は文中の数字）"

RIGHT PAGE:
T10 (headline, large bold Mincho, ink, horizontal, top): "山へ引かれた道"
Body area (RESERVE): under T10, two columns, upper half of the right page, for two paragraphs of about 215 and 165 characters. Leave it blank paper.
T11 (PULL QUOTE, lower half of the right page, alone, bold Mincho about 1.3× the size of T10, set in two lines, ink, a thin vermilion rule above it, generous space around): "「聖なる町と俗なる町」が|隣り合う"

FOLIOS: left page bottom-left "4" then F; right page bottom-right "5" then F.
F "となり　一つの町　01　富士吉田"
This spread contains exactly these strings: T1–T11 and F on each page.
```
- **조판 본문**: 「山へ引かれた道」 두 단락(216·167자).
- [신규] T1·T4·T9. T5·T6은 원고 (4)의 표기다.

---

## STEP 7 — 6–7쪽 펼침 「機の町」 (가로 3:2) · 첨부: Image 1 `p12.png`

**에디터 관점**
- 왼쪽에는 비단 한 폭의 빛만 둔다.
- 오른쪽에는 글과 사이드 스택(4割·박스 2개·우동)을 둔다.
- 「俗なる町」 키커로 4–5쪽의 축을 잇는다.

**검수 포인트**
- 비단에 라벨이 없어야 한다.
- 우동은 굵은 면, 단순한 그릇이어야 한다.
- 박스 문장을 대조한다.

```
PAGE 6–7 — SPREAD "機の町". Landscape 3:2.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE.

LAYOUT MAP (approximate, % of the whole spread):
- Left page, x 0–50: one illustration, full bleed on the top, bottom and left edges, stopping exactly at the centre fold.
- Right page on plain paper: headline zone x 54–96, y 9–20; body zone x 54–80, y 23–86 (two columns); side stack x 82–95, bottom edge at y 86, from top to bottom: big number, box 1, box 2, udon illustration with caption.

ILLUSTRATION (left page): close-up still life of a very thin, light silk fabric draped in soft folds on a dark wooden table, catching side light so it shows a delicate shifting sheen. Beside it, a few spools of very fine thread. Plain fabric, no labels, no packaging. Keep the lower-left area darker and calm for the caption.

CAPTION ON THE ILLUSTRATION (left page, at about 80–89% of the height, left-aligned, small Gothic, snow colour, two lines):
T1 "「非常に軽く、平滑な薄手」"
T2 "県の甲斐絹ミュージアムの説明より"

HEADLINE ZONE (right page):
T3 (small Gothic, vermilion, above the headline): "「俗なる町」の側"
T4 (large bold Mincho, ink, horizontal): "機の町"

SIDE STACK:
T5 (large Gothic numerals, vermilion): "4割"
T6 (small Gothic under it): "国産ネクタイ生地のうち、ここの生地が使われている割合"
Box 1 (thin ink outline; big word in vermilion Gothic at left, sentence in small ink Gothic at right): big T7 "第3土曜" — sentence T8 "毎月第3土曜日には工場を開いて見学者を迎えている。"
Box 2 (same style): big T9 "昼だけ" — sentence T10 "吉田のうどんの店の多くは、今も昼だけ開く。"
UDON ILLUSTRATION (square, bottom of the stack): overhead view of one bowl of very thick, firm white udon noodles in a light brown miso-and-soy broth with a little boiled cabbage, on a plain wooden counter, chopsticks resting on the bowl, plain bowl. Caption under it, tiny ink Gothic: T11 "吉田のうどん"
T12 (tiny grey Gothic, left-aligned at x 54% of the spread, at the bottom of the body zone, just above the bottom 7% strip): "イラスト：生成AI"

Body area (RESERVE): the body zone above, four paragraphs, about 640 characters in total, two columns. Leave this whole zone blank paper.

FOLIOS: left page bottom-left "6" then F, on the illustration, in snow colour; right page bottom-right "7" then F, in ink.
F "となり　一つの町　01　富士吉田"
This spread contains exactly these strings: T1–T12 and F on each page.
```
- **조판 본문**: 「機の町」 네 단락(56·209·102·270자).
- **우동 그림의 양배추**: 출처표 B47이 주재료로 든다. 원고 본문에는 없는 그림 디테일이다.
- [신규] T2·T3·T6, 박스 머리말 T7·T9.

---

## STEP 8 — 10–11쪽 펼침 「火の夜」 (가로 3:2) · 첨부: Image 1 `p12.png`

**에디터 관점**
- 호의 클라이맥스다. 밤 펼침 전체를 그림으로 덮는다.
- 첫 단락만 어둠 속에 흰 글씨로 둔다.
- 둘째 단락은 12쪽 마지막 장에서 이어진다.

**검수 포인트**
- 횃불은 가늘고 높은 원뿔(죽순) 모양이어야 한다.
- 산의 불빛이 분화로 보이면 안 된다.
- 얼굴이 0이어야 한다.
- 눈이 없어야 한다.

```
PAGE 10–11 — SPREAD "火の夜". Landscape 3:2. Night spread: the illustration covers the entire spread edge to edge; all text is snow-coloured on the dark image.
BODY MODE: RESERVE (on a calm dark image)
ATTACHMENTS: Image 1 = STYLE REFERENCE (use it for typefaces, type colours and illustration technique only; this page is at night).

ILLUSTRATION (full bleed): Night in a long, straight town street that rises gently toward Mount Fuji. Down the street stand tall bonfire torches, each about three metres high (nearly twice a person's height) and shaped like a giant bamboo shoot — a tall, slender cone — all burning brightly so the street is lit as bright as day, warm orange light on the road. Far away, the dark silhouette of Mount Fuji against a deep navy late-summer sky, NO snow on the summit, with a thin line of tiny steady fire points on its slope where the mountain huts light their own fires (NOT an eruption, NOT lava). Crowds only as dark silhouettes, no faces, no lettering on any clothing. Keep the lower-left quarter darker and calmer for text.

TEXT (snow colour #eef0f4 on the image):
T1 (entirely on the left page, top at about 9% of the height, Gothic characters about 12% of the spread height tall): "8月26日"
T2 (under T1, large bold Mincho): "火の夜"
T3 (a thin snow-coloured annotation line pointing to one torch on the right page, with small Gothic text): "高さ約3メートル、直径約90センチ"
Body area (RESERVE, on a calm dark image): lower-left of the left page, two narrow columns, for one paragraph of about 165 characters. Leave it as calm dark image with no characters.
T4 (lower part of the right page, PULL QUOTE, large Mincho, snow colour, a thin vermilion rule above): "「真昼のように明るく」"
T5 (under T4, small Gothic): "——『甲斐国志』の記述を紹介する、山梨県立富士山世界遺産センターの解説より"
T6 (tiny, bottom of the right page, just left of the page-11 folio): "イラスト：生成AI"

FOLIOS: left page bottom-left "10" then F; right page bottom-right "11" then F; both in snow colour.
F "となり　一つの町　01　富士吉田"
This spread contains exactly these strings: T1–T6 and F on each page.
```
- **조판 본문**: 「火の夜」 첫 단락(164자)을 흰 글씨로 넣는다.
- [신규] T5. 출처표 A01·A55의 경로를 밝혔다.

---

## STEP 9a — 14쪽 「数字で読む富士吉田」 (세로 2:3) · 첨부: Image 1 `p12.png` [신규 꼭지명]

**에디터 관점**
- 본문의 숫자 12개를 한 장에 모은다.
- 원고의 유보 표현(ほど·約·だという)을 그대로 둔다.
- 15쪽 지도와 마주 본다.

**검수 포인트**: 12칸을 원고와 한 줄씩 대조한다. 하나라도 틀리면 탈락이다.

```
PAGE 14 — "数字で読む富士吉田". Portrait 2:3. Typography only.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE.

T1 (top, large bold Mincho, ink): "数字で読む富士吉田"
GRID: 12 cells, 3 columns × 4 rows, thin ink hairlines between cells. In each cell: the number string in large Gothic (ink; cells B1, B5 and B12 in vermilion) and under it the label in small Gothic. Each B is "number" / "label":
B1  "1572" / "上吉田の町が今の場所にできた年（元亀3年）"
B2  "70軒" / "新しい町に御師や神職、商人、職人が住んだ家の数（東町31軒、西町39軒）"
B3  "約125メートル" / "下吉田駅から富士山駅まで約8キロの散策コースの高低差"
B4  "700〜900メートルほど" / "標高。冷涼な気候と火山灰の土で、稲づくりに向かなかった"
B5  "4割" / "国産ネクタイ生地のうち、ここの生地が使われている割合"
B6  "第3土曜日" / "毎月、工場を開いて見学者を迎える日"
B7  "2000人ほど" / "本町通りを訪れる人の1日平均（市が報道の取材に答えた数）"
B8  "8日" / "健脚でも片道3日、山頂の往復に少なくとも2日。合わせて8日の旅"
B9  "86　／　5" / "御師の家（多いとき）と、今も講社を迎えているという家"
B10 "1万9,860人" / "2026年の登山シーズンに、麓の馬返しを通って歩いて登った人"
B11 "約3メートル" / "火祭の大松明の高さ（直径約90センチ）"
B12 "30メートルほど" / "今の金鳥居が、もとの場所より富士山に近い距離"
T2 (bottom, tiny grey Gothic, just above the bottom 7% strip): "数字はすべて本文の出典による"

FOLIO: bottom-left: "14" then F.
F "となり　一つの町　01　富士吉田"
This page contains exactly these strings: T1, the 24 strings of B1–B12, T2 and the folio.
```
- [신규] 꼭지명, 셀 라벨(원고 문장을 줄인 것), T2.
- **결정 ③에서 삭제를 고르면**: B7을 뺀다. 이때 GRID 줄은 `11 cells … the last cell (bottom-right) is left as empty paper. Vermilion: B1, B5 and B12.`로 바꾼다.

---

## STEP 9b — 15쪽 「富士みち略図」+「歩くなら」 (세로 2:3) · 첨부: Image 1 `p12.png` [신규 꼭지명]

**에디터 관점**
- 손그림 지도를 쓰되 「略図・縮尺なし」를 밝힌다.
- 아래에 "가기 전 다섯 줄"과 글이 있는 쪽 번호를 둔다.

**검수 포인트** (OSM 실측 근거: `../../prototype/cover-machi01/02-map/NOTES.md`, 지리 감사)
- **위=산, 왼쪽=동, 오른쪽=서.**
- 下吉田의 꺾임 아래 다리는 **왼쪽 아래**로 나가야 한다.
- 꺾임과 金鳥居 사이 직선은 **산정을 거의 정확히** 향해야 한다.
- 金鳥居에서 **오른쪽으로 약 6°** 꺾여 上宿에서 끝나야 한다.
- 富士山駅은 金鳥居 **오른쪽, 같은 높이**, 선 밖에 있어야 한다.
- 下吉田駅은 꺾임 아래·오른쪽·선 밖에 있어야 한다.
- 北口本宮은 선 끝의 왼쪽 위, 선 밖에 있어야 한다.

```
PAGE 15 — map and practical box. Portrait 2:3.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE.

T1 (top, large bold Mincho, ink): "富士みち略図"
T2 (right of T1, small grey Gothic): "略図・縮尺なし"

MAP (upper 60% of the page): hand-drawn style schematic on snow paper, ink line work, one vermilion line. The map is turned so that the summit of Mount Fuji is straight UP; north is toward the bottom. Therefore EAST is on the LEFT and WEST is on the RIGHT.
- Top edge: a simple flat silhouette of Mount Fuji, labelled T3 "富士山".
- The vermilion road line: near the bottom it has one bend labelled T4 "下吉田"; BELOW the bend the line leaves toward the lower LEFT. ABOVE the bend the line runs straight up, aimed at the summit (within about 1 degree). At a small ink torii symbol across the line, labelled T5 "金鳥居", the line turns to the RIGHT by about 6 degrees and soon ends at a junction labelled T6 "上宿の交差点".
- T7 "下吉田駅": a small station mark just below the bend, a little to the RIGHT of the line, off the line.
- T8 "本町通り": along the straight part between the bend and the torii.
- T9 "富士山駅": a small station mark to the RIGHT (west) of the torii, at about the same height, off the line.
- T10 "上吉田（御師の町）": along the short part between the torii and the junction.
- T11 "北口本宮冨士浅間神社": a small shrine mark a little ABOVE and to the LEFT of the junction, clearly OFF the line.
- Grey area labels: T12 "「俗なる町」（下吉田）" around the lower part; T13 "「聖なる町」（上吉田）" around the upper part.

BOX (lower part, thin ink outline; title in bold Mincho; five lines of small Gothic, each starting with a small vermilion dot and ending with a tiny grey page reference):
T14 (title): "歩くなら"
T15 "下吉田駅から富士山駅まで、県の散策コースは約8キロ、高低差は約125メートル　→P.5"
T16 "毎月第3土曜日には、工場を開いて見学者を迎えている　→P.7"
T17 "吉田のうどんの店の多くは、昼だけ開く　→P.7"
T18 "本町通りでは、車道に出て撮るのは危ない（地元の観光案内の呼びかけ）　→P.8"
T19 "8月26日の夜は、吉田の火祭　→P.10"

T20 (bottom, tiny grey Gothic, two lines, just above the bottom 7% strip): "地図は概念図です。道の位置関係はOpenStreetMapによる|上は金鳥居から見た山頂（剣ヶ峯）の方角"

FOLIO: bottom-right: "15" then F.
F "となり　一つの町　01　富士吉田"
This page contains exactly these strings: T1–T20 and the folio.
```
- [신규] T1·T2·T14·T20, 다섯 줄(원고 문장을 줄인 것), 쪽 번호.
- T18은 결정 ③을 따른다.
- **산을 「富士山」으로만 쓴 이유**: 金鳥居에서는 剣ヶ峯이 북쪽 화구벽에 가려 보이지 않는다(04-factcheck §5). 그래서 剣ヶ峯은 「방향」으로만 쓴다.

---

## STEP 10 — 표지

**1A (권고)**
- Claude가 조판한다. 실측 지도 표지(`../../prototype/cover-machi01/13-mark/`)에 새 마크를 얹는다.
- 부제의 「30メートルほど」만 주홍으로 한다.
- 오너가 생성할 것은 없다.

**1B (그림 표지)**
- 첨부: Image 1 `attach/01B-geometry-guide.png`, Image 2 `p12.png`.
- 8쪽과 같은 시점의 풍경이다.

```
PAGE 1 — COVER. Portrait 2:3.
BODY MODE: (none)
ATTACHMENTS: Image 1 = GEOMETRY GUIDE (same canvas). Image 2 = STYLE REFERENCE.

ILLUSTRATION (whole page, edge to edge): Use Image 1 as the exact composition. The thick black curve is the true skyline of Mount Fuji from this spot, computed from elevation data — follow it exactly (same shape, height and position); do not make it taller, steeper or more symmetrical. The dashed line is the centre line of a two-lane town street running away toward the mountain — in the near and middle distance it points almost exactly at the summit; far away it jogs a little to the right just before the small cross and continues right beyond it — follow it exactly. At the small cross stands a torii gate across the street: copper-clad, dark weathered-copper colour, NOT vermilion or red. Between its top beams the gate carries a framed tablet; keep the tablet small and its characters indistinct — no legible text. Low two- and three-storey shop buildings with utility poles and wires line both sides. Clear morning, pale sky, late summer, NO snow on the summit. Do not draw the guide lines.

MASTHEAD: RESERVED — x 20–80%, y 7–20% of the page: plain sky (a logo is added later).

TEXT:
T1 (in the open sky to the LEFT of the summit, left-aligned, x 8–38%, y 21–24%; small Gothic, letter-spaced, ink): "一つの町　01"
T2 (under T1, same left alignment, y 24–31%; large bold Mincho, ink; must not touch or cover the mountain outline): "富士吉田"
T3 (VERTICAL, at about x 91%, y 22–36%, in the sky, small Mincho, ink): "富士みち"
Bottom band: a soft snow-coloured panel across the full width from 79% to 89% of the page height; inside, centred, one line of medium bold Gothic, ink, with only the characters 30メートルほど in vermilion:
T4 "今の金鳥居は、もとの場所より30メートルほど山に近い。"
T5 (centred, tiny grey Gothic, at about 90–92% of the height): "イラスト：生成AI（構図は国土地理院の標高データとOpenStreetMapによる実測）"

No other text: no barcode, no price, no date, no folio on the cover.
This page contains exactly these strings: T1–T5.
```
[신규] T1(호 표기), T5.

---

## STEP 11 (선택) — 13쪽 「この町のことば」, 16쪽 奥付 · 첨부: 각각 Image 1 `p12.png`

두 쪽 모두 **정본은 Claude의 HTML 조판**이다.
- 13쪽은 탭하면 단어가 저장되게 만들어야 한다.
- 16쪽에는 법적 출처 표기가 들어간다.

생성기 판은 지면 디자인 시안으로만 쓴다.

```
PAGE 13 — "この町のことば". Portrait 2:3. Typography only, like a small dictionary page.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE.

T1 (top, large bold Mincho, ink): "この町のことば"
LIST: 9 entries in two columns, thin hairline between entries. Each entry: the headword in bold Mincho (ink, about twice the body size) with a small vermilion dot before it; on the next lines its meaning in small Gothic. Each B is "headword" / "meaning":
B1 "富士みち" / "富士講が富士山へ向かった道。県は今の国道139号の愛称として紹介し、北口本宮は「現国道137号線」と書く"
B2 "御師（おし）" / "富士講の人びとを泊め、祈祷や案内をした人びと"
B3 "タツミチ" / "御師の家の表通りから奥へ入る細長い引き込み路"
B4 "間の川" / "御師の家の中門の奥を流れる水路。禊に使った"
B5 "一ノ鳥居" / "山頂までに立つ鳥居の一番目。金鳥居のこと"
B6 "構成資産" / "世界遺産「富士山」を形づくる個々の資産。全部で25ある"
B7 "取り次ぎ" / "御師の仕事の一つ。本文では北口本宮冨士浅間神社の説明の言葉（「取次」）をそのまま使った"
B8 "ガチャマン" / "戦後の織物の好景気を指すことば"
B9 "吉田のうどん" / "太く硬い麺を味噌や醤油の汁で食べる郷土料理"
After the meanings of B3 and B4 only, a tiny grey "→P.3" (this mark appears exactly twice).

FOLIO: bottom-right: "13" then F.
F "となり　一つの町　01　富士吉田"
This page contains exactly these strings: T1, the 18 strings of B1–B9, "→P.3" twice, and the folio.
```

```
PAGE 16 — colophon. Portrait 2:3. Typography only, very quiet, lots of white space.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE.

T1 (upper half, centred, large bold Mincho, ink): "一つの町　01　富士吉田"
Lower half, small Gothic, ink, left-aligned, one line each:
T2 "文・構成　となり編集部"
T3 "イラスト　生成AI（8ページの構図は、国土地理院の標高データとOpenStreetMapによる実測）"
T4 "地図　© OpenStreetMap contributors（ODbL）openstreetmap.org/copyright"
T5 "標高　国土地理院"
T6 "冒頭の場面は資料をもとにした再構成です。"
T7 "本文の事実は、すべて公的機関・神社・観光団体・報道の原文と照らし合わせて確かめています。"

FOLIO: bottom-left: "16" then F.
F "となり　一つの町　01　富士吉田"
This page contains exactly these strings: T1–T7 and the folio.
```
[신규] 13쪽 「→P.3」, 16쪽 전체.
- 16쪽 T7은 원고 출처표의 1차·2차 행(공적 기관·神社·관광재단·보도)에 맞춘 문장이다.
- 결정 ③에서 단락을 삭제하면 「・報道」를 뺀다.
- 결정 ④에서 1B를 고르면 T3을 「表紙と8ページの構図は」로 바꾼다.

---

## 부록 — STEP 12: Claude의 마무리 (생성 뒤)

| 일 | 내용 |
|---|---|
| 본문 조판 | 2–3·4–5·6–7·8·9·10–11쪽의 빈 자리를 실측해, 원고 원문을 그대로 넣는다. Shippori Mincho / Zen Kaku Gothic New(OFL). 기존 `05-compose` 경로를 쓴다 |
| 12쪽 본문 | 생성된 글자가 틀리면 원문 조판으로 덮는다 |
| 로고 | 1A 표지 조판, 또는 1B의 RESERVED 자리에 SVG 합성 |
| 루비 | **일본 잡지 관행**(오너 기준 2026-10-16 KST: 학습자 배려 없이 실제 일본 매거진으로): 표지·제목에는 달지 않는다. 본문에서 일본 성인 독자에게도 어려운 말이나 고유한 읽기에만, 첫 등장 때 한 번 단다(パラルビ). 출처로 읽기를 확인한 것만: 御師（おし, 원고）·雪代（ゆきしろ, A07 1次）·金鳥居（かなどりい, 山梨県立富士山世界遺産センター 리플릿 r1kikakuten1）·甲斐絹（かいき, 山梨県立博物館 「甲斐絹物語」）·点（とも）される(표외 읽기). 間の川·上宿은 읽기 출처를 찾을 때까지 달지 않는다. 禊·筍·郡内·馬返し·大松明·講社·祈祷는 일본 성인이 읽는 말이라 달지 않는다 |
| 앱 연동 | 지면에는 학습 장치를 넣지 않는다(오너 기준). 앱 쪽에서 뷰어의 원고 장으로 이어지는 연동은 지면 밖 UI의 일이다 |
| 검수 | 표시 문구를 한 자씩 대조하고, `visual-review.md`로 본다. 8쪽은 `VIEW_OUT=out-honcho-p8 CROP_TOP_SQUARE=1 python3 -I …/14-view/verify.py`, 1B는 `VIEW_OUT=out-honcho …/verify.py` |

**정리된 판단**: 표지 문장 「もとの場所より30メートルほど」는 그대로 둔다(오너 2026-10-16 KST: 처음 접하는 독자에게 추정 여부는 중요하지 않다). 원 출처(B93)의 「歴史学者が考えている位置」는 원고 출처표 기록으로 남긴다.
