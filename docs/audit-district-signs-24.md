# S18 — 지구제 24도시 팻말·표면 정합 감사

- 감사 기준: `main` `73499f7f3cff595e9ed420df1c54110a3410a928`
- 선행: T19 PR #490, merge `f5349900652e4df076a06a06ba7617117fadc5af`
  (구현 head `52fe299ecfc9be5d896a1d4c78e099a5ef504a3b`)
- 범위: `district-v1` 정의 24도시 전수. T19 신규 13도시는 `신규`로 표시한다.
- 판정: **불일치 0건 — 24/24 PASS, T19 신규 13/13 PASS**

## 감사 계약

1. 팻말은 `planCityDistrictBoundarySigns()`의 실제 결과를 소비해 개방 타일·보행 가능·
   비 EXIT이고, 4방 중 하나 이상이 잠금 타일인지 확인했다. 팻말 상호 Chebyshev 이격
   8타일도 함께 확인했다.
2. soft wall은 각 도시 `districts.locked.line`이 정본 카피
   `이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.`로 resolve되고,
   `CityScene.showDistrictLocked()`가 같은 문자열을 세션당 1회·4,200ms로 노출하는지
   제품 메서드로 재현했다.
3. 미니맵은 `GameCanvas`의 도시별 factor를 그대로 실행해 각 도시에서 open·locked
   샘플이 모두 존재하는지 확인했다. `city.districts` → resolver → offscreen `lockOff`
   → 교차 빗금 픽셀 → `showDistricts` draw 경로도 체크인 소스와 함께 고정했다.
4. 수첩은 `STAMP_ALBUM_NODES`의 실제 도시 게이트와 `CITY_DATA`를
   `stampAlbumDistrictPresentation()`에 넣어 count와 라벨 배열이
   `resolved.open`의 source order와 exact인지 확인했다.

## 도시별 결과

| 도시 (`id`) | T19 | 팻말 수 | 경계 인접 | 잠금 라인 노출 | 미니맵 잠금 베이크 | 수첩 지구 라벨 |
|---|---:|---:|---:|---:|---:|---:|
| 후쿠오카 (`fukuoka`) | 기존 | 113 | PASS | PASS | PASS | PASS (4) |
| 도쿄 (`tokyo`) | 기존 | 466 | PASS | PASS | PASS | PASS (4) |
| 오사카 (`osaka`) | 기존 | 259 | PASS | PASS | PASS | PASS (4) |
| 교토 (`kyoto`) | 기존 | 305 | PASS | PASS | PASS | PASS (4) |
| 부산 (`busan`) | 기존 | 233 | PASS | PASS | PASS | PASS (4) |
| 서울 (`seoul`) | 기존 | 309 | PASS | PASS | PASS | PASS (4) |
| 그랑파리 (`grand-paris`) | 신규 | 316 | PASS | PASS | PASS | PASS (4) |
| 몽생미셸 (`mont-saint-michel`) | 신규 | 161 | PASS | PASS | PASS | PASS (3) |
| 코트다쥐르 (`cote-dazur`) | 기존 | 232 | PASS | PASS | PASS | PASS (4) |
| 브뤼셀 (`brussels`) | 신규 | 96 | PASS | PASS | PASS | PASS (4) |
| 타이베이 (`taipei`) | 신규 | 184 | PASS | PASS | PASS | PASS (4) |
| 홍콩 (`hong-kong`) | 신규 | 85 | PASS | PASS | PASS | PASS (4) |
| 런던 (`london`) | 신규 | 343 | PASS | PASS | PASS | PASS (4) |
| 상하이 (`shanghai`) | 신규 | 93 | PASS | PASS | PASS | PASS (4) |
| 베이징 (`beijing`) | 신규 | 102 | PASS | PASS | PASS | PASS (4) |
| 브리즈번 (`brisbane`) | 신규 | 65 | PASS | PASS | PASS | PASS (4) |
| 시드니 (`sydney`) | 신규 | 161 | PASS | PASS | PASS | PASS (4) |
| 캔버라 (`canberra`) | 신규 | 157 | PASS | PASS | PASS | PASS (4) |
| 멜버른 (`melbourne`) | 신규 | 119 | PASS | PASS | PASS | PASS (4) |
| 제네바 (`geneva`) | 신규 | 66 | PASS | PASS | PASS | PASS (4) |
| 레만호 연안 (`leman-riviera`) | 기존 | 146 | PASS | PASS | PASS | PASS (4) |
| 리옹 (`lyon`) | 기존 | 62 | PASS | PASS | PASS | PASS (4) |
| 보르도 (`bordeaux`) | 기존 | 75 | PASS | PASS | PASS | PASS (4) |
| 스트라스부르 (`strasbourg`) | 기존 | 63 | PASS | PASS | PASS | PASS (4) |
| **합계** | **신규 13 / 기존 11** | **4,211** | **24/24** | **24/24** | **24/24** | **24/24 · 95라벨** |

T19 신규 13도시의 팻말 합은 1,948개다. `districts` 미정의 정본 2도시
(`marseille`, `kawaguchiko`)는 이 감사의 24도시 분모에 포함하지 않았으며, 기존
전면 개방 계약을 유지한다.

## 재현·결정성

- 감사 재현: `src/components/world/__tests__/districtSignsAudit24.test.js`
- 감사 manifest A/B는 도시 순서·신규 여부·팻말 수·경계/간격·잠금 라인·미니맵
  factor와 open/locked 샘플 수·수첩 라벨 수를 포함하며 byte-identical이다.
- manifest SHA-256 A/B:
  `e376a497c184760afa1d964de7d746bcdf7ece1921fb2078d8fa3126ab064d8b`
- 기존 팻말 좌표 manifest SHA-256:
  `dd863792b71fc0d79dd09afa3f429dbf831ceb6cc93193feb0246c7bea58b8aa`
- 제품 코드·도시 wrapper·geo·registry·DB는 수정하지 않았다. 발견한 불일치가 없어
  수정 후보도 없다.

## 검증

- Node `v22.23.1` 공식 nvm 배포판
- S18 감사 단독: 1파일 / 1테스트 PASS / 6.31s / peak V8 heap 400MB
- 관련 표면 targeted: 6파일 / 51테스트 PASS / 11.91s
- `set -o pipefail` 전체 Vitest: 228파일 / 2,239테스트 PASS / 247.68s /
  peak V8 heap 1,803MB / exit 0
- `npm run lint`, `git diff --check`: PASS
