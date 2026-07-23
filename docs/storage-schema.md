# 월드 localStorage 스키마

이 문서는 게스트·수집·월드 설정이 브라우저에 저장하는 키의 단일 진실원이다.
애플리케이션의 학습 진도·테마·PDF 캐시 등 월드 밖 localStorage는 범위에 포함하지 않는다.
로그인 사용자의 여행 스탬프 정본은 계속 `/api/world/stamps`이며, `guest-stamps`는
개발 게스트 전용 폴백이다. 이 스키마는 운영 DB 스키마와 무관하다.

코드 정본은 `src/lib/world/storageSchema.js`다. 현재 형식은 `v1`이고,
`storage-schema-version`이 없는 기존 저장소는 v1로 읽는다. 월드 마운트 시
`ensureStorageSchema()`가 다른 payload를 수정하지 않고 버전 값 `"1"`만 기록한다.

## v1 키 목록

| 키 | v1 저장 형식 | 쓰기·소비처 | 견고성 규칙 |
|---|---|---|---|
| `storage-schema-version` | 10진수 문자열 `"1"` | `storageSchema.js`의 `readStorageSchemaVersion`, `ensureStorageSchema`; `WorldPage` 마운트에서 초기화 | 미존재·깨진 값·접근 차단은 v1로 간주한다. 현재보다 큰 미래 버전은 덮어쓰거나 내리지 않는다. |
| `guest-stamps` | `string[]` JSON. 앨범 정본 node ID를 수집 순서로 보관 | `stamps.js`의 `loadGuestStamps`, `collectGuestStamp`; `GameCanvas` dev guest, `StampAlbum`, 스탬프 마일스톤이 소비 | 깨진 JSON·비배열은 빈 배열. `STAMP_ALBUM_NODES` 밖 유령 ID와 비문자열 제거, 중복은 첫 항목만 유지. 저장소 차단은 읽기 `[]`, 쓰기 `false`. 로그인 서버 경로에는 사용하지 않는다. |
| `npc-met:<cityId>` | 비어 있지 않은 NPC ID의 정렬된 `string[]` JSON | `npcMeetings.js`의 load/save/record; `stampAlbumNpcMeetingProgress.js`가 현재 도시 NPC 분모와 교집합 소비 | `cityId`는 소문자 영숫자·하이픈만 허용. 깨진 JSON·비배열은 빈 Set. 저장 시 비문자열·빈 ID 제거와 정렬. 진행률은 현재 `isNpcMeetingCandidate` ID만 세므로 유령 ID는 분자에서 제외한다. |
| `route-discoveries:<cityId>` | 발견 ID의 정렬된 `string[]` JSON | `routeDiscoveries.js`의 load/save/claim; `CityScene`, `stampAlbumDiscoveryProgress.js`, 발견 마일스톤이 소비 | 깨진 JSON·비배열은 빈 Set. 저장 시 비문자열·빈 ID 제거와 정렬. 수첩·보상은 현재 `mainRoute.discoveries` 및 도시별 보상 정본과 교집합만 세어 유령·교체 ID를 제외한다. 저장 성공 뒤에만 보상을 평가한다. |
| `worldTitles` | 중복 없는 비어 있지 않은 칭호 키 `string[]` JSON | `stampMilestones.js`의 load/save/claim; `discoveryMilestones.js`, `stampTitlePresentation.js`가 공동 영수증으로 소비 | 깨진 JSON·비배열은 빈 배열. 비문자열·빈 값·중복 제거. 알려지지 않은 문자열 칭호는 다른 시스템 소유일 수 있어 저장 시 보존하지만, 표시는 `worldTitleCopy`가 있는 키만 한다. |
| `manabi-world-inventory-items-v1` | 수량형 아이템 맵 JSON. v1은 `{ "pet-food": positiveInteger }` | `inventory.js`의 load/save/grant; 스탬프·발견 마일스톤이 펫 사료 지급, `WorldGameMenu`가 표시 | 깨진 JSON·배열·null은 `{}`. 허용된 수량형 item ID와 양의 정수만 보존하며 유령 item·0·음수·소수는 제거한다. |
| `manabi-world-inventory-favorites-v1` | 중복 없는 가방 item ID `string[]` JSON | `inventory.js`의 load/save; `WorldGameMenu` 가방 정렬·토글, world UI e2e가 소비 | 깨진 JSON·비배열은 빈 배열. 현재 `STARTER_ITEMS`와 `REWARD_ITEMS`에 실재하는 ID만 보존하고 중복 제거. |
| `briefing-seen:<countryId>` | 선점 표식 문자열 `"1"` | `cityEntryBriefing.js`의 `claimCityEntryBriefing`; `GameCanvas` 도시 진입 브리핑이 소비 | 지역학 overview가 실재하는 나라만 쓴다. 키가 하나라도 존재하면 재노출하지 않는다. 저장소 접근·쓰기가 막히면 반복 노출보다 미노출로 닫는다. |
| `manabi-world-avatar-v1` | `{ skin, hair, top, bottom, style, outfit, acc }` JSON | `avatar.js`의 load/save; `WorldPage`, `WorldGameMenu`, world UI e2e가 소비 | 깨진 JSON·비객체·알 수 없는 옵션은 그룹별 첫 기본값으로 정규화. 구형 4필드 저장본은 `style=cap`, `outfit=tee`, `acc=none`으로 무손실 확장한다. |
| `world_pet` | `PET_SPECIES` key 문자열(`dog`, `cat`, `rabbit`, `fox`, `turtle`) | `pet.js`의 `getPetChoice`, `setPetChoice`; `WorldPage`가 소비 | SSR·접근 차단·알 수 없는 값은 `dog`. 알 수 없는 입력은 저장하지 않는다. 레벨·XP·기분은 학습 이벤트 파생값이라 이 키에 저장하지 않는다. |
| `world_muted` | 중복 없는 비어 있지 않은 user ID `string[]` JSON | `muteStore.js`의 get/is/toggle/onChange; `WorldPage` 채팅·근접 음성이 소비 | 깨진 JSON·비배열은 빈 배열. 비문자열·빈 값·중복 제거. SSR·저장 실패는 영속만 생략하고 현재 탭 구독 통지는 유지한다. |

## 공통 규칙과 마이그레이션

1. 모든 키 문자열과 동적 prefix는 `storageSchema.js`만 정의한다. 기존 모듈이 내보내던
   공개 상수와 key builder는 호환 re-export로 유지한다.
2. localStorage는 신뢰 경계가 아니다. JSON parse, 형식 정규화, 현재 정본 ID와의 교집합은
   각 소비자가 수행하며 깨진 값 때문에 렌더·수집·보상이 예외를 던지지 않아야 한다.
3. 저장소 접근과 쓰기는 차단될 수 있다. 읽기는 안전한 빈값·기본값으로, 쓰기는 기존
   함수의 `false`·정규화 결과·조용한 no-op 계약으로 닫는다.
4. v1 도입은 payload 재작성·삭제·키 rename을 하지 않는다. 버전 키 미존재는 v1이고,
   첫 월드 마운트가 버전 표식만 추가하므로 기존 데이터는 그대로 남는다.
5. 향후 v2 이상은 `STORAGE_SCHEMA_MIGRATIONS`에 **도착 버전 번호**를 키로 하는 함수를
   등록하고, 그 함수가 성공한 뒤에만 버전 표식을 올린다. 현재 registry는 비어 있으며
   v1 migration은 no-op이다. 미래 버전을 읽은 구버전 클라이언트는 downgrade하지 않는다.
