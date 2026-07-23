# P3 도쿄 로더 레이어 벤치

- 측정일: 2026-07-23 KST
- 기준: `origin/main` `fbf448c15d38247b9a7aef862a87d7ca3ce80edf`
- 최종 검증 base: `origin/main` `48772316f331114e2d32ec28899c55ecdea16317`
- 구현: `codex4/tokyo-loader-tuning`
- 환경: macOS arm64, 공식 nvm Node `v22.23.1`
- 범위: 도쿄 cityGeo decode와 오버월드 chunk cache 경로만
- 무수정: `GameCanvas.jsx` 미니맵 베이킹·factor, CityScene, 다른 도시 geo, DB, 공식 verifier

## 판정

1. 도쿄의 중첩 `[code,count]` RLE 312,340개를 versioned packed base64 컨테이너로 바꾸고,
   decode 직후 원문 문자열 참조를 끊었다. 도쿄 단일 lazy load의 GC 후 JS heap 증분은
   **24,098,656B → 5,328,312B(-77.89%)**, RSS 증분 중앙값은
   **104.13MiB → 15.95MiB(-84.69%)**로 줄었다.
2. module source는 1,924,430B → 1,683,469B(-12.52%)이고, 독립 Node realm load 중앙값은
   61.28ms → 21.98ms(-64.14%)다. terrain·railway·entry grid의 바이트와 SHA-256은 불변이다.
3. 오버월드 씬의 무제한 `loadedChunks` Map을 제거해 `OverworldChunkLoader`의 32-entry LRU를
   단일 cache로 만들었다. 100개 고유 청크 방문 모델의 payload 상주는
   4,924,800B → 1,575,936B(-68.0%)로 다시 유한해진다.
4. P1의 도시별 dynamic import와 실패 시 Promise cache 제거 계약은 그대로다. P2의
   반경+1 prefetch도 구현하지 않았으며, 이 변경은 기존 요청 합치기·abort·stale 세대 판정을 보존한다.

## cityGeo 형식

`tokyo.geo.js`는 terrain과 railway 각각 다음 MCGR v1 컨테이너를 base64로 보관한다.

| offset | 형식 | 의미 |
|---:|---|---|
| 0 | 4 bytes | magic `MCGR` |
| 4 | u16le | format version `1` |
| 6 | u16le | header bytes `24` |
| 8 | u32le | decoded tile length |
| 12 | u32le | run count |
| 16 | u32le | decoded bytes CRC-32 |
| 20 | u32le | packed payload bytes |
| 24.. | u32le/run | 상위 28bit count + 하위 4bit tile code |

loader는 magic·version·header·expected decoded length·payload length·0/overflow run·CRC-32를
fail-closed 검증한다. Node에서는 `Buffer`, 브라우저에서는 `atob` 경로를 사용한다. decode된
`Uint8Array`만 city payload에 남고 base64 binding은 즉시 `null`로 바뀐다.

| 항목 | 기존 | P3 | 변화 |
|---|---:|---:|---:|
| `tokyo.geo.js` source | 1,924,430B | 1,683,469B | -240,961B (-12.52%) |
| packed container | 중첩 JS 배열 312,340개 | 1,249,408B | 객체 fan-out 제거 |
| terrain typed array | 894,864B | 894,864B | 불변 |
| railway typed array | 894,864B | 894,864B | 불변 |
| decoder 고정 table | 0B | 1,024B | CRC-32 table |

CRC-32는 bundle 내부의 빠른 손상 검출용이다. 산출물 결정성은 아래 SHA-256과 생성기 재실행으로
별도 고정한다.

## 독립 프로세스 전후 실측

각 행은 새 Node 프로세스에서 `global.gc()` → `loadCity('tokyo')` → `global.gc()` 순으로 측정했다.
RSS는 allocator 영향이 있으므로 A/B 원값을 모두 남기고, JS heap·ArrayBuffer exact 값과 함께 본다.

