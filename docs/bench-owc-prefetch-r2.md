# 오버월드 `.owc` 보수 프리페치 벤치 r2

- 상태: **report-only** — 제품 코드·런타임·테스트·자산 무수정
- 입력: `origin/main` `407b32cda5e517c908a86c4d9ac0b88c430e7584`
- 선행: `docs/bench-owc-prefetch.md`의 방향성 1청크·동시성 2·메모리 압력 중단 권고
- 환경: 공식 nvm Node `v22.23.1`, macOS, canonical APAC·EMEA playability `.owc`
- 측정일: 2026-07-23

## 결론

1. Slow-3G형 조건에서 보수 후보의 여섯 시나리오 이동 차단 합계는
   `58,170→22,170ms`로 **61.9% 감소**했다. 첫 cold 청크는 양쪽 모두 1,385ms지만,
   방향 신호 뒤 후속 이동은 진행 중 Promise에 합쳐져 p50/p95가 `1,385/1,385→385/385ms`로 줄었다.
2. 요청은 `42→45`(+7.1%), 전송량은 `2,068,416→2,216,160B`(+147,744B)였다.
   P2의 반경+1 후보 `42→138`(+228.6%)보다 증가 폭이 작다. 추가 3건은 APAC 종점에서 마지막
   이동방향의 in-bounds 청크를 한 번 더 예열한 것이며, EMEA 종점은 경계 밖이라 추가 요청이 없었다.
3. 정확한 최악 packed resident는 APAC `492,480→541,728B`(+49,248B), EMEA는
   `393,984→393,984B`(불변)였다. 20MiB render-page 상한을 더한 모델도 최악 20.517MiB로
   32MiB 중단선 아래였다. 별도 32MiB 압력 probe는 6/6회 background 요청을 0건으로 막았다.
4. **구현 착수 권고: 조건부 YES.** Moore 반경+1이 아니라 아래의 방향성 1청크 후보만 작은
   구현 라운드로 착수할 가치가 있다. 다만 실제 Chrome을 이 환경에서 실행하지 못했으므로
   일반 공개나 merge 권고가 아니다. 구현 PR에서는 실제 브라우저 Slow-3G, 급반전, 씬 종료,
   HTTP cache·HTTP/2 경쟁, heap/GPU를 다시 통과해야 한다.

## 비교 계약

이번 r2는 P2와 같은 256×256 저장 청크 경로를 사용하되 blanket 8-neighbor 대신 다음 후보만 비교했다.

| 정책 | foreground | background | cache·압력 |
|---|---|---|---|
| 현행 | 이동 대상 현재 청크만 `load(cx,cy)` | 없음 | `PackedChunkCache` 32개 |
| 보수 후보 | 현재 청크가 항상 우선, 같은 좌표 요청은 실제 loader Promise에 합침 | 기존 이동방향 신호가 가리키는 다음 저장 청크 1개, scheduler 상한 2 | 같은 32개 LRU만 채움, runtime 신호 ≥32MiB면 새 prefetch 중단 |

후보는 현재 청크 적용 전에는 background를 시작하지 않는다. 각 지점에서 다음 이동방향이 정해진 뒤
1,000ms 후 청크 경계를 시도하는 stress trace다. 이는 256타일을 물리적으로 횡단하는 시간을 뜻하지 않고,
P2의 chunk-hop을 3G급 전송보다 짧은 선행 창으로 재측정하기 위한 고정 조건이다. 마지막 지점에서도
마지막 이동방향 신호가 유지된다고 보아 in-bounds 대상은 예열한다.

## 네트워크 스로틀

Chrome DevTools Slow-3G형 값에 맞춰 요청마다 고정 latency 400ms와 download 400,000bit/s를 적용했다.
`.owc` 한 파일은 49,248B이므로 body 전달은 `ceil(49,248×8/400,000×1,000)=985ms`,
요청→body 완료 논리시간은 1,385ms다.

임시 one-shot 하니스는 실제 타이머로 400ms 뒤 response를 열고 985ms 뒤 canonical 파일을 전달했다.
제품의 `OverworldChunkLoader`가 MOWC 헤더·schema·좌표·region hash·projection hash와 49,152B payload를
그대로 검증·decode했다. 실제 wall-clock은 raw JSON으로 분리하고 canonical SHA에는 고정 논리시간만 넣었다.

