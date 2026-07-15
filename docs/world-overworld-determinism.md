# 오버월드 §6.4 결정성 계약 초안

> 상태: **DRAFT — ① 투영 확정, 수직 슬라이스만 허용**
> 범위: 오버월드 지형·충돌·view-only·희소 오버레이 생성 산출물. 노드 마이그레이션과 DB는 범위 밖이다.

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
지역 ① 본생성, legacy 노드 재투영, DB 변경은 `docs/world-global-expansion.md`의 다음 단계 승인 뒤 시작한다.
② 투영 파라미터는 보류 상태이며 출시 manifest에 기록할 수 없다.
