# 오버월드 §6.4 결정성 계약 초안

> 상태: **DRAFT — ① 투영 확정, 수직 슬라이스만 허용**
> 범위: 오버월드 지형·충돌·view-only·희소 오버레이·신규 지역 교통 노드 인덱스 생성 산출물.
> legacy 노드 마이그레이션과 DB는 범위 밖이다.

## 1. 목표와 비목표

동일한 입력 manifest와 생성기 버전은 실행 환경·경로·시각과 무관하게 같은 파일 목록과 같은 바이트를
만들어야 한다. 결과가 일부라도 degraded이면 개발 미리보기는 가능하지만 출시 manifest에는 기록하지 않는다.

이 계약은 자연지리의 정확성 정책을 대신하지 않는다. 데이터 소스 채택과 투영 선택은
`docs/world-global-expansion.md`가, 런타임 메모리와 교체 정책은 `docs/world-overworld-chunk-runtime.md`가 맡는다.

## 2. 입력 manifest

생성은 단일 UTF-8 JSON manifest를 유일한 시작점으로 삼는다. 알 수 없는 필드는 오류로 처리하고 묵시적
기본값을 두지 않는다.

필수 항목은 다음과 같다.

- `schemaVersion`, 생성기 git SHA, Node 주 버전, 지역 ID.
- 각 원본의 URL·역할·버전·SHA-256·바이트 수·라이선스·필수/QA 전용 여부.
- WGS84 축 순서(`lon,lat`), 지역 bbox, 투영 ID와 모든 파라미터, 지구 반경, 미터/타일.
- 256타일/저장 청크, 타일 원점, y축 방향, half-open 경계, 반올림 방식.
- 표본 격자와 4×4 supersampling 오프셋.
- 4bit 표면 클래스 표·우선순위, 충돌/view-only 규칙, 희소 오버레이 선폭과 단순화 허용치.
- 피처 정렬 키, 문자열 비교 로케일(`en` code-point order), 좌표 양자화 단위.
- 수동 오버라이드 버전·SHA-256·적용 대상 레이어·우선순위.
- 출력 포맷 버전과 출시 대상 청크 목록.

현재 스파이크 manifest는 `scripts/world/projection-spike-manifest.json`이다. 이는 측정 계약이며 본생성
manifest를 대신하지 않는다.

## 3. 입력 획득과 실패 정책

1. 원본은 네트워크 응답을 바로 처리하지 않고 캐시에 완전히 저장한 뒤 SHA-256을 검증한다.
2. 해시·크기·파싱 중 하나라도 다르면 즉시 실패한다. 최신판 자동 대체, 축소판 폴백, 누락 레이어 생략은 없다.
3. GSHHG QA나 ETOPO가 필수로 지정된 실행에서는 둘 중 하나가 빠져도 degraded 성공으로 간주하지 않는다.
4. 로컬 절대 경로, 다운로드 시각, HTTP 헤더는 산출물에 쓰지 않는다.
5. 라이선스 목록도 manifest에서 생성하며 파일 경로순으로 정렬한다.

## 4. 좌표·정렬·수치 계약

- 모든 원본은 WGS84 경도·위도 double로 읽고, 날짜변경선은 지역 중심경선을 기준으로 연속 unwrap한다.
- 투영 수식과 상수는 manifest 값만 사용한다. OS 지도 API나 PROJ의 암묵적 기본값에 의존하지 않는다.
- 원시 투영 미터를 타일 좌표로 바꾼 뒤 `nearest-half-away-from-zero`만 사용한다.
- 피처는 `geometry.type → sourceIndex → partIndex → ringIndex → vertexIndex` 순으로 처리한다.
- 문자열은 `localeCompare` 기본 로케일을 쓰지 않고 고정된 `en` 비교 또는 UTF-8 바이트순을 사용한다.
- 희소 오버레이 좌표는 전역 타일의 1/1024 단위 signed integer로 양자화한다. JSON 부동소수 출력은 금지한다.
- 통계 보고서는 P50/P95/최대를 고정 선형 보간으로 계산한다. wall-clock benchmark는 판정 산출물에 넣지 않는다.

