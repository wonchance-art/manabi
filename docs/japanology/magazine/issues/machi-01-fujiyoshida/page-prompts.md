# 一つの町 01 富士吉田 — 16쪽 완성 지면 프롬프트 v2 (2026-10-16 KST)

**오너 지시**: 「이미지뿐 아니라 어디에 어떤 문구가 어떤 식으로 나올지, 모든 연출을 포함해서 맡긴다. 한 장 한 장 공들여 구성하라. popeye/brutus/&premium 에디터와 열혈 독자의 관점으로 설계하라.」 이어서 「에이전트 풀가동」.

**v1 → v2.** 에이전트 5명이 v1을 검토했다. 검토 결과를 반영해 다시 썼다.

| 에이전트 | 결과 |
|---|---|
| 문구 대조 | 본문 13단락과 ことば 9항목은 원고와 완전 일치. 새 라벨에서 19건 수정 |
| 지리·시각 사실 | 확정 오류 3건, 위치 불일치 1건 |
| 3인 편집 패널(B/P/&P 감각) | 후반부 재배열 |
| 열혈 독자 3인 | 방위 신뢰도, 학습 순환 |
| 생성기 프롬프트 공학 | 글자 렌더링 한계, 2단계 워크플로 |

## 왜 이렇게 바꿨나 (요지)
1. **방위 오류를 고쳤다.** 남쪽(富士山)이 위인 그림에서는 서쪽이 오른쪽이다.
   - 4–5쪽: 東町=왼쪽, 西町=오른쪽.
   - 15쪽: 富士山駅=金鳥居의 오른쪽(서).
   - 2–3쪽: 골목 축을 보면 富士山은 옆(약 90°)에 있다. 원고도 「振り返って」라고 쓴다. 그래서 시점을 바꿨다.
2. **8쪽 本町通り의 시점을 실제 本町通り로 옮겼다.**
   - v1 가이드는 金鳥居 바로 앞 100m였다.
   - 新 가이드는 金鳥居 북쪽 800m, 下吉田 직선부다. 길이 산정과 0.4° 차이로 「정면에 富士山이 이어져 보이는」 구간이다(`14-view/out-honcho-p8/`).
3. **후반부를 다시 짰다.**
   - v1 문제
     - 11–12 펼침은 인쇄본에서 마주 보지 않는다.
     - 표지·8·9쪽이 같은 풍경을 세 번 쓴다.
     - 9쪽이 30m의 답을 미리 말한다.
   - v2 순서
     - **8 本町通り(그림) ↔ 9 鳥居の先(글·인포그래픽)**
     - **10–11 火の夜(펼침)**
     - **12 終わりの一枚(기둥 사이 富士山, 마지막 단락 「…30メートルほど富士山に近い。」로 끝)**
     - 13 ことば ↔ 14 数字 / 15 略図 ↔ 16 奥付
   - 표지의 질문에 이 호의 마지막 문장으로 답한다.
4. **본문은 생성기에 맡기지 않는다(BODY MODE: RESERVE).**
   - 생성기는 본문 자리의 **위치·크기·단 배치까지 설계**하고, 빈 종이로 남긴다.
   - Claude가 원고 원문을 한 바이트도 바꾸지 않고 그 자리에 조판한다(기존 `05-compose` 조판 경로 재사용).
   - 이유: 640자 본문을 1536px 펼침에 넣으면 글자 하나가 약 16px이다. 오자가 사실상 확실하다(OpenAI 공식 한계 문구와 실측 보고).
   - 제목·숫자·캡션 같은 표시 문구(T)는 생성기가 그린다. "어디에 어떤 문구가 어떤 식으로"는 생성기가 정한다.
5. **로고는 생성기가 그리지 않는다(RESERVED).**
   - 이미지 모델에는 '붙여넣기'가 없어 로고를 다시 그린다.
   - 마크는 Claude가 SVG로 합성한다.
6. **원고의 유보 표현을 되살렸다.**
   - 「ほど」(30m·2000人·700〜900m)
   - 「だという」(5軒)
   - 70은 「住んだ家の数」
   - 8日 막대는 귀로 일수를 지어내지 않는 문장형으로 바꿨다.
   - 『甲斐国志』 인용은 출처 경로를 바르게 붙였다(富士山世界遺産センターの解説).
   - 「地元の観光案内」 문장은 직접 인용 형식을 없앴다.

## 쓰는 법 (오너)
1. **스타일 앵커 먼저.**
   - 12쪽(終わりの一枚)을 먼저 생성해 확정한다. 그림·명조·숫자·짧은 본문이 모두 있는 쪽이다.
   - 이후 모든 쪽에 그 그림을 **STYLE REFERENCE**로 첨부한다. 16장이 한 호처럼 보이게 하기 위해서다.
2. **쪽마다 새 대화.** 메시지 하나를 `SERIES SYSTEM v2`(§0) + 그 쪽 `PAGE` 블록으로 만든다.
3. **비율은 ChatGPT의 비율 선택기로 고른다.** 단면은 세로 2:3, 펼침은 가로 3:2다. 프롬프트의 픽셀 수는 효과가 없다.
4. **받으면** 새 메시지에 첨부하고 쪽 번호를 알려 준다. 작업 중에 보낸 것은 파일로 저장되지 않는다.
5. **Claude가 하는 일**
   - 표시 문구 대조
   - 방위·사실 검수(`visual-review.md`)
   - 8쪽 능선 수치 검수
   - 빈 본문 자리 측정 → 원고 원문 조판
   - 로고 합성
   - 루비·학습 장치(HTML 층)
6. **고칠 때**는 같은 대화에서 `Keep everything identical except: ___`로 한 군데만 고친다. 3번 안에 안 되면 Claude에게 넘긴다.

