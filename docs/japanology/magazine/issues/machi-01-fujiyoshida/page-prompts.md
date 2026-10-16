# 一つの町 01 富士吉田 — 16쪽 완성 지면 프롬프트 (2026-10-16 KST)

**오너 지시**: 「이미지뿐 아니라 어디에 어떤 문구가 어떤 식으로 나올지, 모든 연출을 포함해서 맡긴다. 한 장 한 장 공들여 구성하라. popeye/brutus/&premium 에디터와 열혈 독자의 관점으로 설계하라.」

**쓰는 법**
1. ChatGPT 새 대화에서 쪽마다 아래 순서로 하나의 메시지를 만든다.
   - `SERIES SYSTEM`(§0) 블록
   - 그 쪽의 `PAGE` 블록
   - 첨부가 필요한 쪽은 지정한 파일을 함께 붙인다.
2. 받은 결과는 `visual-review.md` 체크리스트와 아래 **쪽별 검수**로 본다. 일본어 글자는 한 자씩 대조한다.

**문구 원칙**
- 본문·인용·숫자는 모두 원고 `../../ja/machi-fujiyoshida.md`(1차 원문 대조 완료)에서 **글자 그대로** 가져왔다.
- 지면 구성 때문에 새로 쓴 문구는 **[신규]** 로 표시했다. 편집장(오너) 확인 대상이다.
- 사실을 새로 더한 문구는 없다.

**잡지 이름에 대해**: 아래 세 잡지는 **편집 사고방식**만 빌렸다.

| 잡지 | 빌린 사고방식 |
|---|---|
| BRUTUS | 한 주제를 깊게 판다. 숫자와 목록으로 '알아 가는 쾌감'을 준다 |
| POPEYE | 손으로 그린 지도와 실용 정보 박스. 독자의 다음 행동을 부른다 |
| &Premium | 여백과 빛, モノ・コト・ヒト를 한 장면에 하나씩 |

그들의 로고·판형·표지 구조는 쓰지 않는다(브랜드 정책 ⑴). 프롬프트에도 잡지 이름을 넣지 않는다.

**글자 렌더링의 한계 (솔직히)**
- 이미지 생성기는 일본어 긴 본문에서 글자를 틀리거나 뭉갤 수 있다.
- 그래서 모든 프롬프트에 「옮길 수 없으면 그 자리를 비워 두고, 지어내지 말라」를 넣었다.
- 본문 단락이 비거나 틀리게 나오면 방법이 둘이다.
  - Claude가 그 그림 위에 실제 글자를 조판한다(HTML).
  - 그 단락만 다시 생성한다.
- 제목·숫자·짧은 캡션은 대체로 잘 나온다.

**판형**
| 지면 | 크기 |
|---|---|
| 단면 | 세로 2:3, 1024×1536 |
| 펼침면 | 가로 3:2, 1536×1024 (웹·태블릿 펼침 기준) |

인쇄 재단(210×297)은 확정 후 조정한다.

---

## 0. SERIES SYSTEM — 모든 쪽 프롬프트 맨 앞에 붙인다

```
SERIES SYSTEM — magazine "TONARI / となり", issue "一つの町 01 富士吉田". Design one finished magazine page exactly as specified below.

PAPER & COLOUR: warm off-white paper (#eef0f4). Ink: deep navy (#151b2c). One accent colour only, vermilion (#d4462a), used sparingly (never for large areas unless stated). Muted greens and greys allowed inside illustrations.

TYPOGRAPHY: Japanese headlines in a bold, high-contrast Mincho (serif) typeface. Body text in a clean Gothic (sans) typeface, small but comfortable, generous line spacing (about 1.8), set horizontally left-to-right unless a block is marked VERTICAL. Captions and labels in small Gothic. Numerals in the same Gothic. Quotation marks are Japanese corner brackets 「」.

GRID & SPACE: generous outer margins (about 7% of the page width). Single pages: 2 text columns. Spreads: 4 text columns across both pages, with a clear gutter in the middle. Plenty of white space; nothing crowded; strong alignment to the grid.

ILLUSTRATION STYLE: calm editorial gouache illustration, flat colour areas, soft natural light, no outlines, not photographic.

FOLIO (every page): at the bottom outer corner, very small Gothic: the page number, a thin space, then "となり　一つの町 01　富士吉田".

TEXT RULES (strict):
- Render every Japanese string exactly as given, character for character, with its punctuation (、。「」（）).
- Do not add any other words, titles, captions, logos, slogans, dates or brand names anywhere.
- If any paragraph cannot be rendered legibly and exactly, leave that text area as clean empty paper instead. Never invent, abbreviate or garble text.
- No readable text inside illustrations: no shop signs, posters, banners, license plates.
- No recognisable faces. People only as small distant figures or silhouettes.
```

