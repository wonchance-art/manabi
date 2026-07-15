# 오버월드 청크 런타임 설계

> 상태: **APPROVED FOR VERTICAL SLICE — ① 등장방형+screen-axis**
> 제약: 한일 소형 fixture만 허용. 지역 ① 본 지형 생성·노드 마이그레이션·DB 변경은 승인 게이트 전 금지.

## 1. 문제 정의

현 `WorldScene`은 448×384 전체 격자를 JS 배열로 만들고 Phaser Tilemap에 한 번에 넘긴다. 지역 ①의
수백만 타일에는 적용할 수 없다. 반면 `CityScene`의 `CityChunkCache`는 카메라 주변 렌더텍스처만 유지하고
LRU로 교체하므로 가시성·수명주기 패턴을 재사용할 가치가 있다.

다만 256×256 **저장 청크**를 그대로 하나의 렌더텍스처로 만들면 16px 원본 기준 4096×4096 RGBA,
약 64MiB가 된다. 따라서 저장과 렌더의 청크 크기를 분리한다.

## 2. 두 단계 청크 모델

| 단위 | 크기 | 책임 |
|---|---:|---|
| 저장 청크 | 256×256타일 | 정적 바이너리 로드, 표면/충돌/view-only, 노드·오버레이 인덱스 |
| 렌더 페이지 | 32×32타일 | Phaser RenderTexture 생성·가시성·LRU |
| 충돌 창 | 플레이어 주변 저장 청크 3×3 | 통행·view-only 질의 |

32×32 페이지는 16px 원본에서 512×512 RGBA, 약 1MiB다. 현재 CityScene의 16×16 렌더 청크 상수는
그대로 재사용하지 않고 페이지 크기를 전략으로 주입한다.

## 3. 재사용 범위

`src/components/world/cityChunks.js`에서 다음 개념을 추출하거나 동일 계약으로 재사용한다.

- 카메라 뷰를 타일/페이지 범위로 바꾸는 계산.
- 보이는 페이지 우선, 한 칸 padding, 이동 방향 prefetch.
- LRU touch와 최대 개수 초과 시 화면 밖 페이지부터 선제 제거.
- `destroy()`에서 렌더텍스처·그래픽 객체를 확실히 해제하는 수명주기.
- 카메라 이동 이벤트를 프레임마다 중복 처리하지 않는 dirty/update 패턴.

다음은 WorldScene용으로 새로 만든다.

- 정적 `.owc` fetch, SHA/헤더/버전 검증, 4+1+1bit 디코더.
- 저장 청크 Promise 중복 제거, AbortController, 세대 토큰으로 늦게 끝난 응답 폐기.
- 표면·충돌·view-only typed-array view와 전역 타일 질의.
- 청크별 노드 공간 인덱스와 희소 오버레이 클리핑.
- 날짜변경선·지역 gate·view-only endpoint 규칙.

## 4. 런타임 구성

```text
WorldScene
 ├─ OverworldChunkController
 │   ├─ ChunkLoader       fetch/검증/중복 제거/취소
 │   ├─ PackedChunkCache  원본 49,152B payload LRU
 │   ├─ DecodedWindow     표면·충돌·view-only 3×3
 │   ├─ RenderPageCache   32×32 RenderTexture LRU
 │   └─ SpatialIndex      노드·게이트·오버레이 청크 인덱스
 ├─ VehicleLayer          청크와 독립된 이동 엔티티
 └─ OverlayLayer          페이지별 clip 결과와 전역 route 상태
```

`WorldScene`은 전역 `mapData` 배열이나 Phaser Tilemap을 소유하지 않는다. 이동·상호작용은 컨트롤러의
전역 타일 질의만 사용한다. 씬 전환 시 컨트롤러가 모든 요청을 취소하고 캐시를 파기한다.

### 수직 슬라이스 구현 상태

- ✅ `MOWC` v1 헤더·4+1+1bit 무복사 디코더·tiny fixture
- ✅ 저장 청크 loader·동일 요청 Promise 중복 제거·packed LRU
- ✅ AbortController + generation token stale 응답 폐기
- ⏳ 3×3 decoded 충돌 창·전역 타일 질의
- ⏳ 32×32 렌더 페이지·오버레이·차량 경계 처리

## 5. 로드와 교체 순서

1. 스폰 전에 현재 저장 청크의 헤더·payload·충돌 창을 로드한다. 실패하면 이동을 시작하지 않는다.
2. 카메라 뷰에서 필요한 32×32 페이지와 한 페이지 padding을 계산한다.
3. 필요한 저장 청크 Promise를 거리순으로 합치고, 현재 이동 방향 앞쪽을 같은 거리에서 우선한다.
4. payload 검증 뒤 필요한 페이지의 타일만 RenderTexture에 굽는다.
5. 새 페이지가 준비된 다음 오래된 화면 밖 페이지를 제거한다. 빈 프레임을 만들지 않는다.
6. 메모리 상한을 넘기기 전 `render page → decoded chunk → packed chunk` 순서로 화면 밖 항목을 제거한다.
7. 순간이동·씬 gate는 목적지 현재 청크를 우선 로드한 뒤 플레이어와 카메라를 옮긴다.