| 상태 | run | load ms | RSS 증분 | JS heap 증분 | ArrayBuffer 증분 |
|---|---|---:|---:|---:|---:|
| 기존 | A | 62.539 | 109,625,344B | 24,098,656B | 1,789,728B |
| 기존 | B | 60.030 | 108,740,608B | 24,098,656B | 1,789,728B |
| P3 | A | 23.768 | 16,711,680B | 5,328,312B | 1,790,752B |
| P3 | B | 20.186 | 16,728,064B | 5,328,312B | 1,790,752B |

P3의 ArrayBuffer +1,024B는 CRC table이다. `buildGrid()` 뒤에는 양쪽 모두 894,864B entry grid가
동일하게 추가된다. 미니맵의 별도 grid·canvas는 이 P3 범위가 아니며 수치에 포함하지 않았다.

## 오버월드 cache 상한

기존 `overworldRegionScene`은 loader LRU에 들어간 chunk를 별도 `loadedChunks` Map에도 넣고
씬 종료까지 제거하지 않았다. 같은 객체 참조라 한 청크가 두 번 복사되지는 않지만, loader가
evict한 payload도 씬 Map이 계속 붙잡아 32-entry byte 상한이 효력을 잃었다.

P3는 모든 좌표 조회를 loader에 위임한다. 100개 고유 청크를 방문하는 결정적 모델은 다음과 같다.

| 항목 | 기존 | P3 |
|---|---:|---:|
| `.owc` 1개 | 49,248B | 49,248B |
| 유효 payload 보유 수 | 100 | 32 |
| payload bytes | 4,924,800B (4.697MiB) | 1,575,936B (1.503MiB) |
| 초과분 | 무제한 | 0 |

재방문 청크가 LRU에서 이미 밀려났다면 다시 fetch한다. 이는 원래 loader의 명시적 32-entry
메모리 상한을 회복하는 trade-off이며, P2가 보류한 blanket prefetch를 암묵적으로 추가하지 않는다.

## 결정성

one-shot canonical JSON은 두 독립 프로세스에서 byte-identical이다.

- run A/B SHA-256:
  `fb5f59eda75bbdc2cbc4316dd895c104bf7820dcce086430b8f055034503627d`
- regenerated `tokyo.geo.js` A/B SHA-256:
  `40e1e07e8bfa84f150c9f7e3bd5b3bf965e87d25f60c15241048314602421c1b`
- terrain SHA-256:
  `b63812d13737b9032f53a7c743c7ef7590b0f10e79ed7e8569afde10db6f0bb1`
- railway SHA-256:
  `4402851971f1f1bf389a9623e7d1ae53291160ce8ab5a9b53ab55917c4f26a89`
- entry grid SHA-256:
  `3ae332711ad959ed5b44c64c7127f8a4ead04de6acccf00d3247eac5bac3b0d5`

```bash
node scripts/bench-tokyo-loader.mjs > /tmp/tokyo-loader-run-a.json
node scripts/bench-tokyo-loader.mjs > /tmp/tokyo-loader-run-b.json
cmp /tmp/tokyo-loader-run-a.json /tmp/tokyo-loader-run-b.json
shasum -a 256 /tmp/tokyo-loader-run-{a,b}.json

node --input-type=module -e \
  "import { writeTokyoGeo } from './scripts/build-tokyo-geo.mjs'; writeTokyoGeo('/tmp/tokyo-a.js')"
node --input-type=module -e \
  "import { writeTokyoGeo } from './scripts/build-tokyo-geo.mjs'; writeTokyoGeo('/tmp/tokyo-b.js')"
cmp /tmp/tokyo-a.js /tmp/tokyo-b.js
```

## 최종 검증

- targeted: 12 files / 89 tests PASS
- `set -o pipefail` full single-worker: 219 files / 2,182 tests PASS / 214.22s
- `npm run lint`: PASS
- production `next build`: PASS
- `git diff --check`: PASS
- 도쿄 lazy load memory: 위 독립 프로세스 A/B에서 GC 후 heap·ArrayBuffer exact 재현,
  RSS 두 실측 모두 기록
