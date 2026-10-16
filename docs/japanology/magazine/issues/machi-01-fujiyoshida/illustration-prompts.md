# 一つの町 01 富士吉田 — 그림만 생성 (B안, 2026-10-16 KST)

**경위**: 오너 보고 「프롬프트대로 제작하는 걸 어려워하는 것 같다, 실패하네」. 그래서 역할을 바꾼다.

**분담**
| 누가 | 하는 일 |
|---|---|
| ChatGPT | 그림만 그린다. 글자·배치는 요청하지 않는다 |
| Claude | 지면 조판(HTML). 제목·본문·숫자·박스·폴리오·로고, 4–5쪽 도해, 15쪽 지도 |

지면 연출의 정본은 그대로 `page-prompts.md` v3.2다. 위치·문구·크기는 그 설계를 따르고, Claude가 조판한다.

**쓰는 법**
- ChatGPT **임시 채팅**을 연다.
- 아래 공통 한 줄과 장면 블록을 붙여 넣는다.
- 비율은 선택기로 고른다.
- ①을 확정하면, 나머지 그림에는 ①을 첨부하고 `Match the style of the attached image.`를 덧붙인다.
- 받은 그림은 새 메시지로 Claude에게 보낸다. 실패한 것도 보낸다. 원인 진단에 쓴다.

## 공통 한 줄
```
Editorial gouache illustration for a Japanese culture magazine: flat colour, soft natural light, no outlines, not photographic. Restrained palette of deep navy, pale grey-white and muted greens and greys. No text, letters, signs, logos or watermarks anywhere. No recognisable faces.
```

## ① 12쪽 기둥 사이의 산 — 1:1 (스타일 기준)
```
Standing close to a large torii gate on a town street, looking south-southwest. The two pillars, copper-clad in dark weathered-copper colour (NOT red), rise at the left and right edges; the crossbeams cross the top, with a small framed tablet whose marks are unreadable. Between the pillars, small and clear in the distance, Mount Fuji with no snow (late August). Mostly pale sky. Early morning. No people.
```

## ② 8쪽 本町通り — 1:1 · 첨부 `attach/08-square-guide.png`
```
Use the attached line drawing as the exact composition. The thick curve is the true skyline of Mount Fuji — follow it exactly, do not make the mountain taller or steeper. The dashed line is the centre of a two-lane town street running toward the mountain; follow it exactly, including the small jog to the right far away. At the small cross, a dark weathered-copper torii gate (NOT red) spans the street. Low shop buildings with blank fronts, utility poles and wires. Mid-morning, late summer, no snow. A few tiny figures on the pavements only. Do not draw the guide lines.
```
검수는 `VIEW_OUT=out-honcho-p8 python3 -I ../../prototype/cover-machi01/14-view/verify.py <그림>`(정사각 그대로)로 한다.

## ③ 2–3쪽 문 너머의 물길 — 1:1
```
We stand just inside a small one-bay roofed wooden gate at the end of a long, narrow lane, beside a narrow channel of clear mountain water running fast at our feet. We have turned around: over the low roofs of the neighbouring house, Mount Fuji rises — broad rather than tall, open sky above it. The gate and a glimpse of the lane at one edge. No people. Early morning, cool air, late summer.
```

## ④ 6쪽 甲斐絹 — 2:3
```
Close-up still life of a very thin, light plain silk fabric draped in soft folds on a dark wooden table, side light showing a delicate shifting sheen. A few spools of very fine thread beside it. No labels, no packaging.
```

## ⑤ 7쪽 吉田のうどん — 1:1
```
Overhead view of one plain bowl of very thick, firm white udon noodles in a light brown miso-and-soy broth with a little boiled cabbage, on a plain wooden counter, chopsticks resting on the bowl. Lunchtime light.
```

## ⑥ 10–11쪽 불의 밤 — 3:2
```
Night in a long, straight town street rising gently toward Mount Fuji. Along the street stand tall bonfire torches, each nearly twice a person's height and shaped like a giant bamboo shoot — a tall slender cone — all burning brightly, the street lit as bright as day. Far away, the dark silhouette of Mount Fuji against a deep navy late-summer sky, no snow, with a thin line of tiny steady fire points on its slope (mountain huts' fires, NOT an eruption). Crowds only as dark silhouettes. Keep the lower-left quarter darker and calm.
```

## 검수 기준
- 쪽별 기준은 `visual-review.md`를 따른다.
- 鳥居는 동색이어야 한다(주홍 금지).
- 글자·간판·로고가 0이어야 한다.
- 얼굴이 0이어야 한다.
- 8월 장면에는 눈이 없어야 한다.