**인쇄 판형 메모**
- 2:3 그림을 A4(1:√2)로 자르면 높이의 약 6%가 잘린다.
- 그래서 폴리오와 크레딧은 아래 7% 안쪽에 두도록 지시했다.
- 판형은 확정할 때 다시 본다.

**[신규] 표시**: 원고에 없는 지면 문구(꼭지명·라벨·안내)는 [신규]로 표시했다. 모두 편집장 확인 대상이고, 새 사실은 없다.

---

## 0. SERIES SYSTEM v2 — 모든 쪽 프롬프트 맨 앞에 붙인다

```
SERIES SYSTEM v2 — read all of this before drawing.

DELIVERABLE: one finished page image of a printed Japanese editorial magazine (a single page, a two-page spread, or the cover, as the PAGE block says). Calm, literate, generous white space. A typeset magazine page, not a poster, flyer or infographic template.

FORMAT: use the aspect ratio stated in the PAGE block (single pages portrait 2:3, spreads landscape 3:2). The page fills the whole canvas: no mock-up, no photographed paper, no page curl, no drop shadow, no border. Keep all type at least 7% away from the top and bottom edges.

ATTACHMENTS — each one has a single role, named in the PAGE block:
- STYLE REFERENCE = an approved earlier page of this series. Match its paper colour, ink colours, typefaces, type sizes, rules, margins and illustration style. Do not copy its text, layout or picture content.
- GEOMETRY GUIDE = a black line drawing on the same canvas as the output. Use its lines only for the positions the PAGE block names. Never draw the guide lines.
- Logos are never drawn. Where the PAGE block says RESERVED, leave that area as plain paper or plain sky; it is filled later.

PALETTE: paper "snow" #eef0f4 (a very pale, cool grey-white). Ink "night" #151b2c (deep navy) for all type unless stated. One accent, vermilion #d4462a, only on the small elements the PAGE block names; never on large areas. Muted greens and greys are allowed inside illustrations.

TYPE: Japanese headlines in a bold, high-contrast Mincho (serif). Captions, labels and numerals in a clean Gothic (sans). VERTICAL means tategaki: characters upright, read top to bottom, columns ordered right to left; never a horizontal line rotated 90°.

GRID: outer margins about 7% of the page width. Text areas: 2 columns per single page; 4 columns across a spread, with an empty gutter at the centre fold. Align every block to the grid. Nothing crowded.

ILLUSTRATION: calm editorial gouache illustration, flat colour areas, soft natural light, no outlines, not photographic. People only as small distant figures or silhouettes, no recognisable faces. Every surface that could carry writing (shop fronts, signs, posters, banners, number plates, bowls, packaging, gate tablets) is plain and blank.

HOW TEXT IS GIVEN:
- Every string to render has an ID in the PAGE block: T1, T2 … display text; B1, B2 … body paragraphs; F = folio.
- The text is exactly what stands between the straight double quotes " ". Never draw the double quotes. Japanese brackets 「」 and 『』 inside a string are part of the text.
- A vertical bar | inside a string is a line break. Never draw the bar.
- Render each listed string exactly once, character for character, with its punctuation (、。「」（）・〜→). Do not translate, shorten, re-punctuate or reword anything.
- No other text anywhere: no magazine name outside the folio, no extra titles, captions, dates, labels, signatures, watermarks or logos.

BODY MODE (stated in each PAGE block):
- RESERVE: B paragraphs are NOT drawn. Design and place their text area at the size stated, and leave it as completely blank paper: flat #eef0f4, no lines, no grey bars, no placeholder or imitation text. Render all T and F strings and the illustration normally.
- RENDER: set every B paragraph in full in its area, small Gothic body text, line spacing about 1.8. If a paragraph cannot be set exactly, leave its area blank paper as in RESERVE. Never write approximate or invented characters.

FOLIO (F): very small Gothic, ink colour, at the bottom outer corner of each page, inside the 7% safe band: the page number, a space, then the folio string.

FINAL CHECK before you output: every T, B (RENDER only) and F string appears exactly once and matches character for character; no other text exists; vermilion appears only where stated; RESERVED and RESERVE areas are blank.
```

공통 폴리오: `F "となり　一つの町 01　富士吉田"`(각 쪽 블록에서 쪽 번호와 함께 지정)

---

## 1쪽 — 표지

**결정 권고**: 표지는 **1A(Claude 조판)** 로 한다. 확정된 실측 지도 표지(`prototype/cover-machi01/13-mark/` 4안)에 새 마크를 얹는다.
- 편집 패널 통합안이다. 일러스트 거리 풍경은 8쪽에서 한 번만 쓴다.
- 부제는 「30メートル」만 주홍으로 한다(B안).

1B는 그림 표지를 원할 때를 위한 생성기용 대안이다. 1B를 쓰면 8쪽과 같은 풍경이 되므로 8쪽 구도를 바꿔야 한다.

**에디터/독자 관점**
- 표지는 "한 문장"으로 산다. 「今の金鳥居は、もとの場所より30メートルほど山に近い。」 — 사실 하나, 숫자 하나, 그리고 '왜?'.
- 독자는 30이라는 숫자에 걸리고, 마지막 쪽(12쪽)에서 같은 문장으로 착지한다.

