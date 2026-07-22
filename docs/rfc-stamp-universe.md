# RFC — 스탬프 우주 확장 계약

- 상태: **제안(승인 전 구현 금지)**
- 기준: `origin/main` `5ffd30c7f5f82e499f47a65759d2000394dadf49`
- 발주: 이슈 #150 코멘트 `5045201540`
- 대상: 기존 전국맵 66노드 + 지역 오버월드 도시 게이트 19노드
- 원칙: 방문 기념의 의미와 기존 저장 ID를 유지하고, 지역 도시만 앨범에 원자적으로 편입한다

## 1. 결론

앨범의 단일 소비 집합을 `WORLD_NODES`에서 새 `STAMP_ALBUM_NODES`로 바꾼다. 새 집합은
`WORLD_NODES` 66개를 기존 순서 그대로 앞에 두고, `REGIONAL_WORLD_NODES`의 도시 게이트 19개를
현재 레지스트리 순서로 뒤에 붙인 85개다.

지역 도시 게이트의 `noStamp: true`는 제거한다. 대신 `noStamp`는 **도시 안의 파사드·학습 도어처럼
앨범에 들어가면 안 되는 상호작용 인스턴스의 명시적 수집 금지**라는 뜻으로 좁힌다. 실제 수집은
`node.noStamp !== true`와 `STAMP_ALBUM_NODES` ID 멤버십을 모두 만족할 때만 허용한다.

지역 도시 19개의 `factLine`은 Claude가 저작한다. 85/85 팩트 커버리지가 통과하기 전에는 지역
노드의 `noStamp`를 해제하지 않아야 한다. 따라서 앨범 카운트·수집·지식 카드가 66에서 85로 한 번에
전환되고, 팩트 없는 빈 보상 상태는 배포되지 않는다.

DB 마이그레이션과 기존 행 변환은 필요 없다. `world_stamps`는 `(user_id, node_id text)`를 키로
쓰므로 기존 66개 ID와 첫 방문 시각을 그대로 보존한다.

## 2. 현재 상태 실측

기준 head에서 Node 22로 정본 모듈을 직접 읽은 결과다.

| 항목 | 현재 | 확장 뒤 |
|---|---:|---:|
| `WORLD_NODES` | 66 | 66(순서·ID 불변) |
| `REGIONAL_WORLD_NODES` | 19 | 19 |
| `ALL_WORLD_NODES` | 85 | 85 |
| 앨범 소비 노드 | 66 | 85 |
| `NODE_FACTS` 키 | 66 | 85 |
| 지역 도시 `factLine` | 0/19 | 19/19 |

현재 19개 지역 노드는 모두 `kind:'city'`, `gate.type:'city'`, `noStamp:true`다. ID 중복은 없고,
`getNode()`는 이미 `ALL_WORLD_NODES`를 검색한다. 따라서 API는 직접 POST한 지역 ID도 현재 유효
노드로 인정하지만, 정상 클라이언트는 `noStamp` 가드 때문에 수집 요청을 보내지 않는다.

제안 순서와 지역 `noStamp` 해제를 정규화한 85행 manifest를 독립 Node 프로세스 두 번에서
산출했다. 두 JSON은 10,458 bytes로 byte-identical이고 SHA-256은
`7457ac81ba78ce2070e6c80ddd53f60da7afb391a0cef97712cc39bf419ce8ca`로 일치했다. 이는 RFC
정본 후보의 순서·ID·gate 매핑 probe이며, 승인 뒤 제품 final head에서는 같은 계약으로 새 SHA를
다시 고정한다.

현재 소비처는 서로 다른 집합을 직접 참조한다.

- `StampAlbum.jsx`: `WORLD_NODES`로 총수·획득수·배지 그리드를 계산한다.
- `GameCanvas.jsx`: `!node.noStamp`로 수집 여부를 정하고, 게임 메뉴 총수는
  `WORLD_NODES.filter(...)`로 계산한다.
