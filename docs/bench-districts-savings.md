# 지구제 잠금 렌더 실절감 벤치

- 상태: **report-only** — 제품 코드·테스트·자산·DB 무수정
- 측정 입력: `origin/main` `946185fda2460b23cb0c56c9ed45ebe3d4be74bc`
- 최종 검증 기준: `origin/main` `13be4cf411c22e3930b5e94e460c19b122d67a4d`
- 발주: 이슈 #150 코멘트 `5049638103`의 D4, 이번 P4 지시로 정본 7도시 전수 확장
- 환경: macOS arm64, 공식 nvm Node `v22.23.1`, Vitest `v4.1.4`
- 측정일: 2026-07-23 KST

## 결론

1. 정본 7도시 7,478,279타일 중 6,833,857타일(91.383%)이 잠금이다. 잠금 타일이
   소비하는 지형 키는 가상 전체상세 25~57종에서 guidebook 5~6종으로 줄었다.
2. 이 감소는 **잠금 청크의 키 선택·CPU bake 절감**이다. 완전 잠금 청크 128개를 도시별로
   균등 표본화한 production `bakeChunk()` JS 경로는 전체상세 대비 p50 10.9~44.1% 빨랐고,
   도시 중앙값은 두 one-shot에서 각각 24.15%, 23.89% 빨랐다.
3. 반대로 전역 텍스처 할당 절감은 없다. 개방 지구가 상세 키를 계속 필요로 하고 preload가
   상세 텍스처를 전부 굽기 때문에, 도시 전체 실사용 키는 5~6종 **늘고** `ct_*` 생성 자산도
   8개(guidebook 7 + 경계 팻말 1) 늘어난다.
4. 명시 프롭 스킵은 7도시 합계 1개, NPC 상세 마커 스킵은 0개다. resolver가 NPC를 개방 지구에
   강제하므로 NPC 절감이 0인 것은 계약대로다. 잠금 일반 POI 5개는 객체를 없애지 않고
   guidebook 실루엣으로 대체한다.
5. P1 lazy-load와 합친 도시 진입 p50에는 재현 가능한 개선이 없다. 전체상세→guidebook 변화의
   도시 중앙값은 run A +0.012%, run B +0.007%였고, 전 도시 범위도 -0.680~+0.522%다.
   lazy module 평가와 공통 scene 초기화가 지배하며 최초 진입 청크 세 곳은 잠금 타일이 0개다.
6. 따라서 현재 잠금 렌더는 **전역 메모리·최초 진입 최적화가 아니라, 잠금 지역을 실제로 걸어
   다닐 때의 청크 CPU 비용과 시각 정보량을 낮추는 정책**으로 판정한다.

## 비교 계약

### guidebook

현재 `CityScene` 그대로다.

- 잠금 지형은 land/water/road 3방향/landmark의 5~6개 키로 치환
- 잠금 타일의 mainRoute·rail·water overlay·가로수 생략
- 잠금 명시 프롭은 생성하지 않음
- 잠금 일반 POI는 이름 없는 `ct_guidebook_landmark_marker`로 대체
- district 경계 팻말과 resolver·충돌 계약은 유지

### 가상 전체상세

geo·district rect·resolver·경계 팻말·청크 크기·표본·viewport를 모두 같게 두고 렌더 판정의
`districtOpenAt`만 항상 참으로 강제했다. 즉 잠금 타일도 기존 상세 지형, rail/water/tree overlay,
명시 프롭, 상세 노드 마커를 쓰는 반사실이다. district 기능 자체를 제거한 옛 버전과 비교하지 않아
resolver나 D5 팻말 비용을 절감으로 잘못 세지 않는다.

전역 preload 자산 수만 별도로 볼 때는 `districts:null`인 legacy 전체상세도 함께 세어,
guidebook 추가 자산 수를 확인했다. 이 수는 아래 CPU bake 시간 비교에는 사용하지 않았다.

## 정본 범위와 텍스처 키

`잠금 키`는 잠금 타일에서 실제로 참조한 고유 지형 texture key 수다. `전체 키`는 개방·잠금 전역을
합친 실사용 수다. `생성 ct_*`는 빈 texture manager에서 해당 도시 `preload()`가 만든 모든
`ct_*` 자산 수로, 캐릭터·프롭도 포함한다.