### 1B (선택) — 그림 표지, 세로 2:3 · 첨부: GEOMETRY GUIDE = `14-view/out-honcho/guide.png`
```
PAGE 1 — COVER. Portrait 2:3.
BODY MODE: (none — no body text on this page)
ATTACHMENTS: Image 1 = GEOMETRY GUIDE (black line drawing, same canvas).

ILLUSTRATION (whole page, edge to edge): Use Image 1 as the exact composition. The thick black curve is the true skyline of Mount Fuji from this spot, computed from elevation data — the mountain's outline must follow it exactly (same shape, height and position); do not make it taller, steeper or more symmetrical. The dashed line is the centre line of a two-lane town street running away from the viewer toward the mountain — keep its position exactly: near the bottom it runs almost straight at the summit, and far away, near the small cross, it bends a little to the right; that bend is correct. At the small cross stands a large torii gate across the street: copper-clad, dark weathered-copper colour, NOT vermilion or red; if it has a tablet, the tablet is blank. Low two- and three-storey shop buildings with utility poles and wires line both sides. Clear early morning, pale sky. Do not draw the guide lines.

MASTHEAD: RESERVED — the top 22% of the page, centred, is left as plain sky (a logo is added later).

TEXT:
T1 (directly under the reserved masthead area, centred, small Gothic, letter-spaced, ink): "一つの町　01"
T2 (under T1, centred, large bold Mincho, ink): "富士吉田"
T3 (VERTICAL, along the right edge in the sky, small Mincho, ink): "富士みち"
Bottom band: a soft snow-coloured panel across the full width, about 12% of the page height, ending 7% above the bottom edge; inside, centred, one line of medium bold Gothic, ink, with only the characters 30メートル in vermilion:
T4 "今の金鳥居は、もとの場所より30メートルほど山に近い。"
Under the panel, centred, tiny grey Gothic:
T5 "イラスト：生成AI（構図は国土地理院の標高データとOpenStreetMapによる実測）"

No other text: no barcode, no price, no date, no folio on the cover.
This page contains exactly these strings: T1–T5.
```
[신규] T1 「一つの町　01」(호 표기), T5 크레딧.

---

## 2–3쪽 — 펼침 「門の奥の水」 (가로 3:2)

**에디터 관점**
- 첫 장면은 사람 없이 물소리로 연다.
- 시점은 中門을 막 지나 물길 옆에 서서 몸을 돌린 자리다. 원고 「振り返って空を見ると」. 옆집 지붕 위로 산이 크게 다가온다.
- 글은 오른쪽 1/3에만 둔다.

**독자 관점**: 「タツミチ」「間の川」는 13쪽 「この町のことば」에서 다시 만난다. Claude 조판 때 두 낱말을 굵게 하고 주홍 점을 찍어 잇는다.

**검수**
- 사람이 0이어야 한다.
- 산이 골목 정면 끝이 아니라 옆 지붕 위에 있어야 한다.
- 물길은 좁고 빠르게 흘러야 한다.

```
PAGE 2–3 — OPENING SPREAD "門の奥の水". Landscape 3:2: two facing pages; left page = left half, right page = right half.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

LAYOUT MAP (approximate, % of the whole spread):
- Illustration: x 0–64, full bleed top, bottom and left; its right edge is a clean vertical cut on the right page.
- Text column: x 68–94 on plain paper.

ILLUSTRATION: We have just stepped through a small one-bay roofed wooden inner gate at the end of a long, narrow private lane, and we stand beside a narrow channel of clear mountain water running fast across the ground at our feet. We have turned around: over the low roofs of the neighbouring house, Mount Fuji rises very large and close, filling the upper part of the sky. The gate and a glimpse of the lane are at one edge of the picture; the mountain is NOT at the far end of the lane. No people. Early morning, cool air, a plain clear day.

TEXT (text column):
T1 (top, small Gothic, letter-spaced, vermilion): "一つの町　第1回　富士吉田"
T2 (VERTICAL headline, large bold Mincho, ink, under T1 at the right of the column): "門の奥の水"
Body area (RESERVE): to the left of T2, one column, from about 30% to 86% of the spread height, for two paragraphs of about 170 and 95 characters with a blank line between. Leave it blank paper.
T3 (bottom of the column, tiny grey Gothic, two lines): "冒頭の場面は資料をもとにした再構成です。|イラスト：生成AI"

FOLIOS: left page bottom-left "2" + F; right page bottom-right "3" + F.
F "となり　一つの町 01　富士吉田"
This spread contains exactly these strings: T1–T3 and the two folios.
```
- **조판 본문**: 원고 「門の奥の水」 두 단락(171·95자).
- **루비(HTML)**: 御師(おし), 禊(みそぎ).
- [신규] T3 첫 줄. 원고 머리의 「冒頭場面: 再構成」을 독자에게 보이는 표기로 옮겼다.

---

## 4–5쪽 — 펼침 「山へ引かれた道」 (가로 3:2)

**에디터 관점**
- 구조를 보여 주는 펼침(B)이다. 「聖なる町と俗なる町」의 축을 이 호에서 처음 지도로 세운다(P).
- 풀쿼트를 펼침의 감정 중심으로 크게 둔다(&P).
- 1572는 도해 아래 왼쪽에 둔다. 산과 다투지 않게 하기 위해서다.

**독자 관점**: 지도 앱과 대조해도 맞는 방위다(위=남, 왼쪽=동).

**검수**
- 東町(31軒)이 왼쪽, 西町(39軒)이 오른쪽이어야 한다.
- 집은 길가가 아니라 필지 안쪽 깊숙이 있어야 한다.
- 필지 개수는 따지지 않는다(개념도).