- `/api/world/stamps`: `getNode(nodeId)`만으로 POST ID를 검증한다.
- `worldNodeFacts.test.js`: `WORLD_NODES`만 팩트 전수 계약으로 본다.
- `stampAlbum.test.js`: `WORLD_NODES`만 아이콘 전수를 검사한다.

이 상태에서는 소비처 하나만 바꾸면 앨범 총수, 메뉴 진행률, 수집 허용, 서버 허용, 지식 카드가
서로 어긋난다. 새 단일 집합과 순수 멤버십 helper가 필요한 이유다.

## 3. 목표와 비목표

### 목표

1. 지역 오버월드의 실제 도시 진입 게이트 19개를 방문 기념 앨범에 편입한다.
2. 앨범·메뉴·수집·API·팩트 테스트가 같은 85개 정본 집합을 소비하게 한다.
3. 기존 66개 스탬프 ID·획득 여부·최초 방문일·표시 순서를 보존한다.
4. `noStamp`가 도시 파사드·학습 도어·앨범 밖 NPC를 계속 차단하게 한다.
5. 지역 팩트는 Claude 저작 전용으로 두고, 85/85 원자적 커버리지를 병합 게이트로 만든다.
6. 롤백 때 DB 행을 삭제하거나 변환하지 않아도 기존 66개 앨범으로 즉시 돌아갈 수 있게 한다.

### 비목표

- 도시 내부 POI·파사드·언어 도어·NPC 전체를 새 스탬프로 만들지 않는다.
- 지역 도시를 과거에 방문했는지 추정해 19개 스탬프를 자동 지급하지 않는다.
- 스탬프를 XP·학습 달성·실화폐·서버 검증 보상으로 승격하지 않는다.
- 나라별 앨범 페이지, 검색, 희귀도, 퀘스트, 새 DB 컬럼을 이번 라운드에 넣지 않는다.
- Codex가 해외 도시 `factLine` 문구를 대신 저작하지 않는다.

## 4. 편입 대상 19개와 ID 계약

스탬프 PK에는 도시맵 ID(`gate.to`)가 아니라 **오버월드 노드 ID(`node.id`)**를 저장한다. 파리와
니스처럼 두 값이 다른 도시가 있어 이를 섞으면 기존 `getNode`·앨범·방문일 조인이 깨진다.

| 지역 | 스탬프 `node.id` | 도시맵 `gate.to` |
|---|---|---|
| APAC | `hong-kong` | `hong-kong` |
| APAC | `taipei` | `taipei` |
| APAC | `shanghai` | `shanghai` |
| APAC | `beijing` | `beijing` |
| APAC | `brisbane` | `brisbane` |
| APAC | `sydney` | `sydney` |
| APAC | `canberra` | `canberra` |
| APAC | `melbourne` | `melbourne` |
| EMEA | `paris` | `grand-paris` |
| EMEA | `mont-saint-michel` | `mont-saint-michel` |
| EMEA | `nice` | `cote-dazur` |
| EMEA | `brussels` | `brussels` |
| EMEA | `london` | `london` |
| EMEA | `marseille` | `marseille` |
| EMEA | `geneva` | `geneva` |
| EMEA | `leman-riviera` | `leman-riviera` |
| EMEA | `lyon` | `lyon` |
| EMEA | `bordeaux` | `bordeaux` |
| EMEA | `strasbourg` | `strasbourg` |

편입 검증은 19개 각각에 다음을 요구한다.

- `kind === 'city'`
- `gate.type === 'city'`
- 비어 있지 않은 문자열 `id`, `name`, `gate.to`, `regionId`
- `ALL_WORLD_NODES` 안 ID 유일
- `gate.to`가 실제 `CITY_MAPS` 도시 ID와 exact 일치
- `noStamp !== true`

지역 노드가 추가될 때 자동으로 앨범에 들어오게 할지 여부는 별도 승인 대상이다. 이번 구현은 위
19개 exact 목록과 count를 테스트로 고정한다. 새 도시가 registry에 추가됐다는 이유만으로 팩트 없이
보상 우주가 넓어지지 않게 fail closed한다.