| 도시 | 잠금 타일 | 완전 잠금 청크 / 전체 | 잠금 키 전체상세→guidebook | 전체 키 전체상세→guidebook | 생성 `ct_*` legacy→guidebook |
|---|---:|---:|---:|---:|---:|
| 부산 | 1,359,151 (92.429%) | 5,292 / 5,810 | 57→6 | 92→98 | 262→270 |
| 서울 | 2,344,824 (94.094%) | 9,140 / 9,828 | 26→6 | 28→34 | 262→270 |
| 코트다쥐르 | 1,655,013 (90.118%) | 6,507 / 7,326 | 26→6 | 28→34 | 262→270 |
| 레만호 연안 | 886,801 (84.719%) | 3,398 / 4,116 | 26→6 | 27→33 | 262→270 |
| 리옹 | 201,819 (94.120%) | 790 / 864 | 26→6 | 28→34 | 267→275 |
| 보르도 | 217,201 (91.463%) | 850 / 960 | 25→5 | 27→32 | 267→275 |
| 스트라스부르 | 169,048 (93.588%) | 657 / 728 | 25→5 | 27→32 | 267→275 |
| **합계** | **6,833,857 / 7,478,279 (91.383%)** | **26,634 / 29,632** | — | — | **도시당 +8** |

부산의 전체상세 잠금 키가 57종인 이유는 감천 `pastel-*` building skin의 4팔레트×edge mask가
잠금 영역에 분포하기 때문이다. guidebook은 이를 공통 land로 접는다. 보르도·스트라스부르의
guidebook 키가 5종인 것은 잠금 영역에서 세 road 방향 중 하나가 실제로 나오지 않았기 때문이다.

중요한 반대 효과도 있다. guidebook은 상세 키를 제거하지 않고 추가한다. 개방 지구가 상세 키를
계속 쓰므로 전역 실사용 키는 도시당 +5~6, preload `ct_*`는 정확히 +8이다. texture manager가
같은 key를 공유하더라도 이번 정책만으로 GPU texture 종류나 preload 메모리가 줄었다고 볼 수 없다.

## 프롭·NPC·overlay 절감

| 도시 | 명시 프롭 스킵 | NPC 상세 스킵 | 일반 POI 상세→실루엣 | 잠금 가로수 잠재 스킵 | 경계 팻말 생성 |
|---|---:|---:|---:|---:|---:|
| 부산 | 0 | 0 | 0 | 16,168 | 233 |
| 서울 | 0 | 0 | 3 | 41,322 | 309 |
| 코트다쥐르 | 0 | 0 | 0 | 6,882 | 232 |
| 레만호 연안 | 0 | 0 | 0 | 3,802 | 146 |
| 리옹 | 1 | 0 | 2 | 3,872 | 62 |
| 보르도 | 0 | 0 | 0 | 6,154 | 75 |
| 스트라스부르 | 0 | 0 | 0 | 5,778 | 63 |
| **합계** | **1** | **0** | **5** | **83,978** | **1,120** |

- 명시 프롭은 `city.props + mainRoute.props + district boundary signs`의 실제 좌표를 판정했다.
  잠금 스킵은 리옹 1개뿐이며 mainRoute 프롭과 경계 팻말은 개방 계약 때문에 스킵되지 않는다.
- NPC·gate·chapter·reading 노드는 `resolveCityDistricts()`가 개방 타일을 강제한다. 따라서
  NPC 상세 마커 스킵 0은 누락이 아니라 fail-closed 계약의 결과다.
- 잠금 일반 POI 5개(서울 3, 리옹 2)는 `nodeViews` 객체를 그대로 만들고 texture와 label만
  guidebook으로 바꾼다. 객체 수 절감으로 세지 않았다.
- 잠금 가로수 83,978개는 모든 잠금 청크를 한 번씩 방문할 때의 잠재 생성 회피량이다.
  가로수는 chunk lifecycle에 묶여 있으므로 동시에 resident인 절감량이 아니다.