```
PAGE 4–5 — SPREAD "山へ引かれた道". Landscape 3:2.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

LEFT PAGE — DIAGRAM (flat illustration, top-down view, ink lines and soft muted fills on snow paper). SOUTH IS AT THE TOP, so EAST IS ON THE LEFT and WEST IS ON THE RIGHT.
- A single straight street runs from the bottom of the page up to the top, where a simple flat silhouette of Mount Fuji sits at the top edge.
- On both sides, many long, narrow strip-shaped lots (like the teeth of a comb) run back from the street. In each lot a narrow lane leads in from the street, and a small house sits set back deep inside the lot, away from the street. Draw the lots as an even pattern; do not try to draw an exact number.
- Below the lots the street continues and fades out at the bottom edge.
Labels (small Gothic, ink):
T1 (top, beside the mountain): "富士山"
T2 (on the LEFT row): "東町　31軒"
T3 (on the RIGHT row): "西町　39軒"
T4 (small arrow along the street pointing up): "南へ"
T5 (soft grey area label over the lots): "「聖なる町」（上吉田）"
T6 (soft grey area label below the lots, near the faded street): "「俗なる町」（下吉田）"
T7 (lower-left, very large Gothic numerals, vermilion): "1572"
T8 (directly under T7, small Gothic): "元亀3年（1572年）"
T9 (tiny grey caption under the diagram): "町割りの概念図（軒数は文中の数字）"

RIGHT PAGE:
T10 (headline, large bold Mincho, ink, horizontal, top): "山へ引かれた道"
Body area (RESERVE): under T10, two columns, upper half of the right page, for two paragraphs of about 215 and 165 characters. Leave it blank paper.
T11 (PULL QUOTE, lower half of the right page, alone, bold Mincho at about twice the headline size, ink, a thin vermilion rule above it, generous space around): "「聖なる町と俗なる町」が隣り合う"

FOLIOS: "4" + F bottom-left; "5" + F bottom-right.
F "となり　一つの町 01　富士吉田"
This spread contains exactly these strings: T1–T11 and the two folios.
```
- **조판 본문**: 「山へ引かれた道」 두 단락(216·167자).
- **루비(HTML)**: 雪代(ゆきしろ).
- [신규] T1·T4·T9. 구역 라벨 T5·T6은 원고 (4)의 표기다.

---

## 6–7쪽 — 펼침 「機の町」 (가로 3:2)

**에디터 관점**
- 왼쪽 쪽에는 비단 한 폭의 빛만 둔다.
- 오른쪽은 글과 사이드 스택이다. 사이드 스택에는 4割(큰 숫자 하나), 「第3土曜」「昼だけ」 박스, 우동이 들어간다.
- 「俗なる町」 키커로 4–5쪽의 축을 잇는다.
- 실용 정보는 15쪽 「歩くなら」로도 보낸다.

**검수**
- 비단에 무늬·라벨이 없어야 한다.
- 우동은 굵은 면에 고명이 없어야 한다.
- 박스 문장을 한 자씩 대조한다.

```
PAGE 6–7 — SPREAD "機の町". Landscape 3:2: two facing pages; left page = left half, right page = right half.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

LAYOUT MAP (approximate, % of the whole spread):
- Left page, x 0–50: one illustration, full bleed on the top, bottom and left edges, stopping exactly at the centre fold.
- Right page on plain paper: headline zone x 54–96, y 7–20; body zone x 54–80, y 23–88 (two columns); side stack x 82–96, bottom edge at y 88, from top to bottom: big number, box 1, box 2, udon illustration and caption.

ILLUSTRATION (left page): close-up still life of a very thin, light silk fabric draped in soft folds on a dark wooden table, catching side light so it shows a delicate shifting sheen. Beside it, a few spools of very fine thread. No pattern, no labels, no packaging. Keep the lower-left corner darker and calm for the caption.

CAPTION ON THE ILLUSTRATION (bottom-left of the left page, small Gothic, snow colour, two lines):
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
UDON ILLUSTRATION (square, bottom of the stack): overhead view of one bowl of very thick, firm white udon noodles in a light brown miso-and-soy broth, on a plain wooden counter, chopsticks resting on the bowl, no toppings, plain bowl. Caption under it, tiny ink Gothic: T11 "吉田のうどん"

T12 (tiny grey Gothic, bottom of the right page): "イラスト：生成AI"
BODY B1–B4 (RESERVE): four paragraphs, about 640 characters in total (about 56, 209, 102 and 270 characters), set in the body zone in 2 columns. Leave this whole zone blank paper.

FOLIOS: "6" + F bottom-left; "7" + F bottom-right.
F "となり　一つの町 01　富士吉田"
This spread contains exactly these strings: T1–T12 and the two folios.
```
- **조판 본문**: 「機の町」 네 단락(56·209·102·270자).
- **루비(HTML)**: 機(はた)の町. 근거는 「ハタオリマチ」 표기.
- [신규]
  - T2 「県の甲斐絹ミュージアムの説明より」
  - T3 「「俗なる町」の側」(원고 구절)
  - T6(원고 문장을 줄인 것)
  - 박스 머리말 T7·T9

---

## 8쪽 — 「本町通り」 (단면 2:3) · 첨부: GEOMETRY GUIDE = `14-view/out-honcho-p8/guide-page8.png`

**에디터 관점**
- 이 호에서 처음 보는 "그 풍경"이다(표지는 지도).
- 가이드는 실제 本町通り 직선부(金鳥居 북쪽 800m)에서 본 실측이다. 길이 산정과 거의 일치해서 「정면에 이어져 보인다」는 원고와 맞는다.
- 안전 당부는 원문 문장 그대로 작은 박스에 둔다. 따옴표도, 출처를 단 줄표도 쓰지 않는다.

**검수**
- 능선 수치 검수: 위 2/3 영역을 가이드와 겹쳐 잰다.
- 차도 위 사람 0.
- 간판 글자 0.