## 5. 단일 소비 집합 계약

새 순수 모듈은 다음 의미를 갖는다. 이름은 구현 승인 시 확정하되 계약은 동일해야 한다.

```js
export const STAMP_ALBUM_NODES = Object.freeze([
  ...WORLD_NODES,
  ...REGIONAL_WORLD_NODES,
].filter((node) => node.noStamp !== true));

const STAMP_ALBUM_NODE_IDS = new Set(STAMP_ALBUM_NODES.map((node) => node.id));

export function canCollectStamp(node) {
  return !!node
    && node.noStamp !== true
    && STAMP_ALBUM_NODE_IDS.has(node.id);
}
```

최종 승인 head에서는 `WORLD_NODES` 66개와 지역 19개 모두 `noStamp !== true`이므로 길이는 정확히
85다. 필터를 남기는 이유는 미래의 전역 장식 노드가 `ALL_WORLD_NODES`에 들어오더라도 자동 수집되지
않게 하기 위해서다.

### 순서

- 인덱스 `0..65`: 현재 `WORLD_NODES`와 ID·순서 exact 동일
- 인덱스 `66..84`: 현재 `REGIONAL_WORLD_NODES` 순서 exact 동일
- 정렬, locale compare, 런타임 Set 순회, 방문일 순으로 재배치하지 않는다.

앨범은 기존의 평면 그리드와 스크롤을 유지한다. 이번 RFC에서 나라별 페이지나 그룹 UI를 추가하지
않는다. 기존 사용자는 같은 66칸을 먼저 보고 그 뒤에 지역 도시 19칸이 붙는다.

## 6. `noStamp` 의미 재정의

`noStamp`는 더 이상 “지역 오버월드 소속”이나 “전국맵 밖”을 뜻하지 않는다.

| 값 | 새 의미 | 예 |
|---|---|---|
| `true` | 이 상호작용 인스턴스는 앨범 ID가 아니며 수집 요청을 절대 만들지 않음 | 도시 파사드, 학습 도어, 앨범 밖 NPC |
| 없음/`false` | 금지 오버라이드는 없음. 단, 정본 ID 멤버십을 추가로 통과해야 수집 가능 | 전국맵 노드, 지역 도시 게이트 |

두 조건을 함께 검사해야 한다. `!node.noStamp`만 쓰면 임의의 도시 로컬 노드가 서버로 전송될 수
있고, ID 멤버십만 쓰면 전역 ID를 우연히 재사용한 파사드가 스탬프를 발급할 수 있다.

기존 도시 파일의 파사드·도어 `noStamp:true`는 그대로 유지한다. 제거 대상은 이 RFC 표의 지역 도시
게이트 19개뿐이다. `GameCanvas` 안의 모든 수집 지점(전국맵 A 상호작용, 지역 오버월드 요청,
도어 확인, NPC 완주)은 같은 `canCollectStamp`를 사용해야 한다.

수집 시점은 기존처럼 노드에 A로 상호작용한 순간이다. 도시 로드, 세이브 복원, 지역 진입, 맵
렌더만으로 자동 수집하지 않는다.

## 7. 앨범·메뉴·API 계약

### 앨범과 메뉴

- `StampAlbum`의 `total`, `got`, 배지 그리드는 모두 `STAMP_ALBUM_NODES`를 사용한다.
- 게임 메뉴의 `totalPlaces`도 같은 배열 길이를 사용한다.
- `got`은 `STAMP_ALBUM_NODES`와 `stamps Set`의 교집합 수다. 알 수 없는 서버 행은 카운트하지 않는다.
- 방문일 맵은 계속 `nodeId → at`으로 조인한다. 새 필드나 인덱스 기반 저장을 만들지 않는다.
- 지역 노드는 모두 `kind:'city'`이므로 기존 `stampIcon`의 `🏙️` 폴백을 그대로 쓴다.

