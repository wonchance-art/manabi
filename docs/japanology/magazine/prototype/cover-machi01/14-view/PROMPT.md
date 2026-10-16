# ②단계 — ChatGPT에 넣는 프롬프트 (2026-10-16 KST)

> **낡음 (2026-10-16 KST)**: 이 파일은 v1(金鳥居 북 100m 시점) 기록이다. 쓰는 프롬프트의 정본은 `../../../issues/machi-01-fujiyoshida/page-prompts.md`, 첨부 파일은 `../../../issues/machi-01-fujiyoshida/attach/`.

**준비**: `out/guide.png`를 내려받아 ChatGPT 대화에 **첨부한 채로** 아래 블록 하나를 붙여 넣는다.
- 블록은 영어다.
- 출력은 반드시 **세로 2:3(1024×1536)** 으로 받는다. 검수기는 이 비율만 받는다.

## 가이드 그림이 뜻하는 것 (실측)
| 선 | 뜻 | 근거 |
|---|---|---|
| 굵은 곡선 | 이 자리에서 보이는 富士山 능선 | 국토지리원 標高 DEM10B로 계산 |
| 점선 | 富士みち(국도 139호) 도로 중심선 | OpenStreetMap 노드 |
| ＋ | 金鳥居가 선 지점(땅) | — |

- 시점: 金鳥居에서 북쪽으로 100m 떨어진 도로 위, 눈높이 1.6m.
- 方位 208.15°, 수평 화각 26°(망원).
- 능선의 높은 마루는 剣ヶ峰이 아니라 앞쪽(북쪽) 분화구 테두리일 수 있다. 계산은 보이는 대로 그렸다.

## A. 일러스트 (권장)
```
Use the attached line drawing as the exact composition guide for a portrait illustration (2:3, 1024x1536).
- The thick black curve is the true skyline of Mount Fuji seen from this exact spot, computed from elevation data. The mountain's silhouette must follow this curve exactly — same shape, same height, same position. Do not make the mountain taller, steeper or more symmetrical.
- The dashed line is the centre line of a two-lane town street running straight away from the viewer toward the mountain. Keep its position and direction exactly.
- The small cross marks the spot on the ground where a large torii gate stands across the street. Place the gate's two pillars on either side of the street at that spot. The gate is dark copper/bronze-green metal, NOT vermilion or red.
- Low two- and three-storey shop buildings line both sides of the street, with utility poles and wires.
Style: calm editorial illustration, flat gouache colours, soft daylight, clear air, a little snow on the summit. Not photographic.
No readable text anywhere: no signs with letters, no logos, no brand names, no license plates. People only as a few tiny distant figures with no recognisable faces. No cars in the foreground.
Do not draw the guide lines themselves in the final image.
```

## B. 사진풍 (쓰면 크레딧에 생성 표기 필수)
A 블록의 `Style:` 줄을 아래로 바꾼다. 나머지 규칙(글자·로고·사람·자동차 없음)은 그대로 둔다.
```
Style: natural photograph look, telephoto lens compression, soft morning light, clear air, a little snow on the summit.
```

## C. 金鳥居 없이 (형태 검증 부담을 없애는 판)
A 또는 B 블록에서 `The small cross marks…` 줄을 지우고 아래 줄을 넣는다.
```
Ignore the small cross; there is no gate in the picture.
```

## 고칠 때 (같은 대화, 결과 이미지 + guide.png 둘 다 첨부)
```
Keep everything in the first image, but the mountain outline does not match the thick curve in the guide. Redraw only the mountain so that its outline follows the guide curve exactly. Same size and aspect ratio.
```

## 보내 줄 것
- **생성 이미지 원본.** 새 메시지에 첨부한다. 작업 중에 보내면 파일로 저장되지 않는다.
- 쓴 블록(A/B/C)과 날짜.

## Claude가 하는 일 (③단계)
`verify.py`로 능선을 실측과 겹쳐 잰다.
- 통과 기준: 어긋남 중앙값 6px 이하, 95% 지점 15px 이하.
- 도로와 金鳥居 지점은 겹친 그림(`verify/*-overlay.png`)으로 확인한다.
- 통과한 것만 표지에 올린다.

**크레딧안**: 「イラスト：生成AI（構図は国土地理院の標高データとOpenStreetMapによる実測）」
- 사진풍(B)이면 「生成AIによるイメージ」를 앞에 둔다.