```
PAGE 8 — "本町通り". Portrait 2:3.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = GEOMETRY GUIDE (same canvas: the drawing occupies the top two-thirds; the bottom third is blank and is the text area). Image 2 = STYLE REFERENCE (approved page 12).

ILLUSTRATION (top two-thirds, full bleed top and sides, its bottom edge exactly at the grey line in Image 1): follow Image 1 exactly. The thick curve is the true skyline of Mount Fuji from this spot — same shape, height and position. The dashed line is the centre of a two-lane town street running straight away toward the mountain; here the street points almost exactly at the summit — keep it so. Far away, at the small cross, a copper-clad torii gate (dark weathered-copper colour, NOT red; any tablet blank) spans the street, where the street bends slightly to the right. Low shop buildings, utility poles and wires on both sides. Mid-morning light. A few tiny distant figures on the pavements only, never in the roadway, no faces.

CAPTION ON THE ILLUSTRATION (lower-left of the picture, small Gothic, snow colour):
T1 "正面に富士山が続くように見える"

TEXT AREA (bottom third, snow paper):
T2 (left, large bold Mincho, ink): "本町通り"
Body area (RESERVE): to the right of T2, two columns, for one paragraph of about 230 characters. Leave it blank paper.
T3 (small note box at the right end of the text area, thin vermilion outline, small Gothic, ink, wrapped to the box): "地元の観光案内は、車道に出て撮るのは危ないのでやめてほしいと呼びかけている。"
T4 (tiny grey Gothic, bottom, inside the safe band): "イラスト：生成AI（構図は国土地理院の標高データとOpenStreetMapによる実測）"

FOLIO: "8" + F bottom-left.
F "となり　一つの町 01　富士吉田"
This page contains exactly these strings: T1–T4 and the folio.
```
- **조판 본문**: 「本町通り」 한 단락(229자).
- **편집장 확인**: 이 단락은 원고 ⑺-3에서 판단을 기다리는 중이다(2000人 등은 보도 회답, 2차). 결정에 따라 본문에서 빠질 수 있다.
- [신규] T1(원고 구절), T4.

---

## 9쪽 — 「鳥居の先」 글·인포그래픽 (단면 2:3)

**에디터 관점**
- 8쪽 그림과 마주 보는 문턱의 쪽이다.
- 「そこから先が富士山の神域」를 크게 둔다.
- 「8日の旅」는 원고 문장 그대로 세 마디로 보여 준다. 귀로 일수는 지어내지 않는다.
- 86과 5는 화살표 없이 나란히 둔다.
- 1964 → 「それでも」 → 1万9,860人으로 쇠퇴만이 아닌 지금을 보여 준다.

**검수**
- 숫자 86·5·1768·2013·1964·1万9,860·3日·2日·8日을 대조한다.
- 「健脚でも」는 「片道3日」에만 붙어야 한다.

```
PAGE 9 — "鳥居の先". Portrait 2:3. Typography and simple infographics only, no illustration.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

T1 (top-left, large bold Mincho, ink): "鳥居の先"
T2 (full width under T1, bold Mincho, about 1.4× body headline weight, ink, in Japanese corner brackets as given): "「そこから先が富士山の神域」"
T3 (small grey Gothic under T2, right-aligned): "——山梨県の資料"

INFOGRAPHIC A (a single thin horizontal ink line with three labelled segments, left to right; first segment and last label in ink, middle segment in vermilion):
T4 (first segment label): "江戸→吉田　健脚でも片道3日"
T5 (middle segment label): "吉田→山頂　往復に少なくとも2日"
T6 (at the right end, bold Gothic): "合わせて8日の旅"

INFOGRAPHIC B (two very large Gothic numbers side by side, NO arrow between them, ink):
T7 "86"   with small label under it: T8 "御師の家（多いとき）"
T9 "5"    with small label under it: T10 "今も講社を迎えている家"
T11 (one line of small Gothic spanning under both): "御師の家は多いときで86軒を数えた。今も講社を迎えている家は5軒だという。"

INFOGRAPHIC C (one row: small number, a word, a large number):
T12 (small Gothic number, ink): "1964"  with tiny label: T13 "富士スバルライン開通"
T14 (bold Mincho, vermilion): "それでも"
T15 (large Gothic number, ink): "1万9,860人"  with tiny label: T16 "2026年の登山シーズンに、麓の馬返しを通って歩いて登った人"

Body area (RESERVE): lower 40% of the page, two columns, for three paragraphs of about 95, 245 and 115 characters. Leave it blank paper.

FOLIO: "9" + F bottom-right.
F "となり　一つの町 01　富士吉田"
This page contains exactly these strings: T1–T16 and the folio.
```
- **조판 본문**: 「鳥居の先」 세 단락(97·243·114자). 마지막 문장 「鳥居の先が、冒頭の上吉田である。」은 한 줄을 띄워 따로 세운다(조판 지시).
- **루비(HTML)**: 講社, 祈祷. 독음 확인 후 붙인다.
- [신규]
  - T3 「——山梨県の資料」(원고 「県の資料は…と書く」)
  - T4–T6. 원고 문장 「江戸から吉田までは健脚でも片道3日かかり、吉田から山頂の往復に少なくとも2日、合わせて8日の旅だった」를 세 마디로 나눴다.
  - T8·T10·T13·T16. 원고 문구를 라벨로 썼다.

---

## 10–11쪽 — 펼침 「火の夜」 (가로 3:2)

**에디터 관점**
- 호의 클라이맥스다. 밤 펼침 전체를 그림으로 덮는다.
- 글은 첫 단락만 어둠 속에 낮게 둔다.
- 「8月26日」을 크게 박고, 횃불 하나에 치수 주석선을 단다(원문 수치).
- 풀쿼트는 출처 경로를 바르게 단다.
- 둘째 단락(27일·鳥居·30m)은 12쪽 마지막 장으로 넘긴다.

**검수**
- 횃불은 죽순(가늘고 높은 원뿔) 모양이어야 한다.
- 산의 불빛이 분화로 보이면 안 된다.
- 군중에 얼굴이 없어야 한다.
- 산정에 눈이 없어야 한다(8월).