## 5. 래스터와 레이어 파생

각 타일은 manifest의 4×4 오프셋 16곳에서 분류한다. 표면은 최다 표본 클래스를 선택하고 동률이면 manifest의
`surfacePriority`가 높은 클래스를 택한다. 충돌과 view-only는 표면에서 추론하지 않고 각자 독립 규칙으로
16표본을 판정한다.

- 표면: 4bit, 클래스 ID 0~15. 클래스 이름·색·우선순위는 manifest에 모두 명시한다.
- 충돌: 1bit. `1=차단`, `0=통행`으로 고정한다.
- view-only: 1bit. `1=표시는 하지만 플레이어 진입 차단`으로 고정한다.
- 경계·철도·항로: 격자 패킹 밖 희소 오버레이. 국경은 충돌을 바꾸지 않는다.
- 수동 오버라이드: 원본→파생 규칙 뒤, 패킹 전에 대상 레이어에만 적용한다. 좌표·이전 값·새 값·사유가 없는
  패치는 거부한다.

해안·강·철도처럼 경계를 넘는 피처는 청크별로 따로 래스터하지 않는다. 전역 투영 좌표에서 한 번
양자화한 뒤, 대상 청크에 1타일 이상의 halo를 포함해 클립하고 최종 256×256 half-open 영역만 잘라낸다.

## 6. 청크 바이트 포맷 v1 제안

수직 슬라이스 디코더의 v1 헤더는 96바이트 little-endian으로 고정한다.

| offset | bytes | field |
|---:|---:|---|
| 0 | 4 | magic `MOWC` |
| 4 | 2 | format version (`1`) |
| 6 | 2 | schema version |
| 8 | 2 | header bytes (`96`) |
| 10 | 2 | flags (`0`, 미지원 비트는 거부) |
| 12 | 4 | signed `cx` |
| 16 | 4 | signed `cy` |
| 20 | 8 | valid half-open bbox `x0,y0,x1,y1` (`uint16` ×4) |
| 28 | 4 | payload bytes (`49,152`) |
| 32 | 32 | region ID SHA-256 |
| 64 | 32 | projection manifest SHA-256 |

- 파일명: `<region>/<cx>/<cy>.owc`, `cx`·`cy`는 signed decimal.
- byte order: little-endian, 전체 저장 청크는 256×256 고정.
- 헤더: magic `MOWC`, format/schema version, region hash, signed `cx/cy`, 유효 bbox, projection-manifest SHA-256.
- 표면 payload: 행 우선 65,536셀, 짝수 셀=하위 nibble, 홀수 셀=상위 nibble, 32,768 bytes.
- 충돌 payload: 행 우선 LSB-first, 8,192 bytes.
- view-only payload: 행 우선 LSB-first, 8,192 bytes.
- full chunk canonical payload는 49,152 bytes다. 지역 bbox 밖 패딩은 표면=manifest의 바다 ID,
  충돌=1, view-only=1로 고정한다.
- 전체 canonical 파일은 헤더 포함 49,248 bytes이며 trailing bytes를 허용하지 않는다.
- canonical 파일은 압축하지 않는다. CDN 전송 압축은 가능하지만 content hash 대상은 원본 `.owc`다.

희소 오버레이와 노드 인덱스는 청크별 canonical JSON 또는 후속 고정 바이너리 포맷으로 분리한다. JSON을
쓸 경우 키 순서·배열 정렬·LF 종결·정수 좌표를 고정하고 들여쓰기 없이 기록한다.

## 7. 경계 소유권과 연속성

- 청크 `(cx,cy)`는 전역 타일 `[cx×256,(cx+1)×256) × [cy×256,(cy+1)×256)`를 소유한다.
- 경계 위 POI/게이트는 반올림 후 위 half-open 규칙으로 단 하나의 청크에만 속한다.
- 선 피처는 전역 정수 좌표열을 먼저 만든다. 인접 청크는 같은 꼭짓점 바이트열을 참조해 클립한다.
- 해안·강·철도 경계 표본은 좌우/상하 청크를 합쳐 생성한 기준 이미지와 byte-equivalent한 셀을 가져야 한다.
- 날짜변경선이나 지역 bbox 밖으로 이어지는 선은 명시적 gate/view-only endpoint로 끝내고 자동 wrap하지 않는다.