- 같은 전수 기준에서 rail overlay draw 85,317회, water overlay sprite 2,098,026개가 잠금으로
  생략될 수 있다. water 역시 viewport pool이라 동시 resident 절감으로 해석하지 않는다.
- 반대로 D5 경계 팻말 1,120개는 현재 `create()`에서 전역 sprite로 생성된다. 명시 프롭 1개
  스킵보다 큰 고정 객체 비용이므로, 객체 수 최적화가 목적이면 팻말의 chunk lifecycle 편입을
  별도 승인·브라우저 메모리 게이트로 검토할 가치가 있다.

## 잠금 청크 CPU bake

각 도시의 완전 잠금 청크를 좌표 순으로 만들고 128개를 처음·끝 포함 균등 표본화했다. production
`CityScene.bakeChunk()`를 그대로 호출하되 RenderTexture의 GPU `batchDraw`만 no-op으로 두었다.
두 정책을 같은 프로세스에서 순서를 교대해 3회 warm-up 뒤 31 paired pass를 실행했다.

아래는 128청크 한 pass의 p50 범위(run A~B)다.

| 도시 | 전체상세 p50 | guidebook p50 | 변화 |
|---|---:|---:|---:|
| 부산 | 2.463~2.535ms | 1.713~1.738ms | -30.5~-31.4% |
| 서울 | 3.377~3.414ms | 3.008~3.013ms | -10.9~-11.7% |
| 코트다쥐르 | 3.576~3.765ms | 2.104~2.116ms | -40.8~-44.1% |
| 레만호 연안 | 3.321~3.453ms | 2.157~2.224ms | -35.0~-35.6% |
| 리옹 | 4.299~4.383ms | 3.261~3.336ms | -23.9~-24.2% |
| 보르도 | 4.491~4.510ms | 3.970~3.976ms | -11.6~-11.8% |
| 스트라스부르 | 4.154ms | 3.610~3.656ms | -12.0~-13.1% |
| **도시 중앙값** | — | — | **-24.15% / -23.89%** |

base terrain draw는 두 정책 모두 타일당 1회라 없어지지 않는다. 차이는 상세 building edge/skin 및
road key 선택이 guidebook 분기로 단순해지고 잠금 rail overlay가 빠지는 CPU 경로다. 따라서 이 표는
**GPU/Canvas bake 절대시간이 아니라 production JS bake 경로의 상대 wall-clock**이다.

## P1 lazy-load 위 도시 진입

### 방법

1. 각 도시를 독립 Node realm 15회에서 `cities/manifest.js` import + `loadCity(id)`하여 P1 lazy
   module 평가 p50/p95와 종료 RSS를 쟀다.
2. 같은 payload를 warm 상태로 두고 `buildGrid` → mainRoute/district resolve → 경계 팻말 계획 →
   texture preload → 320×288, pad 1의 최초 진입 청크 bake → 프롭/노드 계획을 15 paired pass로
   쟀다.
3. 아래 `합산 p50`은 두 중앙값의 기여도 합이다. 실제 한 브라우저 navigation의 wall-clock으로
   과대 해석하지 않는다.

로컬 Chrome 새 프로세스는 세션 정책에서 `SIGABRT`, 연결 브라우저는 가용 인스턴스 0개였으므로
Phaser Canvas/GPU 절대시간은 수집하지 못했다. 정적 전수 수치와 production JS CPU 경로는 유효하지만,
물리 모바일·브라우저 GPU 판정은 이 보고서의 명시적 한계다.

### 최초 진입 청크의 잠금 비율

| 도시 | 진입 청크 | 진입 청크 잠금 타일 |
|---|---:|---:|
| 부산 | 12 | 0 / 3,072 (0%) |
| 서울 | 16 | 768 / 4,096 (18.750%) |
| 코트다쥐르 | 16 | 0 / 4,096 (0%) |
| 레만호 연안 | 16 | 0 / 4,096 (0%) |
| 리옹 | 12 | 2,110 / 3,072 (68.685%) |
| 보르도 | 16 | 1,143 / 4,096 (27.905%) |
| 스트라스부르 | 12 | 1,652 / 3,072 (53.776%) |