```
PAGE 10–11 — SPREAD "火の夜". Landscape 3:2. Night spread: the illustration covers the entire spread edge to edge; all text is snow-coloured on the dark image.
BODY MODE: RESERVE
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

ILLUSTRATION (full bleed): Night in a long, straight town street that rises gently toward Mount Fuji. Down the street stand tall bonfire torches, each about three metres high (nearly twice a person's height) and shaped like a giant bamboo shoot — a tall, slender cone — all burning brightly so the street is lit as bright as day, warm orange light on the road. Far away, the dark silhouette of Mount Fuji against a deep navy late-summer sky, NO snow on the summit, with a thin line of tiny steady fire points on its slope where the mountain huts light their own fires (NOT an eruption, NOT lava). Crowds only as dark silhouettes, no faces, no lettering on any clothing. Keep the lower-left quarter darker and calmer for text.

TEXT (snow colour #eef0f4 on the image):
T1 (upper-left, very large Gothic, about 18% of the spread height): "8月26日"
T2 (under T1, large bold Mincho): "火の夜"
T3 (a thin snow-coloured annotation line pointing to one torch on the right side, with small Gothic text): "高さ約3メートル、直径約90センチ"
Body area (RESERVE): lower-left, two narrow columns, for one paragraph of about 165 characters, on a calm dark area. Leave it as calm dark image with no characters (snow text is added later).
T4 (lower-right, PULL QUOTE, large Mincho, snow colour, a thin vermilion rule above): "「真昼のように明るく」"
T5 (under T4, small Gothic): "——『甲斐国志』の記述（富士山世界遺産センターの解説より）"
T6 (bottom corner, tiny): "イラスト：生成AI"

FOLIOS: "10" + F bottom-left; "11" + F bottom-right (snow colour).
F "となり　一つの町 01　富士吉田"
This spread contains exactly these strings: T1–T6 and the two folios.
```
- **조판 본문**: 「火の夜」 첫째 단락(164자)을 흰 글씨로 넣는다.
- **루비(HTML)**: 筍(たけのこ), 点(とも)される.
- [신규] T5 출처 표기. 「真昼のように明るく」는 원고 출처표 A55에 실린 富士山世界遺産センター 해설의 어구다.

---

## 12쪽 — 「終わりの一枚」 (단면 2:3) — **스타일 앵커, 가장 먼저 생성** [신규 쪽 이름은 내부용, 지면에는 쓰지 않음]

**에디터 관점**
- 원고 마지막 단락을 그대로 그림으로 옮긴다. 「鳥居の柱のあいだに、富士山を見ることができる」.
- 쪽은 표지 문장의 숫자(30メートルほど)로 끝난다. 원고 자기교열의 「鳥居の位置という事実で閉じた」를 지면으로 옮기는 것이다.
- 짧은 본문(101자)을 RENDER로 시도한다. 글자가 적어 생성기가 소화할 수 있다.

**검수**
- 鳥居는 동색이어야 한다. 주홍이면 즉시 탈락이다.
- 기둥 사이에 산이 있어야 한다.
- 단락을 한 자씩 대조한다.
- 「30メートルほど」만 주홍이어야 한다.
- 산에 눈이 없어야 한다(8월 27일).

```
PAGE 12 — closing page. Portrait 2:3.
BODY MODE: RENDER
ATTACHMENTS: none (this page becomes the STYLE REFERENCE for all others).

ILLUSTRATION (top 58% of the page, full bleed top and sides): Standing on the town street close to a large torii gate, slightly to the west side of the road, looking south. The two copper-clad pillars of the gate (dark weathered-copper colour, NOT vermilion or red) rise as dark vertical bands at the left and right edges of the picture, and the crossbeams cross the top. Between the pillars, small and clear in the distance, Mount Fuji, with NO snow (late August). Upper half mostly pale sky. Soft early-morning light. No people. If the gate has a tablet, it is blank.

BELOW THE ILLUSTRATION (snow paper):
T1 (left, small Gothic numerals, ink, stacked): "1788"   tiny label: T2 "最初の鳥居（富士講の信者が建てた）"
T3 (left, small Gothic numerals, ink, under T1): "1957"   tiny label: T4 "今の鳥居"
B1 (RENDER — the closing paragraph, body Gothic, ink, one column to the right of the numbers; the characters 30メートルほど set slightly larger and in vermilion; nothing else in vermilion):
"翌27日の祭りは、金鳥居で行われる。鳥居の柱のあいだに、富士山を見ることができる。最初の鳥居は1788年に富士講の信者が建てた。1957年にできた今の鳥居は、もとの場所より30メートルほど富士山に近い。"
T5 (tiny grey Gothic, bottom inside the safe band): "イラスト：生成AI"

FOLIO: "12" + F bottom-left.
F "となり　一つの町 01　富士吉田"
This page contains exactly these strings: T1–T5, B1 and the folio.
```
- [신규] T2·T4는 원고 문장을 줄인 라벨이다.
- 9쪽에서 「今の鳥居」 라벨의 30m 설명을 뺐다. 답은 이 쪽에서만 한다.

---

## 13쪽 — 「この町のことば」 (단면 2:3)

**에디터·독자 관점**
- 학습 앱 매거진다운 쪽이다.
- 표제어 9개를 사전처럼 조판한다.
- 2–3쪽에서 만난 タツミチ·間の川 옆에 「→2」를 단다.

**권고**: 이 쪽은 HTML 조판이 기본이다. 탭하면 단어 저장으로 이어지고, 표제어 읽기 줄도 HTML에서 붙인다. 생성기 판은 지면 디자인 시안으로 쓴다.