## 8. 출력 manifest와 재현 게이트

`content-manifest.json`은 상대 경로순으로 정렬한 `path, bytes, sha256, role`을 가진다. manifest 자체와
사람용 보고서를 제외한 모든 출시 파일을 포함하며, 생성 시각·호스트명·절대 경로를 넣지 않는다.

출시 후보는 다음을 모두 통과해야 한다.

1. 깨끗한 두 임시 디렉터리에서 `TZ=UTC/LANG=C`와 `TZ=Asia/Seoul/LANG=ko_KR`로 각각 생성한다.
2. 두 출력의 파일 목록·바이트·SHA-256이 완전히 같아야 한다.
3. WGS84→tile→WGS84 P95가 0.25타일 미만이어야 한다.
4. 256 경계의 해안·강·철도 균열이 0이어야 한다.
5. 모든 POI/게이트/철도 제어점의 청크 소속이 반복 실행에서 같아야 한다.
6. 누락 원본·잘못된 해시·미지원 manifest 필드가 성공으로 종료되지 않아야 한다.
7. 본생성 manifest와 content manifest의 SHA를 PR에 기록한다.

한일 수직 슬라이스는 `scripts/world/build-overworld-fixture.mjs`가 위 포맷의 4개 `.owc`와
`content-manifest.json`을 생성한다. manifest 청크 항목은 상대 경로순이며 생성 시각·호스트명·절대
경로가 없다. `--check`는 재생성 결과와 체크인 바이트를 비교하고, 전체 유효 셀은 기존 playable 격자와,
bbox 밖은 `sea/blocked/view-only` 패딩과 대조한다. 이 fixture는 본생성 또는 노드 마이그레이션이 아니다.

## 9. 변경 관리

입력 버전, 투영 파라미터, 클래스 표, 반올림, 우선순위, 오버라이드 중 하나라도 바뀌면 전체 content hash를
새로 만든다. 기존 청크를 제자리 수정하지 않는다. 포맷 변경은 `formatVersion`을 올리고 런타임이 지원하지
않는 버전을 명시적으로 거부하게 한다.

① 투영 판정으로 한일 소형 fixture 수직 슬라이스의 포맷·loader·cache·렌더 페이지 구현은 허용된다.
지역 ①은 등장방형+screen-axis 확정 뒤 surface preview 생성이 승인되었다. legacy 노드 재투영과 DB 변경은
별도 승인 전까지 시작하지 않는다. ② 투영 파라미터는 보류 상태이며 출시 manifest에 기록할 수 없다.

## 10. 지역 ① surface preview v1

`scripts/world/overworld-region-apac-v1.json`과 `scripts/world/build-overworld-region.mjs`는 지역 ①의
육지/바다 표면만 생성한다. 입력은 Natural Earth 10m land v5.1.2의 고정 바이트
`SHA-256=1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416`이며, 네트워크 폴백은 없다.

- bbox `[60,-47,180,61]`, 4.5km/타일, 2631×2669타일, 256타일 청크 11×11개다.
- 산출물은 `public/assets/overworld/asia-pacific-surface-preview-v1/`의 121개 `.owc`, 보고서,
  content manifest다.
- 육지/바다 동률은 manifest의 `land → sea` 우선순위를 적용한다.
- 이 단계에는 산맥·강·철도·노드·수동 오버라이드가 없다.
- 모든 유효 셀의 collision과 view-only를 `1`로 고정하고 `releaseEligible=false`로 표시한다. 따라서
  런타임이 실수로 연결해도 플레이어가 진입할 수 없다.
- UTC/C와 Asia/Seoul/ko_KR 환경의 독립 생성 결과가 파일 목록과 바이트 단위로 같아야 한다.

원본 캐시 디렉터리에 manifest의 `ne_10m_land.geojson`을 둔 뒤 다음 명령으로 생성·검증한다.

```bash
node scripts/world/build-overworld-region.mjs \
  --manifest scripts/world/overworld-region-apac-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/asia-pacific-surface-preview-v1

node scripts/world/build-overworld-region.mjs \
  --manifest scripts/world/overworld-region-apac-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/asia-pacific-surface-preview-v1 \
  --check
```

