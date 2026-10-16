# 一つの町 01 富士吉田 — 지면 구성과 그림 프롬프트 (2026-10-16 KST)

> **v2로 대체 (2026-10-16 KST)**: 쪽 배치와 프롬프트의 정본은 `page-prompts.md` v2다. 이 파일의 P1–P6 장면은 v2에 흡수됐다. 바뀐 점: 2–3 시점은 몸을 돌린 자리, 8쪽은 本町通り 실측 시점, 鳥居 장면은 12쪽.


**분담 (오너 지시 2026-10-16 KST)**
- Claude: 매거진 구성과 아이디어를 내고, 그것을 프롬프트로 만든다.
- 오너: ChatGPT로 이미지를 받아 온다.

**근거**
- 모든 장면은 원고 `../../ja/machi-fujiyoshida.md`(1차 원문 대조 완료)에 있는 사실만 쓴다.
- 원고에 없는 세부는 프롬프트에서 "그리지 말 것" 또는 "일반적으로"로 둔다.

## 0. 공통 규칙 — 모든 그림 프롬프트 앞에 붙이는 하우스 스타일

```
HOUSE STYLE (use for every image in this series):
Calm editorial illustration for a Japanese culture magazine. Flat gouache texture, soft natural light, restrained palette built on deep navy (#151b2c), off-white (#eef0f4) and one accent of vermilion (#d4462a), with muted greens and greys. Simple shapes, no outlines, quiet and spacious composition with generous empty sky or wall for text.
RULES: No readable text anywhere — no signs with letters, no logos, no brand names, no license plates. No recognisable faces; people only as small distant figures or silhouettes. Not photographic. Do not invent landmarks that are not described.
```

이 규칙을 두는 이유:
- 같은 스타일 블록을 모든 그림 앞에 붙여야 호 전체가 한 손으로 그린 것처럼 보인다.
- 색 세 가지는 표지 토큰과 같다.
- 글자·로고 금지는 브랜드 정책 ⑴, 얼굴 금지는 가공 인물 금지 원칙에서 왔다.

**모든 AI 그림의 크레딧**: 「イラスト：生成AI」.
- 실측 가이드를 쓴 그림은 「構図は国土地理院の標高データとOpenStreetMapによる実測」을 덧붙인다.

## 1. 대지(페이지 배치)

| 쪽 | 원고 절 | 무엇 | 그림 | 만드는 쪽 |
|---|---|---|---|---|
| 1 | 扉 | 표지 | 새 마크 + 一本の線 지도, 또는 ④의 실측 일러스트 | Claude(지도)·오너(일러스트) |
| 2–3 | 門の奥の水 | 첫 장면 펼침 | **P1** 中門 너머 물길, 지붕 위 富士山 | 오너 |
| 4–5 | 山へ引かれた道 | 町割り의 이치 | 자작 도해(短冊 70필지·남쪽으로 뻗은 길)와 一本の線 지도 | Claude |
| 6–7 | 機の町 | 실크와 우동 | **P2** 甲斐絹 빛 정물, **P3** 吉田のうどん | 오너 |
| 8 | 本町通り | 길 끝의 산 | **P4** 실측 가이드 위 일러스트(14-view) | 오너, 검수는 Claude |
| 9 | 鳥居の先 | 一ノ鳥居 | **P5** 金鳥居 기둥 사이의 富士山 | 오너 |
| 10–11 | 火の夜 | 8월 26일 밤 | **P6** 대송명 줄과 산의 불 | 오너 |
| 12 | ことば·地図·出典 | 말 9개, 지도, 출처 | 글자만 | Claude |

- **4–5쪽은 AI를 쓰지 않는다.** 필지 수(東31·西39)처럼 세어야 하는 사실은 생성기가 틀린다.
- **4쪽**은 「聖なる町と俗なる町」을 한 장으로 보여 주는 지도다. 下吉田(俗)과 上吉田(聖)을 金鳥居가 가른다.

## 2. 그림별 프롬프트

각 블록 앞에 0의 HOUSE STYLE을 붙인다.

### P1 門の奥の水 — 2–3쪽 펼침, 가로 3:2 (1536×1024)

```
SCENE: Looking from a quiet main street into a long, narrow private lane that runs deep between houses in a Japanese mountain-foot town. At the far end of the lane stands a modest wooden inner gate. Just past the gate, a narrow stone-lined water channel runs fast across the ground at our feet, clear mountain water. Above the low roofs, Mount Fuji rises very large and close, filling the upper part of the sky.
No people. Early morning, cool air.
```