```
PAGE 13 — "この町のことば". Portrait 2:3. Typography only, like a small dictionary page.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

T1 (top, large bold Mincho, ink): "この町のことば"
LIST: 9 entries in two columns, thin hairline between entries. Each entry: the headword in bold Mincho (ink, about twice the body size) with a small vermilion dot before it; on the next lines its meaning in small Gothic. Render exactly:
B1 headword "富士みち" — meaning "富士講が富士山へ向かった道。県は今の国道139号の愛称として紹介し、北口本宮は「現国道137号線」と書く"
B2 headword "御師（おし）" — meaning "富士講の人びとを泊め、祈祷や案内をした人びと"
B3 headword "タツミチ" — meaning "御師の家の表通りから奥へ入る細長い引き込み路" — and after the meaning, tiny grey "→2"
B4 headword "間の川" — meaning "御師の家の中門の奥を流れる水路。禊に使った" — and after the meaning, tiny grey "→2"
B5 headword "一ノ鳥居" — meaning "山頂までに立つ鳥居の一番目。金鳥居のこと"
B6 headword "構成資産" — meaning "世界遺産「富士山」を形づくる個々の資産。全部で25ある"
B7 headword "取り次ぎ" — meaning "御師の仕事の一つ。本文では北口本宮冨士浅間神社の説明の言葉（「取次」）をそのまま使った"
B8 headword "ガチャマン" — meaning "戦後の織物の好景気を指すことば"
B9 headword "吉田のうどん" — meaning "太く硬い麺を味噌や醤油の汁で食べる郷土料理"

FOLIO: "13" + F bottom-right.
F "となり　一つの町 01　富士吉田"
This page contains exactly these strings: T1, the 9 headwords, the 9 meanings, the two "→2" marks and the folio.
```
[신규] 「→2」 쪽 표시.

---

## 14쪽 — 「数字で読む富士吉田」 (단면 2:3) [신규 꼭지명]

**에디터 관점**
- 본문에 흩어진 숫자 12개를 한 장에 모은다(B).
- 원고의 유보 표현(ほど·約·だという)을 모두 살렸다.
- 15쪽 지도와 마주 보는 「알기 ↔ 가기」 펼침이다.

**검수**: 12칸을 원고와 한 줄씩 대조한다. 하나라도 틀리면 탈락이다.

```
PAGE 14 — "数字で読む富士吉田". Portrait 2:3. Typography only.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

T1 (top, large bold Mincho, ink): "数字で読む富士吉田"
GRID: 12 cells, 3 columns × 4 rows, thin ink hairlines between cells. In each cell: the number in large Gothic (ink; cells 1, 5 and 12 in vermilion) and under it one or two lines of small Gothic. Render exactly:
B1  "1572" / "上吉田の町が今の場所にできた年（元亀3年）"
B2  "70軒" / "新しい町に御師や神職、商人、職人が住んだ家の数（東町31軒、西町39軒）"
B3  "約125m" / "下吉田駅から富士山駅まで約8キロの散策コースの高低差"
B4  "700〜900mほど" / "標高。冷涼な気候と火山灰の土で、稲づくりに向かなかった"
B5  "4割" / "国産ネクタイ生地のうち、ここの生地が使われている割合"
B6  "第3土曜日" / "毎月、工場を開いて見学者を迎える日"
B7  "2000人ほど" / "本町通りを訪れる人の1日平均（市の報道への回答）"
B8  "8日" / "江戸から吉田、山頂を往復し、合わせて8日の旅"
B9  "86　／　5" / "御師の家（多いとき）と、今も講社を迎えている家（だという）"
B10 "1万9,860人" / "2026年の登山シーズンに、馬返しを通って歩いて登った人"
B11 "約3m" / "火祭の大松明の高さ（直径約90センチ）"
B12 "30メートルほど" / "今の金鳥居が、もとの場所より富士山に近い距離"
T2 (bottom, tiny grey Gothic): "数字はすべて本文の出典による"

FOLIO: "14" + F bottom-left.
F "となり　一つの町 01　富士吉田"
This page contains exactly these strings: T1, B1–B12, T2 and the folio.
```
- [신규] 꼭지명, 셀 설명(원고 문장을 줄인 것), T2.
- B7은 8쪽과 마찬가지로 원고 ⑺-3 결정에 따른다. 빠지면 빈칸을 다른 숫자로 채우지 않고 11칸으로 둔다.

---

## 15쪽 — 「富士みち略図」+「歩くなら」 (단면 2:3) [신규 꼭지명]

**에디터 관점**
- 손그림 지도(P)를 쓰되 「略図・縮尺なし」를 크게 밝힌다.
- 아래에 "가기 전 다섯 줄"과 쪽 번호를 둔다.

**독자 관점**: 北口本宮이 직선 위에 없다는 것(上宿에서 남남동 약 450m)을 지도로 확인한다.

**검수**
- **위=산(남), 왼쪽=동, 오른쪽=서.**
- 富士山駅은 金鳥居의 **오른쪽**, 약간 아래에 있어야 한다.
- 下吉田의 꺾임 아래 다리는 **왼쪽 아래**로 나가야 한다.
- 下吉田駅은 꺾임 바로 아래, 선의 오른쪽, 선 밖에 있어야 한다.
- 北口本宮은 선 끝의 왼쪽 위, 선 밖에 있어야 한다.
- 직선부는 산정보다 조금 오른쪽을 향하고, 金鳥居에서 오른쪽으로 조금 더 꺾여야 한다.