### 결과

`lazy p50`과 합산 p50은 두 one-shot 범위다.

| 도시 | P1 lazy p50 | 전체상세 합산 p50 | guidebook 합산 p50 | 변화 |
|---|---:|---:|---:|---:|
| 부산 | 54.11~54.81ms | 70.87~70.89ms | 70.51~70.85ms | -0.50~-0.06% |
| 서울 | 141.61~141.74ms | 162.63~163.54ms | 162.65~163.56ms | +0.007~+0.012% |
| 코트다쥐르 | 46.50~46.62ms | 63.49~63.92ms | 63.68~64.00ms | +0.13~+0.30% |
| 레만호 연안 | 30.09~31.02ms | 40.38~41.26ms | 40.37~41.30ms | -0.04~+0.08% |
| 리옹 | 21.09~21.31ms | 25.74~25.96ms | 25.75~26.09ms | +0.02~+0.52% |
| 보르도 | 22.79~22.82ms | 27.66~27.67ms | 27.47~27.62ms | -0.68~-0.17% |
| 스트라스부르 | 17.27~17.30ms | 20.51~20.56ms | 20.47~20.52ms | -0.44~+0.07% |
| **도시 중앙값** | — | — | — | **+0.012% / +0.007%** |

독립 lazy realm의 RSS p50은 약 75.44MiB(스트라스부르)~287.44MiB(서울)였다. 이는 Node
프로세스 전체 RSS이며 Phaser GPU texture를 포함하지 않는다. 큰 서울 payload의 lazy 평가가
약 142ms로 전체 합산을 지배하고, scene의 최초 청크 bake p50은 양쪽 모두 약 0.4~0.7ms라
guidebook의 잠금 청크 이득이 진입 합계에서는 잡음보다 작다.

## 결정성

임시 one-shot은 다음 deterministic 산출만 canonical JSON에 넣었다.

- 7도시 grid·open mask·chunk 분류
- 잠금/전역 texture key 집합
- preload texture key 집합
- 프롭·NPC·POI·zone·tree·rail·water·경계 팻말 카운트
- 최초 진입 청크와 잠금 타일 수

wall-clock과 RSS는 raw JSON으로 분리했다. 최종 paired one-shot 2회의 canonical JSON은
15,687 bytes로 byte-identical이다.

```text
run A  44739c702afef4d8d108709ca471fee589164441e09cd7d5aec90d721a65b02c
run B  44739c702afef4d8d108709ca471fee589164441e09cd7d5aec90d721a65b02c
cmp    identical
```

임시 하니스와 raw/canonical JSON은 보고서 작성 뒤 제거했다.

## 검증

```text
targeted
14 files / 128 tests PASS
48.33s

full, single worker
220 files / 2,184 tests PASS
298.71s
```

targeted 범위는 district resolver/render, boundary signs, chunks, P1 lazy registry/smoke/registry와
P3 city geo loader, 정본 7도시 geo·mainRoute 회귀다. 측정 뒤 main이 최종 검증 기준까지 전진했지만
7도시 geo·district·`CityScene` 입력과 겹치는 변경은 없었고, 위 targeted·full은 최신 기준에서
다시 실행했다. 전체 실행의 기존 Vite dynamic-import warning 1건 외 실패는 없다. 제품·테스트·
자산·registry·verifier·DB는 수정하지 않았고 merge·force-push도 수행하지 않았다.

## 후속 판정

- **현재 정책 유지**: 잠금 영역 정보량과 방문 중 CPU bake를 실제로 낮춘다.
- **최초 진입 성능 수치로 홍보 금지**: P1 위 p50 개선은 재현되지 않았다.
- **texture 메모리 절감으로 계산 금지**: 상세 texture는 남고 guidebook `ct_*` 8개가 추가된다.
- 후속 최적화가 필요하면 제품 변경 전에 별도 승인으로
  1. 경계 팻말 1,120개의 chunk lifecycle 편입,
  2. 도시별 실제 사용 texture만 lazy bake,
  3. 물리 모바일 Canvas/WebGL에서 GPU texture·첫 프레임 p95
  를 함께 게이트해야 한다.