---

## 1쪽 — 표지 (단면 2:3) · 첨부 2장: `brand/ai-gen/refine/v1/lockup-black.png`, `prototype/cover-machi01/14-view/out/guide.png`

**에디터 관점**
- 표지는 "한 문장"으로 산다. 이 호의 한 문장은 「今の金鳥居は、もとの場所より30メートルほど山に近い。」다.
- 사실 하나와 숫자 하나가 있고, '왜?'를 부른다.
- 그림은 실측 구도의 거리와 산이다. 길이 산을 정확히 향하지 않는다는 것까지 정직하게 그린다.

**열혈 독자 관점**
- 서점 평대에서 30m라는 숫자에 걸린다.
- 세로로 작게 박힌 「富士みち」가 이 호의 열쇠말이라는 걸 알아챈다.

**검수**
- 로고를 다시 그리거나 왜곡하지 않았는지 본다.
- 부제를 한 자씩 대조한다.
- 산 윤곽은 Claude가 수치로 검수한다.
- 鳥居는 주홍이면 안 된다.
- 간판 글자가 0이어야 한다.

```
PAGE 1 — COVER. Portrait 2:3 (1024x1536). Full-bleed illustration with typography on top.

ATTACHMENTS: (1) the TONARI/となり logo image; (2) a black line-drawing composition guide.

ILLUSTRATION (fills the whole page, edge to edge):
Use attachment (2) as the exact composition guide. The thick black curve is the true skyline of Mount Fuji seen from this exact spot, computed from elevation data — the mountain's outline must follow it exactly: same shape, same height, same position. Do not make the mountain taller, steeper or more symmetrical. The dashed line is the centre line of a two-lane town street running away from the viewer toward the mountain — keep its position and direction exactly; note that the street does NOT point straight at the summit, it runs a little to the right of it, and that is correct. The small cross marks where a large torii gate stands across the street: place the gate there, made of dark copper-clad metal (bronze-green), NOT vermilion or red, plain form with no plaque. Low two- and three-storey shop buildings with utility poles and wires line both sides of the street. Clear early morning, pale sky, a little snow on the summit. Do not draw the guide lines themselves. Keep the upper 30% of the page mostly sky for the masthead.

MASTHEAD: Place attachment (1) — the logo, exactly as supplied, without redrawing or changing any letter shape — centred at the top, about 86% of the page width, top margin about 4% of page height. Colour it deep navy (#151b2c).

TEXT:
- Directly under the logo, centred, small Gothic, letter-spaced: 一つの町　01
- Under that, centred, large bold Mincho (about 9% of page width per character): 富士吉田
- VERTICAL, along the right edge in the upper-middle sky area, small Mincho, navy: 富士みち
- Bottom band: a soft off-white panel across the full width (about 12% of page height) with, centred, medium bold Gothic in navy, one line:
  今の金鳥居は、もとの場所より30メートルほど山に近い。
- Under that line, centred, tiny Gothic, grey:
  イラスト：生成AI（構図は国土地理院の標高データとOpenStreetMapによる実測）

No other text on the cover. No barcode, no price, no date.
```

---

## 2–3쪽 — 펼침 「門の奥の水」 (3:2)

**에디터 관점**
- 첫 장면은 사람 없이 "물소리"로 연다(&Premium식 정적).
- 그림이 펼침의 2/3을 차지한다. 오른쪽 1/3에만 글을 둔다.
- 제목은 크고 짧게 세로로 세운다.

**열혈 독자 관점**
- 「タツミチ」「間の川」라는 처음 보는 낱말을 루비처럼 따라간다.
- 이 낱말들은 14쪽 「この町のことば」에서 다시 만난다.

**검수**
- 사람 0.
- 물길은 좁은 돌 수로여야 한다.
- 두 단락을 한 자씩 대조한다.
- 재구성 표기가 있어야 한다.

