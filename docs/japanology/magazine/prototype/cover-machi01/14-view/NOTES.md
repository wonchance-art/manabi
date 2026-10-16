# 14-view — 실측 뼈대 위에 AI가 칠하는 표지 그림 (2026-10-16 KST)

## 경위
오너 질문 「대조 검수해서 AI로 구성하는 건?」에 대한 답으로 구성한 공정이다. 오너는 「우선은 3번으로」를 택했다. 즉 생성은 오너의 ChatGPT가 맡는다.

## 공정
| 단계 | 담당 | 하는 일 |
|---|---|---|
| ① | Claude, `view.py` | 실측 뼈대를 만든다. 국토지리원 DEM10B로 능선을, OSM으로 富士みち 중심선과 金鳥居 지점을 잡는다. 결과는 `out/guide.png`, `guide-notes.png`, `guide.json` |
| ② | 오너, `PROMPT.md` | guide.png를 첨부해 ChatGPT로 생성한다 |
| ③ | Claude, `verify.py` | 능선 어긋남을 수치로 재고, 도로와 金鳥居 지점을 겹친 그림으로 확인한다 |

## 실측과 미검증 구분
**실측**
- 능선(시점에서 각 방위의 지형 최대 앙각, 굴절계수 0.13 보정)
- 도로 중심선
- 金鳥居의 땅 위 위치
- 시점 위치·높이

**미검증** (`guide.json`의 `unverified`)
- 도로 폭
- 金鳥居의 높이와 형태
- 건물 (DEM은 맨땅이다)

미검증 요소는 AI가 그린다. 크레딧의 생성 표기로 밝힌다.

## 자기 시험
- 실측 능선대로 칠한 가짜 그림: 중앙값 1.2px → 통과.
- 같은 그림을 25px 내린 것: 23.8px → 불합격.

## 재생성(리포 루트)
- 뼈대: `python3 -I docs/japanology/magazine/prototype/cover-machi01/14-view/view.py`
  - DEM 타일은 `data/dem/`에 캐시되고, 커밋하지 않는다.
- 검수: `python3 -I docs/japanology/magazine/prototype/cover-machi01/14-view/verify.py <이미지>`
