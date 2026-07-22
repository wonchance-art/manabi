# SPEC — 주동선 발견 이벤트 (v3 리옹 파일럿 콘텐츠 레이어)

- 상태: 계약 확정·카피 정본(Claude 저작). 구현 발주: Codex-1 E5(#150 코멘트 참조).
- 근거: 오너 v3 방향 C "이동의 콘텐츠화 — 길 위 마이크로 이벤트·발견물"(레벨 디자인 진단).
- 원칙: geo·mainRoute 경로 재생성 없음. 기존 지식 카드(factLine)·스탬프 문법 위에 얹는
  1회성 마이크로 발견만 추가. DB 무변경(localStorage), IP 수위(상호·인물 무재현) 준수.

## 1. 데이터 계약 (도시 파일 저작 핀)

`city.mainRoute.discoveries` — 선택 필드, 없으면 렌더·동작 불변(fail-closed).

```js
discoveries: [
  { id: 'lyon-d1', leg: ['perrache', 'bellecour'], at: 0.55, line: '…' },
]
```

- `leg`: mainRoute waypoints의 인접 id 쌍. 배열 순서·인접성 위반은 resolve 단계에서 throw.
- `at`: 그 leg 경로 타일열 위 위치 비율(0 초과 1 미만). 결정 규칙:
  `tileIndex = waypointOffsets[i] + round(at × (waypointOffsets[i+1] − waypointOffsets[i]))`,
  좌우 경계는 ±1 클램프. pathSha 재현성과 동일하게 결정적이어야 한다.
- `line`: 마이크로 카피 1줄(12~90자·해요체). factLine과 동일 규격, desc와 문자열 중복 금지.
- 같은 leg에 최대 1개(파일럿 범위). id는 `<cityId>-d<n>` 규약.

## 2. 동작 계약

- 렌더: 발견 타일에 스파클 도트 프롭(2프레임 점멸, 무문자) — 기존 GBC 프롭 베이크 문법.
  미발견만 점멸, 발견 후엔 소등(재방문 시 정적 도트).
- 트리거: 플레이어가 발견 타일에 **도보 진입**(전철·페리 스폰 제외)하면 1회 발동 —
  GBC 말풍선으로 `line` 4.2s 노출(newStamp factLine 연출과 동일 톤). 스탬프 미발급.
- 저장: `localStorage 'route-discoveries:<cityId>'` = 발견 id 배열. 서버 무통신.
- 수집률 표기(선택): 여행 수첩 도시 상세에 `발견 n/8` 1줄 — S2(앨범 확장)와 충돌 시 S2 우선.

## 3. 리옹 정본 카피 8건 (구현자는 그대로 배선 — 수정 금지)

| id | leg | at | line |
|---|---|---:|---|
| lyon-d1 | perrache→bellecour | 0.55 | 보행자 거리의 차양 아래로 아침 냄새가 흘러요 — 리옹의 하루는 빵집 앞에서 시작돼요. |
| lyon-d2 | bellecour→vieux-lyon | 0.50 | 손강 다리 위에서 물빛이 바뀌어요 — 잔잔한 손강과 힘찬 론강, 두 강의 성격이 달라요. |
| lyon-d3 | vieux-lyon→fourviere | 0.40 | 구시가 골목엔 「트라불」이라 불리는 지붕 덮인 지름길이 숨어 있어요 — 비 오는 날의 통로였대요. |
| lyon-d4 | fourviere→terreaux | 0.45 | 언덕에서 내려다보면 붉은 지붕의 바다 너머로 두 강이 만나는 자리가 보여요. |
| lyon-d5 | terreaux→opera | 0.50 | 시청 뒤편을 돌면 오페라의 유리 반원 지붕이 나타나요 — 옛 벽 위에 얹은 현대의 곡선이에요. |
| lyon-d6 | opera→croix-rousse | 0.60 | 크루아루스 오르막은 옛 견직 공방의 동네예요 — 천장 높은 집들이 그 시절의 흔적이에요. |
| lyon-d7 | croix-rousse→halles | 0.50 | 론강변 산책로엔 플라타너스가 줄지어요 — 강을 따라 달리는 사람들의 코스예요. |
| lyon-d8 | halles→part-dieu | 0.45 | 실내 시장의 치즈 좌판을 지나면 곧 파르디외의 유리탑이 눈에 들어와요. |

수위 검증: 상호·인명·브랜드 0(실내 시장·유리탑·오페라 지붕은 일반 외관 묘사),
사실 근거(트라불·카뉘 견직 역사·두 강 합류)는 지역학 리옹 카드와 정합, desc 문자열 비중복.

## 4. 테스트 요구 (구현 PR 게이트)

- 계약: leg 인접성·at 범위·line 규격(12~90자·해요체)·leg당 1개·id 규약 위반 throw.
- 결정성: 리옹 8건의 tileIndex 산출값 스냅샷(waypointOffsets 기준 exact).
- fail-closed: discoveries 없는 25도시 렌더·동작 불변(기존 스냅샷 무변화).
- 트리거: 도보 진입 1회 발동·재진입 무발동·localStorage 왕복.