### API

POST 허용 여부도 `getNode(nodeId)`가 아니라 `STAMP_ALBUM_NODE_IDS` 멤버십으로 닫는다. `getNode`는
렌더 가능한 노드인지 답하고, 스탬프 정책 정본은 아니기 때문이다.

GET 응답 모양과 정렬은 유지한다.

```json
{ "stamps": [{ "nodeId": "seoul", "at": "..." }] }
```

스탬프는 여전히 보안성 없는 방문 기념이다. 서버는 실존·허용 ID와 본인 행만 검증하며 실제 이동
완료를 증명하지 않는다. 따라서 85/85 수집을 학습 달성이나 보상 지급 조건으로 사용하지 않는다.

## 8. `factLine` 커버리지와 콘텐츠 소유권

현재 `NODE_FACTS`는 기존 66개를 정확히 덮고 지역 19개는 0개다. 지역 도시를 편입하면서 토스트가
조용히 사라지는 것은 보상 루프 확장 목적과 맞지 않으므로 최종 병합 상태는 85/85를 강제한다.

Claude가 19개 문구를 저작하고 Codex는 구조·테스트만 연결한다. 키는 표의 `node.id`를 쓴다. 특히
파리는 `paris`, 니스는 `nice`이며 `grand-paris`, `cote-dazur`를 새 키로 만들지 않는다.

각 신규 문구는 기존 계약을 그대로 따른다.

- 12~90자, 줄바꿈 없음, `요.` 해요체 종결
- 같은 노드 `desc`와 exact 중복 금지
- 상호·현존 인물·작품·브랜드·국기·엠블럼 무재현
- 연도·유래·전승은 필요한 헤지 포함
- 중화권은 지리·건축·생활 사실 층위만, 정치 서술 금지
- `NODE_FACTS`의 모든 키는 `STAMP_ALBUM_NODES`의 실재 ID

권장 병합 순서는 (1) Claude의 19개 팩트 저작, (2) Codex 구조 변경과 85/85 테스트, (3) 지역
`noStamp` 해제를 같은 최종 PR head에서 검증하는 방식이다. 중간 커밋이 존재해도 배포 가능한 final
head는 팩트 85개와 앨범 85개가 exact 일치해야 한다.

## 9. 기존 저장 데이터 호환

`world_stamps`의 PK는 `(user_id, node_id)`이고 `node_id`는 `text`다. 앨범은 원래부터 문자열
Set으로 수집 여부를 계산하므로 스키마·직렬화 버전 변경이 없다.

1. 기존 66개 행은 ID와 `at`을 그대로 유지한다.
2. 19개 지역 도시는 표의 `node.id`로 새 행을 추가한다.
3. 과거 방문 이력은 저장되지 않았으므로 지역 스탬프를 자동 backfill하지 않는다.
4. 현재 API가 `getNode`로 지역 ID를 허용하므로 직접 POST로 이미 생긴 지역 행이 있을 수 있다.
   확장 뒤에는 그 행과 최초 `at`을 그대로 표시하며 덮어쓰지 않는다.
5. 알 수 없거나 삭제된 ID가 DB에 남아도 85개 카운트·그리드에는 나타나지 않는다. 데이터 삭제는
   이번 범위가 아니다.

롤백은 코드에서 소비 집합과 지역 `noStamp`를 이전 상태로 되돌리는 것만으로 끝난다. 롤백 중 지역
행은 DB에 휴면 상태로 남고, 재활성화 시 원래 최초 방문일로 다시 보인다. 파괴적 삭제나 역방향
마이그레이션은 하지 않는다.

## 10. 검증 계약

### 정본 집합

- `STAMP_ALBUM_NODES.length === 85`
- 앞 66개 ID 배열이 `WORLD_NODES` ID 배열과 byte-identical
- 뒤 19개 ID 배열이 승인된 지역 표와 exact 동일
- ID 중복 0, 빈 ID 0, `noStamp:true` 0
- 지역 19개가 모두 city gate이며 `gate.to`가 실제 도시 registry에 존재
- 같은 입력에서 ID manifest JSON 2회 byte-identical SHA-256