## 11. 지역 ① terrain·river preview v1

`scripts/world/overworld-terrain-apac-v1.json`과 `scripts/world/build-overworld-terrain.mjs`는 surface preview를
기준으로 고도 등급과 주요 강 중심선을 파생한다. 이 단계도 이동 마스크를 열지 않으며
`releaseEligible=false`다.

- 고도 원본은 NOAA ETOPO 2022 v1 60 arc-second bed GeoTIFF다.
  전체 원본 `478,386,633`바이트와
  `SHA-256=a2cc72f8a4292dee928f439069457cdefc1fba319876807c626edce40258ba7a`를 먼저 검증한다.
- 원격 WCS 재표본화는 사용하지 않는다. 고정 원본에서 `left=14400, top=1740, width=7200,
  height=6481`을 로컬 추출한다.
- 타일마다 `[0.125,0.375,0.625,0.875]²`의 16개 지점을 가장 가까운 native 픽셀로 표본화해 평균하고
  half-away-from-zero로 반올림한다. ceil 격자의 동·남쪽 미세 초과분은 원본 끝 픽셀로 명시적으로 clamp한다.
- 바다는 surface preview의 바다 값을 그대로 보존한다. 육지는 `<300m=lowland`, `300–999m=highland`,
  `1000–2499m=mountain`, `≥2500m=alpine`의 4개 등급으로 기록한다.
- 강 원본은 Natural Earth 10m rivers/lake centerlines v5.1.2,
  `SHA-256=bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a`다.
  `scalerank≤5`만 선택하고 단순화 없이 전역 타일 1/1024 정수 좌표로 한 번 양자화한다. 각 256타일
  청크에는 1타일 halo를 포함하며, 경계를 공유하는 파일은 같은 전역 endpoint를 가진다.
- 원본 수계 지명은 민감지역 중립 정책 검수 전 산출물에 기록하지 않는다. 역추적에는 이름 대신
  `sourceFeatureIndex`와 결정적 route/segment ID만 사용한다.
- 체크인 산출물은 `public/assets/overworld/asia-pacific-terrain-preview-v1/`의 121개 terrain 청크,
  32개 river overlay, 보고서와 content manifest다. 모든 collision/view-only 비트는 계속 `1`이다.

검증된 두 원본을 캐시 디렉터리에 둔 뒤 다음 명령으로 생성·검증한다.

```bash
node scripts/world/build-overworld-terrain.mjs \
  --manifest scripts/world/overworld-terrain-apac-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/asia-pacific-terrain-preview-v1

node scripts/world/build-overworld-terrain.mjs \
  --manifest scripts/world/overworld-terrain-apac-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/asia-pacific-terrain-preview-v1 \
  --check

node scripts/world/render-overworld-terrain-preview.mjs \
  public/assets/overworld/asia-pacific-terrain-preview-v1 \
  <preview.png>
```

## 12. 지역 ① rail preview v1

`scripts/world/overworld-transport-apac-v1.json`과 `scripts/world/build-overworld-transport.mjs`는 지형 청크를
수정하지 않고 철도를 별도 희소 오버레이로 생성한다.

- 원본은 Natural Earth 10m railroads v5.1.2의 고정 `39,598,080`바이트,
  `SHA-256=a0962d7866060ae3e24df255f6d662389ac9ba7e0df40cf329c2281190b861e6`다.
- 오버월드 축척에서 주요 간선만 보이도록 `scalerank≤5`를 선택한다. 이 기하 데이터로 실제 운행 여부,
  여객 서비스, 역 위치, 시간표 또는 보행 가능 여부를 추론하지 않는다.
- 원본 좌표열을 날짜변경선 기준으로 unwrap하고 전역 타일 1/1024 정수로 양자화한 뒤, 전역 정수 좌표에서
  Ramer–Douglas–Peucker를 적용한다. 허용 오차는 128/1024타일(1/8타일)로 고정한다.