요청은 `(regionId,cx,cy,formatVersion,generation)` 키를 가진다. 씬 교체나 투영 manifest 변경으로 세대가
달라지면 완료된 이전 응답을 캐시에 넣지 않는다.

## 6. 메모리 상한 제안

Phaser 기본 자산과 플레이어/NPC 텍스처를 제외한 오버월드 청크 런타임 목표는 **32MiB 이하**다.

| 항목 | 상한 | 예상 |
|---|---:|---:|
| 렌더 페이지 | 20×1MiB | 20MiB |
| packed 저장 청크 | 32×48KiB+헤더 | 약 1.6MiB |
| decoded 충돌 창 | 9×80KiB 이하 | 약 0.8MiB |
| 노드·오버레이·작업 버퍼 | 고정 | 4MiB |
| 여유/할당 오버헤드 | 고정 | 약 5.6MiB |

RenderTexture 실제 GPU 바이트와 브라우저 heap은 개발 계측으로 별도 기록한다. 32MiB를 5초 이상 넘기면
새 prefetch를 중단하고 화면 밖 페이지를 즉시 줄인다. 현재 화면 페이지는 메모리 압력만으로 제거하지 않는다.

## 7. 충돌·노드·상호작용

- `isWalkable(globalX,globalY)`는 저장 청크와 로컬 셀을 half-open 규칙으로 계산한다.
- 충돌 또는 view-only가 1이면 플레이어 진입을 거부한다. 표면 ID만으로 통행을 추론하지 않는다.
- 아직 로드되지 않은 셀은 통행 불가로 취급하고, 짧은 로딩 표시 후 재시도한다.
- 노드 ID는 전역 불변이며 청크 인덱스는 검색 가속용이다. 경계 노드는 하나의 소유 청크에만 저장한다.
- 상호작용 반경이 경계를 넘으면 현재+인접 청크 인덱스를 조회하되 ID로 중복 제거한다.
- legacy/new 이중 운용 동안 좌표 변환은 adapter에서만 하고 노드 원본을 런타임에서 수정하지 않는다.

## 8. 오버레이와 이동 차량

철도·강·국경·항로의 원본 좌표열은 저장 청크 경계에서 잘라 복제하지 않고 전역 양자화된 route ID와
구간으로 관리한다. 렌더 페이지는 자기 bounds+선폭 halo와 교차하는 구간만 clip해 그린다. 인접 페이지가
같은 정수 endpoint를 사용하므로 이음새가 생기지 않는다.

차량은 청크 자식이 아닌 `VehicleLayer`의 전역 엔티티다. 서버 월드 시각과 노선 시간표로 구간 진행률을
계산하고 매 프레임 전역 route 위치를 보간한다. 차량이 청크 경계를 넘을 때 객체를 파괴·재생성하지 않는다.
카메라 밖에서는 스프라이트만 숨기고 시간 상태는 계속 계산한다. 승객 탑승 중에는 차량 주변 페이지와 다음
정차역 저장 청크를 우선 prefetch한다.

## 9. 오류·오프라인·보안

- 헤더 버전, region hash, payload 길이가 다르면 해당 청크를 차단하고 개발 로그에 상대 경로와 오류 코드만 남긴다.
- 런타임은 네트워크 원본 지리 데이터로 폴백하지 않는다. 배포된 canonical 청크만 읽는다.
- 경로는 manifest의 청크 좌표로 조합하며 사용자 문자열을 URL에 넣지 않는다.
- 재시도는 지수 backoff와 최대 횟수를 두고, 실패 청크 너머로 이동시키지 않는다.
- 비밀키나 인증 토큰은 청크 URL/manifest/로그에 포함하지 않는다.

## 10. 수직 슬라이스와 승인 게이트

첫 구현은 한일 범위의 작은 fixture만 사용하며 다음 순서로 분리한다.

1. 포맷 헤더·4+1+1bit 디코더와 손으로 만든 tiny fixture.
2. 저장 청크 loader/cache + 충돌 창 단위 테스트.
3. 32×32 렌더 페이지와 CityScene 동등 카메라 이동 테스트.
4. 해안·철도 경계 fixture, 차량이 페이지/저장 청크 경계를 넘는 테스트.
5. 로그인 fixture 실화면에서 장거리 이동·빠른 왕복·순간이동·재접속 적대 검증.
6. heap/GPU 텍스처 계측, 32MiB 목표와 화면 공백 0 확인.

완료 조건은 ESLint 0, Vitest, build, content/reading 게이트와 다음 런타임 전용 게이트다.

- 같은 저장 청크 요청의 실제 fetch 1회.
- 청크 경계 충돌·view-only 결과가 양쪽 접근에서 동일.
- 빠른 카메라 왕복과 씬 종료 뒤 늦은 Promise가 객체를 부활시키지 않음.
- 렌더 페이지 seam 0, 차량 위치 점프 0, 화면 내 페이지 eviction 0.
- 스폰·gate 목적지 로드 실패 시 안전하게 이동 차단.

이 수직 슬라이스 통과 전 지역 ① 본생성과 legacy 노드 마이그레이션은 시작하지 않는다.