- 사실 근거
  - 원고 첫 장면: タツミチ(가늘고 긴 인입로) → 中門 → 발밑의 물길(間の川) → 지붕 위에 크게 다가오는 富士山.
  - 「人物は登場せず」.
- 그리지 말 것: 특정 가옥의 실제 외관. 御師住宅의 구조는 원고에 없다.

### P2 甲斐絹의 빛 — 6쪽 위, 세로 2:3 (1024×1536)

```
SCENE: Close-up still life of a very thin, light silk fabric draped in soft folds on a dark wooden table, catching side light so it shows a delicate shifting sheen. Beside it, a few spools of very fine thread. No pattern, no labels, no packaging.
```

- 사실 근거: 「非常に軽く、平滑な薄手」, 독특한 광택, 가는 실을 높은 밀도로 짠다.
- 주의
  - 甲斐絹 고유의 무늬·색은 원고에 없으므로 무지로 둔다.
  - 넥타이 완제품이나 상표는 그리지 않는다.

### P3 吉田のうどん — 7쪽 아래, 정사각 (1024×1024)

```
SCENE: Overhead view of one bowl of very thick, firm white udon noodles in a light brown miso-and-soy broth, on a plain wooden counter at lunchtime light. Simple and unadorned. Chopsticks resting on the bowl.
```

- 사실 근거: 「太く、驚くほどの歯ごたえとコシ」, 味噌や醤油の汁, 낮에만 여는 가게.
- 주의: 고명(양배추·말고기 등)은 원고에 없으므로 넣지 않는다.

### P4 本町通り — 8쪽, 세로 2:3 (1024×1536) · 실측 가이드 사용

- `../../prototype/cover-machi01/14-view/out/guide.png`를 **첨부**한다.
- 프롬프트는 `14-view/PROMPT.md`의 블록 A(일러스트)를 쓴다.
- 받으면 Claude가 능선을 실측과 겹쳐 잰다. 통과 기준은 어긋남 중앙값 6px 이하.
- 이 그림은 표지 후보도 겸한다.

### P5 鳥居の先 — 9쪽, 세로 2:3 (1024×1536)

```
SCENE: Standing on a town street looking south, a large plain torii gate made of dark copper-clad metal (bronze-green, NOT vermilion or red) spans the street. Between its two pillars, Mount Fuji is framed in the distance. Clear late-summer morning.
```

- 사실 근거
  - 1957년의 지금 鳥居, 銅張り라 주홍이 아니다.
  - 27일 제례 때 「鳥居の柱のあいだに、富士山を見ることができる」.
- 미검증: 鳥居의 정확한 형태·비례. 그래서 「plain」으로 단순하게 두고, 크레딧의 생성 표기로 밝힌다.
- 이 장면도 실측 가이드로 바꿀 수 있다. 시점을 金鳥居 바로 앞으로 옮기면 된다. 원하면 Claude가 만든다.

### P6 火の夜 — 10–11쪽 펼침, 가로 3:2 (1536×1024)

```
SCENE: Night in a long, straight town street that rises gently toward Mount Fuji. Down both sides of the street stand tall bonfire torches, each about three metres high and shaped like a giant bamboo shoot, all burning brightly so the street is lit as bright as day. Far away, the dark silhouette of Mount Fuji, with a thin line of tiny fire points glowing on its slope where the mountain huts light their own fires. Crowds only as dark silhouettes, no faces.
```

- 사실 근거
  - 8월 26일 밤, 높이 약 3m·지름 약 90cm의 筍 모양 大松明.
  - 표통에 세운다.
  - 산의 山小屋에서도 불을 피운다.
  - 「真昼のように明るく」.
- 주의: 실제 거리의 건물 배치는 미검증이다. 길은 「곧게, 산을 향해 완만한 오르막」까지만 지정한다.

## 3. 받을 때 규칙
- **크기**: 그림마다 위에 적은 비율로 받는다.
- **보내는 법**: 새 메시지에 첨부한다. 작업 도중에 보낸 이미지는 파일로 저장되지 않는다.
- **알려 줄 것**: 그림 번호(P1~P6), 쓴 블록, 날짜.
- **수정 요청**: 같은 대화에서 아래 문장으로 한 군데만 고친다.
  ```
  Keep everything identical except: ___
  ```
  - 3번 안에 안 되면 멈추고 Claude에게 넘긴다.
- **Claude의 검수**
  - 원고 사실과 어긋나는 것이 있는지 본다. 예: 주홍 鳥居, 고명, 읽히는 간판, 얼굴.
  - P4는 수치 검수도 한다.
  - 통과한 것만 지면에 올린다.