- 단순화는 청크 분할 전에 한 번만 수행한다. 256타일 청크는 1타일 halo를 공유하며 양쪽 파일은 같은
  route ID와 전역 endpoint를 가진다.
- 체크인 산출물은 `public/assets/overworld/asia-pacific-transport-preview-v1/`의 41개 rail overlay,
  보고서와 content manifest다. 노드·DB·게이트·이동 마스크는 변경하지 않는다.

```bash
node scripts/world/build-overworld-transport.mjs \
  --manifest scripts/world/overworld-transport-apac-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/asia-pacific-transport-preview-v1

node scripts/world/build-overworld-transport.mjs \
  --manifest scripts/world/overworld-transport-apac-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/asia-pacific-transport-preview-v1 \
  --check

node scripts/world/render-overworld-terrain-preview.mjs \
  public/assets/overworld/asia-pacific-terrain-preview-v1 \
  <preview.png> 1600 \
  public/assets/overworld/asia-pacific-transport-preview-v1
```

## 13. 지역 ① 이동·view-only preview v1

`scripts/world/overworld-playability-apac-v1.json`과
`scripts/world/build-overworld-playability.mjs`는 fail-closed terrain 청크를 검증한 뒤 이동 마스크만 파생한다.
이 단계는 실제 항공·선박 게이트, 역·항구 노드, 시간표, DB를 만들지 않으며 `releaseEligible=false`다.

- 육지 연결 성분은 행 우선 스캔과 4방향 연결로 한 번만 분류한다. 대각선으로 맞닿은 섬은 같은 성분으로
  합치지 않는다.
- 256타일 이상 성분은 기본 보행 가능, 그보다 작은 섬은 기본 view-only다. 1타일은 약 20.25km²의
  명목 면적이므로 이 기준은 약 5,184km²다.
- 핵심 생활·콘텐츠 섬은 WGS84 policy anchor로 명시 허용한다. 원양 섬은 크기가 기준 이상이어도
  `view-only` anchor가 우선한다. 한 성분에 두 정책이 동시에 지정되면 생성 자체를 거부한다.
- anchor는 manifest의 최대 2타일 안에서 결정적인 거리·행·열 순으로 가장 가까운 육지에 스냅한다.
  범위 안에 육지가 없으면 묵시적으로 좌표를 바꾸지 않고 실패한다.
- 유효 바다는 `collision=1, view-only=0`, 보행 육지는 `0,0`, 관람 전용 육지는 `1,1`이다.
  bbox 밖 청크 패딩은 기존 포맷 계약대로 `1,1`을 유지한다.
- 산지 등급과 강·철도 오버레이는 이동 마스크를 바꾸지 않는다. 4.5km 타일의 전역 로밍을 유지하고,
  통행 비용·교통수단·게이트는 후속 노드 계약에서 별도로 정의한다.
- 체크인 산출물은 `public/assets/overworld/asia-pacific-playability-preview-v1/`의 121개 청크,
  연결 성분·anchor 감사 보고서, content manifest다.

```bash
node scripts/world/build-overworld-playability.mjs \
  --manifest scripts/world/overworld-playability-apac-v1.json \
  --output-dir public/assets/overworld/asia-pacific-playability-preview-v1

node scripts/world/build-overworld-playability.mjs \
  --manifest scripts/world/overworld-playability-apac-v1.json \
  --output-dir public/assets/overworld/asia-pacific-playability-preview-v1 \
  --check

node scripts/world/render-overworld-terrain-preview.mjs \
  public/assets/overworld/asia-pacific-terrain-preview-v1 \
  <preview.png> 1600 \
  public/assets/overworld/asia-pacific-transport-preview-v1 \
  public/assets/overworld/asia-pacific-playability-preview-v1
```

## 14. 지역 ② 중립 경계 preview v1

`scripts/world/overworld-boundary-emea-v1.json`과 `scripts/world/build-overworld-boundary.mjs`는 경계를
충돌·국가 채색·소유권 라벨과 분리된 희소 오버레이로 생성한다. 이 단계도
`releaseEligible=false`다.