```
PAGE 15 — map and practical box. Portrait 2:3.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

T1 (top, large bold Mincho, ink): "富士みち略図"
T2 (right of T1, small grey Gothic): "略図・縮尺なし"

MAP (upper 62% of the page): hand-drawn style schematic on snow paper, ink line work, one vermilion line. The map is turned so that the summit of Mount Fuji is straight UP (roughly south-southwest at the top); north is toward the bottom. Therefore EAST is on the LEFT and WEST is on the RIGHT.
- Top edge: a simple flat silhouette of Mount Fuji, labelled T3 "富士山（剣ヶ峯）".
- The vermilion road line: from the bottom it rises; near the bottom it has one bend — BELOW the bend the line leaves toward the lower LEFT. Label the bend T4 "下吉田". Above the bend the line runs almost straight up, pointing slightly to the RIGHT of the summit. At a small ink torii symbol across the line (label T5 "金鳥居") the line turns a little further to the RIGHT and ends at a junction labelled T6 "上宿の交差点".
- T7 "下吉田駅": a small station mark just below the bend, a little to the RIGHT of the line, off the line.
- T8 "本町通り": along the straight part between the bend and the torii.
- T9 "富士山駅": a small station mark just to the RIGHT (west) of the torii, slightly below it, off the line.
- T10 "上吉田（御師の町）": along the short part between the torii and the junction.
- T11 "北口本宮冨士浅間神社": a small shrine mark a little ABOVE and to the LEFT of the junction, clearly OFF the line.
- Soft grey area labels: T12 "「俗なる町」（下吉田）" around the lower part; T13 "「聖なる町」（上吉田）" around the upper part.

BOX (lower part, thin ink outline; title in bold Mincho; five lines of small Gothic, each starting with a small vermilion dot and ending with a tiny grey page reference):
T14 (title): "歩くなら"
T15 "下吉田駅から富士山駅まで、県の散策コースは約8キロ、高低差は約125メートル　→4"
T16 "毎月第3土曜日には、工場を開いて見学者を迎えている　→7"
T17 "吉田のうどんの店の多くは、昼だけ開く　→7"
T18 "本町通りでは、車道に出て撮らないで（地元の観光案内の呼びかけ）　→8"
T19 "8月26日の夜は、吉田の火祭　→10"

T20 (bottom, tiny grey Gothic): "地図は概念図です。道の位置関係はOpenStreetMapによる"

FOLIO: "15" + F bottom-right.
F "となり　一つの町 01　富士吉田"
This page contains exactly these strings: T1–T20 and the folio.
```
- [신규] 꼭지명 T1·T14, 지도 주석 T2·T20, 다섯 줄(원고 문장을 줄인 것), 쪽 번호.
- T18은 편집장 확인 대상이다(원고 ⑺-3과 연동).
- 위치 근거는 OSM 실측(`02-map/NOTES.md`, 지리 감사)이다.
  - 富士山駅: 鳥居의 서쪽 약 256m, 북쪽 58m.
  - 北口本宮: 上宿에서 방위 171°, 457m.

---

## 16쪽 — 奥付 (단면 2:3)

**에디터 관점**: 신뢰를 표지만큼 공들여 조판한다. 생성 AI, 실측 데이터, 재구성 장면을 정면으로 밝힌다.

**권고**: 법적 출처 표기(©·ODbL)가 들어 있으므로 HTML 조판을 기본으로 한다. 생성기 판은 시안이다.

```
PAGE 16 — colophon. Portrait 2:3. Typography only, very quiet, lots of white space.
BODY MODE: RENDER
ATTACHMENTS: Image 1 = STYLE REFERENCE (approved page 12).

T1 (upper half, centred, large bold Mincho, ink): "一つの町　01　富士吉田"
Lower half, small Gothic, ink, left-aligned, one line each:
T2 "文・構成　となり編集部"
T3 "イラスト　生成AI（8ページの構図は、国土地理院の標高データとOpenStreetMapによる実測）"
T4 "地図　© OpenStreetMap contributors（ODbL）openstreetmap.org/copyright"
T5 "標高　国土地理院"
T6 "冒頭の場面は資料をもとにした再構成です。"
T7 "本文の事実は、すべて公的機関・観光団体・報道の原文と照らし合わせて確かめています。"

FOLIO: "16" + F bottom-left.
F "となり　一つの町 01　富士吉田"
This page contains exactly these strings: T1–T7 and the folio.
```
[신규] 奥付 전체.
- T7은 원고 머리의 「すべて原文を開いて照合した行だけ」와 출처표의 2차 행(관광재단·보도)에 맞춘 표현이다.
- 원고 ⑺-3 결정 뒤 확정한다.
- 1B 그림 표지를 쓰면 T3에 「表紙と」를 더한다.

---

## 부록 — Claude의 HTML 층 (생성 뒤)

| 대상 | 내용 |
|---|---|
| 본문 조판 | 2–3·4–5·6–7·8·9·10–11쪽 빈 자리. 원고 원문 그대로, Shippori Mincho / Zen Kaku Gothic New(OFL), 기존 `05-compose` 경로 |
| 로고 | 1A 표지(13-mark), 1B를 쓰면 RESERVED 자리에 합성 |
| 루비 | 첫 등장에만. 御師·禊(2–3), 雪代(4–5), 機(6–7), 講社·祈祷(9), 筍·点される(10–11). 고유명사 독음(金鳥居·上宿·甲斐絹·大松明·馬返し)은 출처 확인 전까지 붙이지 않는다 |
| 학습 순환 | 이미지 속 글자는 탭이 안 된다. 각 쪽에 「이 쪽 본문 읽기」 버튼을 두어 뷰어의 원고 장으로 보낸다. 13쪽 표제어는 HTML로 만들어 단어 저장(`save_vocabulary_context`)으로 잇는다 |
| 검수 | `visual-review.md`, 8쪽 능선 수치(`14-view/verify.py`, 위 2/3 영역), 표시 문구 한 자씩 대조 |