연결 가능한 인앱/Chrome 세션은 0개였고 로컬 Chrome headless도 exit 134(SIGABRT)로 종료되어 CDP 자체의
`Network.emulateNetworkConditions`는 쓰지 못했다. 따라서 브라우저 HTTP cache, HTTP/2 multiplexing,
service worker, Phaser heap·GPU 텍스처는 이번 수치에 포함되지 않는다.

## 결정적 이동 시나리오

각 시나리오는 정책별 cold loader/cache에서 시작한다.

| 지역 | 시나리오 | 경로 |
|---|---|---|
| APAC 11×11 | east-west | `2,4 → 3,4 → 4,4 → 5,4 → 6,4 → 7,4 → 8,4` |
| APAC 11×11 | north-south | `6,1 → 6,2 → 6,3 → 6,4 → 6,5 → 6,6 → 6,7 → 6,8` |
| APAC 11×11 | dogleg | `3,8 → 3,7 → 4,7 → 4,6 → 5,6 → 5,5 → 6,5 → 6,4 → 7,4 → 7,3` |
| EMEA 4×5 | east-west | `0,1 → 1,1 → 2,1 → 3,1` |
| EMEA 4×5 | north-south | `1,0 → 1,1 → 1,2 → 1,3 → 1,4` |
| EMEA 4×5 | dogleg | `0,4 → 0,3 → 1,3 → 1,2 → 2,2 → 2,1 → 3,1 → 3,0` |

dogleg도 각 구간의 새 방향이 정해진 뒤 1,000ms 선행 창을 준다. 방향을 정한 직후 다시 뒤집는 급반전은
포함하지 않았으므로 구현 전 브라우저 적대 시나리오로 남긴다.

## 결과

`후속 p50/p95`는 첫 cold 이동을 제외한다. 전체 p95는 여섯 시나리오 모두 첫 cold 1,385ms를 포함해
양 정책이 1,385ms다. 후보의 후속 36회는 cache hit가 아니라 이미 시작된 동일 좌표 Promise 결합이며,
추가 네트워크 요청 없이 남은 385ms만 차단했다.

| 지역·시나리오 | 요청 현행→후보 | 이동 차단 합계 | 감소 | 후속 p50/p95 | bg scheduler peak | peak packed 현행→후보 |
|---|---:|---:|---:|---:|---:|---:|
| APAC east-west | 7→8 | 9,695→3,695ms | 61.9% | 1,385/1,385→385/385ms | 0→2 | 0.329→0.376MiB |
| APAC north-south | 8→9 | 11,080→4,080ms | 63.2% | 1,385/1,385→385/385ms | 0→2 | 0.376→0.423MiB |
| APAC dogleg | 10→11 | 13,850→4,850ms | 65.0% | 1,385/1,385→385/385ms | 0→2 | 0.470→0.517MiB |
| EMEA east-west | 4→4 | 5,540→2,540ms | 54.2% | 1,385/1,385→385/385ms | 0→2 | 0.188→0.188MiB |
| EMEA north-south | 5→5 | 6,925→2,925ms | 57.8% | 1,385/1,385→385/385ms | 0→2 | 0.235→0.235MiB |
| EMEA dogleg | 8→8 | 11,080→4,080ms | 63.2% | 1,385/1,385→385/385ms | 0→2 | 0.376→0.376MiB |

실제 network inflight peak는 모든 조합에서 1이었다. scheduler peak 2는 완료 Promise 정리와 다음 방향
작업 등록이 같은 microtask 경계에서 겹친 값이며 설정 상한 2를 넘지 않았다. 후보는 한 번에 방향 대상
1개만 만들기 때문에 전송 자체가 2개 동시가 된 trace는 없었다.

| 지역 | 총 요청 | 총 전송량 | 이동 차단 합계 | 감소 | 최악 packed |
|---|---:|---:|---:|---:|---:|
| APAC | 25→28 (+12.0%) | 1,231,200→1,378,944B | 34,625→12,625ms | 63.5% | 492,480→541,728B |
| EMEA | 17→17 (불변) | 837,216→837,216B | 23,545→9,545ms | 59.5% | 393,984→393,984B |
| 합계 | 42→45 (+7.1%) | 2,068,416→2,216,160B | 58,170→22,170ms | 61.9% | — |