```
PAGE 2–3 — OPENING SPREAD. Landscape 3:2 (1536x1024).

ILLUSTRATION: occupies the left two-thirds of the spread, bleeding off the top, left and bottom edges.
Scene: looking from a quiet main street into a long, narrow private lane that runs deep between houses in a Japanese mountain-foot town. At the far end of the lane stands a modest wooden inner gate. Just past the gate, a narrow stone-lined water channel runs fast across the ground at our feet, clear mountain water. Above the low roofs, Mount Fuji rises very large and close, filling the upper part of the sky. No people. Early morning, cool air.

RIGHT THIRD (text area, off-white paper):
- Top, small Gothic, letter-spaced, vermilion: 一つの町　第1回　富士吉田
- Below, VERTICAL headline, large bold Mincho, navy: 門の奥の水
- To the left of the vertical headline, in one narrow column of horizontal body text (Gothic), these two paragraphs with a blank line between them:

金鳥居から上宿の交差点まで、表通りに面して細長い引き込み路が奥へ延びている。タツミチと呼ばれる道だ。突き当たりの中門をくぐると、足もとを水路が勢いよく流れている。「間の川」と呼ばれる流れだ。観光庁の解説文によれば、御師の家の前には、禊に使うために富士山の水を引いた水路があった。振り返って空を見ると、家々の屋根の上に富士山が大きく迫ってくる。

ここは富士山の北の麓、山梨県富士吉田市の上吉田である。御師と呼ばれる人びとが、山へ向かう信者を泊めてきた町だ。江戸の富士講の人びとは甲州街道と富士みちを通り、ここから吉田口の登山道へ入った。

- At the bottom of the text area, tiny grey Gothic, two lines:
  冒頭の場面は資料をもとにした再構成です。
  イラスト：生成AI
```
[신규] 「冒頭の場面は資料をもとにした再構成です。」 원고 머리의 「冒頭場面: 再構成」을 독자용으로 옮긴 표기다.

---

## 4–5쪽 — 펼침 「山へ引かれた道」 (3:2)

**에디터 관점**
- BRUTUS식 "구조를 보여 주는" 펼침이다.
- 1572라는 숫자를 크게 세우고, 단책(短冊)형 필지가 산을 향한 길 양쪽에 늘어선 도해를 둔다.
- 도해는 개념도다. 필지 수는 그림이 아니라 라벨로 말한다.
- 풀쿼트로 「聖なる町と俗なる町」을 띄운다. 이 말이 이 호 전체의 축이다.

**열혈 독자 관점**
- 도해를 보며 "그래서 길이 산을 향하는구나"를 손가락으로 따라간다.
- 東31·西39의 비대칭이 눈에 걸린다.

**검수**
- 1572·元亀3年 표기를 확인한다.
- 東町31軒·西町39軒 라벨의 숫자가 맞아야 한다.
- 그림 속 필지 개수는 따지지 않는다. 개념도라는 캡션이 있어야 한다.
- 두 단락을 대조한다.

```
PAGE 4–5 — SPREAD "山へ引かれた道". Landscape 3:2 (1536x1024).

LEFT PAGE — DIAGRAM (flat illustration, top-down view, navy lines and soft colour fills on off-white):
A single straight street runs from the bottom of the page up toward the top, where a simple, flat silhouette of Mount Fuji sits at the top edge (labelled small: 富士山). On both sides of the street, many long, narrow strip-shaped lots (like the teeth of a comb) run back from the street, each with a small house at the street end. The lots on the right side and left side are drawn as clearly separate rows. Do not try to draw an exact number of lots; draw them evenly as a pattern.
Labels in small Gothic, navy:
- On the left (west) row: 西町　39軒
- On the right (east) row: 東町　31軒
- A small arrow along the street pointing up: 南へ
Under the diagram, tiny grey Gothic caption: 町割りの概念図（軒数は文中の数字）

Upper-left corner of the left page, very large Gothic numerals in vermilion: 1572
Directly under it, small Gothic: 元亀3年（1572年）

RIGHT PAGE — TEXT:
- Headline, large bold Mincho, navy, horizontal: 山へ引かれた道
- Body (Gothic, 2 columns), these two paragraphs:

上吉田の町が今の場所にできたのは、元亀3年（1572年）である。春先の急な気温上昇で雪が解け、土石流となって押し寄せる「雪代」を避けるため、もとの集落を移したという。新しい町は、富士山に向かって南へ延びる街路をはさみ、東西に屋敷地が整然と並ぶように割られた。道の両側は短冊のように細長く区切られ、東町に31軒、西町に39軒、あわせて70軒に御師や神職、商人、職人が住んだ。山へ向かうこの街路は、甲府盆地と駿河を結ぶ鎌倉道でもあった。

この道は町の外へも続く。山梨県の資料によれば、富士吉田に入った富士道は下吉田のあたりで南へ向きを変え、富士山へまっすぐ延びる。県は、富士に真向かう一直線の道に沿って「聖なる町と俗なる町」が隣り合う、と紹介している。下吉田駅から富士山駅まで約8キロを歩く県の散策コースは、高低差が約125メートルあり、富士山に向かってゆるく上っていく。

- PULL QUOTE between the columns' bottoms, spanning the right page width, large bold Mincho, navy, with a thin vermilion rule above:
  「聖なる町と俗なる町」が隣り合う
```
[신규] 도해 캡션 「町割りの概念図（軒数は文中の数字）」, 라벨 「南へ」. 사실은 더하지 않았다.

---

## 6–7쪽 — 펼침 「機の町」 (3:2)

