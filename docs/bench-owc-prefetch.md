# 오버월드 `.owc` 반경+1 프리페치 벤치

- 상태: **report-only** — 제품 코드·런타임·자산 무수정
- 기준: `origin/main` `49e6699764febdcd1132c4644389f65e91ed6705`
- 발주: 이슈 #150 코멘트 `5046786117`, 재킥 `5053883288`
- 환경: nvm Node `v22.23.1`, macOS, canonical playability `.owc`
- 측정일: 2026-07-23

## 결론

1. 반경+1은 요청 자체를 빠르게 하지 않는다. 고정 30ms 전달 조건에서
   요청→검증·decode→cache 적용 지연은 두 정책 모두 p50/p95 30ms다. 대신 첫 청크가 적용된 뒤
   다음 청크를 미리 받아, 여섯 시나리오의 후속 이동 36/36회를 cache hit로 바꾼다.
2. 그 결과 이동 중 누적 차단은 APAC 750→90ms(-88.0%), EMEA 510→90ms(-82.4%)로 줄지만,
   요청은 APAC 25→93(+272%), EMEA 17→45(+165%)로 늘어난다. peak inflight도 현행 1에서
   APAC 8, EMEA 5까지 상승한다.
3. 최악 resident `.owc` payload는 APAC 0.47→1.50MiB, EMEA 0.38→0.85MiB다.
   두 번의 독립 자식 프로세스 RSS는 후보가 현행보다 -1.31~+2.30MiB로 방향까지 바뀌었다.
   정확한 payload 증가는 보이지만 이 크기의 RSS 차이는 Node allocator·스케줄러 잡음과 분리되지 않았다.
4. **전면 반경+1 구현은 현 단계에서 권고하지 않는다.** 최선 조건에서도 청크당 지연은 그대로이고
   요청량만 2.65~3.72배가 된다. 후속 승인이 있다면 현행 이동방향 1페이지 신호를 저장 청크 경계에서만
   소비하고, background concurrency 2 이하·메모리 압력 중단·`PackedChunkCache` 전용이라는 더 좁은
   후보를 브라우저 네트워크 throttle로 다시 비교하는 편이 안전하다.

## 비교 대상

현행 런타임에는 저장 청크 반경 프리페치가 없다.

- `OverworldChunkLoader`는 요청받은 `(cx,cy)` 하나를 fetch·검증·decode하고 동일 요청 Promise를 합친다.
- `PackedChunkCache` 기본 상한은 32개·32×49,248B다.
- `OverworldRenderPager`는 가시 32×32 페이지를 먼저 병렬 적용하고, padding·이동방향 1페이지는
  `warmPages()`에서 순차 예열한다. 저장 청크 경계에 가까울 때만 이 페이지 예열이 옆 `.owc`를
  간접 요청할 수 있다.
- 플레이어 충돌 질의의 `ensureChunk()`는 현재 청크를 필요 시 로드한다.

이번 벤치는 렌더 페이지·overlay·노드 요청을 제외하고 저장 `.owc` 정책만 격리했다.

| 정책 | 이동 지점 처리 | background 처리 | cache |
|---|---|---|---|
| 현행 | 현재 저장 청크만 요청·적용 | 없음 | 매 시나리오 empty, 32개 LRU |
| 반경+1 후보 | 현재 청크를 우선 적용 | in-bounds 8-neighbor를 동시에 요청하고 다음 이동 전 settle | 동일 |

후보에 유리하도록 이동은 항상 인접 청크이고, 각 이동 사이에 모든 prefetch가 끝날 만큼 머문다고 가정했다.
현재 청크와 이웃을 함께 시작하지 않아 최초 foreground 요청은 background와 대역폭을 다투지 않는다.

## 결정적 이동 시나리오

좌표는 256×256 저장 청크의 `cx,cy`다. 각 시나리오는 정책별 cold cache에서 시작한다.

| 지역 | 시나리오 | 결정적 경로 |
|---|---|---|
| APAC 11×11 | east-west | `2,4 → 3,4 → 4,4 → 5,4 → 6,4 → 7,4 → 8,4` |
| APAC 11×11 | north-south | `6,1 → 6,2 → 6,3 → 6,4 → 6,5 → 6,6 → 6,7 → 6,8` |
| APAC 11×11 | dogleg | `3,8 → 3,7 → 4,7 → 4,6 → 5,6 → 5,5 → 6,5 → 6,4 → 7,4 → 7,3` |
| EMEA 4×5 | east-west | `0,1 → 1,1 → 2,1 → 3,1` |
| EMEA 4×5 | north-south | `1,0 → 1,1 → 1,2 → 1,3 → 1,4` |
| EMEA 4×5 | dogleg | `0,4 → 0,3 → 1,3 → 1,2 → 2,2 → 2,1 → 3,1 → 3,0` |

## 결과

`요청→적용`은 30ms 고정 전달시계와 실제 `OverworldChunkLoader`의 MOWC 헤더·schema·좌표·region hash·
projection hash·49,152B payload decode를 합친 결정적 정책 trace다. 검증/decode wall-clock은
host-dependent raw 증거로 따로 기록했다.

