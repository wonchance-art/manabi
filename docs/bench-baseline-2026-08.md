# 엔진 벤치 기준선 — 2026-08

## 실행 환경·방법

- 측정일: 2026-08-24 (UTC)
- 런타임: Node.js v24.15.0, Linux x64 (6.18.35)
- CPU: Intel Xeon Platinum 8370C 2.80GHz, 할당 3 vCPU
- 메모리: 17 GiB
- 명령: `node --expose-gc scripts/bench/run.mjs`
- 각 case는 1회 워밍업 후 25회 반복한다. 시간과 실행 전후 V8 heap 증가량을 각각
  정렬해 중앙값·p95를 기록했으며, 반복 전 명시적으로 GC를 호출했다.

## 기준선

| case | 중앙값 (ms) | p95 (ms) | heap 중앙값 (KiB) | heap p95 (KiB) |
|---|---:|---:|---:|---:|
| materialFit (5,000 tokens) | 1.213 | 2.001 | 487.4 | 706.8 |
| materialFit (20,000 tokens) | 5.825 | 32.258 | 824.8 | 825.1 |
| gradeDictation/diffChars (1K chars) | 2.291 | 26.074 | 1,750.8 | 11,315.8 |
| pickOutputWords (5K rows/events) | 11.739 | 27.638 | 5,602.5 | 5,854.9 |
| pickDictationSentences (2K lines) | 1.863 | 3.372 | 1,532.8 | 1,539.0 |
| hanja loader (3 JSON read+parse) | 22.850 | 42.799 | 2,109.8 | 2,612.7 |

## 상위 병목 관찰

1. 한자 JSON 3종의 읽기·파싱이 시간 중앙값 22.850ms로 가장 큰 고정 비용이다.
2. `pickOutputWords`는 5천 행·이벤트에서 heap 중앙값 5.5MiB와 시간 중앙값 11.739ms로 순수 엔진 중 가장 무겁다.
3. `gradeDictation/diffChars`는 p95 heap이 11.1MiB까지 튀어 긴 입력의 tail 변동성이 가장 크다.

