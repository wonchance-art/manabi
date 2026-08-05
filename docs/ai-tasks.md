# AI 태스크 보드 (todo → doing → done)

3세션(Claude·Codex-1·Codex-2)이 매 사이클 이 파일 하나로 상태를 동기화한다.
규칙: **자기 열만 옮긴다**(todo→doing은 착수 선언, doing→done은 CODEX_DONE/CLAUDE 검수와 함께).
보드 갱신 커밋은 다른 변경과 섞지 않는다. 상세 스펙·핑퐁은 기존대로 #150(이 보드는 인덱스).
오너 결정 대기 항목은 owner-gate 섹션에 — 어떤 세션도 임의 착수 금지.

> **운영 공지 (2026-07-22)** ① 세션 3·4는 iCloud vault 트리 직접 사용 금지 — 로컬 clone으로 즉시
> 이전(#150 P0). 오늘 vault 브랜치 전환 동기화로 Claude dev 서버·에셋 서빙 파손 실측.
> ② dev 검수 하니스: 게스트 열람(#388)·오프라인 단독 입장(#389)·?spawn= 직행(#391)·dev SW 차단(#392).
> ③ 벌크 발주 완료 — 각 세션은 자기 SPEC 큐(#150 코멘트 5046785242/5647/5938/6117)를 대기 없이 순차 소화.

> ④ **오너 전면 승인(2026-07-23)**: D-트랙(여행책 지구제 — docs/rfc-guidebook-districts.md) 그린라이트.
> 잠금 카피·적용 순서 확정. 세션 1~4 적극 활용 — D-트랙 큐 최상단, 대기 금지.
## Codex-1 (codex/*)
### doing
### todo
### done (최근)
- 🔍 전체 코드 리뷰 R1 — `src/components` production 158파일/39,818줄 심층 정독으로
  major 10·minor 3을 exact 라인·원문·수정안으로 고정하고, ChapterDrills/WritingPractice/
  RefSpeak 정본·hydration 문제와 LearnProgressWidget 정상 cleanup을 판정. report-only,
  targeted 2파일/6·전체 265파일/2,532테스트 green
  (`codex/review-code-components`, assignment 5192929323, fixed base 8e7e41778f338c0ed8a5d6744dedd011fb409a74)
- Tatoeba fr 실음원 메타 v1: v1+v2 A1~A2 20문형을 오디오 메타 전용 API로 조회하고
  오디오 자체 라이선스 CC BY/CC0 allowlist·낭독자 귀속·스키마 계약을 고정. 현행 후보의
  오디오 22건은 NC 16·SA 1·미표시 5로 허용 0건(총 부족 120)을 명시하고, 3회 byte-identical
  SHA·대상 3/3·전체 261파일/2,516테스트 green을 검증
  (`codex/tatoeba-fr-audio`, 구현 cfe43e0, base 162d6bb7ec6908759308f1ce720e145550167d27)
- Tatoeba fr A2 스냅샷 v2: unstable API `paging.next` 페이지네이션으로 10문형×20문장
  200건을 CC BY 2.0 FR·CC0 allowlist와 문장별 sourceUrl로 고정하고, 동일 쿼리 2회
  byte-identical SHA·스키마/라이선스 전수 계약·정본 전체 259파일/2,511테스트 green을 검증
  (`codex/tatoeba-fr-v2`, 구현 8b20d9e, base 1c3a03f)
- 커리큘럼 메타 R1 + 코스 지도 R3: 챕터 `prerequisites`·`formulaic` 스키마/동일 트랙
  참조 계약과 권장 선행·장면 고정구 배지, 상세 도입 안내를 시스템 코드에 연결하고
  콘텐츠 데이터 무변경·전체 250파일/2,483테스트 green을 고정
  (`codex/curriculum-meta`, 구현 56390ef, base ad21a64)
- 대화 예시 구조화 R1: examples에 flat 형식과 배타적인
  `dialogue: [{speaker, fr|ja|en|zh, ipa?, ko}]` 검증을 추가하고 story 공용 대사 라인 렌더러를
  연결해 콘텐츠 이행 0건·전체 249파일/2,473테스트 green을 고정
  (`codex/dialogue-field`, 구현 ce35663, base 387b83e)
- 교재 경쟁력 M1 동기 표면화: `/learn/course`에 기존 profile 스트릭 기반 배지와
  오늘 레슨 1개 완료 카드를 추가하고, 사용자 스코프 게스트 폴백·progressStore 갱신을 연결
  (`codex/m1-streak-surface`, 구현 854b8a9, base 5e2244f)
- F5 레슨 완료 CTA: 4트랙 공통 문법 상세에서 F1 레슨 ref로 완료를 기록하고
  게스트 로컬 폴백·재방문 완료 상태·코스 지도 다음 레슨/1·9 진도를 연결
  (`codex/f5-lesson-complete`, 구현 b274eb8, base 3aca5c4)
- F5 코스 지도 4트랙 전면화: `/learn/course` 일본어·프랑스어·영어·중국어
  트랙 선택과 트랙별 F1 Course→Unit→Lesson·F2 진도/다음 CTA를 연결하고, F4 정본
  챕터/세트를 포섭해 기존 문법·어휘 페이지로 딥링크
  (`codex/f5-course-map-all`, 구현 4a4b0a1, base 8d94dab)
- F5 선행 프로토 영어 코스 지도: `/learn/course` 신규 라우트에서 F1 Course→Unit→Lesson을
  렌더하고 F2 진도·다음 레슨 CTA·게스트 로컬 폴백과 렌더/진도/빈 상태 회귀를 고정
  (`codex/f5-course-map-proto`, 구현 0da5298, base 23511cf257032aec2d6cb9f690ca4bb097996e58)
- V3 도로 오토타일 리옹 단일 파일럿: `roadStyle: 'autotile-v1'` opt-in으로
  roadLike 4방 비트마스크 16종·광폭 내부 노면·8px 위상 파선을 ROAD·CROSSWALK·BRIDGE·
  mainRoute·guidebook에 정합하고 미설정 25도시 렌더 키를 불변 유지
  (`codex/road-autotile-pilot`, 구현 8f31227, base a252e27058b0a009595d58b7acd0523e9098ba87,
  final base d8aea7714b814eae1487fc9e2f854bde867926e0)
- W3 dev 게스트 하니스 정본 문서화: 활성화·`?spawn=` 전체 문법·오프라인/저장 경계와
  광장·공항·회랑 직행 지원 여부, 라이브 검수 절차를 소스 라인 근거로 고정
  (`codex/dev-harness-docs`, 구현 e98b4e8, base a252e27058b0a009595d58b7acd0523e9098ba87)
- V2 코트다쥐르 경계 대비 확보(W2-R2-02): 밝은 개방 보도↔잠금 평지의 지각 명도차를
  `3.15→24.43`으로 높여 16×16 전 픽셀 하한 20을 통과시키고 다른 지구제 6도시의
  guidebook 렌더 명령·W1 경계 키 스냅샷을 유지
  (`codex/cote-dazur-boundary-contrast`, 구현 fbb9b97,
  base 407b32cda5e517c908a86c4d9ac0b88c430e7584, final base d192161e13255aa3e10c38bd6615e9be6ca82c34)
- E11 기지 flaky 4종 안정화: osakaGeo·tokyoGeo RLE 왕복, cityFukuoka 전수 셀,
  contentOverrides 전 언어 라운드트립의 병렬 부하 timeout을 30초로 명시하고 전체 vitest 3회 연속 green
  (`codex/flaky-test-stabilize`, 구현 04f8e9e, base a8ff50d992b399137bf978acc7545f8e5235f2eb)
- E10 에어허브 감사 공백 수정: APAC 인천 도착 앵커를 왕복 가능한 항공 게이트로 승격하고
  저장 실패를 E2 문법의 연결 안내·동일 목적지 `다시 시도 Ⓐ/Ⓑ` 상태머신으로 통일,
  EMEA/APAC 왕복·재시도 감사 절차를 회귀 테스트로 고정
  (`codex/airhub-audit-fixes`, 구현 63796f1, base fbfd3c70284f26ec21c34b0772dfe70af0d127f5)
- E9 광장(도쿄) 에어허브 게스트 하니스 검증·락 점검(report-only): E4·E6형 락 교착·
  중복 저장·잔존 상태 없음과 dev guest 저장 스킵을 확인하고, 광장 직행 spawn 부재·
  EMEA/APAC 왕복 비대칭·실패 재시도 카피 공백을 보고
  (`codex/airhub-guest-lock-audit`, 구현 ff0d34c,
  base 49e6699764febdcd1132c4644389f65e91ed6705, #150 5053883288)
- D5 잠금 지구 경계 표지판: 개방↔잠금 경계의 개방 쪽 도로·보행 타일에 8타일 이격
  무문자 빗장 팻말 1,120개를 결정 배치하고 district 7도시에서만 베이크·소비
  (`codex/district-boundary-signs`, 구현 0d01f1b, base e330283ecb435b7bf5bad51aab35f57258b20a1f,
  #150 5049669206·5053883288)
- V1 시각 대비 라운드: 밝은 보행 지형의 guidebook 잠금 점묘·빗금과
  mainRoute 포장의 저녁·야간 틴트 대비를 상향하고 미정의 도시 렌더 불변 계약을 유지
  (`codex/visual-contrast-round`, 구현 bc8408a, base e330283ecb435b7bf5bad51aab35f57258b20a1f)
- W1 지구제 7도시 라이브 시각 감사(report-only): 개방↔잠금 경계의 guidebook 종이 톤과
  4.2초 soft-wall 안내를 도시별 2장씩 실측하고 14개 JPEG·관찰 노트를 정본화
  (`codex/districts-live-audit`, 구현 9c9e330, base 31b0d68eaf03b7a8a44ee502c66c7cb6800db953,
  #150 5051753765)
- E7 dev guest 교통 저장 스킵 일반화: 에어허브·횡단열차·지역 페리의 위치 저장을
  공항 출구와 같은 무API 성공 경로로 통일하고 로그인 사용자 exact POST 계약은 유지
  (`codex/guest-transit-save-skip`, 구현 6cdf675, base d3d69f07c0d1be0046fc3533cb61c684fa9b1903,
  #150 5049638103·5051753765)
- E8 횡단열차 회랑 CSM-1~3 수정: 지역 이탈 락 분리·탑승 선저장 재진입 가드·
  11.7초 정차 경계 이후에도 같은 중간역으로 명시적 하차 재시도와 상태 정합을 보장
  (`codex/corridor-statemachine-fix`, 구현 213e877, base 2492a19217cdebb7f7e9d69ea2bff780aef310ed,
  #150 5050141148)
- E6 횡단열차 회랑 상태머신 점검: 지역 이탈 공용 락 교착·탑승 선저장 재진입·
  중간역 하차 실패 재시도 창을 재현하고, 게스트 spawn 미지원과 오버레이 비잔존을 report-only로 감사
  (`codex/corridor-statemachine-audit`, base 8cce1bd1387e0b05ab29215a547d7730e2b9327c,
  #150 5049590405)
- D1 여행책 지구 게이팅 엔진: `district-v1` rect union fail-closed resolve·4.2초 1회 soft wall·
  저채도 guidebook 잠금 렌더와 TRANSIT/스폰/EXIT/도어/NPC/발견 정합 게이트를 구현하고,
  리옹 예비 rect 8개·주동선 509타일 및 미정의 25도시 render/movement 불변을 고정
  (`codex/guidebook-district-engine`, 구현 f433720, base bcc0796bd4de957cc5f98f9e1458a557edd463d9,
  #150 5049638103·5049669206·5049709411)
- E5 주동선 발견 이벤트: 리옹 정본 8건을 waypointOffsets 기반 exact 타일로 해석하고,
  미발견 2프레임 무문자 스파클·도보 진입 1회 4.2초 GBC 말풍선·localStorage 왕복을 구현
  (`codex/route-discovery`, base cf8c32d4964ab186d07e5658b40494abf15d2e2c,
  #150 5047588502)
- E4(P1) 지역 오버월드 도시 진입 락 분리: cityPrompt 입력 락과 enterCity 재진입 가드를
  분리하고 페리·회랑·지역 철도·항공의 동일 비대칭도 전용 전환 락으로 복구
  (`codex/region-city-entry-lock-fix`, base c0b87b356c5c4b1d4c15cd95edbeafa288e4ab9f,
  #150 5047568734)
- E1·E2 공항 스토리 상태머신 정리: 씬 이탈 상태 전량 초기화·심사 저장 실패 retry와
  dev guest 저장 skip/전환 보장 (`codex/airport-story-state-fix`, PR #400,
  base 32e2b4d55cfd9c6f76071b7487e633e66d15aa7d, #150 5046785242)
- E3 스토리 2회차 선택형 스킵 RFC: 기존 사용자 스코프 독해 완주 이력 기반으로
  dialogue만 선택 생략하고 심사·저장·출구 게이트는 유지하는 fail-safe 전이 제안(#150 5047276121)
- 레벨 디자인 v3 리옹 경로 위계 구현: 승인된 typed `mainRoute` 9열·URDL/RLE/pathSha pin,
  웜 그레이 포장 오버레이·이정표/가로등 결정 배치와 기존 25도시 렌더 불변 계약 구현
  (`codex/route-hierarchy-impl`, base b09b79ed4f1a30927f7783972f21a4c44e379efe)
- 레벨 디자인 v3 리옹 파일럿 경로 위계 RFC: typed `mainRoute` waypoint 9개·비EXIT
  URDL BFS/RLE·미정의 도시 렌더 불변·포장/프롭 소비 경계를 report-only로 제안하고 승인 대기
  (`codex/route-hierarchy-rfc`, base 5ffd30c7f5f82e499f47a65759d2000394dadf49)
- 게임성 전체 점검 성능·체감 감사: 26도시 메모리 전수표에서 도쿄·코트다쥐르 24 MiB
  위반을 확인하고, cold geo·warm 진입 29표본으로 eager geo 파싱/RLE decode 병목과 개선안을
  `docs/audit-performance.md`에 report-only로 정리
  (`codex/audit-performance`, base 0cd3ca25cd623894fdd9f2334fe7c36e64cddc6d)
- 스트라스부르 EMEA 오버월드 게이트: 스트라스부르역 실좌표 투영 `[296,430]`으로
  `strasbourg` 노드를 등록하고 EXIT 왕복·기존 EMEA 노드/철도 허브 비침범 계약 구현
  (`codex/strasbourg-overworld-gate`, base 7771fcc9aefbed17560dbce9a860ea8ea3b656e3)
- 보르도 EMEA 오버월드 게이트: 생장역 실좌표 투영 `[165,523]`으로
  `bordeaux` 노드를 등록하고 EXIT 왕복·기존 EMEA 노드/철도 허브 비침범 계약 구현
  (`codex/bordeaux-overworld-gate`, base cafa3ffb0a3890443317520069b63bf039ef6cde)
- 리옹 EMEA 오버월드 게이트: 파르디외역 실좌표 투영 `[251,500]`으로
  `lyon` 노드를 등록하고 EXIT 왕복·기존 EMEA 노드/철도 허브 비침범 계약 구현
  (`codex/lyon-overworld-gate`, base 40f03627ffa069fa90ad81f3ffa7f3518dcb0044)
- 스트라스부르 비콘텐츠 선행 수집: bbox `[7.70,48.55,7.81,48.63]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
  (`codex/strasbourg-snapshot`, base 28046177a5a635cc951beb05b9b7920f147237ad)
- 보르도 비콘텐츠 선행 수집: bbox `[-0.64,44.79,-0.52,44.88]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
  (`codex/bordeaux-snapshot`, base f5325c2af3df63a9639b603ea53dfb76fa6b1e66)
- 리옹 비콘텐츠 선행 수집: bbox `[4.79,45.71,4.90,45.80]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
  (`codex/lyon-snapshot`, base 3944ddb8196fe76de2ab999fcc4ae3d3f5921bd2)
- 아이디어 보드 ⑤ 도시 진입 브리핑 카드: 일본·한국 나라별 첫 도시 진입 시
  overview 요약 3줄·여행 폰 딥링크를 localStorage 영구 1회 계약으로 표시
  (`codex/city-entry-briefing`, base 630746c5ef4737af6359c54d7d64865ef8ac015c)
- 레만호 연안 EMEA 오버월드 게이트: 로잔역 실좌표 투영 `[279,481]`로
  `leman-riviera` 노드를 등록하고 EXIT 왕복·기존 노드/철도 허브 비침범 계약 구현
- 채널터널 연출: 런던↔파리를 `EMEA_RAIL_NETWORK` virtual service edge로 연결하고,
  양방향 260ms black fade·해저터널 상태 표시·물리 rail overlay 분리 계약을 구현
- R4B 애드온: `glacial` 수면 3프레임과 감천 BUILDING 전용 4색 파스텔
  `zoneSkins`를 결정 좌표 해시·포함 경계·전역/기본 폴백 계약으로 구현
- 몽생미셸 조수 visual-only 1단계: 745 game-min·epoch 420·8단계 결정 시계,
  source-informed `tideSafeCorridorMask` 해시 고정, 충돌·재배치 비활성 유지
- 레만호 연안(로잔~몽트뢰) 비콘텐츠 선행 수집: bbox `[6.60,46.40,6.95,46.54]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- EMEA 오버월드 일반 공개 릴리스: `releaseEligible` 다층 인터록을 릴리스 정합 계약으로
  전환하고, 경계 고지·관리자 preview·overworld 전체 회귀를 유지
- 제네바 EMEA 오버월드 게이트: 코르나뱅역 실좌표 투영으로 `geneva` 도시 노드를
  등록하고, EXIT 왕복·기존 EMEA 노드/철도 허브 상호작용 반경 회귀 계약 구현
- 제네바 비콘텐츠 선행 수집: bbox `[6.105,46.175,6.185,46.240]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 가와구치코 오버월드 게이트: 가와구치코역 실좌표 투영으로 신규 일본 도시 노드를
  등록하고, 기존 후지산 랜드마크 노드는 유지한 채 EXIT 왕복·상호작용 반경 회귀 계약 구현
- 후지 등산 액트 씬 골격: 자갈치 씬 구조를 미러한 4막 Phaser 씬
  (`fifth-station`→`mountain-hut-night`→`goraiko`→`ohachi-meguri`)과 액트 순서·경계 계약 테스트
- 가와구치코/후지 비콘텐츠 선행 수집: bbox `[138.725,35.395,138.85,35.55]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 마르세유 EMEA 오버월드 게이트: 생샤를역 투영·보행 도착 `[259,561]`과
  `returnNode: 'marseille'` EXIT 왕복·기존 EMEA 노드 상호작용 반경 회귀 계약 구현
- 렌더크래프트 R4 지역 색감 스킨: 건물 지붕 팔레트 5종과 에메랄드 수면 1종을
  `tileSkins` 계약·CityScene 베이킹·소비처에 일반화하고, `gachapon`·`arcade`
  서브컬처 프롭 2종을 무문자·무캐릭터·무브랜드 도트 실루엣으로 베이킹
  (도시별 배선·배치는 Claude 후속)
- 자갈치 액트 씬 골격: `msmAbbeyScene.js` 구조를 미러한 4막 Phaser 씬
  (`dawn-pier`→`auction-floor`→`hoe-alley`→`breakwater-lighthouse`)과 액트 순서·경계 계약 테스트
- 마르세유 비콘텐츠 선행 수집: bbox `[5.32,43.245,5.42,43.325]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 렌더크래프트 R2: CityScene에 신규 랜드마크 실루엣 kind 15종 베이킹
  (`ct_prop_<kind>`, 도트 2~3색·브랜드/문자/국기 무재현, 배치는 Claude R3)
- 멜버른 APAC 런타임 노드 게이트: 플린더스 스트리트역 확정 도착 `[1862,2442]`,
  offset `[0,0]`과 `returnNode: 'melbourne'`를 연결해 EXIT 왕복·상호작용 반경 회귀 계약 구현
- 캔버라 APAC 런타임 노드 게이트: 캔버라역/킹스턴 확정 도착 `[1954,2380]`,
  offset `[0,0]`과 예약 `returnNode: 'canberra'`를 연결해 EXIT 왕복·상호작용 반경 회귀 계약 구현
- 멜버른 비콘텐츠 선행 수집: bbox `[144.90,-37.88,145.01,-37.78]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 브리즈번·시드니 APAC 런타임 노드 게이트: 확정 도착 `[2039,2186]`·`[1999,2345]`와
  예약 `returnNode`를 연결해 EXIT 왕복·상호작용 반경 회귀 계약 구현
- 브리즈번 APAC 센트럴역 입구 게이트 후보: 투영·도착 `[2039,2186]`, offset `[0,0]`
  체크인 보행성·기존 월드/수송 노드 상호작용 반경 비침범 검증(런타임 노드 제외)
- 캔버라 비콘텐츠 선행 수집: bbox `[149.06,-35.33,149.18,-35.24]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 시드니 비콘텐츠 선행 수집: bbox `[151.17,-33.93,151.31,-33.79]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 브리즈번 비콘텐츠 선행 수집: bbox `[152.98,-27.52,153.09,-27.42]`,
  4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 베이징 APAC 런타임 노드 게이트: 후보 확정 도착 `[1236,521]`, offset `[0,0]`
  과 예약 `returnNode: 'beijing'`를 연결해 EXIT 왕복·상호작용 반경 회귀 계약 구현
- 베이징 APAC 전문역 입구 게이트 후보: 투영·도착 `[1236,521]`, offset `[0,0]`
  체크인 보행성·기존 월드/수송 노드 상호작용 반경 비침범 검증(런타임 노드 제외)
- 상하이 APAC 런타임 노드 게이트: #201 확정 도착 `[1347,736]`, offset `[0,0]`
  과 예약 `returnNode: 'shanghai'`를 연결해 EXIT 왕복·상호작용 반경 회귀 계약 구현
- 상하이 APAC 인민광장 게이트 후보: 투영·도착 `[1347,736]`, offset `[0,0]`
  체크인 보행성·기존 월드/수송 노드 상호작용 반경 비침범 검증(런타임 노드 제외)
- 베이징 비콘텐츠 선행 수집: 4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 런던 EMEA 세인트판크라스 노드 게이트: 확정 도착 `[172,356]`, `returnNode: 'london'`
  왕복·철도 허브 충돌 회피·체크인 회귀 계약
- 상하이 비콘텐츠 선행 수집: 4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 홍콩·타이베이 APAC 노드 게이트 + 브뤼셀 미디 EMEA 게이트: 예약 `returnNode`와
  확정 도착 타일로 EXIT 왕복·충돌·회귀 계약 구현
- 홍콩 비콘텐츠 선행 수집: 4×4 Overpass 48/48 + 20m 스냅샷 결정성 계약(POI·역·콘텐츠 제외)
- 타이베이 비콘텐츠 선행 수집: 4×4 Overpass 48/48 + 중국어권 스냅샷 결정성 계약
- 코트다쥐르 오버월드 게이트: EMEA 니스 노드 + 도시 EXIT 왕복 계약 (#164 후속 최종 브랜치)
- 몽생미셸 노르망디 게이트+수도원 씬+라 카제른 (#155 merge)
- 부산·서울 교량 3분류·수계 (#151·#153 merge)

## Codex-2 (codex2/*)
### doing
### todo
### done (최근)
- 🛠️ `src/views` 리뷰 후속 V-05~V-13: 저장 성공 확인·재시도, query 오류 상태,
  PDF URL/분석 실패 복구, 마운트 후 localStorage 복원, KST 일간 경계를 구현하고
  전 뷰 await mutation error 보강 감사까지 완료(targeted 28·전체 268파일/2,554테스트 green,
  diff SHA `5f8322d8…6bfe`, peak RSS 3,454,058,496B·swap 0,
  `codex2/fix-views-review-findings`, 구현 `a633c37`, base `dc6659ef5197c67d5a9308c2625afcd82efa5ae6`)
- 🔍 전체 코드 리뷰 R1 — `src/views` 실제 46파일·18,951줄 전수 정독(스캔 0),
  치명 3·중대 10·경미 3건을 `docs/review-code-views.md`에 원문 인용·수정안과 함께 보고
  (코드 수정 없음, targeted 21·전체 2,532 tests green, base `8e7e41778f338c0ed8a5d6744dedd011fb409a74`)
- 📚 대사 IPA 커버리지 린트(report-only): 4트랙 grammar의 화자 객체 469개를
  객체 단위로 스캔해 IPA 누락 176개를 파일별 라인으로 보고하고 단일행·다행 픽스처를 고정
  (`codex2/lint-dialogue-ipa`, 구현 e9694d4, base 1c3a03f5d9b9175ef300e4c4d8d8199504e9677b)
- P2 리옹 시각 엔진 선행: `groundStyle: 'variant-v1'` opt-in 지구별 PLAZA 지면 3종과
  범용 props 4종(야간 점등 가로등 포함)을 등록하고, 미설정 25도시 base=A=B 렌더 불변·
  리옹 전후 crop 4장·전체 235/2,282 green을 검증
  (`codex2/p2-lyon-visual-engine`, 구현 0d8e850·전수 게이트 5a67290, #531 근거)
- Q3 리옹 타일 정정 no-op hook: 공용 순수 `applyTileFixes()`·manifest v1을 마지막
  mutating 후처리와 final meta/RLE 사이에 연결하고, hook 전후 A/B geo SHA
  `0bb8a0a…36d2`·공식 verifier·전체 233/2,259 green과 산출 byte 불변을 검증
  (`codex2/q3-lyon-fix-hook`, 구현 77b4e6f, base d0784d4490af7311666a03ead5d9b82f64c22e69)
- T20 V3 도로 오토타일 전면 확산: T17 잔여 23도시 wrapper를 opt-in해 26도시
  전부 `autotile-v1`로 고정하고, 전 도시 PNG A/B byte-identical·BRIDGE 상위 3도시
  실제 16px 근접 crop 6장·전체 227/2,238 green을 검증
  (`codex2/autotile-expansion`, 구현 1180885, base 73499f7f3cff595e9ed420df1c54110a3410a928)
- T19 잔여 도시 지구 확산: T10 r3 PASS 13도시에 `district-v1` 51지구·71 rect를
  정본화하고 TRANSIT·스폰·EXIT·도어·NPC·발견·mainRoute 전수 정합과 미정의 2도시를 고정
  (`codex2/districts-expansion`, 구현 3ee99da, base cf8342e51c80184559e23bd6ac048b1f7b7b40dd)
- T8 NPC·도어 후보 스팟 실측(report-only): 빈 역 NPC 병합 뒤 나머지 24개 지구별
  NPC 3곳·도어 2곳을 보행성·앵커 근접·기존 마커/후보 상호 ≥3타일·건물 4방향 인접 계약으로
  결정 제안하고 2회 byte-identical SHA와 전체 212/2,141 green을 고정
  (`codex2/npc-door-spots`, 구현 bfe6fad, base e330283ecb435b7bf5bad51aab35f57258b20a1f,
  #150 5053450849·5053772988)
- T7 개방 지구 콘텐츠 갭 실측(report-only): 7도시 26개 개방 지구의 도어·NPC·발견·
  POI·TRANSIT 실제 도착과 고유 앵커/km²를 결정적으로 측정하고 빈 역 지구 2곳·
  저밀도 광역 지구 5곳 중심의 채움 순서를 제안
  (`codex2/district-content-gaps`, base d3d69f07c0d1be0046fc3533cb61c684fa9b1903,
  #150 5051753765)
- T6 미니맵 factor 복귀 구현: 도쿄 1→2·코트다쥐르 2→3 city-aware 정책과
  24MiB 계약식·런타임 하한 회귀를 추가하고 240 CSS px 라벨 무충돌을 실화면 확인
  (`codex2/minimap-factor-restore`, base 2492a19217cdebb7f7e9d69ea2bff780aef310ed,
  #150 5050141148)
- verifier R6 report-only 제안: 제네바·레만 연안·브뤼셀·런던의 buildingPct exact,
  수면 best-of-5 단면·BRIDGE 잔존을 재실측하고 보수적 후보 band·하한을 문서화
  (`codex2/verifier-r6-proposal`, base bcc0796bd4de957cc5f98f9e1458a557edd463d9,
  #150 5049590586)
- mainRoute v3 확산 후보: 보르도·스트라스부르 typed waypoint 본선과 전 마커 URDL BFS
  도달성 행렬·leg/전체 path SHA를 report-only로 고정하고 Pont de Pierre outlier를 분리 제안
- verifier R5 report-only 제안: 그랑파리·마르세유·코트다쥐르의 buildingPct exact와
  riverSections ±2 단면·BRIDGE 0을 재실측하고 보수적 band·sum/run 하한 후보를 문서화
- 미니맵 factor 복귀 A/B: 도쿄 1→2·코트다쥐르 2→3의 동일 252×252타일 크롭을
  504px PNG 4장으로 비교하고, backing·지형 전환·2회 byte-identical SHA를 report-only로 고정
- 도쿄 메모리 긴급 감사: 도쿄 40.11 MiB의 76.6%가 final canvas backing이며 불연속 factor가
  지배 원인임을 분해하고, 도쿄 factor 2·코트다쥐르 factor 3 복귀안과 mainRoute verifier 계약 제안
- 콘텐츠 밀도 감사: 26도시 POI·학습 도어·TRANSIT·transitPoints·props·NPC·desc·
  스탬프 계약을 결정적 전수 실측하고 면적 대비 불균형·회복 우선순위를 문서화(구현 없음)
- 밴드 R4 하드닝: #150 승인 5044061378에 따라 리옹 `[13,17]`·보르도 `[12,16]`·
  스트라스부르 `[10.5,14]` buildingPct hard gate 전환(green null 유지)
- 밴드 R4 report-only 제안: 정본 buildingPct 리옹 14.6% → `[13,17]`, 보르도
  13.8% → `[12,16]`, 스트라스부르 12.2% → `[10.5,14]`(green null 유지·승인 전 verifier 무수정)
- 스트라스부르 geo 본생성: POI 7·표시 전용 역 1·일강 그랑딜 섬 수계·결정성
  계약 구현, official verifier #365 독립 검수 후 #363 merge
- 보르도 geo 본생성: POI 9·표시 전용 역 1·가론강 초승달 곡류·피에르 다리·결정성
  계약 구현, official verifier #360 독립 검수 후 #358 merge
- 리옹 geo 본생성: POI 9·역 2·론/손 합류·프레스킬 단일 4방 성분·결정성
  계약 구현, official verifier #353 독립 검수 후 #352 merge
- 밴드 R3: Claude 승인(#150 코멘트 5042496936)에 따라 레만호 building `[2.0,3.5]`
  hard gate를 반영하고, 레만호·몽생미셸·가와구치코 특수형 green report-only 계약 유지
- 런던 타워브리지 수면 폭 감사: 원본 240~300m 정상, 교량데크 ROAD 흡수와
  교차한 구 verifier 단면 오탐 확정·#192 종결(CODEX_DONE 5003344796)
- 코트다쥐르 geo: 공식 verifier·targeted green 재확인, #158 merge
  (`6e3184d`, CODEX_DONE 4995615623)
- 레만호 연안 geo SPEC_FIX_2: st-saphorin 코르니슈 전망 좌표 교정·결정성·
  공식 verifier·전체 회귀 green, CODEX_DONE 후 #304 merge (`92b4b33`)
- 그랑파리 geo+교량 3분류 (#157 merge), frenchCityRuntimeAdapter(스코프 클린 확인)

## Codex-3 (codex3/*) — 게임 시스템 확장 (타 기기)
### doing
### todo
- 📚 /learn 진도·스트릭 위젯(발주 5126671497) → **구현 #706 도착·Claude 게이트 green(lint 2종+vitest 2508) — 오너 승인 대기(draft 유지)** ← 피벗 후 우선, 아래 월드 항목 동결
- (P0 공통) 로컬 clone 이전 확인 코멘트
- S1 STAMP_ALBUM_NODES 85 원자 전환(선행 #387 충족 — 즉시 착수): #150 5046785938
- S4 수집 연출 정합 → S2 앨범 지역 탭·수집률 → S3 마일스톤 보상 v1(localStorage·DB 금지)
### done (최근)
- 🛡️ 리뷰 R1 후속 수리(발주 5194144381): SW cache version을 배포 콘텐츠 SHA로
  결정화하고 실패/redirect navigation 캐시를 차단했으며, curriculum drill scanner를
  fail-closed+mutation 회귀로 고정하고 check-content가 expansion·scene 배열 모듈을 자동 발견.
  Vercel 실측 Node 20.x와 Node 22 world PNG 2회 동일 SHA는 report-only로 기록
  (`codex3/harden-sw-content-gates-v2`, 구현 `7d9ef85189bd1eea58c5fd619d4d0c96e360aef5`,
  최신 replay base `dc6659ef5197c67d5a9308c2625afcd82efa5ae6`·최초 착수 base
  `f40039ec3b9e44222fc5b73e460a74d76d04162e`)
- 🔍 전체 코드 리뷰 R1 — scripts·설정·테스트 영역(report-only): 고정 base
  `8e7e41778f338c0ed8a5d6744dedd011fb409a74`에서 게이트 8파일·설정·service worker·
  의존성·테스트 258파일을 감사해 치명 2·중대 12·경미 2와 미커버 핵심 경로 상위 5를 문서화
  (`codex3/review-code-scripts-config-tests`, `docs/review-code-scripts-config-tests.md`)
- 📚 드릴→SRS 연결(v2 통합): ChapterDrills 정오답을 drill id 단위 append-only
  review_events + 기존 grammar_review FSRS 행으로 연결(정답 Good·오답 Again), 멱등 upsert와
  게스트 localStorage·기존 문법 복습 화면 역해석을 회귀 고정
  (`codex3/drill-srs-bridge`, draft #750, 구현 4fad9c3, base 01c303692f0c99562d2eac15db1c8b6501d31618)
- `/learn` 진도·스트릭 위젯: 기존 게스트 localStorage 진도·활동 정본을 재사용해
  레벨별 방문/완료 수와 연속 학습일·첫 방문 빈 상태를 표면화하고 전체
  258파일/2,508테스트 green을 고정 (`codex3/learn-progress-widget`, 구현 4686d8e,
  base 3e5ce2909d8716da6861f67a028d3c51711191bd, draft·오너 승인 게이트)
- S24 도어 track 전달 결함 수선: explicit track을 CityScene bridge부터 WorldPage까지 보존하고,
  unknown/prototype track을 경고 후 fail-closed하며 가상 en·기존 fr-01~26 URL 회귀를 고정
  (`codex3/s24-track-bridge-fix`, 구현 268f72f,
  base cf882168ef883d1050133bc1e4d1cc219d0eeadd, #150 5059591803)
- S23 한국 도시 채움 시스템 제약 조사(report-only): 서울 23·부산 14노드의 track/chapter/NPC
  0건, helper 4트랙과 Korean 부재, UI bridge의 track 소실, 불어 NPC 11종 필드 재사용,
  인천공항 일본어 시작점·영어 36개 미사용 chapter를 규명 (`codex3/s23-korea-fill-constraints`)
- S22 도시 진입 착지점 26도시 전수 검증(report-only): 도시 게이트 26 exact-1,
  55노선·180 stop 참조·157 고유 착지의 저작/실제 타일 open·보행을 재현하고
  정적 게이트 포섭과 동적 session/dev spawn 별도 fail-closed 경계를 규명
  (`codex3/s22-entrypoints-audit`, 구현 56ae0a7, base 009337219c940b0838950e8de409a952bbc800a1)
- S19 localStorage 스키마 정본화: 월드 실사용 고정 키 7종·동적 prefix 3종을 v1 정본에
  모으고, 버전 미존재를 v1로 무손실 취급하는 `storage-schema-version`과 no-op migration
  registry를 도입해 기존 깨진 JSON·유령 ID·차단 저장소 계약을 유지
  (`codex3/s19-storage-schema`, 구현 c8a1cd3, base 99925fac302427d8978babfdd63dae3df7c4e8d6)
- S18 지구제 24도시 팻말·표면 정합 감사(report-only): 팻말 4,211개의 실제 open 경계 인접과
  신규 13도시 soft wall·미니맵 잠금 베이크·수첩 라벨 13/13을 재현해 불일치 0건을 확정
  (`codex3/s18-district-signs-audit`, 구현 17edd36, base 73499f7f3cff595e9ed420df1c54110a3410a928)
- S16 NPC 만남 분모 동적 포섭: 정적 3도시 목록을 제거하고 로드된 도시의 전용 `kind:'npc'`
  후보를 스캔해 도쿄·오사카 채움 NPC 4종의 `만난 사람 0/2` 노출과 향후 자동 포섭을 회귀 고정
  (`codex3/s16-npc-met-dynamic`)
- S14 수첩 지구 표기 동적 판정: 정적 7도시 집합을 제거하고 로드된 도시의 `districts`
  정의로 상세를 열어 일본 4도시를 포함한 11도시 라벨·A2 칭호 폴백을 회귀 고정
  (`codex3/album-districts-dynamic`, 구현 89e47cf, base f571a8814ffd9c43159c3cf330c01b4106d83f94)
- S13 역 NPC 스탬프 연결: 리옹·보르도·스트라스부르 noStamp NPC 5종의 대화 완주를
  `npc-met:<cityId>`에 기록하고 여행 수첩 `만난 사람 n/m`·S7 다음 목표 후보로 연결
  (`codex3/gare-npc-stamp-fix`, 구현 c351a98, base 163ba9345419100385012ec20704e2db4943e530)
- S11 dev 게스트 스탬프 로컬 폴백(W2-R2-03): devGuest 수집 상태를 `guest-stamps`
  localStorage 정본 교집합으로 저장·로드하고 앨범·도감·마일스톤 소비와 깨진 JSON·유령 ID
  견고성을 유지 (`codex3/guest-stamp-local`, 구현 d56ce41, base d192161e13255aa3e10c38bd6615e9be6ca82c34)
- S10 W2-R2-01: S7 다음 목표 선택에서 완료 분모 없는 정적 지구 개방 수를 제외하고
  발견·칭호의 실제 잔여량만 비교하도록 감사 7도시 재현을 회귀 고정
  (`codex3/s7-remaining-goal-fix`, 구현 111fbc7, final base 407b32cda5e517c908a86c4d9ac0b88c430e7584)
- S9 발견 완집 보상: 리옹 8/8·보르도 8/8·스트라스부르 7/7 정본 ID 교집합 완주 시
  localStorage 칭호 키·펫 사료를 도시별 1회 지급하고 기존 4.2초 GBC 칭호 토스트로 연결
  (`codex3/discovery-milestone`, 구현 b3e7dda, base a8ff50d992b399137bf978acc7545f8e5235f2eb)
- S7 진척 표면 정리: 여행 수첩 도시 상세의 지구·발견·칭호 후보를 남은 개수·고정 동률
  우선순위로 1줄 통합하고 기존 개별 표기와 XOR 처리
  (`codex3/next-goal-line`, 구현 614426f, base fbf448c15d38247b9a7aef862a87d7ca3ce80edf)
- S6 여행 수첩 발견 수집률: 주동선 발견이 있는 리옹·보르도·스트라스부르 카드에
  `route-discoveries:<cityId>`의 정본 교집합을 `발견 n/m`으로 표시하고 깨진 JSON·미지 ID를 무시
  (`codex3/album-discovery-progress`, 구현 cc0277d, base 64a9292369e95f426a6a09fc70effa4a003e136b)
- S5 칭호 표시 배선: 여행 수첩 획득 칭호·다음 목표 1줄과 달성 순간 4.2초 토스트
  (#150 SPEC 5049537006, allowlist 5049669206, base `51bfcf062d76fb470a6ae21a3ae50f15b65aa38a`)
- S3 마일스톤 보상 v1(#150 코멘트 5046785938): 10/30/60/85 수집에 펫 사료와
  카피 없는 `worldTitles` 키 4개를 localStorage로 중복 없이 지급
- S2 앨범 UI 확장(#150 코멘트 5046785938): 전국맵·아시아태평양·유럽/지중해/중동
  85개 무중복 탭과 탭별 수집률·미수집 실루엣을 기존 GBC 문법으로 구현
- S4 수집 연출 정합(#150 코멘트 5046785938): 지역 오버월드·도시 씬의 5.2초 factLine과
  `quest:scored`/`quest:done` 하트 피드백을 공통 타이밍 계약으로 회귀 고정
- 스탬프 우주 확장 구현(#150 코멘트 5045825484): `STAMP_ALBUM_NODES` 85개 정본·소비처 3곳·
  지역 `noStamp` 해제·팩트 85/85·기존 66개 저장 호환 계약
- 스탬프 우주 확장 RFC(발주 #150 코멘트 참조): REGIONAL_WORLD_NODES 19도시 앨범 편입 계약
  설계 — StampAlbum 소비 집합·noStamp 재정의·지식 카드(factLine) 커버리지 연계. RFC → 승인 → 구현
- S8 수첩 표면 모바일 정리: 앨범 지역 탭은 터치 가로 스크롤로 고정하고 배지·지구 칩·
  발견/다음 목표·칭호 표기의 min-content 축소와 줄바꿈을 1180px 미만·375px 계약으로 회귀 고정
  (`codex3/album-mobile-polish`, 구현 adb8a03, base fbf448c15d38247b9a7aef862a87d7ca3ce80edf)

## Codex-4 (codex4/*) — 성능·인프라 (타 기기)
### doing
### todo
- 🏁 /learn 콘텐츠 lazy-load 완결(발주 5126671583): RFC #707 → 구현 #709 merge — grammar 그래프 gzip 2,787,044→61,894B(-97.78%)·/learn 초기 회귀 0·comparator 계약 테스트·배선 diff 0 ← 아래 월드 항목 동결
- P0 (운영 필수·최우선) 로컬 clone 이전 + 확인 코멘트: #150 5046786117
- P1 geo lazy-load 구현(RFC #394 승인 — 실패 UX·?spawn= 정합·scene race 주의 3건 코멘트 참조)
### done (최근)
- M2 교재 경쟁력 연습 형식 +2종: 기존 어휘 4개를 쌍별 채점하는 단어↔뜻 매칭과
  기존 예문 자동 토큰 어순 배열을 공통 엔진에 추가하고, StudySession 형식 로테이션·
  F2 `recordReviewCompleted` 쌍별 SRS·게스트 폴백을 회귀 고정
  (`codex4/m2-exercise-types`, 구현 931890a, base 933ac1e)
- F4-3 후속 연습 엔진 배선: `ExerciseEnginePrototype`를 `StudySessionPage` 문법
  choice/order 흐름에 연결하고 첫 시도 기록을 F2 `recordReviewCompleted`로 통일하면서
  기존 exact 채점·오답 재출제·챕터 진도와 게스트 무원격 폴백 회귀를 고정
  (`codex4/exercise-wire`, 구현 7b9c036, base 8d94dab)
- F4-3 선행 연습 엔진 조사·프로토: 5개 소비·채점·SRS 경로와 F2 연결을 전수 감사해
  E3 66문항의 현행 직결 불가를 판정하고, 기존 페이지 무수정·미배선
  `short-answer→fill`/choice 공통 컴포넌트와 fail-closed 계약 테스트를 추가
  (`codex4/exercise-engine`, 구현 4c59d5b, base 0cd0cae)
- E4 콘텐츠 스키마 계약 가드: 4트랙 문법·어휘 raw 모듈의 실제 필드·shell 차이를
  전수 문서화하고, 초안 제외·본문/예문·모듈당 3어 하한을 공통 계약 테스트로 고정
  (`codex4/e4-content-schema-guard`, 구현 f7b1874, base 1cfda63)
- Q6 전 유형 정정 사전공사: A′·B′·C′·D′·F·H′ 규칙·보호 타일/보행 articulation
  fail-closed skip과 리옹 1,001-fix 통합 draft를 만들고, skip 제외 전 유형 0·격리 geo/scan
  A/B 결정성·기대값 자동 갱신·전체 235/2,286 green을 고정
  (`codex4/q6-all-rules`, 구현 09fb474, base b13141d7e369e3d3017f4e6d1da516c1168253d6)
- Q4 정정 manifest 생성기 + 리옹 B′ 파일럿 초안: r2 JSON canonical 검증·8방 최빈
  비CROSSWALK 보행류 치환(동률 SIDEWALK)으로 28성분/30타일 manifest를 만들고,
  임시 재생성 B′ 28→0·대표 crop 5쌍·geo/scan/PNG A/B 결정성을 고정
  (`codex4/q4-fix-manifest-pilot`, 구현 11ae028, base cf882168ef883d1050133bc1e4d1cc219d0eeadd)
- P9 오토타일 mask 중복 계산 제거: texture key당 cardinal mask를 1회로 줄여 도쿄
  `tileCode` 증가를 일반 +71.98→+22.84%·잠금 +72.55→+20.33%로 축소하고,
  26도시 PNG·snapshot byte 불변과 전체 230/2,248 green 고정
  (`codex4/p9-autotile-mask-cache`, 구현 8cee8b9, base cd92eb40407971f46349b3d84d73c82dad55799d)
- P10 렌더 성능 결정 지표 가드: 도쿄 일반·완전 잠금 128청크의 `tileCode` probe와
  미니맵 downsample·잠금 overlay 호출/할당을 main 실측 약 1.5배의 결정적 상한으로 고정하고,
  기존 26도시 render-key SHA snapshot을 재사용해 중복 결정성 스모크를 생략
  (`codex4/p10-perf-guard`, 구현 4f768bf, base 9d19d75fce0d476f350bf092d8410541bc499495)
- P7 초기 번들 Supabase+FSRS 분리: 공용 65,039 B gzip 청크를 기능 경계로 지연해
  대표 초기 route 65.1~65.5 kB gzip 절감·초기 manifest 교집합 0·학습 흐름 회귀 green
  (`codex4/p7-vendor-split`)
- P3 도쿄 로더 레이어: cityGeo packed-RLE로 lazy load heap 77.89% 절감·오버월드
  무제한 중복 Map 제거로 32-entry LRU 상한 복구(`codex4/tokyo-loader-tuning`)
- P2 .owc 프리페치 벤치: APAC·EMEA 각 3경로에서 현행 vs 반경+1의 지연·동시 요청·RSS를
  report-only 비교하고 blanket 반경+1 보류·방향성/concurrency 2 후속 게이트를 제안
  (`codex4/owc-prefetch-bench`, base `49e6699764febdcd1132c4644389f65e91ed6705`)
- P2 .owc 프리페치 벤치(report-only) → P3 도쿄 로더 레이어(파일 경계: Codex-2 T1과 분리)
- P1 geo lazy-load 구현: 일반 부팅 0도시·저장/`?spawn=` 1도시 선로드·진입 race/재시도·
  전체맵/PNG CLI 선택 로드와 전수 테스트 이관 완료(`codex4/geo-lazyload-impl`)
- geo lazy-load RFC(발주 #150 코멘트 참조): 경량 manifest·도시별 literal dynamic import·
  저장 도시 1개 선로드·전체맵 선택 로드·전수 검증/롤백 계약 제안 — 승인 전 구현 금지

## Claude (claude/*)
### doing
- **🔄 피벗(2026-07-24, #150 5061033330): 교재 주력·월드 동결** — 월드 신규 발주 금지
  (버그 수리만). 이하 월드 항목들은 동결 시점 기록으로 보존.
- **📚 교재 체제 현황(피벗 후 1일차 완주)**: Foundation F0~F5 전량(#540~560) → F4 콘텐츠
  4트랙 격차 해소(#549·552·556·557) → 장면 라운드 C1(#569)·C2(#573)·C3 발음(#575) →
  커버리지 35%→75%+발음 마감(#574). 정본화 표준 = index spread·검증 3종. **대기 = 오너
  검사 2건**(F0 문안 docs/product-definition.md · 코스 지도 /learn/course)
- **📚 실전 샌드위치 라인(2026-07-24 오후)**: RFC #582(레슨 스키마 v2·실자료 소스 전략) →
  카드 모델 G1-A(#584) → 프랑스어 전수 평가(#583) → 발음 3챕터 재작성(#586) → **파일럿
  2레슨 merge(#587: Café 주문 Je voudrais·약국 Il faut — 표시 전용, 오너 라이브 검사 대기)**.
  다음 = 검사 결과 따라 확산 여부(owner-gate)·실음원(Tatoeba/CC) 연결
- **🚨 #582 회귀 사고 복구 완료**: 구식 트리 squash가 #581 복원분 4,797줄 재삭제(add -A 삼킴
  2회째) → #588 원상복구(scene 정본 4트랙·auditL1·StudySessionPage) + 중국어 발음 2챕터
  표본 검수→치명 오류 직접 교정 재등록(#589). 재발 방지 = vault 커밋 전면 금지·merge 전
  `gh pr diff --stat` 확인(#150 코멘트 5067904181)
- **📋 4트랙 전수 감사 완비(2026-07-24 저녁, 전 트랙 종합 D)**: 프랑스어 #583 → 중국어 #594 →
  일본어 #597 → 영어 #599 (codex 3세션 병렬 발주·게이트). 공통 병인 = 위임 저작의 '경향→절대
  규칙' 고착 + 발음 전사 오류. **치명 수리 완료**: fr 발음 #586·noix #591 / zh 了·被 #596·확정
  병음 48건 #598 / ja 모라 #600 / en 발음·shellfish #601. 부수: 해요체 fr 정리 #593(게이트 교정
  24건), 선택 리에종 R2 #595, IPA 정책 RFC #592. **잔여** = ja 경어 5분류 재구성(JA-C02, 마지막
  치명) → 트랙별 Important 단정 완화 → 해요체 ja 97·en 100·zh 10 → 구조 라운드(IPA R3·R4,
  화자명 필드, 커리큘럼 재배치, slug 이행 설계) → zh 연서 2,564·pos 181. IP 재현 지적(ja)은
  오너 승인 설계 확인 — owner-gate 유지
- **🏁 감사 후속 소화 라운드(2026-07-24 밤) 완결**: JA-C02 경어 5분류 재구성 #603 →
  Important 문법 단정 완화 4트랙 31건(#604 zh6·#605 en9·#606 fr5·#607 ja11) →
  IPA R3 완결(#608 장면 37·#610 A레벨 42 — #583 지목 79/79) → 해요체 4트랙 전체
  통일(#593 fr·#609 ja/en/zh 187개소 — 위임 2회 실패 후 Claude 직접, 인용 보존).
  **감사의 언어·문법·문체 계열 전량 종결.** 잔여 = 구조·데이터: ja 품사 표제 10곳 ·
  EN I10 구절 IPA·I12 draft slug(이행 설계) · 화자명 필드 · 커리큘럼 재배치 ·
  zh 연서 2,564·pos 181 · IPA R3 3차(B1~C2 272, 소급 범위 재확인)
- **📊 재평가 R2·대량 이행 라운드(2026-07-24 밤) 완결**: 재평가 4/4(#613~615·618 —
  en·zh·ja D→C, fr D 유지 원인 즉시 수리 #617) + 신규 지적 당일 소화(#616·619, zh 정치
  프레이밍·브랜드 6건 #617 포함). 정책 RFC 2건(#620) → **병음 연서 4,999(#621)·예문
  해요체 4배치 3,757(#622~625)·pos 178(#626) 전량 이행**. 잔여 = 구조 설계 3건(커리큘럼
  선행·화자명 필드·slug/draft 이행 — 각 RFC 필요)·B1~C2 IPA 272 범위 결정·owner-gate
  2건(파일럿 라이브 검사→확산 트리거·브랜드/작품 예외 정책)
- **🏁 오너 결정 2건 반영·샌드위치 시험 적용 완결(2026-07-25)**: ① R3 재평가 4/4(#638~641 —
  **zh B 진입·fr C 확정**, ja·en C 유지) ② 브랜드 정책 v1 '최대한 활용'(#642 — 등재제·zh 4건
  복원) ③ **샌드위치 fr A1~A2 완결**(#643~648 — A1 장면 8 전환+A2 신규 2 저작, 12레슨 5단
  구조·선행·고정구·SRS 데이터) ④ en 장면 IPA 48/48(#649 — EN-I11 해소). 다음 결정(오너) =
  시험분 확인 후 타 트랙 확산 / 실음원 연결 / SRS 동작 배선. 잔여 후보 = ja 문형 확장(발주
  설계 필요)·en 자연성 표본
- **🏁 챕터 제작 원칙 v1 발효·소급 수리(2026-07-25)**: 오너 설계 원본 Idea/ 17문서
  merge(#1 — 5/30 개설분 발굴) → `docs/policy-chapter-authoring.md` 제정(#652 — 오너
  4원칙+8축=P1~P12, 5블록↔샌드위치 대응표, A등급 판정 기준, 소급 점검 대장) + 12레슨
  소급 수리(P7 훅 D1 절단 8챕터 전수 대조·P6 '들어 보세요' 카피 전량 중립화·duration
  실측 20분/15분). 후속 큐 = P10 fr A1·A2 레벨 기준표 → P11 자동 게이트 lint 확장(codex
  발주 가능) → P9 문화 한 스푼 전수 점검. owner-gate = 오디오·실자료(㉮㉯)·SRS 배선
- **📐 P10 기준표 발효(2026-07-25)**: fr A1·A2 레벨 기준표 v1(#654 —
  `docs/curriculum-fr-a1a2.md`). A1 문형 갭 0 판정·A2 갭 5 확증(부정 변형·si 조건·
  서사 연결사 = 실측 0건, où·조건법 분석 부재). **저작 갭 큐 = 발주 유일 경로**(a2-15
  부정 변형→16 si→17 서사 종합→10 où 확장→18 조건법). P11 1차(order·prerequisites
  lint) codex 발주 게시(#150 코멘트 5078380117). 다음 몫 = 갭 큐 1번 a2-15 저작
- **✍️ 갭 큐 저작 개시(2026-07-25)**: a2-15 부정 변형(#656 — 원칙 v1 §3 절차 첫 실전:
  뼈 ne…plus/jamais/rien/personne·살 빵집 매진·문화 한 스푼·훅/변형 분리·기준표 동시
  갱신) + P6 잔존 라벨 10곳 소탕('들렸어요' 사각지대, 12레슨 잔존 0) → a2-16 si 조건·제안(#658 —
  피크닉 흥정·플랜 B·s'il 엘리종 재사용·오르세 브랜드 등재) → a2-17 과거 서사
  종합(#660 — 몽생미셸 조수·연결사 골격·P4 재사용 모범) → a2-10 où 확장(#662 —
  관계사 세트 완결·판별표 3행) → a2-18 조건법
  정중(#664 — futur 어간+imparfait 어미·3단 온도·A1 고정구 회수). **갭 큐 5/5 완주 —
  A2 문형 커버 갭 0(2026-07-26)**. P12 독립 감사 완료(#666 — 위임 2회
  실측+1회 날조 기각, 접지 증명 게이트 확립. 중요 1건 'a2-17 듣는 장면' 수리·P8 세트
  해석 명문화 → **치명 0·중요 0**, review-fr-principles-round.md landing). 이어서 P9 문화 한 스푼
  전수 보강(#668 — 충족 1·갭 10 충전, 🎴 마커). **오너 일괄 승인(2026-07-26 '전부
  담아서 ㄱㄱ')** — 감수 승인·owner-gate 3건 해제(오디오는 무비용 TTS부터·실화폐 불변)·
  잔여 전 항목 진행. 실행: fr R4 재평가 발주(접지 규격 위임, 가동 중) + P11 1차 직접
  구현(#670 — order·prerequisites lint, 음성 검증 포함). **R4 landing: fr 종합 A 판정**
  (등급 궤적 D→D→C→A — review-fr-track-r4.md, 접지 8종 전수 일치 검증·보정 3건 기록).
  **실험 목표 달성.** 이어서 **샌드위치 배선
  묶음**: ① 중대 발견 — 렌더러가 dialogue 필드를 안 그려 14레슨 훅·재노출 대화가 화면에
  비어 있던 결함 수리(StoryLines 재사용 — RefSpeak TTS 내장이라 오디오 배선 동시 해결)
  ② SRS 배선(selfCheck fsrsSignal→G1-A 카드 등록·상태 전이, sandwichCards.js + 멱등
  테스트 5종) ③ ⑤단 단어장 담기 CTA. 스모크·유닛 green → **실자료 RFC v1**
  (rfc-authentic-sources.md — Tatoeba 1순위·라이선스 필터(NC 제외)·src 스키마·결정성
  스냅샷 파이프라인·실행 큐 4단, 오디오 다운로드는 owner-gate). 이어서 **src 스키마 구현**(계약
  검증 isValidSrc — grade A/B·basedOn 강제, dialogue 라인·평탄 예문 양쪽 허용, 출처
  자동 집계 블록 렌더, 테스트 60종 green) + 상습 flaky districtSignsAudit24 timeout
  90s 수리(게이트 3회 적중 선례). 이어서 **Tatoeba 수집 1단 실행**
  (fetch-tatoeba-fr.mjs — unstable API 실측 계약, 10문형 182건 스냅샷 커밋, CC BY
  2.0 FR 181·CC0 1) + flaky 정정(#675의 90s가 헬퍼 닫힘에 붙어 무효였음 — it 실물
  30_000→90_000 정위치, 스모크 60s. 전체 병렬 green 재확인). 이어서 **㉮ 파일럿 대조**: 90문장
  ↔ 스냅샷 정확 일치 2건(scene-13 'J'ai raté ma correspondance'·a2-18 'Je voudrais
  un café') src 표기 — 출처 블록 첫 실표시. 근접 3건은 미표기(가짜 유래 금지),
  실재율 낮음 확인 → 커버 확대는 실문장 채택 저작(등재 라운드)로. 이어서 **P11 (c)(d) 구현으로
  자동 게이트 완결**: (c) 선행 순서 검사(레벨 랭크·order 역전 fail — 현 콘텐츠 위반 0)
  (d) 레벨 어휘 대조 report-only(A1 87%·A2 96%, vocabPreview 도입어 인정 — 미등재
  상위 plat·gauche·médecin 등 = 어휘 팩 보강 후보 큐). (e) src 계약은 #675 기구현 —
  **P11 (a)~(e) 전체 가동**. 이어서 **어휘 팩 보강 24어**(A1 두
  테마 16 — 길·가게/말하고 움직이기, A2 한 테마 8 — 수다·가게. 전 후보 팩 부재 전수
  검증 후 등재, 커버 A1 87→93%·A2 96→98%). 발견: arriver·médecin·place가 A2 팩에만
  있는데 A1 장면이 사용 — **레벨 재배치 검토 후보**로 기록. 이어서 **레벨 재배치 4어**(arriver·
  médecin·place·fois를 a2→a1 기존 테마로 정확 이동 — A1 커버 94%·재배치 미스 소멸)
  + **ja 문형 확장 1단(분석) SPEC 게시**(bunkei 936패턴 실측 — 중복 103종 목록화·JLPT
  표준 대비 갭, report-only. 저작 2단은 분석 검수 후). 이어서 **ja bunkei 1단 분석 완결**
  (audit-ja-bunkei-expansion.md — 중복 114종 쌍 분포 실측·삼분 기준(표기 차이/동일
  용법/정당 재도입)·N4 표준 42/42 커버로 '확장 부족' 서사 반증 → 2단 = 정리 라운드로
  재정의, triage 초벌 codex 발주). 이어서 **triage 초벌 landing**
  (audit-ja-bunkei-triage.md — 위임 초벌 검증 채택: (a)표기 75·(b)동일 26·⟂15,
  게이트 노트 보정 3건 — (c)0종 집계 정정·ながら (c) 확정·경어 계열은 JA-C02 설계
  충돌 위험으로 실행 보류 트랙 분리). 이어서 **⟂ 15종 수기 판정 확정**
  (전문 대조 — (c)/오탐 유지 6·(b) 확정 8·부분 재편 1, させていただく는 N3 고유
  판명, 정규화 v2 개선점 3건 기록). 이어서 **정리 실행 1차**(N5+N4·
  N2+N1 배치 — 수기 재판정에서 위임 판정 3건 뒤집힘(と·とき·次第だ 별개 용법)·설계
  보호 2건(N4 보통형 브리지 섹션) 발견 후 순수 재교육 16종만 삭제: N1 13·N4 3,
  총 936→920. 병합 대기 5건 이월). 이어서 **2차 배치(N3+N4 44키
  전수 재판정)**: 삭제 22(N3 재교육)·(c) 유지 2(れる 심화·こと 게시문)·병합 이월 3·
  **설계 충돌 보류 5(추측 세트 소유권 — そうだ·ようだ·みたいだ·らしい·はず)**·경어 12
  보류. 총 898(936−38). 이어서 **3차 배치(N2+N3 33키)**:
  N2 재교육 28종 삭제·병합 이월 5·をはじめ 표기 인라인 병합 — 총 870(936−66).
  이어서 **병합 배치 완주**(이식 11·
  표기 병합 2·삭제 13 — 총 857, 누적 79종 처분). → **🏁 라운드 마감**: 설계 검토
  2건 판정·실행(추측 세트 = N4 정본·N3 5종 삭제+섹션명 개명 / 경어 12 = JA-C02 나선
  설계로 전부 유지). **최종 936→852(삭제 71·병합 13), 정보 소실 0, 백로그 'ja 문형
  확장' 종결**. 이어서 **정리 복제 개시**: 4트랙
  bunkei 스캔(zh 27·en 20·fr 24 — ja 대비 소규모) → **zh 배치 완주**(ch 링크 기준
  정본 판정·이식 14·삭제 27, 511→484, 정보 소실 0). → **en 배치 완주**(삭제 19·이식
  10·유지 1(may·might C1 헤징 재도입), 585→566 — c1 팩이 재수록 창구 10/19로 zh h4
  패턴 재확인). → **fr 배치·4트랙 총결산 완결**:
  fr 삭제 24·이식 16(c1 창구 15/24 — 3트랙 연속 동일 구조 확인, quoique/quoi que
  오탐 판별). **총결산: 4트랙 2,620→2,466(삭제 141·이식 53·정보 소실 0)** — 중복
  정리 시리즈 전체 마감. 이어서 **재발 방지 확정**: ch 일치
  lint는 실측(교차 링크가 설계상 35~40%)으로 철회, 대신 bunkei 중복 키 카운트
  report-only 감시 추가(기준선 ja 31·zh 1·en 2·fr 0 — 초과 = 신규 유입 신호).
  오너 결정 대기: 타 트랙 원칙 확산·fr B1. 타 트랙 확산
  여부는 오너 결정(원칙 v2와 함께)
- **🐛 오너 신고 수리(2026-07-30)**: fr 챕터 목록 뒤죽박죽 — 원인 = getGrammarChapters가
  파일 연결 순서의 원배열 반환(ALL_CHAPTERS·이전/다음만 정렬돼 목록과 불일치).
  레지스트리 레벨별 정렬 뷰로 일원화(#693, 전 트랙 수혜) + order 미도입 챕터의 NaN
  비교자 결함 동시 수리(안정 정렬). 정렬 테스트 3종 고정(fr A1 1..33 첫=생존·A2 1..18)
- **🧩 학습 경로 완성 v1 개시(2026-07-31, 오너 지시 '싹 갈아엎고 겹침 없이 A1-A2')**:
  수직 슬라이스 merge(#695) — RFC(재진단: 문형 퀴즈·FSRS 기가동, 갭 = 신선 드릴·딕테·
  통합)·drills 스키마 계약·비중복 3중 lint(인식 14/14 검증)·ChapterDrills 렌더러
  (fill·choice·order·**dictation TTS — 듣기 축 신설**)·파일럿 14문항. 잔여 = 배치 2~5
  (49챕터, ultracode 워크플로 병렬 예정) → 누적 복습 → '순서대로 = 충분' 재판정
- **🏁 드릴 층 완주(2026-07-30)**: 배치 2~5 연속 저작으로 **fr A1~A2 전 51챕터 변형
  드릴 357문항 완비**(#697·698·699·700·701 — fill·choice·order + 딕테 ~97, 듣기 축
  완성). 비중복 게이트 누적 적발 17건 전량 교체(실효 입증), order 시점 준수(초반
  챕터 엄격 어휘), tmp 정리 소실 2회 자가 복원. 다음 = 누적 복습 세트 설계 →
  '순서대로 = 충분' R5 재판정
- **🏁 V3 도로 오토타일 26/26 완주**: 리옹 파일럿(#472)→도쿄·서울 라이브 육안(#484)→전면
  확산(#493, BRIDGE crop 게이트). 오너 지적 "도로 chaos" 해소 라인 종결. P8 렌더 벤치 실행 중
- **🏁 지구제 26/26 완성**: T19 13도시(#490)→마르세유·가와구치코 정본(#500, ferry wrapper
  복구). S18 팻말 4,211개 전수 정합(#494). 잠긴 지구 fail-closed 전 도시 가동
- **🏁 IP 판정 완결**: 28건 조사(#482)→판정 9건 수정·19건 유지(#483). 학습 콘텐츠 브랜드
  언급은 owner-gate 보류. 도어 ID 전역 유일성 계약 신설(#485)
- **채움 라운드 2 진행**: 도어 12종 fr-19~30(#485·#492)·NPC 6종 페어 배치(#496). 다음 =
  일본 라운드 3(S21 사전검증 후)·한국 도시 방향 설계(#492 조사 반영)
- 시스템 트랙: S14~S20 전량 merge(수첩 동적 판정·만남 동적 분모·통합 여정 시나리오·스토리지
  스키마 v1). 코스 트랙: 도쿄 실측 #498 merge·서울 T23 실행 중(정본 저작은 Claude 대기열)
- 사이클 운영(cron 10분·게이트 위임·merge 단일 창구) — 이번 라운드 merge 19건(#476~#500)
- **🏁 유럽 2차 1호 마르세유 완성 선언**: 수집 #251→본생성 #260→배선·프로필·R4 스킨 #263→
  EMEA 게이트 #267 전 라인 종결(20도시·오버월드 왕복·노드 desc 저작). 2호 = 가와구치코 개시
- **🏁 가와구치코/후지 완성 선언**: 수집 #269→본생성 #276→배선 #278(첫 등산 버스·유람선 8호)→
  후지 액트 씬(#275+#277)→오버월드 게이트 #283 전 라인 종결 — **22도시+액트 씬 3종**.
  **🏁 3호 제네바 완성 선언**: 전 라인 종결(#285→#289→#290→#292) + fr 도어 3호 세트 fr-13~15
  배선(#295 — 시계 공방·퐁뒤·초콜릿, 프랑스어권 4세트 비중복). **4호 = 레만호 연안 개시**
  (오너 큐 순서 — 수집 SPEC 5012092624: 로잔~몽트뢰 벨트 1.05M·라보 세계유산 포함).
  Codex-2 = 밴드 라운드 2 배정(신도시 3곳)
- **지역학(스터디즈) 트랙**: 🏁 일본학·한국학 양국 완간(#294 — 12문서 대칭 2권 체제,
  여행 폰 양국 비교 사전 완성). 아이디어 보드(#281)·📱 여행 폰(#286). 다음 = 프랑스학 개시 검토
- **전체맵 뷰어 개편(오너 지시 #273)**: 대형 맵 미표시 수정(1px 적응 비트맵)·화면맞춤 줌·
  국가 중심 2단 카테고리(도시국가 병렬 배치) 완료
- **📱 여행 폰(오너 지시 #286)**: 여행 수첩 5번째 탭 — 게임 안 다이제틱 위키(지역학 검색·열람,
  studies 단일 진실원·게임 이탈 없음). 🏁 아이디어 ①+③ 딥링크 착지 완료(#300)
- **🏁 fr 학습 경로 v1 라운드 마감(R5 · #704)**: 판정 **"순서대로 = A1~A2 범위 충분"** — 드릴
  51챕터 357문항(딕테 105)·누적 복습 EVERY=5·발음 챕터 16건 수리(실존 인물 실명 IP 포함).
  위임 감사는 스테일 트리로 정량부 전면 기각(접지 규격 2연속 유효 — 신규 규율: 감사 첫 액션
  base HEAD 보고·객체 단위 계측). 잔여 격차 = 자유 산출 피드백(범위 외)·실음원(owner-gate)·
  어휘 커버 report-only·진도 위젯(Codex-3 이관). 오너 지시로 세션 1~4 병렬 발주 4건 게시
- **어휘 커버 정리 R1(#711)**: 핵심 lemma 30종 등재(devoir·vouloir·apprendre 등 A1 동사 공백 해소)·
  A1 리듬 예문 반과거 시점 위반 교체·lint (d) 불규칙 어간 브리지 — 커버 A1 94→97%·A2 98→100%,
  manifest 재생성 결정성 확인. 잔여 = A1 8종·A2 orsay 1종 report-only
- **A0↔A1 중복 해소(오너 지적, #713)**: a0-05↔a1-29 리에종 무참조 재도입 실측(동일 예문 10건) →
  복습 승급 프레임·예문 차별화 수리, lint (g) 레벨 간 동일 예문 감시(기준선 8·0·0)·원칙 P13 신설.
  타 트랙 동일 질환 스캔 = fr 국한 확정. **오너 재지적 → A0-05 슬림화(#725) → 최종 OT 기준 적용(#727): a0-05 챕터 제거·앙셴느망/듣기 함정 A1-29 이관, 동일 예문 8→5. 원칙 확정 = OT에 규칙 체계 챕터 금지(P13).** **ja N3·N2 표준 대조 감사 접지 통과**(N3 28문형 누락 0·결함 2건
  소액 — **#715 수리 완료**: 미화어 짝 칸·경어 연결 세분화. 인트로 중복 스캔 = fr 국한 확정, ja 2건·en 0건)
- **en 자연성 표본 감사 완결(접지 통과)**: 표본 6챕터 ~70예문 — 명백한 오류 0·해요체 완전 준수,
  검수 필요 1건 수리(does not→doesn't, #720). **저우선 큐 소진** — 잔여 몫 전량 오너 결정 대기
  (타 트랙 확산·fr B1·실음원·#706 승인)
- **월드 내비·ja 독해 파일럿 노출 제거(오너 지시, #723)**: Layout [월드] 2곳·LessonsPage 독해
  카드 제거 — 라우트·코드는 동결 보존(직행 URL만). 개발 중지 상태의 UI 정합
- **A0 해독 훈련 v1(오너 발주, #729)**: 발음 규칙→모르는 단어 소리 내기 — 3챕터 드릴 20 +
  신설 a0-07 종합(치트시트·루틴·14문항) + speak 필드(정답 후 TTS 확인 루프) + 인트로 드릴 렌더.
  심화 확장(#731): 비모음 전 계열(un/um·oin·ien·ym)·해제 함정·갭 5(-er 어미·ui·x·th) — 총 49문항, 전수 대조 완료(생략 2 고지). 다음 후보 = 오너 육안 확인 후 en 파닉스 드릴 확산 검토
- **교재 소개 '배우면 좋은 점'(#733) + 언어권 세계지도·스탯 시각화(#735)**: perks 4줄 +
  실지도 교체(#738)→깨짐 수리(#740, 날짜변경선 링 분할)→**하이라이트 중심 자동 줌(#741)**: bbox 기반 viewBox·배율 보정 라벨 — 실렌더 검증·배포 success, 오너 육안 확인 대기.
  (흥미 주제 40선 리스트는 채택 대기 — 오너가 심플 버전 선택)
- **교재 소개 피치 카드 완결(#743)**: 오너 발주 라운드(어필 구성→korean-copy 스킬→점수 평가
  반복→작품 실명 게이트 해제·등재 4행→한국어 자연화→시각 강조) — 훅·장면 6·인용 박스·CTA,
  실렌더 검증·배포 success. **#745 경로 수리**: /lessons 실데이터는 buildRefManifest(제3 모듈)였음 — pitch 편입·끝단 스모크·프로덕션 HTML 실측까지 확인(과거 #737 'perks 흐름' 보고는 오판이었음을 정정). 카드 계보: perks(#733)→지도(#735~741)→피치(#743·#745)
- **86→92 3축 라운드(오너 ㄱㄱ)**: ① 드릴→SRS = C3 발주(5151840982) ② **산출 축 v2 완결(#747)** —
  써 보기(작문→모범답→자기 점검) 파일럿 10챕터·프로덕션 실측 ✓ ③ 실음원 = C1 오디오 메타 발주
  (5151841017, CC BY/CC0만). 잔여 = C1·C3 도착 게이트, 써 보기 A1~A2 확산
- **인터리브 재배치(오너 발주·학습과학, #753)**: A1 문법 최장 연속 19→5·A2 12→3 — 장면 14개를
  prerequisites 충족 지점 직후로 분산(여행 서사 유지·고정구 힌트 2 보강). 프리레퀴짓 16선언
  자체 검증+lint (b)(c)+manifest 재생성, 프로덕션 순서 실측 ✓
- **DELF 대비 라운드(오너 발주 — 말하기 제외·기존 챕터 내)**: 작문 특화 1차(#755) — 과제형
  써 보기 16챕터(문자·메모·엽서·이메일·일기, 단어 수 목표)+단어 카운터, 프로덕션 실측 ✓.
  **코어 22 확산 완료(#757 — fr 작문 48/48 완비**, 비중복 게이트가 모범답 중복 1건 적발·교체).
  잔여 = C1 실음원 도착 시 듣기 배선 → 형식 흡수 마무리
- **A안 fr B1~C2 완성 라운드 개시(오너 승인)**: #706 위젯 merge ✓ / Phase 1 기준표(docs/
  curriculum-fr-b1c2.md) — 커버 30/31·갭 신규 1(b2-11 futur antérieur)·보강 1·검수 2.
  **Phase 2 완료(#761)**: b2-11 신설+보강 3, 갭 큐 4/4 소진. **Phase 3 완결**: B1 63(#763)·B2 77(#765)·C 66(#766) = 206문항, 게이트 적발 4 전량 교체.
  **Phase 4 완결(#769)**: B1~C2 써 보기 31 — fr 작문 79챕터 완비. **🏁 A안 전 Phase 완결(#771)**: 감사 접지 통과·결함 0 → **종합 재평가 86→90점**(작문 60→82).
  **극대화 패키지(#773)**: 담화 듣기 36(TTS·실음원 자리 예약)·오답 텔레메트리(로컬)·어휘 커버
  B1~C2 확장(전 레벨 96%+). **텔레메트리 서버화(#775)**: review_events 재사용(신규 스키마 0) — 멀티 디바이스 연속.
  잔여 = C1·C3 도착 배선(→92+), 타 트랙은 오너 별도 요청 대기. **타 트랙 확산은 고평가 검증 후
  오너 별도 요청으로만(임의 착수 금지)**
- **🇨🇳 확산 1호 zh 개시(오너 발주 '다음은 중국어')**: Z1 기준표(#777) — 78챕터·HSK 대조,
  갭 4(기존 챕터 보강)·검수 3, 특수 설계(병음 딕테·성조 듣기). **Z2 완결(#779)**: 갭 6섹션(별·니·착·就才·再又·得地) — 검수 승격 2 포함, HSK 1~3 갭 소진.
  **Z3 드릴 완결(#781~#787)**: 전 78챕터 챕터 드릴 468(+장면 sq 24 별도) — OT·발음·H1 120(#781, red merge 사고 → #782 수리·&& 게이트 명문화) →
  H2 72(#783)·H3 78(#784)·H4 60(#785)·H5·H6 90(#786)·장면 48(#787). **Z4 써 보기 완결(#789~#791)**: 인프라 일반화(zh·pinyin 샘플
  fail-closed·CJK 글자 수) + writing 71/71챕터. **Z5 평가 완료(docs/review-zh-z5.md)**: 위임 감사 재판정(유효: 병음 전수 100%·시점 0 /
  기각: 갭 미완 주장 — 실물 반증)·**종합 93** — 비중복 게이트 선적발 24건 전량 교체, 배포 실측 green.
  **극대화 라운드(오너 '할 수 있는 건 최대한', #794~#796)**: ① 담화 듣기 22(장면 응대 16 + 성조 미니멀 페어 6 — fr #773 동형, listen 103)
  ② (h) 병음 정합 게이트 신설(한자↔음절 대조·정서법) — 첫 가동에서 기존 vocab 병음 실결함 22건 적발·수리(dì'èr류 아포스트로피 21·bànfǎ 음절 누락 1)
  ③ (d-zh) 글자 커버 지표 + 실전 vocab 80단어(여행·긴급·문어) — 커버 H1 87→99·H2/H5/H6 소진. **도착 게이트 완료(2026-08-04)**: C3 드릴→SRS #750 merge(충돌 2건 창구 해소 — drillSrs 단일 정본·pastStat item_key 완화,
  2,529 green) → zh 드릴 506도 즉시 SRS 편입(별도 배선 0). C1 Tatoeba 실음원 #752 merge(스냅샷 해시 재현 일치, 2,532 green) —
  **판정: 적합 음원 0건(전량 NC/SA/무라이선스), fr C1 실음원 축은 Tatoeba로 불성립** → 타 소스 재발주 or TTS 유지는 오너 판단.
  **오너 결정: 실음원 = TTS 유지 확정(2026-08-04, #150 5174813763)** — C1 트랙 종결, fr·zh 음성 정본은 Web Speech TTS.
  **한자 자형 경량 축 완료(#799)**: ot-03 보강 — 부수 8종 표·형성자 원리(한국 한자음 연동 青→请清情)·드릴 3, 증식 0.
  실사용 스모크 8페이지 실측 green(zh 챕터·발음·writing·/review/grammar·/learn). 잔여 = 오너 육안 실사용 라운드만.
- **🇬🇧 확산 3호 en 개시(오너 발주 '이젠 다음으로 영어', 2026-08-04)**: E1 기준표+게이트 en 확장(#801,
  docs/curriculum-en-cefr.md — 68챕터 실측) → **E3 드릴 완결(#802~#807)**: 전 68챕터 챕터 드릴 408
  (OT·A1 78 → A2 66 → B1 66 → B2 60 → C1·C2 90 → 장면 48) — 파닉스 미니멀 페어·관사/수일치·간접의문·
  make/do·현수분사·반어 청해·콩글리시 교정, 비중복 선적발 누계 10건 교체, id는 en-* 접두(fr과 SRS 키 분리),
  SRS 자동 편입. **E4 써 보기 완결(#809~#812)**: 스키마 en 확장(fr/zh/en 배타) + 64/64챕터 — #811 부분 삽입 사고(스크립트
  오배치·별개 문장 체인)를 #812 실측 수습, 재발 방지 명문화. **E5 평가 완료(docs/review-en-e5.md)**: 감사 재판정
  (유효: 규모·id·시점 0 / 기각: TTS 정본 오해 감점)·**종합 92**.
- **🇯🇵 확산 4호 ja 완주(오너 발주 '일본어도 마저 ㄱㄱ', 2026-08-05)**: J1 기준표+게이트(#815) → J3 드릴
  98챕터 588(#816~#821 — 조사 주력·활용/읽기 함정·경어 단정 완화·문화 장면 8종·음운 미니멀 페어) →
  J4 써 보기 92/92+스키마 4언 배타(#822~#824) → J5 평가 **93**(docs/review-ja-j5.md — 감사 재판정·기등재
  미디어 인용 실물 검증). **4트랙 완성: fr 91·zh 93·en 92·ja 93** — 챕터 드릴 총 2,000+·작문 319·전 드릴 SRS 편입.
  공통 잔여 = 오너 실사용 라운드.
- **🧭 웹앱 구성 평가+개량 R1(2026-08-05, #827)**: 사용자 여정 실측 평가(랜딩→교재 발견 '하' — /lessons 링크 0 /
  트랙 홈 en·ja 404 / 복습 동선 약함, 만족 예측: 발견 후 85~90·퍼널 포함 ~70, memory/evaluation.md) → 우선순위 3종 구현:
  ① 랜딩 헤더·푸터 '교재' + 4트랙 카드 섹션(실측: lessons?lang 링크 4·CTA 4) ② en·ja 인덱스 리다이렉트(4트랙 200 대칭)
  ③ 드릴 완주→ReviewNudge(서버/게스트 due 카운트→/review/grammar). ④ /lessons SSR화 완료(f84fc4d — useSearchParams 제거·localStorage useEffect 격리, next build+로컬 실증 후 배포).
  ⚠️ 사고: R2 커밋이 브랜치 미생성+push 폴백으로 **PR 없이 main 직push**(단일 창구 위반 — 게이트는 전 통과라 revert 없이
  기록으로 수습). 재발 방지: push 폴백(|| push HEAD) 금지·작업 시작 시 브랜치 확인.
- **🧹 최적화 R3(#830)**: 라우트 23종 전수 실측(수정일·인바운드·특수 참조) → 제거 2(cohorts 미완 기능·Klee 미사용 폰트,
  Noto Serif는 별칭 22곳 실사용 확인·유지) + 살리기 3(/learn 플래그 해제 정식 노출·네비에 복습·지역학) + 보존 판정
  (world 동결·offline PWA·viewer/pdf 활성·미들웨어 matcher 건전). 오너 승인('권고대로')으로 2건 실행(#833):
  /listen 세트 제거(페이지·api/media 4종·뷰 ≈1,950줄·LLM 키 표면 소멸 — **복원 지점 32e305e**) ·
  /learn→/lessons 통합(LearnPage embedded 모드·진도 스트립·리다이렉트·네비 일원화). 지역학은 오너 정정으로
  보존 분류(#832 — 네비 철회·라우트 유지). ⚠️ #833 커밋에 Vercel 웹훅 유실로 배포 미생성 → 본 보드 커밋으로 재트리거
- **🔍 전체 코드 리뷰 R1(2026-08-05, 6자리 분담 — Claude 2 + Codex 4)**: base 8e7e417 고정·인용 의무·수정 금지 규격.
  **Claude 즉시 수리 4건**: 저장형 XSS(#835 — word detail이 로그인 누구나 쓰는 크라우드소싱 필드인데 뷰어 6곳
  dangerouslySetInnerHTML, sanitize 0 → 렌더 시점 이스케이프) / **AdminPage Hooks 순서(#838 — /admin이 프로덕션에서
  열리지 않던 치명, 가드를 전 Hooks 뒤로)** · 오픈 리다이렉트 · 모달 XSS · level 폴백 / prebuild에 lint-curriculum 배선
  (#839 — 콘텐츠 3중 게이트가 배포에서 미강제였음) / level 파라미터 key·label 양립(#840 — 원래부터 미작동, 실측 검증).
  **위임 리뷰 재판정**: Codex-2 views(#836 정독 46파일)·Codex-3 scripts(#837) 최상급 채택 / 허수 기각 = admin
  service_role '우회'(각 라우트 자체 requireAdmin 가드 실재)·fire-and-forget '기록 손실'(게스트 localStorage 정본).
  **진행 중**: Codex-2 V-05~V-13 수리(V-13 확증 — supabase {error} 미확인으로 저장 실패가 성공 토스트) ·
  Codex-3 sw.js 하드닝(분 단위 버전·404 캐시) · Codex-1 components(미착수) · Codex-4 성능(최신 main 재실측 지시).
  **보류**: engines 20.x vs Node 22 계약(M-11 — Vercel 런타임·PNG 해시 영향, 검증 후 결정) · word-detail 크라우드소싱
  쓰기 권한(오너 판단).
- **🔍 코드 리뷰 R1 라운드 2(2026-08-05 밤)**: 위임 산출 3건 게이트·머지 — Codex-2 뷰 신뢰성 수리(#845 — V-13
  "저장 실패가 성공 토스트" 포함 9뷰), Codex-3 sw·게이트 하드닝(#844 — 캐시 버전을 콘텐츠 해시로 결정화·404 캐시 차단),
  Codex-4 성능 감사(#842 — 라우트별 First Load 실측). **머지 게이트에서 치명 회귀 적발·수리(#846)**: #844의 파서 재작성이
  필드 앵커를 `(?:^|,)`로 좁혀 `{ zh: "…" }` 첫 필드를 전부 제외 → (f) '챕터 예문과 동일' 검사가 무력화(예문 추출 12→0).
  `(?:^|[,{])` 수리 + **실콘텐츠 변이 주입 회귀 테스트** 추가. 교훈: 파서 교체는 동작 동치성 검증 없이 통과 금지
  (테스트 green이어도 검출기가 죽은 상태는 green으로 보인다).
  **성능 수리 발주(Codex-4)**: P1 폰트 4패밀리·14weight(gzip 약 240KB 상시) → 실사용 weight만·JP/Serif 라우트 한정,
  P2 /lessons worldMapPaths 동기 포함 → dynamic import, P5 nav prefetch 250KB, P4 /home 이중 catalog, P3 ISR 주석 불일치.
  **Codex-1(components 40k줄) 무응답** — 회신 없으면 Claude 회수.
### todo (오너 전건 승인 2026-07-18 — owner-gate 해제분 포함, Codex-1 확장 큐 = #150 코멘트 5012160829)
- **🧪 레벨 디자인 v3 리옹 파일럿(오너 승인·발주 5045143688)**: 경로 위계 RFC(Codex-1)·
  도쿄 40MiB 긴급 분해(Codex-2)·정석 한 바퀴 코스(Claude) — 성공 판정은 라이브 비교
- **🎮 게임성 전체 점검(오너 지시 2026-07-22 — 진행 중: 감사 2종 완료·라이브 검수 잔여)**: ① 라이브 플레이
  검수(실 렌더러 — 스탬프 카드·브리핑·MSM 조수·glacial/감천 스킨·채널터널·불어권 도시)
  ② 게임 루프 평가(학습·수집·이동·보상·목표) ③ 개선안 아이디어 보드 3차 → 오너 승인 →
  구현 라운드. 이후 라운드는 "플레이어가 뭘 느끼나"를 검수 항목에 상시 포함
- 아이디어 보드 2차 잔여 = ⑤진입 브리핑 카드(④ 스탬프 지식 카드는 #327 종결)
- 프랑스학 완간 잔여(경제·문화·사회) 순차 저작 / 리옹·보르도·스트라스부르 수집 검수·SPEC 확정 대기
- 불어권 게임 확장 큐(오너 방향 2026-07-22 「불어권 그 자체」): 리옹→보르도→스트라스부르 제안,
  몬트리올(아메리카 신규 오버월드)은 별도 RFC — 큐 확정 시 리옹 수집 SPEC 발주
- 런던 위성 마이크로 픽(재량 위임 해석): 윈저+옥스퍼드 2곳 추천 — 레만호 완성 후 순번
- 일본 4도시 COPY 슬롯 이식(다국어 UI 확정 시) / 아토미움 = marker-only 유지 확인
### done (최근)
- v3 3도시 완전체: 보르도 mainRoute(클래식 워크 490 steps·T3 sha 재현)·스트라스부르
  mainRoute(리버사이드 워크 441 steps·T3 sha 재현)·발견 카피 15건 정본 — 경로 회랑 지구
  정합(잠김 0)·mainRoute 가드 3도시 갱신
- 미니맵 지구 오버레이+토글 구현(오너 요청 — 라이브 on/off 검증), 게스트 채팅 정직 카피
- 검수 merge: W1 지구 라이브 감사(7/7 결함 0)·E7 게스트 저장 스킵·T7 갭 실측·T6·E8
- 콘텐츠 채움 라운드 1 발주(T8 스팟 실측·V1 시각 대비) — T7 우선순위 채택
- D2 지구 정본 7도시 완성: 리옹(회랑 4지구)+빈 도시 2(보르도·스트라스부르)+희박 대형맵 4
  (서울·부산·코트다쥐르·레만) — T5 실측 채택, resolve 정합 전수 green, 미정의 가드 19도시
- 검수 merge: D1 지구 엔진(#421)·T6 factor 복귀(#426)·E8 회랑 수정(#427)·S5 칭호 표시(#420)·
  E6 회랑 감사(#418)·R6 실측(#419)·T5 rect(#422 스택 수습 포함)
- verifier R6 저작(제네바 출수부 신규·레만·런던 상향) + 자율 실행 2건(T6 확정·E8 발주)
- 사이클 3 검수 6건 merge: E5 발견 이벤트(#411 — 리옹 d5·d6 라이브 발동 확인)·S3 보상(#405)·
  T3 mainRoute 데이터(#410→#407 수습)·R5 제안(#402)·E4 도시 진입(#406 — 제네바 진입 라이브 green)
- verifier R5 저작: 그랑파리 [13.5,16.5]·마르세유 [15.5,19.5]·단면 상향, 3도시 공식 green
- 칭호 카피 정본 4건(worldTitleCopy.js) + S5 표시 배선 발주
- 라이브 플레이 검수 1차 투어 완료(#397 리포트): 게스트 하니스 4종(#388·#389·#391·#392)
  구축, 전국맵·학습 루프·리옹 v3 포장·보르도·EMEA·제네바 계약 라이브 검증,
  P1 프로덕션 결함(#396 EMEA 자산 스테일 가드) 발견·수정, E1·E2 발주
- 4세션 벌크 발주(#395 보드): E/T/S/P 큐 13건 + 운영 공지(로컬 clone·검수 하니스)
- 도쿄 메모리 감사 #390 검수·merge(factor 복귀안은 T1 A/B 자료 발주로 연결)
- **🎮 게임성 점검 감사 2종 #377·#378**: 콘텐츠 밀도(도어 0 도시 11곳·스탬프 7도시 한정·
  서울 앵커 0.026/km²)·성능(도쿄 40.11MiB FAIL·부팅 전량 import 병목) — 오너 진단
  「길이 길이 아니다」 등재, v3 파일럿 발주
- **🇫🇷🏁 불어권 확장 웨이브 완주(cdca6aa — 선언 코멘트 참조)**: 리옹·보르도·스트라스부르
  3도시 전 라인 하루 완주(수집→본생성→프로필→배선→게이트→desc·refs) + 프랑스학 완간
  7/7(#373) — 26도시·전체 196/2,046 green. 다음 = 🎮 게임성 전체 점검
- **🏁 보르도 완성(91311cf)·배선 #367 / 스트라스부르 배선 #371·게이트 #372·refs #374 /
  밴드 R4 제안 #369 merge·하드닝 승인**
- **🏁 리옹 완성 선언(a8e22fd — 5043686863)**: 수집 #346→본생성 #352→배선 #355→게이트
  #361→노드 desc·refs #364 — 24번째 도시, 하루 안 전 라인. 보르도 게이트 발주
- **🥨 스트라스부르 본생성 #363 + 프로필 #365**: 결정성 3-way·POI 7종 착지·일강 분기 실측
  pin·전체 196/2,042 green — Codex-2 본생성 3연쇄 완주, 밴드 R4 제안 발주
- **🍷 보르도 본생성 #358 검수·merge + verifier 프로필 #360**: 결정성 3-way·POI 9종 ±1타일·
  가론강 460m/660m 실측 pin·전체 195/2,032 green — Codex-2 스트라스부르 순번(마지막 본생성)
- **🏙️ 리옹 도시 배선 #355(b65dd3d)**: desc 9종·구역 6·파르디외~페라슈 철도축·props 3·
  R4 terracotta — 24번째 도시, 전체 194/2,024 green. 잔여 = 게이트(Codex-1)·fr 도어 6호·
  studiesRefs lyon 키(게이트 후)
- **🦁 리옹 본생성 #352 검수·merge + verifier 프로필 #353**: 결정성 3-way·POI 9종 SPEC ±1타일
  전착지·론 180m/손 60m 실측 pin 전 게이트·전체 194/2,024 green — Codex-1 리옹 게이트 발주
  (5043280384)·Codex-2 보르도 본생성 순번
- **🥨 스트라스부르 수집 #350 검수·merge + 본생성 SPEC(5043140593) — 수집 3연타 완주**:
  405×446·해시 7종·8/8, 전체 193/2,016 green. Codex-2 본생성 3연쇄(리옹 진행 중 감지),
  Codex-1은 리옹 geo merge 시 게이트 발주 예고
- **🍷 보르도 수집 #348 검수·merge + 본생성 SPEC(5043027192)**: bbox exact·474×501·해시 7종·
  8/8, 전체 192/2,008 green — POI 9종+생장역 tile 확정, Codex-1 스트라스부르 순번(마지막)
- **🦁 리옹 수집 #346 검수·merge + 본생성 SPEC 게시(5042794245)**: bbox exact·428×501·레이어
  7종 해시·파이프라인 8/8, 전체 191/2,000 green — POI 9종+역 2종 tile 재투영 확정,
  Codex-2 본생성 착수 가능·Codex-1 보르도 수집 순번 / 프랑스학 경제편 #345(5/7)
- **🇫🇷 불어권 웨이브 #341·#342·#343**: 프랑스 studiesRefs 배선(도시 4곳 입국 브리핑 활성·
  브뤼셀/제네바/레만 프랑코포니 딥링크 — 나라 오인 방지 계약)·구계약 3건 지역학 3권 체제
  갱신(#341 red를 #342로 즉시 복구, 게이트 체인 pipefail 상시화)·역사 ②편(혁명~현대,
  채널터널/TGV/오스만 게임 연계) — 프랑스학 4/7, 전체 190/1,992 green
- **📱 아이디어 보드 ⑤ 진입 브리핑 #335 검수·merge**: 나라별 영구 1회 선점·studiesRefs
  연동·문서 없는 나라 생략 계약 — 2차(④+⑤) 종결, 전체 190/1,992 green. 프랑스 활성화는
  studiesRefs 배선 라운드에서
- **🌍 불어권 확장 2연타 #336·#337(882fec2)**: 프랑스학 역사 ①편(갈리아~베르사유, ①편 규율
  미러) + 불어권 세계(프랑코포니) 문서(OIF·왈로니/로망디·퀘벡·아프리카 — 게임 속 불어권 명시,
  intro 불어권 관점 전환) — 프랑스학 3문서째, 오너 방향 「불어권 그 자체」 반영
- **🇫🇷 프랑스학 개시 #332(2023fb3)**: 지역학 3권째 나라 등록 + fr-overview 개관(5섹션·통계표,
  공적 통계 헤지·상호 무언급), 게임 연계(프랑스어권 4도시·MSM 조수·로망디) — 오너 승인 2026-07-22
- **📚 지역학 근현대사 ②편 #330(f9dab10)**: 한일 양국 교차 저작(대한제국→현대 / 메이지→현대),
  승인 수위(사실·구조 층위) 엄수·병합/패전 연대 교차 정합·쟁점 상세는 스코프 명시 후 보류 —
  14문서 대칭 체제 완성, 전체 189/1,988 green
- **🏁 유럽 2차 4호 레만호 완성 선언(main 8454885 — 코멘트 5042244197)**: 수집 #299→verifier
  #307→본생성 #304→배선 #320→fr 도어 5호 세트 #324→게이트 #326(독립 검수 53/53)→노드 desc
  #328 전 라인 종결 — 23도시·도선 10호·프랑스어권 5세트, 전체 189/1,988 green. 밴드 R3 발주
- **📖 아이디어 보드 ④ 스탬프 지식 카드 #327**: 전국맵 66노드 전수 factLine 저작(전승 헤지·
  사실 층위 수위)·GBC 토스트·계약 테스트 — 라이브 시각 검수는 오너 플레이 시
- **🚪 레만호 fr 도어 5호 세트 #324(577aef5)**: fr-16 와인 카브(라보·반과거)·fr-17 거리
  음악가(몽트뢰·être 복합과거)·fr-18 약국(로잔·단순미래) — a2 잔여 챕터 소진, 4세트
  비중복 계약, 전체 188/1,983 green
- **🏙️ 레만호 도시 배선 #320**: desc 12종(representationPolicy 준수)·구역 6·심플론선 7역·
  벨에포크 유람선 도선 10호(선사명 일반화)·props 4종(지형 실검증)·R4B glacial 수면
  제네바+레만 소비 개시(배정표 물-전용 지원 개정) — 23도시 등록, 전체 186/1,975 green
- **🏔️ 레만호 본생성 #304 검수·merge(92b4b33)**: SPEC_FIX_2(생사포랭 코르니슈) exact 반영,
  결정성 3-way SHA 일치 독립 재현, verifier 전 게이트(우시 6,920m·시옹 2,760m·BRIDGE 0),
  merge 상태 전체 186/1,967 green — 검수 코멘트 5041659533
- **📍 인기 누락 POI 보강 라운드 #316(2b27c41)**: 니시키시장[431,306]·광장시장[921,668]·
  흰여울문화마을[711,905]·공중정원전망대[387,165] — 4도시 geo 재생성(단일 진실원)·desc 4종,
  교토는 HAND_AUTHORED allowlist 계약 개정(스냅샷 무변경), 서울·부산 verifier 전 게이트,
  전체 185/1,958 green
- **🌊 MSM 조수 1단계 #309 검수·merge(d44d959) + 카피 착지 #310(63893db)**: 충돌 무변경
  (blocked=원본 코드만)·safe spine 301칸 pin·결정 시계 검수, 전체 184/1,955 대행 검증.
  phase 4종 ko+A2 fr 카피를 성벽 설명·msm-04 도어에 배선(745분 전수 스캔 폐쇄 계약,
  185/1,957). collision 2단계는 라이브 검수 후 별도 라운드
- 레만호 #304 2차 실측: epesses 교정 확인, 잔여 st-saphorin 7.39타일 → 코르니슈 전망
  좌표(6.7971/46.4724, 역투영 검증) 교정 회신 5012798854 — 최종 재생성 대기
- **🌍 EMEA 일반 공개 #306 검수·merge(ca840d7)**: 다층 인터록 → 릴리스 정합 계약 전환 검수
  (혼합 공개 상태 거부 가드·경계 고지 유지·APAC false 명시·관리자 preview 보존),
  merge 상태 전체 vitest 183/1,949 대행 검증 — 유럽 7도시 일반 공개 전환
- **레만호 공식 verifier 프로필 #307(87a0b75)**: 우시 단면 6,920m 실측 pin ≥6,000 ·
  시옹 연안 2,760m pin ≥2,200 · BRIDGE 0. #304 사전 실측에서 라보 POI 스냅 17.31타일
  이탈 발견(SPEC 좌표 결함) → 에페스 마을 좌표로 SPEC 수정 회신
- **밴드 R2 하드닝 #301 검수·merge(02fe512)**: 마르세유 [15,20]/≥1·가와구치코 [4.5,7]/green
  report-only(산지 지배 특수형)·제네바 [9.5,12.5]/≥7.5 hard gate 전환 — R2 verifier 독립
  18/18 프로필 전 게이트 스윕 PASS, 밴드 라운드 2 종결(다음 R3 = 레만호 완성 후)
- **📱 지역학 딥링크(#300 — 아이디어 ①+③)**: 일본·한국 78노드(도시 POI·NPC·오버월드 게이트)
  → studies 문서 큐레이션(studiesRefs), 설명 박스 「더 알아보기」·게이트 「나라 알아보기」 버튼,
  폰 탭 문서 직행. 실재 문서·실재 노드 계약 테스트 4종 — 183 files/1,941 green
- **#152 AI Relay 검수·merge(a87a553)**: 타이밍세이프 인증·kind 위조 차단·RLS 전면 거부·
  claim RPC 검수 통과. **DB 마이그레이션 적용·Vercel env 3종은 오너 수동 단계 대기** —
  적용 전까지 /api/ai-relay만 503, 게임 무영향. 트리아지 동반: #168 close(니스 게이트
  main 대체 확인)·#176 close(조수 RFC — 코멘트 4999436456 보존, 구현 라운드 승계)
- **레만호 연안 1단계 수집 #299 검수·merge**: 레이어 7종 RLE·sha256 전건 독립 재현,
  PNG 해시 독립 렌더 일치, 시각 감사(로잔~시옹성 북안·심플론 철도) 정합 — 8/8 PASS.
  본생성 SPEC 게시(5012404504: POI 12·역 7·CFF+CGN 유람선 도선 10호·남안 분리 성분 주의)
- 밴드 R2 전건 승인 회신(5012225430 — 마르세유 [15,20]/≥1 ✓ 가와구치코 [4.5,7]/green
  report-only(산지 질량 근거 타당) ✓ 제네바 [9.5,12.5]/≥7.5 ✓)
- **밴드 하드닝 #266 검수·merge**(승인 13도시 정합 대조·16/16 프로필 전 게이트 스윕 PASS —
  report-only 라운드 종결, 마르세유·MSM 관찰 유지) / R4 완결(엔진 #259·프롭 #262·배정 #263~264)
- **🐟 자갈치 액트 씬 2호 완성**: 골격 #255 검수·merge + COPY·훅·게이트 배선(#257 —
  [ko/사투리/gloss] 첫 무발음축 카피 계약, 전체 1,840 green) / 지역학 1기 골격+일본학
  개관(#256 — /studies 3층 SSG·검증 노트 강제 계약)
- Codex-2 report-only 밴드 제안 검수·전건 승인(#150 코멘트 5010610812 — 13도시 band 확정,
  HK 11.4 정본 관찰값 승인, MSM green report-only 유지, 마르세유 프로필은 실측 저작 예정)
- 도쿄 서브컬처 확장 v2.3(#252 — 아키하바라 전기가이·다케시타도리·오토메로드 geo 재생성
  단일 진실원 유지, 프롭 6종, IP 일반 참조) / 마르세유 스냅샷 #251 검수·merge + 본생성 SPEC /
  가와구치코 ja 도어 ja-01~04 저작·merge(#249 — 첫 n5 본편 세트)
- 마르세유 fr 도어 2호 세트 fr-07~12 저작·merge(#247 — a2 본편 6챕터, 세트 비중복 계약) /
  japanese track 라우팅 n5 확장(#246 — 가와구치코 ja 도어 선행, 레거시 ot 폴백 무영향) /
  자갈치 씬 골격 SPEC 게시 + ja 트랙 88챕터 감사(n5 도어 4종 픽)
- **렌더크래프트 3라운드 완결**: R2 베이킹 검수·merge(#241 — 15/15 계약) + R3 랜드마크 15종
  전 도시 배치(#243 — POI 곁 체비쇼프 2 시각 앵커) / #240 verifier 강화 검수·merge(스냅샷
  8종 연결, 15프로필 재실측) / 런던 PNG flaky 종결(#242 — 120s 명시)
- 언어 도어 12종 신규 저작·배선(#238 — 시드니 en-07~12·홍콩 zh-07~09·상하이 zh-10~12,
  세트 비중복·보행성 계약) / 오버월드 지역 노드 desc 13종(#236) / 렌더크래프트 R1.5(#237 —
  잔여 8도시, 부산항 카페리 대칭·캡틴쿡 수면 분수)
- desc 커버리지·도어 라우팅 게이트 신설(#234 — 289노드 100% 회귀 고정) / 상시 품질 큐
  3세션 편성(#150 — 오너 지시: 대기 금지)
- 렌더크래프트 R1(#232): 6도시 프롭 배치(페리 선체 5척·야시장·네온 — 기존 kind 재사용,
  수면/보행 판정+노드 이격 계산) / R2 신규 kind 15종 스펙 게시(#150 — Codex-1 배정)
- **🏁 멜버른 geo 검수·merge(#227)+콘텐츠 배선(desc 12종·구역 7·시티루프/트램) — 19도시 등록,
  오너 확정 큐 전체 완주** / 캔버라 APAC 게이트 merge(#228) / 멜버른 verifier 프로필(#229)
- 캔버라 geo 검수·merge(#219)+콘텐츠 배선(desc 10종·구역 6·라이트레일) — **18도시 등록(호주 3호)** /
  브리즈번·시드니 APAC 게이트 merge(#223) / 멜버른 스냅샷 merge(#224) / 멜버른 SPEC 게시(#150)
- 시드니 geo 검수·merge(#216)+콘텐츠 배선(desc 14종·구역 8·하버 페리 3노선 첫 다분기) —
  **17도시 등록(호주 2호)** / 캔버라 verifier 프로필(#221 — 호수 1040/900 사전 실측 통과) /
  브리즈번 게이트 후보 merge(#220)
- 브리즈번 geo 검수·merge(#211)+콘텐츠 배선(desc 11종·구역 6·시티캣) — **16도시 등록(호주 1호)** /
  캔버라 스냅샷 merge(#215) / 시드니 verifier 프로필(#217 — 포트잭슨 2300m/2300m 사전 실측)
- 브리즈번 공식 verifier 프로필(#213 — S자 사행 위도 스캔 pin, #211 사전 실측 전 게이트 통과) /
  시드니 스냅샷 검수·merge(#212 — 상한 실측 22.66MiB 정합) / 캔버라 상세 SPEC 게시(#150)
- 시드니 상세 SPEC 게시(#150 — bbox C안 확정 반영, 하버 페리 3노선 첫 다분기 도선)
- 브리즈번 스냅샷 검수·merge(#208) / 브리즈번 desc 11종 사전 저작(검증 노트·배선 메모 포함)
- #204·#205·#206 스택 검수·일괄 merge(9d3a0fb): 상하이·베이징 APAC 게이트 — **15도시
  오버월드 왕복 완결** / 브리즈번 상세 SPEC 게시(#150 — 호주 1호, 남반구 투영 주의 명시)
- 베이징 도시 콘텐츠 배선: desc 12종·구역 7·1호선 축 — 15도시 등록(**중국어권 4도시 완결**)
- 타이베이 zh 도어 tile 배선(#202 — 중국어권 1호 단일 탑재로 확정, 파리/런던 선례)
- 중국어 도어 zh-01~06 저작 + chinese 트랙 라우트 일반화(ot 동형 방어 테스트) — 141 files green
- 베이징 verifier 프로필(#198 — 북해 단면 경화도 분절 교정 540/540) / 베이징 desc 12종 사전 저작
- 상하이 도시 콘텐츠 배선: desc 10종·구역 6·2/10호선·황푸강 도선(스타페리 문법) —
  14도시 등록(확정 큐 상하이까지 콘텐츠 완결)
- 런던 도시 콘텐츠 배선: desc 24종·영어 도어 en-01~06 tile 배선(track 라우팅)·구역 8·
  서클/주빌리/그리니치 축 — 13도시 등록(영어권 1호 완성)
- 베이징 상세 SPEC 게시(#150 — 중국어권 최종) / 상하이 geo 검수·merge(#191) / 상하이
  verifier 프로필(#190) / 런던 타워브리지 단면 오탐 보정(하류 -0.0810 이동 — 런던 전 게이트 통과)
- 홍콩 도시 콘텐츠 배선(#186 merge): desc 12종·구역 6·MTR 취안완선·스타페리 도선 — 12도시 등록
- 타이베이·브뤼셀 콘텐츠 배선, 유럽 1차 콘텐츠 전량, 한국 2도시 desc, 검증기 정본(#161)

## 확정 큐 (오너 2026-07-17)
런던(진행 중) → 브뤼셀 → 타이베이 → 홍콩 → 상하이 → 베이징 → 호주 4(브리즈번·시드니·캔버라·멜버른).
상세: docs/world-city-roadmap-cn-au.md. 유럽 2차 잔여·호주 나머지는 백로그 동결.

## owner-gate (오너 결정 대기 — 착수 금지)
- **몽생미셸 조수 RFC A~C 승인**: A) 745분 주기·epoch 420·8단계 결정 시계 B) 안전 회랑
  mask 방식(소스 재생성 vs 301칸 spine 고정) C) visual-only→collision 2단계 롤아웃
  (D 성벽 카피 4상태는 Claude 승낙 완료 — RFC: #150 코멘트 4999436456)
- 런던 위성 마이크로 2~3곳 픽(윈저·옥스퍼드·케임브리지·스트랫퍼드·캔터베리·브라이튼)
- 채널터널(유로스타 파리~런던) 연출 여부
- #152 AI Relay DB 마이그레이션 승인
- 브뤼셀 아토미움 IP 수위 재확인(유럽 2차 착수 시)
- EMEA 오버월드 일반 공개 시점(releaseEligible)