| 지역·시나리오 | 요청 현행→후보 | 요청→적용 p50/p95 | 이동 차단 합계 현행→후보 | peak inflight | resident 현행→후보 |
|---|---:|---:|---:|---:|---:|
| APAC east-west | 7→27 | 30/30→30/30ms | 210→30ms | 1→8 | 0.33→1.27MiB |
| APAC north-south | 8→30 | 30/30→30/30ms | 240→30ms | 1→8 | 0.38→1.41MiB |
| APAC dogleg | 10→36 | 30/30→30/30ms | 300→30ms | 1→8 | 0.47→1.50MiB |
| EMEA east-west | 4→12 | 30/30→30/30ms | 120→30ms | 1→5 | 0.19→0.56MiB |
| EMEA north-south | 5→15 | 30/30→30/30ms | 150→30ms | 1→5 | 0.23→0.70MiB |
| EMEA dogleg | 8→18 | 30/30→30/30ms | 240→30ms | 1→3 | 0.38→0.85MiB |

APAC dogleg 후보는 36개를 요청하지만 LRU 상한 때문에 마지막에는 32개(1,575,936B)만 resident다.
모든 후보 시나리오는 첫 foreground 1회 뒤 나머지 36개 이동 지점에서 cache hit였다.

| 지역 | 총 요청 | 요청 배수 | 누적 이동 차단 | 감소율 | 최대 동시 요청 | 최악 resident |
|---|---:|---:|---:|---:|---:|---:|
| APAC | 25→93 | 3.72× | 750→90ms | 88.0% | 1→8 | 0.47→1.50MiB |
| EMEA | 17→45 | 2.65× | 510→90ms | 82.4% | 1→5 | 0.38→0.85MiB |
| 합계 | 42→138 | 3.29× | 1,260→180ms | 85.7% | 1→8 | — |

### wall-clock과 측정기 RSS

canonical trace와 같은 실행에서 wall-clock·RSS도 수집했지만 해시 입력에서는 제외했다.
5ms bucket의 요청→적용 p50 범위는 현행 35~40ms, 후보 35~50ms였다. p95 범위는 각각
40~135ms, 40~190ms로 크게 흔들렸다. background 3~8개 동시 요청이 청크 자체를 더 빨리
적용하지 않으며, host contention에 따라 tail을 키울 수 있음을 확인하는 정도로만 해석한다.

아래 값은 각 지역 3시나리오 중 가장 큰 독립 자식 프로세스 peak RSS다.

| 지역 | run A 현행→후보 | run B 현행→후보 | 후보-현행 범위 |
|---|---:|---:|---:|
| APAC | 50.63→50.44MiB | 52.44→53.77MiB | -0.19~+1.33MiB |
| EMEA | 51.08→49.77MiB | 49.58→51.88MiB | -1.31~+2.30MiB |

RSS는 baseline module/allocator가 약 30~55MiB로 흔들리는 Node 프로세스 전체값이다. 정책 고유 메모리는
49,248B 단위 resident payload가 더 강한 증거다. 후보의 최악 추가 payload는 APAC 1,083,456B
(1.03MiB), EMEA 492,480B(0.47MiB)다. Phaser GPU 텍스처·overlay·브라우저 cache는 이번 RSS에 없다.

## 결정성

임시 one-shot 측정기는 다음을 한 프로세스 호출에서 수행했다.

1. APAC·EMEA 각 3경로 × 2정책을 독립 자식 프로세스로 실행한다.
2. 체크인 `.owc`를 실제 loader로 읽고 모든 헤더·hash·payload를 검증한다.
3. 요청 수, cache hit, peak inflight, resident bytes, 고정 논리시계 trace를 canonical JSON으로 쓴다.
4. wall-clock/RSS raw 결과는 별도 JSON으로 분리한다.

두 clean 실행의 canonical JSON은 byte-identical이다.

```text
run A  a8f807167885e4cc2de4ac1b3fc0cd197fe7b44566ab705a5c091318d8ff2726
run B  a8f807167885e4cc2de4ac1b3fc0cd197fe7b44566ab705a5c091318d8ff2726
cmp    identical
```

임시 측정기와 raw/canonical JSON은 보고서 작성 뒤 제거하며 제품이나 체크인 자산에 포함하지 않는다.

## 판정과 후속 승인 게이트

전면 Moore 8-neighbor 프리페치는 이동 차단을 앞당겨 숨길 수 있지만, 이 벤치의 가장 유리한 경로에서도
요청→적용 latency 자체는 줄이지 못하고 요청·동시성·resident payload를 늘렸다. 따라서 P2 판정은
**blanket radius+1 보류**다.

별도 구현 승인을 검토한다면 다음 계약을 먼저 고정해야 한다.

1. 32×32 페이지의 기존 이동방향 신호가 다음 저장 청크 경계를 향할 때만 1개를 예열한다.
2. background concurrency는 2 이하, foreground 현재 청크가 항상 우선이다.
3. prefetch는 32개 LRU `PackedChunkCache`만 채운다. 씬의 별도 `loadedChunks` Map에 넣어
   LRU 밖 강한 참조를 남기지 않는다.
4. 32MiB 런타임 압력 신호에서 즉시 중단하고 화면 내 페이지·현재 충돌 청크는 제거하지 않는다.
5. 실제 브라우저에서 Fast/Slow 4G, 연속 이동·급반전·씬 종료를 각각 측정해 요청 취소·낭비율·
   p95 이동 차단·heap/GPU를 확인한다.

구현·merge·force-push는 수행하지 않았다.
