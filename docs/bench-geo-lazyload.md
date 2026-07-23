# Geo lazy-load 구현 벤치

- 측정일: 2026-07-23 KST
- 기준: `origin/main` `e330283ecb435b7bf5bad51aab35f57258b20a1f`
- 구현: `codex4/geo-lazyload-impl`
- 환경: macOS arm64, 공식 nvm Node `v22.23.1`, Next.js `15.5.21`
- 목적: geo bytes나 도시 payload를 바꾸지 않고 일반 부팅과 관리자 전체맵 첫 진입에서
  26개 도시 adapter/geo의 평가를 제거했는지 확인

## 결과

### 프로덕션 번들

두 트리에서 `NODE_OPTIONS=--max-old-space-size=8192 npx next build`를 실행하고,
`.next/react-loadable-manifest.json`의
`views/WorldPage.jsx -> ../components/world/GameCanvas` 파일 합계와
`.next/app-build-manifest.json`의 관리자 전체맵 페이지 파일 합계를 비교했다.
gzip은 동일 파일을 level 9로 다시 압축한 값이다.

| 진입점 | origin/main raw | lazy raw | 감소 | origin/main gzip | lazy gzip | 감소 |
|---|---:|---:|---:|---:|---:|---:|
| `/world` GameCanvas loadable entry | 28,523,978 B | 586,459 B | 97.94% | 3,868,783 B | 185,701 B | 95.20% |
| `/admin/worldmap` 초기 페이지 자산 | 28,645,600 B | 704,436 B | 97.54% | 3,892,459 B | 208,475 B | 94.64% |

기준 GameCanvas entry에는 26개 payload를 함께 가진 28,004,127 B 단일 청크가 있었다.
구현 뒤 GameCanvas entry의 가장 큰 자체 청크는 495,365 B이며, 각 도시 payload는 literal
dynamic import의 개별 비동기 청크로 이동했다. 전체 `.next/static/chunks` raw 합계는
32,001,558 B → 32,059,178 B로 거의 같으므로 bytes를 삭제한 결과가 아니라 초기 요청 경계만
분리한 결과다.

### 새 Node realm module 평가

각 행을 독립 Node 프로세스에서 5회 실행했다. 시간과 `process.memoryUsage().rss`의 중앙값이다.
브라우저 전체 메모리가 아니라 registry/adapter/geo module 평가 비용을 비교하는 보조 지표다.

| 경로 | 평가 payload | 중앙값 | 종료 시 RSS 중앙값 |
|---|---:|---:|---:|
| origin/main `cities/index.js` import | 26 | 825.54 ms | 705,101,824 B |
| lazy `cities/index.js` import | 0 | 1.43 ms | 43,335,680 B |
| lazy + `loadCity('tokyo')` | 1 | 56.98 ms | 153,649,152 B |
| lazy + 도시 5개 순차 방문 | 5 | 388.12 ms | 451,788,800 B |

일반 부팅의 module 평가 RSS는 기준 대비 661,766,144 B(93.85%) 낮았다. 방문한 ESM module은
세션 cache에 남으므로 5도시 순차 방문 값처럼 누적된다. 이번 구현은 이미 방문한 module의 unload를
약속하지 않는다.

## 기능 계약

- `CITY_BOOT_MODE = 'lazy'`: plaza/APAC/EMEA 일반 부팅 city payload 0개, 초기 city scene 0개
- 저장 좌표와 dev guest `?spawn=city:<id>`: Phaser import와 대상 payload 1개를 병렬 선로드한 뒤
  초기 scene 배열에 그 도시만 등록
- 진입 확인: `loadCity` → 중복 add 확인 → `game.scene.add` → 기존 scene의 fade/start 순서
- 같은 ID 동시 요청: 같은 Promise와 같은 scene 등록 작업으로 합침
- 실패: Promise cache 제거, 확인 다이얼로그 종료, 현재 scene/좌표 보존, GBC
  `연결을 확인해 주세요` + `다시 시도 Ⓐ/Ⓑ`
- 관리자 전체맵: 목록/그룹은 `CITY_MANIFEST`, 선택한 city만 load; 빠른 탭 전환의 stale 응답 무시
- PNG CLI: ID 인자가 있으면 그 도시만 load, 무인자일 때만 `loadAllCities()`
- 긴급 eager 롤백: `src/components/world/cities/manifest.js`의 `CITY_BOOT_MODE` 한 줄을
  `'eager'`로 바꾸면 Phaser 생성 전에 26개를 다시 준비

## 결정성

| 검증 | 결과 |
|---|---|
| manifest JSON 독립 프로세스 2회 | SHA-256 `8f7dafe074d18e66f7a2855884b1bf2fd5d8217dd19a738ac5c752860a7ef5b9`, byte-identical |
| 26개 grid 독립 프로세스 2회 | aggregate SHA-256 `edc73ca95f2ad6b5763a42eef5c078644b1b08ac40bcef68d74b04cff9ffeb4c`, 총 15,323,503 B, byte-identical |
| 도쿄 PNG lazy 2회 + origin/main | `2b59648282ee148eaa9e7da8e367020945a0d6ee0252ce5d1432ff70cff6efe6` |
| 서울 PNG lazy 2회 + origin/main | `b674be7921c2f0aebda8cd230e1bda7b8147881a91b6cee7dfbdcf0cc8156a02` |
| 부산 PNG lazy 2회 + origin/main | `ad48e9f4368f7b65369b01c565d8f5d5acdb74e7d29fd6d08ab0d66700c6fe9d` |
| 코트다쥐르 PNG lazy 2회 + origin/main | `5c839125c28c548ea0b31acb314396f3f6e486202876d27c4c7e4f97bffccf02` |

## 검증 명령

```bash
npx vitest run \
  src/components/world/__tests__/cityLazyRegistry.test.js \
  src/components/world/__tests__/cityLazySmoke.test.js \
  src/components/world/__tests__/cityRegistry.test.js \
  src/components/world/__tests__/cityTileSkinAssignments.test.js \
  src/components/world/__tests__/cityRegionMainRoute.test.js \
  src/components/world/__tests__/cityDescCoverage.test.js \
  src/lib/world/__tests__/studiesRefs.test.js \
  src/lib/__tests__/worldSession.test.js \
  --maxWorkers=1 --no-file-parallelism

NODE_OPTIONS=--max-old-space-size=8192 npx next build
```

targeted 결과는 8 files / 90 tests PASS다. 별도로 allowlist 확정 뒤 main에 추가된
`cityDistricts.test.js`와 `stampUniverse.test.js`의 동기 registry 회귀도 2 files / 26 tests
PASS로 확인했다. 최종 전체 검증은 214 files / 2,151 tests PASS,
`npm run lint` PASS, production `next build` PASS다.