### 메모리와 압력 중단

정책 고유 메모리의 강한 증거는 loader가 실제 보유한 49,248B 단위 packed resident다. 후보의 최악 증가는
APAC 한 청크 49,248B(0.047MiB), EMEA 0B다. `20MiB render-page budget + packed resident` 모델의 최악은
현행 20.470MiB, 후보 20.517MiB다. decoded 충돌 창·overlay·브라우저/GPU는 모델 밖이다.

각 후보 조합이 끝난 뒤 별도 미방문 in-bounds 좌표에 runtime pressure를 정확히 32MiB로 주입했다.
6/6회가 `pressure`로 중단됐고 request delta는 모두 0이었다. 정상 여섯 trace에서는 압력선에 닿지 않았다.
실제 구현은 압력 신호를 예약 전에 다시 읽고, 이미 필요한 화면 페이지·현재 충돌 청크를 제거해서는 안 된다.

아래는 조합별 독립 자식 프로세스의 지역별 최대 RSS다. 후보가 두 run 모두 낮았지만 Node module baseline,
allocator, 12개 병렬 자식 스케줄링과 분리할 수 없으므로 절감 근거로 사용하지 않는다.

| 지역 | run A 현행→후보 | run B 현행→후보 |
|---|---:|---:|
| APAC | 53.05→50.02MiB | 50.70→48.59MiB |
| EMEA | 51.98→49.31MiB | 50.42→47.91MiB |

실제 timer wall-clock은 현행 차단 1,384.735~1,389.383ms, 후보 후속 차단
383.874~388.108ms로 논리 1,385/385ms와 정합했다. cold 값을 포함한 후보 전체 범위의 상단은
1,388.865ms였다.

## 결정성·검증

임시 one-shot 측정기는 한 호출에서 2지역 × 3시나리오 × 2정책을 독립 자식 프로세스로 실행하고,
wall-clock/RSS를 제외한 manifest identity·정책·요청·차단·resident·압력 probe를 canonical JSON으로 썼다.

```text
run A  12,490 bytes  5af44775d73ddd120f514a926503975e134226447b8c6fae0122a185a75b6feb
run B  12,490 bytes  5af44775d73ddd120f514a926503975e134226447b8c6fae0122a185a75b6feb
cmp    byte-identical
```

입력 manifest SHA-256:

- APAC `062213f0cc7ae64b3fff5b0dff34819dc107632c0cbd428fc297db3697e94fcd`
- EMEA `5cc6ba0ec01b351ac861f7e8a632670034c3d1ff94c92175a6609d954d6dc683`

검증 결과:

- `npm run check:overworld-assets`: 2지역·11 manifest·561파일·35,048,838B PASS
- targeted loader/render-page: 3파일·29테스트 PASS
- 전체 단일 워커: 221파일·2,191테스트 PASS, 196.54s
- `npm run lint`, `git diff --check`: PASS

임시 측정기와 raw/canonical JSON은 보고서 작성 뒤 제거하며 체크인하지 않는다.

## 구현 라운드의 필수 게이트

조건부 착수 범위는 다음 계약을 동시에 만족하는 작은 runtime 변경으로 한정한다.

1. `planOverworldRenderPages()`의 기존 방향 신호가 저장 청크 경계를 가리킬 때 다음 청크 1개만 예약한다.
   반경+1·직교 양옆·대각선은 금지한다.
2. foreground `load(cx,cy)`는 background와 동일 Promise를 합치되 우선순위를 잃지 않는다.
   background scheduler는 2 이하이고 씬 reset/destroy에서 대기·요청을 취소한다.
3. 결과는 `OverworldChunkLoader`의 32-entry `PackedChunkCache`에만 둔다. 별도 강한 참조 Map은 금지한다.
4. runtime pressure ≥32MiB이면 새 background를 시작하지 않는다. 압력이 해제되기 전 재큐잉하지 않는다.
5. 실제 브라우저 Slow-3G에서 연속 이동·급반전·종점 정지·씬 종료를 재측정한다. 요청 취소·낭비율,
   p95 이동 차단, HTTP cache/HTTP2, heap·GPU와 blank frame 0을 merge gate로 둔다.

이번 작업에서는 구현·자산 변경·merge·force-push를 수행하지 않았다.