**에디터 관점**
- モノ(비단)·コト(공장 개방)·食(우동)을 한 펼침에 담는다(&Premium의 モノ・コト・ヒト).
- 왼쪽은 비단 한 폭의 빛만 크게 둔다. 오른쪽은 글, 우동 그림, 실용 박스 두 개다.
- POPEYE식 박스 「第3土曜」 「昼だけ」는 독자의 다음 행동(가 보기)으로 이어지는 정보다. 모두 원고 문장이다.

**열혈 독자 관점**
- "넥타이 원단 40%"라는 숫자를 동료에게 말하고 싶어진다.
- 「ガチャマン」이라는 의성어 같은 말에서 웃는다.

**검수**
- 비단에 무늬·라벨이 없어야 한다.
- 우동은 굵은 면에 고명 없음.
- 네 단락을 대조한다.
- 박스 두 개의 문장이 원문 그대로여야 한다.

```
PAGE 6–7 — SPREAD "機の町". Landscape 3:2 (1536x1024).

LEFT PAGE — full-bleed illustration (left page only):
Close-up still life of a very thin, light silk fabric draped in soft folds on a dark wooden table, catching side light so it shows a delicate shifting sheen. Beside it, a few spools of very fine thread. No pattern, no labels, no packaging.
Bottom-left over the illustration, small off-white Gothic caption, two lines:
「非常に軽く、平滑な薄手」
県の甲斐絹ミュージアムの説明より

RIGHT PAGE:
- Headline, large bold Mincho, navy: 機の町
- Body (Gothic, 2 columns), these four paragraphs:

金鳥居の北側、下吉田が「俗なる町」の側にあたる。大正の終わりから昭和の初めにかけて、ここが織物生産の中心だった。

このあたりは郡内と呼ばれ、江戸時代には甲斐絹という薄く美しい絹が着物の裏地として重宝された。県の甲斐絹ミュージアムは、その布を「非常に軽く、平滑な薄手」で、独特の光沢と「サラッとした風合い」をもつと説明している。甲斐絹が最後に織られたのは1940年代だという。甲斐絹が途絶えたあとも町の機は止まらず、戦後の好景気は「ガチャマン」と呼ばれた。観光庁の解説文は、織機をガチャっとするだけで1万円もうかると言われた、と書く。

今の産地は、細い糸を高い密度で織り上げる難しい織物を得意とする。県によれば、国産ネクタイ生地の4割にここの生地が使われている。家族経営の小さな工場が多く、毎月第3土曜日には工場を開いて見学者を迎えている。

吉田のうどんの店の多くは、今も昼だけ開く。観光庁の解説文は、織物が町の主な産業だった20世紀初めにさかのぼる習わしだと説明している。標高700〜900メートルほどの冷涼な気候と火山灰の土のため、この地は昔から稲づくりに向かなかった。麺は太く、驚くほどの歯ごたえとコシがあり、生地は袋に入れたまま足で踏んでこねる。農林水産省は、機械を動かす女性の手を止めないように、行商を受け持つ男性たちが昼食にうどんをつくるようになった、といわれると紹介している。同じ省の別のページは女性の仕事を「製糸」と書いており、言い伝えの細部は一つに定まっていない。

- Lower right corner: a small square illustration (about 28% of the right page width): overhead view of one bowl of very thick, firm white udon noodles in a light brown miso-and-soy broth, on a plain wooden counter, chopsticks resting on the bowl, no toppings, no logo on the bowl. Under it, tiny Gothic caption: 吉田のうどん
- Two small boxed notes stacked above the udon illustration, each a thin navy outline box with a large vermilion number/word on the left and one line of Gothic on the right:
  Box 1 — big: 第3土曜　/ line: 毎月第3土曜日には工場を開いて見学者を迎えている。
  Box 2 — big: 昼だけ　/ line: 吉田のうどんの店の多くは、今も昼だけ開く。
- Bottom of right page, tiny grey Gothic: イラスト：生成AI
```
[신규] 캡션 「県の甲斐絹ミュージアムの説明より」, 박스 머리말 「第3土曜」「昼だけ」. 원문 낱말에서 땄다.

---

## 8쪽 — 「本町通り」 (단면 2:3) · 첨부: `14-view/out/guide.png`

**에디터 관점**
- 표지와 같은 거리를 이번에는 지면 안에서 "읽게" 한다.
- 그림을 위 2/3에, 글을 아래 1/3에 둔다.
- 안전 당부를 따로 떼어 작은 박스로 둔다. 관광 잡지가 아니라 동네를 존중하는 잡지라는 태도다.

**열혈 독자 관점**
- 하루 2,000명, 2017년쯤이라는 숫자로 "요즘의 이 거리"를 안다.
- 가기 전에 박스 한 줄을 기억한다.

**검수**
- 산 윤곽은 수치로 잰다.
- 길이 산과 일직선으로 "고쳐지지" 않았는지 본다.
- 간판 글자가 0이어야 한다.
- 단락과 박스를 대조한다.