- 원본은 Natural Earth 10m admin-0 boundary lines land v5.1.2
  (`2,284,669`바이트,
  `SHA-256=74d9c16229c095fde65943a9919e337682f044bcebccb120764f38edf3b70f4a`)와
  admin-0 boundary lines disputed areas v5.1.2 (`183,831`바이트,
  `SHA-256=69f19da764e6982b43aebae4b1a356ffe74c33f2a3cdb462637c0ba8e969c30b`)다.
- land 원본 안의 `International boundary (verify)`만 `de-facto` 실선으로 분류한다. 분쟁·휴전·미확정·
  통제·참조선 분류와 disputed 원본 전체는 귀속 주체와 무관하게 `neutral-disputed` 한 종류의 점선으로
  강제한다. manifest에 없는 분류가 나오면 생성은 실패한다.
- 원본의 국가명·경계명·좌우 행정 주체·주장·주석 속성은 전부 버린다. 산출물에는 결정적 ID,
  `sourceFeatureIndex`, 기하 인덱스, 축척 등급, 중립 렌더 분류만 기록한다.
- 국가별 면 채색과 수도·귀속 라벨은 금지한다. 경계는 이동·충돌·view-only를 바꾸지 않는다.
- 좌표열은 단순화하지 않고 전역 타일 1/1024 정수로 먼저 양자화한다. 256타일 청크는 1타일 halo를
  공유하며 양쪽 파일은 같은 전역 endpoint와 segment ID를 가진다.
- 체크인 산출물은
  `public/assets/overworld/europe-mediterranean-middle-east-boundary-preview-v1/`의 17개 경계 overlay,
  보고서와 content manifest다.
- 고지문: “지도상의 경계·명칭·표시는 특정 지역의 법적 지위나 경계 주장에 대한 승인 또는 지지를
  의미하지 않습니다.”

```bash
node scripts/world/build-overworld-boundary.mjs \
  --manifest scripts/world/overworld-boundary-emea-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/europe-mediterranean-middle-east-boundary-preview-v1

node scripts/world/build-overworld-boundary.mjs \
  --manifest scripts/world/overworld-boundary-emea-v1.json \
  --input-dir <verified-source-cache> \
  --output-dir public/assets/overworld/europe-mediterranean-middle-east-boundary-preview-v1 \
  --check
```

## 15. 지역 교통 노드 인덱스 preview v2

`scripts/world/overworld-transport-nodes-{apac,emea}-v1.json`과
`scripts/world/build-overworld-transport-nodes.mjs`는 승인된 횡단철도·항공 게이트를 256타일 청크별
canonical JSON 인덱스로 생성한다.

- 입력 위경도는 각 지역의 확정 projection manifest로 투영하고 `nearest-half-away-from-zero`로 한 번만
  반올림한다. 결과 타일은 half-open 규칙으로 단 하나의 `nodes/<cx>/<cy>.json`에 속한다.
- 생성기는 기준 playability content manifest와 모든 청크의 크기·SHA-256을 먼저 검증한다. 노드 타일이
  체크인된 보행 가능 셀이 아니면 임의 스냅 없이 실패한다.
- 문서 키·노드 키는 타입별 exact schema이며 노드는 ID code-point 순이다. 공통 필드는 ID·타입·표시명·
  `contentLocale`·타일이고, 횡단철도는 `corridorStopId`, 항공은 3자리 `airportCode`만 추가한다. 생성 시각·
  호스트명·절대 경로·DB ID는 기록하지 않는다.
- 현재 인덱스는 기존 `vladivostok-transsib`, `moscow-transsib`와 관리자 미리보기 전용
  `paris-cdg-air`를 포함한다. 파리 게이트는 교통 지리 참조일 뿐 운임·시간표·운행 여부·학습 콘텐츠를
  주장하지 않는다.
- 런타임은 content manifest에 등록된 청크만 요청하고, 지역 레지스트리의 게이트 ID·타입·표시명·
  언어 앵커·타입별 route key·타일이 모두 일치해야 씬을 연다. 불일치나 누락은 fail closed다.
- 두 산출물 모두 `releaseEligible=false`이며 기존 저장 좌표·DB·지역 공개 상태를 바꾸지 않는다.

```bash
npm run build:overworld-transport-nodes
npm run check:overworld-transport-nodes
```