### 수집 정책

- 기존 66개와 지역 19개는 `canCollectStamp === true`
- 도시 파사드·학습 도어·앨범 밖 NPC 대표 fixture는 `false`
- 존재하지 않는 ID, 빈 객체, `null`, 같은 ID라도 `noStamp:true`인 인스턴스는 `false`
- API는 85개 ID만 허용하고 임의 문자열은 400
- 중복 POST는 기존처럼 첫 `at`을 덮어쓰지 않음

### 앨범·팩트·호환

- 앨범 총수와 메뉴 총수가 모두 85
- 기존 66개만 가진 Set에서 `got === 66`, 신규 빈칸 19
- 기존 66개 순서·아이콘·방문일 표시 회귀 없음
- `NODE_FACTS` 키 집합과 `STAMP_ALBUM_NODES` ID 집합 exact 동일(85/85)
- 신규 19개 팩트의 길이·한 줄·해요체·desc 비중복·실재 키 계약 통과
- 지역 ID가 들어간 기존 GET 응답과 신규 POST 응답을 현 파서가 무변경으로 수용

### 회귀·실측

- stamp universe·album·facts·stamps API 관련 targeted vitest
- 전체 `npm test`, `npm run lint`, `git diff --check`
- Node 22 공식 배포판에서 targeted와 전체 테스트의 max RSS·peak footprint·swap 기록
- 제품 코드 구현 시 final head에서 정본 manifest를 두 번 산출해 byte-identical SHA를 CODEX_DONE에 첨부

## 11. 승인 뒤 예상 파일 경계

Codex는 승인된 구조 파일만 수정하고 해외 팩트 문구는 건드리지 않는다.

- 신규 순수 정책 모듈: `src/lib/world/stampUniverse.js`
- 지역 게이트 플래그 19개: `src/components/world/worldNodes.js`
- 소비처 최소 변경: `src/components/world/StampAlbum.jsx`, `src/components/world/GameCanvas.jsx`
- 서버 허용 집합: `src/app/api/world/stamps/route.js`
- 신규/갱신 테스트: stamp universe, 앨범, facts, API 경계
- Claude 저작: `src/lib/world/worldNodeFacts.js`의 지역 19개 `factLine`
- 보드: Codex-3 열만 별도 커밋
- 금지: DB·migration·geo·CityScene·도시 generator·registry 구조·기존 66개 팩트 카피

`worldNodes.js`와 `GameCanvas.jsx`는 공유 파일이므로, 구현 승인 댓글에 위 exact 파일 소유권을
명시적으로 포함해야 한다. 그 승인 전에는 이 RFC와 Codex-3 보드 외 파일을 수정하지 않는다.

## 12. 승인 요청

1. 기존 66개를 prefix로 보존하고 지역 19개를 suffix로 붙이는 85개 평면 앨범을 승인하는가?
2. `noStamp`를 파사드·도어의 명시적 금지로 좁히고, 지역 도시 19개에서만 제거하는가?
3. `noStamp !== true`와 정본 ID 멤버십을 함께 보는 `canCollectStamp` 이중 가드를 승인하는가?
4. 스탬프 PK는 `gate.to`가 아니라 현재 `node.id`를 유지하는가?
5. Claude 저작 팩트 19개와 구조 전환을 85/85 원자적 병합 게이트로 묶는가?
6. 과거 지역 방문 자동 지급 없이, 이미 존재하는 지역 DB 행만 그대로 드러내는가?
7. DB 무변경·코드 롤백 시 지역 행 휴면 보존 방식을 승인하는가?
8. 승인 뒤 공유 파일 `worldNodes.js`·`GameCanvas.jsx`의 위 최소 변경을 Codex-3에 허용하는가?

승인 전에는 제품 코드·팩트 카피·DB를 수정하지 않는다.