```
PAGE 8 — "本町通り". Portrait 2:3 (1024x1536).

ATTACHMENT: black line-drawing composition guide.

ILLUSTRATION: occupies the top two-thirds of the page, bleeding off the top and both sides. Use the attachment as the exact composition guide, cropped to this area: the thick curve is the true skyline of Mount Fuji from this spot — follow it exactly (same shape, height and position); the dashed line is the centre of the two-lane street — keep it exactly; the street runs slightly to the right of the summit, which is correct. Place a dark copper-clad (bronze-green, NOT red) plain torii gate across the street at the small cross. Low shop buildings, utility poles and wires on both sides. Mid-morning light. A few tiny distant figures standing on the pavements (not in the roadway), no faces. Do not draw the guide lines.

TEXT AREA (bottom third, off-white paper):
- Headline at left, large bold Mincho, navy: 本町通り
- Body (Gothic, 2 columns):

下吉田の中心を通る富士みちは、通称「本町通り」と呼ばれる。正面に富士山が続くように見えるこの通りで、写真を撮る人が増えた。市の富士山課は報道の取材に対し、撮影の場所として注目されたのは2017年ごろからだと答えている。訪れる人は1日平均2000人ほどで、警備員を1年中置いているという。地元の観光案内は、車道に出て撮るのは危ないのでやめてほしいと呼びかけている。2016年に始まった秋の「ハタオリマチフェスティバル」は、本町通りをメイン会場の一つにしている。

- A small note box at the right end of the text area, thin vermilion outline, Gothic, two lines:
  車道に出て撮るのは
  危ないのでやめてほしい
  and under it, tiny: ——地元の観光案内より
- Very bottom, tiny grey Gothic: イラスト：生成AI（構図は国土地理院の標高データとOpenStreetMapによる実測）
```
[신규] 「——地元の観光案内より」(출처 표시). 박스 문구는 원문의 인용 부분이다.

---

## 9쪽 — 「鳥居の先」 (단면 2:3)

**에디터 관점**
- 기둥 두 개가 산을 액자처럼 끼는 한 장으로 표지 부제(30m)에 답한다.
- 鳥居 아래 여백에 1788/1957 두 숫자만 세운다. BRUTUS의 "숫자로 말하기"다.
- 이 숫자는 11–12쪽 「火の夜」 끝단락의 사실이기도 하다.

**열혈 독자 관점**
- "一ノ鳥居"라는 이름과 "그 앞이 신역"이라는 한 줄에서 경계를 넘는 감각을 느낀다.

**검수**
- 鳥居가 청동색인지 확인한다. 주홍이면 즉시 탈락이다.
- 현판·글자가 없어야 한다.
- 단락과 숫자 라벨을 대조한다.

```
PAGE 9 — "鳥居の先". Portrait 2:3 (1024x1536).

ILLUSTRATION: top 62% of the page, full width, bleeding off the top and sides.
Standing on a town street looking south, a large plain torii gate made of dark copper-clad metal (bronze-green, NOT vermilion or red, no plaque, no lettering) spans the street. Between its two pillars, Mount Fuji is framed in the distance. Clear late-summer morning, soft light. No people.

BELOW THE ILLUSTRATION:
- Left, large bold Mincho, navy: 鳥居の先
- Right of the headline, two stacked number labels in Gothic:
  Large vermilion "1788" + small navy line: 最初の鳥居（富士講の信者が建てた）
  Large navy "1957" + small navy line: 今の鳥居（もとの場所より30メートルほど富士山に近い）
- Body (Gothic, full width, one column):

富士みちを南へ上ると、富士山駅の東で金鳥居をくぐる。山頂までに立つ鳥居の一番目にあたり、「一ノ鳥居」とも呼ばれる。県の資料は、「そこから先が富士山の神域」と書く。鳥居の先が、冒頭の上吉田である。

- Very bottom, tiny grey Gothic: イラスト：生成AI
```
[신규] 숫자 라벨 두 줄. 원문 「最初の鳥居は1788年に富士講の信者が建てた。1957年にできた今の鳥居は、もとの場所より30メートルほど富士山に近い。」를 줄였다.

---

## 10쪽 — 「御師の宿」 글 중심 (단면 2:3)

**에디터 관점**
- 그림 없이 타이포와 인포그래픽만으로 쉬어 가는 쪽이다(펼침 사이의 호흡).
- 「8日の旅」를 날짜 막대 8칸으로 보여 준다. 왕로 3·산 2·복로 3이다.
- 86→5의 낙차를 큰 숫자 두 개로 세운다.

**열혈 독자 관점**
- 8칸 막대를 보며 "에도에서 걸어서"의 실감을 얻는다.
- 86에서 5로 줄어든 낙차를 기억한다.

