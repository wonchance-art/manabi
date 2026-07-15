# 오버월드 투영 스파이크 비교 보고서

> 생성 명령: `node scripts/world/projection-spike.mjs --input-dir <verified-cache>`
> 판정 범위: 헌장 §4의 3후보 × 7 시각 fixture × screen/geo-axis. 본생성·노드 마이그레이션·DB 변경 없음.

## 판정 (2026-07-15, Claude×Codex 의견 일치)

- **① 아시아-태평양 확정: Equirectangular + screen-axis.** 중심경선 125°E, 표준위도 27.5°N을 고정하고 KR/JP 콘텐츠 가중 점수와 그리드 의미론을 우선한다.
- **② 유럽-지중해-중동: HOLD.** 수치 1위는 LAEA지만 screen-axis 방향 하드 게이트를 넘지 못했다. 재평가할 때는 현 3후보 비교에 **등장방형 표준위도 스윕**을 추가 검토한다.
- LAEA와 geo-axis는 수치 비교군으로 유지하되, 4방향 이산 이동에서 축 회전 비용이 사라지지 않는다.

점수 가중치는 manifest의 `scoreWeights`로 고정한다(축척 25%, 북쪽 이탈 20%, 전단 15%, 형상 25%, screen-up 15%). 절대 품질값이 아니라 후보 순위용이며 원시 지표를 함께 공개한다.

## 입력과 결정성

- Natural Earth land 10m v5.1.2: `1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416`
- Natural Earth populated places 10m v5.1.2: `9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b`
- 지구 반경 6371008.8m, 명목 4500m/타일, 256타일/청크.
- 표본은 bbox 내부 21×21 셀 중심, 피처는 source index 순, 반올림은 half-away-from-zero.
- 시각은 후보별 동일 지리 bbox를 viewport-normalize하고, 수치는 **정규화 전 원시 투영 미터**에서 계산했다.
- 역변환 비용 프록시(초월함수·분기 상대단위): 등장방형 1, Sinusoidal 2, LAEA 8. 환경 의존 wall-clock 수치는 결정성 산출물에서 제외했다.

## 지역 ① 원시 요약

| 후보 | 동서 축척 P95 | 북쪽 이탈 P95 | 형상 왜곡 P95 | screen up P95 | geo stair P95 | 하드 게이트 |
|---|---:|---:|---:|---:|---:|---|
| Equirectangular | 48.4% | 0° | 48.4% | 0° | 0% | screen PASS / geo PASS |
| Sinusoidal | 0% | 32.2° | 85.8% | 32.2° | 38.6% | screen PASS / geo PASS |
| LAEA | 16.5% | 31.6° | 65.9% | 34.9° | 38.1% | screen PASS / geo PASS |

### 균등·콘텐츠 가중 평균

| 후보 | 균등 평균 점수↓ | KR/JP 콘텐츠 가중 점수↓ |
|---|---:|---:|
| Equirectangular | 10.66 | 9.9 |
| Sinusoidal | 26.53 | 18.85 |
| LAEA | 19.38 | 12.59 |

## 지역 ② 원시 요약

| 후보 | 동서 축척 P95 | 북쪽 이탈 P95 | 형상 왜곡 P95 | screen up P95 | geo stair P95 | 하드 게이트 |
|---|---:|---:|---:|---:|---:|---|
| Equirectangular | 54.2% | 0° | 54.2% | 0° | 0% | screen PASS / geo PASS |
| Sinusoidal | 0% | 22.6° | 51.2% | 22.6° | 29.4% | screen FAIL / geo PASS |
| LAEA | 1.8% | 23.5° | 6.5% | 24.1° | 30.3% | screen FAIL / geo PASS |

## 입력 모드 판정

- **screen-axis**: 입력과 미니맵 축이 항상 일치한다. 실제 진북과의 차이는 `screenNorthErrorDeg`로 공개하며 22.5° 초과를 4방향 의미론 반전 위험으로 본다.
- **geo-axis**: 연속 벡터는 진북을 맞추지만 타일 이동에는 수평 스텝을 섞어야 한다. `geoAxisHorizontalShare`는 진북 1타일 진행에 필요한 수평 스텝 비율이다.
- 최종 입력 권고는 screen-axis다. geo-axis는 방향 보조선·미니맵 나침반용 계산에는 재사용할 수 있지만 플레이어 D-pad 기본값으로 쓰지 않는다.
- 방향 하드 게이트의 핵심 범위는 ① 일본+한반도, ② 전체 지역 bbox다. 원시 지역 P95와 핵심 범위 최대값은 서로 다른 질문이므로 표의 모드 판정은 후자를 사용한다.

## 철도·하드 게이트

- Trans-Siberian 대표 제어선의 투영 기인 추가 곡률(누적/최대 1스텝): 등장방형 75.6°/11.66°, Sinusoidal 40.8°/6.04°, LAEA 78.5°/4.42°.
- 전 후보의 공통 게이트는 WGS84→float tile→WGS84 P95 <0.25타일, 256 청크 경계 재구성 균열 0, 앵커 청크 소속 반복 계산 byte-identical이다. 방향 게이트는 입력 모드별로 분리하며 표의 `screen/geo` 판정은 공통 게이트까지 포함한다.
- 정수 타일 반올림 오차는 별도 게임플레이 오차이며 역투영 게이트에 섞지 않았다. 실제 래스터 수직 슬라이스에서 supersampling·half-open ownership을 다시 검증한다.

## 7개 시각 fixture

1. [전역 축소도](generated/world-projection-spike/overview.svg)
2. [일본 열도](generated/world-projection-spike/japan.svg)
3. [한반도](generated/world-projection-spike/korea.svg)
4. [인도네시아](generated/world-projection-spike/indonesia.svg)
5. [뉴질랜드](generated/world-projection-spike/new-zealand.svg)
6. [시베리아 철도 제어선](generated/world-projection-spike/transsib.svg)
7. [호주 동해안](generated/world-projection-spike/australia-east.svg)

원시 수치는 [metrics.csv](generated/world-projection-spike/metrics.csv), 전체 판정 데이터는 [results.json](generated/world-projection-spike/results.json), 파일 해시는 [content-manifest.json](generated/world-projection-spike/content-manifest.json)에 있다.

## Codex 최종 의견(1p)

①은 **등장방형**을 지지한다. 일본·한반도에서 화면 위=북, 철도·도로 축, 미니맵 축이 정확히 일치하고, 현재 콘텐츠 가중치가 이 두 지역에 집중된다. 고위도 동서 팽창은 분명하지만 시베리아를 corridor 씬으로 분리하는 헌장 결정과 명목 4.5km/타일·시간표 기반 교통이 비용을 제한한다. 뉴질랜드의 형상 열화는 전단 30°보다 플레이 입력 일관성이 덜 위험하다.

②는 수치 점수 1위인 **LAEA**를 다음 체감 비교 대상으로만 유지한다. ②는 스칸디나비아·영국 등 고위도 육지가 저밀도 빈칸이 아니므로 등장방형 팽창 비용이 크지만, 현재 screen-axis 방향 게이트는 실패했다. 현 스코프는 타 지역 콘텐츠를 만들지 않으므로 투영을 잠그지 않고, 한일 수직 슬라이스에서 공통 청크 런타임을 먼저 검증한다. 재평가 시에는 표준위도 변화가 등장방형의 고위도 팽창과 핵심 지역 형상에 미치는 영향도 같은 원시 지표로 스윕한다.