**검수**
- 막대가 8칸이고 3·2·3으로 나뉘는지 본다.
- 86·5·1768·2013·1964·19,860을 대조한다.
- 두 단락을 대조한다.

```
PAGE 10 — continuation of "鳥居の先". Portrait 2:3 (1024x1536). Typography and simple infographics only, no illustration.

TOP: small Gothic, vermilion, letter-spaced: 鳥居の先（つづき）

INFOGRAPHIC 1 (upper third): a horizontal bar of 8 equal square cells in a row, labelled above, small bold Mincho: 江戸から山頂まで、8日の旅
- Cells 1–3 filled navy, label under them (Gothic): 江戸→吉田　片道3日
- Cells 4–5 filled vermilion, label under them: 吉田→山頂　往復2日以上
- Cells 6–8 filled navy, label under them: 吉田→江戸　3日
Tiny grey note under the bar: 健脚でも

INFOGRAPHIC 2 (middle): two very large Gothic numbers side by side with an arrow between them: 86 → 5
Under "86": 御師の家（多いとき）
Under "5": 今も講社を迎えている家

BODY (Gothic, 2 columns, lower half), these two paragraphs:

御師は、富士講の人びとに宿を貸すだけでなく、教えを説き、祈祷をし、さまざまな取り次ぎをした。江戸から吉田までは健脚でも片道3日かかり、吉田から山頂の往復に少なくとも2日、合わせて8日の旅だった。御師の家は多いときで86軒を数えた。今も講社を迎えている家は5軒だという。明和5年（1768年）に建った旧外川家住宅の主屋は、年代のわかる富士山の御師住宅のなかで最も古い。2013年6月、富士山は「信仰の対象と芸術の源泉」として世界文化遺産に登録され、この家と小佐野家住宅は構成資産になった。

昭和39年（1964年）に富士スバルラインが開通すると、富士登山の形は大きく変わり、吉田口登山道と富士講は急に衰えた。それでも富士吉田市によれば、2026年の登山シーズンに麓の馬返しを通って歩いて登った人は1万9,860人いた。
```
[신규] 「鳥居の先（つづき）」, 「江戸から山頂まで、8日の旅」, 막대 라벨 「吉田→江戸　3日」. 「片道3日」의 귀로를 3일로 나타낸 것은 원문 「合わせて8日」(3＋2＋3)과 일치한다. 원문은 귀로 일수를 따로 쓰지 않았으니 편집장 확인 대상이다.

---

## 11–12쪽 — 펼침 「火の夜」 (3:2)

**에디터 관점**
- 호의 클라이맥스다. 밤 펼침 전체를 그림으로 덮고, 글은 어둠 속 흰 글씨로 낮게 둔다.
- 날짜 「8月26日」을 크게 박는다.
- 횃불 하나에 치수 주석선을 단다. POPEYE식 손 주석으로, 사실은 원문 수치다.
- 『甲斐国志』의 「真昼のように明るく」를 풀쿼트로 둔다.

**열혈 독자 관점**
- 달력에 8월 26일을 적는다.
- 산 위 불빛 줄이 "산장의 불"이라는 걸 알고 다시 그림을 본다.

**검수**
- 횃불이 죽순(원뿔) 모양인지 본다.
- 산의 불빛이 분화처럼 보이면 안 된다.
- 군중에 얼굴이 없어야 한다.
- 치수 주석과 두 단락을 대조한다.

```
PAGE 11–12 — SPREAD "火の夜". Landscape 3:2 (1536x1024). Night spread: the illustration covers the entire spread edge to edge; all text is off-white on the dark image.

ILLUSTRATION (full bleed):
Night in a long, straight town street that rises gently toward Mount Fuji. Down both sides of the street stand tall bonfire torches, each about three metres high (about twice a person's height) and shaped like a giant bamboo shoot — a tall, slender cone — all burning brightly so the street is lit as bright as day, warm orange light on the road. Far away, the dark silhouette of Mount Fuji against a deep navy sky, with a thin line of tiny fire points glowing on its slope where the mountain huts light their own fires (small steady points, NOT an eruption, NOT lava). Crowds only as dark silhouettes, no faces, no festival clothing with lettering. Keep the lower-left quarter of the spread darker and calmer for text.

TEXT (off-white #eef0f4 on the image):
- Upper-left, very large Gothic numerals and characters: 8月26日
- Under it, large bold Mincho: 火の夜
- One torch near the right side has a thin off-white annotation line pointing to it, with small Gothic text: 高さ約3メートル、直径約90センチ
- Lower-left, body (Gothic, 2 narrow columns), these two paragraphs:

道がいちばん明るくなるのは、8月26日の夜である。吉田の火祭では、高さ約3メートル、直径約90センチの筍の形をした大松明が表通りに立てられ、火が点される。町の火に合わせて富士山の山小屋でも火が焚かれ、山と町とがひとつになる、と文化庁の解説は書く。19世紀初めに編まれた『甲斐国志』は、村の中が真昼のように明るかったと伝えている。

翌27日の祭りは、金鳥居で行われる。鳥居の柱のあいだに、富士山を見ることができる。最初の鳥居は1788年に富士講の信者が建てた。1957年にできた今の鳥居は、もとの場所より30メートルほど富士山に近い。

- Lower-right, PULL QUOTE, large Mincho, off-white, with a thin vermilion rule above: 「真昼のように明るく」
  and under it, small Gothic: ——『甲斐国志』
- Bottom corner, tiny: イラスト：生成AI
```
[신규] 「——『甲斐国志』」(출처 표시). 풀쿼트는 원고가 이미 인용한 공적 자료의 짧은 어구다.

---

## 13쪽 — 「数字で読む富士吉田」 (단면 2:3) [신규 꼭지명]

**에디터 관점**
- BRUTUS 독자가 가장 오래 머무는 쪽이다.
- 본문에 흩어진 숫자 12개를 한 장에 모아, 큰 숫자와 한 줄 설명으로 늘어놓는다.
- 모든 숫자는 원고 그대로다.

**열혈 독자 관점**
- 이 쪽 하나만 사진 찍어 저장한다. 다음 여행의 대화 소재가 된다.

**검수**: 숫자 12개와 설명을 원고와 한 줄씩 대조한다. 숫자 하나라도 틀리면 탈락이다.

```
PAGE 13 — "数字で読む富士吉田". Portrait 2:3 (1024x1536). Typography only, no illustration.

TOP: large bold Mincho, navy: 数字で読む富士吉田

GRID: 12 entries in a 3-column x 4-row grid, thin navy hairlines between cells. In each cell: a large Gothic number (navy; the three marked ★ in vermilion), and under it one or two lines of small Gothic. Render exactly:

1. ★1572 — 上吉田の町が今の場所にできた年（元亀3年）
2. 70 — 屋敷地の数（東町31軒、西町39軒）
3. 約125m — 下吉田駅から富士山駅まで約8キロの散策コースの高低差
4. 700〜900m — 標高。冷涼で、稲づくりに向かなかった
5. ★4割 — 国産ネクタイ生地のうち、ここの生地が使われている割合
6. 第3土曜日 — 毎月、工場を開いて見学者を迎える日
7. 2,000人 — 本町通りを訪れる人の1日平均
8. 8日 — 江戸から山頂を往復する旅の日数
9. 86→5 — 御師の家（多いとき）と、今も講社を迎えている家
10. 1万9,860人 — 2026年の登山シーズンに、馬返しを通って歩いて登った人
11. 約3m — 火祭の大松明の高さ（直径約90センチ）
12. ★30m — 今の金鳥居が、もとの場所より富士山に近い距離

BOTTOM: tiny grey Gothic: 数字はすべて本文の出典による
```
[신규] 꼭지명, 셀 설명문(본문 문장을 줄인 것), 하단 주석. 새 사실은 없다.

---

## 14쪽 — 「この町のことば」 (단면 2:3)

**에디터 관점**
- 학습 앱의 매거진다운 쪽이다. 낱말 9개를 사전 표제어처럼 조판한다.
- 표제어는 크게, 뜻은 원고 「意味」 칸 그대로 둔다.
- 2–3쪽에서 만난 낱말(タツミチ, 間の川)을 여기서 다시 만난다.

**열혈 독자 관점**
- 표제어에 형광펜을 칠한다. 앱의 단어 저장으로 이어지는 쪽이다.

**검수**: 표제어 9개와 뜻을 대조한다.

```
PAGE 14 — "この町のことば". Portrait 2:3 (1024x1536). Typography only, like a small dictionary page.

TOP: large bold Mincho, navy: この町のことば

LIST: 9 entries, each with the headword in bold Mincho (navy, about twice the body size) followed on the next line by its meaning in small Gothic. Thin hairline between entries. Two columns. Render exactly:

富士みち — 富士講が富士山へ向かった道。県は今の国道139号の愛称として紹介し、北口本宮は「現国道137号線」と書く
御師（おし） — 富士講の人びとを泊め、祈祷や案内をした人びと
タツミチ — 御師の家の表通りから奥へ入る細長い引き込み路
間の川 — 御師の家の中門の奥を流れる水路。禊に使った
一ノ鳥居 — 山頂までに立つ鳥居の一番目。金鳥居のこと
構成資産 — 世界遺産「富士山」を形づくる個々の資産。全部で25ある
取り次ぎ — 御師の仕事の一つ。本文では北口本宮冨士浅間神社の説明の言葉（「取次」）をそのまま使った
ガチャマン — 戦後の織物の好景気を指すことば
吉田のうどん — 太く硬い麺を味噌や醤油の汁で食べる郷土料理

(Each headword's first character may carry a small vermilion dot to the left as a bullet.)
```

---

## 15쪽 — 「富士みち略図」+「歩くなら」 (단면 2:3) [신규 꼭지명]

**에디터 관점**
- POPEYE식 손그림 지도를 낸다. 단, 이 호는 실측에 정직한 호라서 「略図・縮尺なし」를 크게 밝힌다.
- 아래에는 원고 사실만으로 만든 "가기 전 다섯 줄" 박스를 둔다.

**열혈 독자 관점**
- 이 쪽을 들고 걷는다. 北口本宮이 직선 위에 없다는 점(약 450m 남남동)을 지도에서 확인한다.

**검수**
- 지명 9개의 순서를 본다: 下吉田駅 → 本町通り → 富士山駅·金鳥居 → 上吉田 → 上宿の交差点.
- 北口本宮이 선에서 벗어나 있어야 한다.
- 富士山駅이 金鳥居의 서쪽이어야 한다.
- 다섯 줄을 대조한다.

```
PAGE 15 — map and practical box. Portrait 2:3 (1024x1536).

TOP: large bold Mincho, navy: 富士みち略図
Right of the title, small grey Gothic: 略図・縮尺なし

MAP (upper 62% of the page): a hand-drawn style schematic map on off-white, navy line work, one vermilion line.
- North is at the bottom, south (toward Mount Fuji) is at the top. A simple flat silhouette of Mount Fuji at the top edge, labelled: 富士山（剣ヶ峰）
- One vermilion line = the road. From the bottom of the map it rises upward, makes one bend near the bottom (labelled near the bend: 下吉田), then runs almost straight upward, ending at a junction labelled: 上宿の交差点. The straight part points slightly to the right of the summit, not exactly at it.
- Along the line, from bottom to top, small labels: 下吉田駅 (beside the line near the bottom), 本町通り (along the lower straight part), then a small navy torii symbol across the line labelled 金鳥居, with 富士山駅 just to the LEFT (west) of the torii, then the section above the torii labelled 上吉田（御師の町）.
- A small navy shrine symbol placed a little to the upper-LEFT of the line's top end — clearly off the line — labelled: 北口本宮冨士浅間神社
- Two soft area labels in grey: lower part 「俗なる町」（下吉田）, upper part 「聖なる町」（上吉田）

BOX (lower part, thin navy outline, title in bold Mincho: 歩くなら), five lines of Gothic, each starting with a small vermilion dot:
・下吉田駅から富士山駅まで、県の散策コースは約8キロ、高低差は約125メートル
・毎月第3土曜日には、工場を開いて見学者を迎えている
・吉田のうどんの店の多くは、昼だけ開く
・本町通りでは、車道に出て撮らない
・8月26日の夜は、吉田の火祭

BOTTOM tiny grey Gothic: 地図は概念図です。道の位置関係はOpenStreetMapによる
```
[신규]
- 꼭지명 「富士みち略図」 「歩くなら」, 지도 주석.
- 박스 다섯 줄은 본문 문장을 줄였다.
- 「北口本宮は上宿から南南東へ約450メートル」는 원고 (4)에 있다. 지도상 왼쪽 위(남남동은 북쪽이 아래인 지도에서 위·왼쪽)에 두었다.

---

## 16쪽 — 奥付·크레딧 (단면 2:3)

**에디터 관점**
- 신뢰를 표지만큼 공들여 조판한다.
- 생성 AI 사용, 실측 데이터, 재구성 장면을 숨기지 않고 정면으로 밝힌다. 이 잡지의 태도다.

**검수**: 각 줄을 대조한다.

```
PAGE 16 — colophon. Portrait 2:3 (1024x1536). Typography only, very quiet, lots of white space, everything in small Gothic, navy, left-aligned in the lower half of the page.

Upper half: only the logo-free title in large bold Mincho, navy, centred: 一つの町　01　富士吉田

Lower half, lines (render exactly):
文・構成　となり編集部
イラスト　生成AI（表紙と8ページの構図は、国土地理院の標高データとOpenStreetMapによる実測）
地図　© OpenStreetMap contributors（ODbL）openstreetmap.org/copyright
標高　国土地理院
冒頭の場面は資料をもとにした再構成です。
本文の事実は、すべて公的機関などの原文と照らし合わせて確かめています。
```
[신규] 奥付 전체.
- 마지막 줄 「本文の事実は…原文と照らし合わせて確かめています。」는 원고 머리의 「すべて原文を開いて照合した行だけを使った」에 근거한다.
- 원고에 保留 행이 있으면 이 문장을 조정해야 한다. 편집장 확인 대상이다.
