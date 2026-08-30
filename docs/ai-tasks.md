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
- ~~🎧 받아쓰기 채점 엔진(#1077 제안 6, 발주 5386786944)~~ → **회수: 2026-08-23
  16:03 스캔까지 WORKING 무표식(30분 룰) — Claude 직접 수행·완결(회수 공지
  5386950005, PR #1118)**. 이 열에 잔여 발주 없음.
### done (최근)
- 🧪 e2e 확장 R2 — 신기능 5종 실렌더 커버(받아쓰기·빠른 분석·이미 알아요·재독/산출
  칩·학습 그룹), `e2e/features-r2.e2e.mjs`. **검수에서 2건 고정 실패를 적발해 Claude가
  직접 수리**(오너 지시 ①, 이력 재작성 없이 커밋 `01a9e6d` 추가):
  ⑴ 받아쓰기 — 드래그 선택 텍스트가 폰트·레이아웃에 따라 흔들려 좌측 번역 캐시 키
  (`viewer_tx:{lang}:{sel}`)가 빗나갔다. 🎧 진입 버튼은 **번역 결과가 있을 때만** 렌더돼
  캐시가 빗나가면 버튼 자체가 없다(드래그·분석은 정상이었다 — picked 2·단어 2개 실측).
  지정 텍스트가 원문 줄로 결정적인 **문장 막대(¦) 경로**로 교체하고 키를 정확히 시드.
  좌측 패널이 aside·시트 양쪽에 렌더되므로 `.first()`로 레이아웃 의존 제거(기대하던
  'AI 분석 결과' 시트는 좁은 폭 전용 — 기본 뷰포트에서 안 뜬다).
  ⑵ /quick — 이 테스트만 서버 라우트를 실제로 태워 `SUPABASE_SERVICE_ROLE_KEY` 없는
  e2e 환경에서 **500**(실측). 스위트의 다른 테스트와 같은 층(브라우저 레벨)으로 고정 —
  라우트는 단위 테스트 소관이다. 언어 선택 기본 일본어 ↔ 영어 입력 불일치도 수리,
  소비처가 사라진 공용 mock의 morpheme_dictionary fixture 제거.
  부수 효과: 스위트 77s→17s(타임아웃 대기 소멸).
  **환경 함정 실측(다음 세션 재사용 가치)**: e2e README 경고대로 `.next`를 다른
  `NEXT_PUBLIC_*`로 빌드하면 인증 e2e 결과가 무효다 — 처음엔 대조군 learning-flow도
  4/9 실패해 조사한 끝에 확인했고, config `webServer.env`(https://e2e.supabase.co ·
  e2e-anon-key · SITE_URL=포트일치)로 재빌드하니 9/9 green. 그리고 **CI는 features-r2
  파일을 돌지 않는다**(도착 CI green은 기존 스위트 기준) — 이 종류는 로컬 실행으로만
  잡힌다. 게이트: 5/5 연속 2회 + 회귀 learning-flow 9/9·smoke 14/14 + 전체 vitest
  2,250 green. (`codex/add-e2e-tests-for-5-new-features`, #1131 merge 465f939)
- 🎧 받아쓰기 문장 선정 엔진 `pickDictationSentences` — **Codex Cloud 전환 후 첫 회신**:
  공백 제외 길이 경계 포함·담은 단어 포함 수 우선·동률 원문 순서·정확 중복 제거·방어적
  입력(계약 5핀). 검수에서 낡은 base 실측(Cloud 환경이 #1118 시점 main을 캐시 — 브랜치
  자체는 2,058테스트) → **현재 main 병합 트리로 재검증(212파일/2,078 green)** 후 merge.
  이후 Cloud 회신 검수는 '병합 트리 재검증'을 표준 단계로 둔다.
  (실제 브랜치 `codex/locate-the-issue`, #1124 merge 310b8b1)
- 📄 PDF.js 뷰어 전환 1단계 골격: pdfjs-dist `4.10.38` 고정·public worker 전략,
  캔버스+선택 가능 textLayer와 current±1 최대 3페이지 lazy 렌더, 순수 텍스트 줄·문단·
  하이픈 복원, `?pdfjs=1` opt-in을 구현하고 기본 `<embed>` 경로를 불변 유지
  (`codex/pdfjs-viewer-s1`, 구현 `c58f87c`, draft PR #1038,
  base `19ef218bc69be44775aae46c8865f840bdf17cc6`)
- 인증 E2E 빌드 환경 계약 R1: 빌드 시점 테스트 전용 `NEXT_PUBLIC_*` 주입과
  인증 학습 E2E 실행 순서를 `e2e/README.md`에 고정해 런타임 env만 설정한 실패를 차단
  (`codex/e2e-auth-build-contract-r1`, 구현 `083a994`,
  base `aa1390995d8967092489d534193a4b39c7774e0b`)
- 로그인 사용자 학습 E2E R1: 인증 세션 쿠키 직접 주입으로 로그인 UI 타이밍 의존을
  제거하고, 실재 A1 단어 저장→`/vocab` 새 단어 큐·복습 카드 계약을 연속 2회 5/5로 고정
  (`codex/e2e-auth-vocab-r1`, 구현 `b08e4a5`, 수정 `936e0dc`, PR #869,
  base `2c0d8890f121205fd2464f2579422abd5486784d`)
- 학습 흐름 E2E 커버리지 R2: 게스트 `/lessons`에서 매니페스트 실재 4트랙 챕터로
  진입하고 6문항 choice·fill·order·listen 정오답 채점, 복습 넛지, 써 보기
  localStorage 새로고침 복원, 이어서 학습 카드 최상단, 없는 slug HTTP 404를 실렌더로 고정
  (`codex/e2e-learning-flow-r2`, 구현 `0441b0c`,
  base `8857a720f7d78c31bf2b2e05eef17252009d3fc6`)
- ✅ components 리뷰 후속 C-04~C-13 — 실제 TTS 경로 가용성, 자료별 async/storage
  격리, 중첩 button 제거, Supabase/export/레슨 완료 실패 정합, 듣기 세션·NPC timer
  cleanup, dialog Escape·focus trap/복귀를 회귀 테스트로 고정. diff SHA 2회
  `5fc9f46ba2972d15f373bbbefa216accb045066b2df01d371346cdefe79ea091`, targeted
  2파일/11·전체 275파일/2,584테스트 green, lint 0 errors(기존 warning 2), full max RSS
  3,805,839,360B·swap 0 (`codex/fix-components-c04-c13`, 구현 `2836f36`, assignment
  5198422435, exact base `e694830ca5c47c464e949a6d657cb2454468bf84`)
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
- ~~📖 재독 후보 선정 엔진(#1077 제안 12, 발주 5386788169)~~ → **회수: 2026-08-23
  WORKING 무표식(30분 룰) — Claude 직접 수행·완결(PR #1118)**. 이 열에 잔여 발주 없음.
### done (최근)
- 🧪 `src/lib` 미시 계약 보강 R1 — **소스 무수정 계약 준수 확인**: 9모듈
  (authErrors·diffChars·errorMessage·jaSegments·jaTokenize·kanaRomaji·lessonAccepts·
  seriesMeta·splitParagraphs) 경계·실패 경로를 `*.more.test.js` 신설로만 보강
  (기존 테스트 파일 무수정 — 비겹침 규칙대로). 검수: 병합 트리 재검증에서
  222파일/2,250 green(+169). (`codex/check-connection-status`, #1129 merge 0e66dd4)
- 🧪 뷰어 e2e 스모크 R1: 분석 완료 중국어 `processed_json` 픽스처와 직접 세션 쿠키로
  토큰 탭·문장 드래그·열린 문장 시트의 단어 전환·책 챕터 내비를 Gemini 무호출로 고정
  (targeted 1/1·학습 e2e 9/9 연속 2회·전체 301파일/2,829테스트·build 474페이지 green,
  파일 SHA `9898e6bf…3263` 2회 동일, e2e peak JS heap 29,247,956B·전체 max RSS
  2,433,974,272B·peak footprint 24,988,648B·swap 0, `codex2/viewer-e2e-r1`,
  구현 `d552651`, assignment 5312202647, exact base `b8eea864ef78871af772ba08c6c2bbfec0d25215`)
- ♿ 학습 접근성 R2: 챕터 패턴 체크의 문제·선택지 연결과 채점 live status, 어휘 복습
  힌트 disclosure·비색상 정오 상태, 단어장 도구 이름·CSV 키보드 진입을 저위험 보강하고
  대비·44px·`/home`은 제안 전용으로 유지(targeted 5파일/18·전체 279파일/2,608테스트,
  build 466페이지 green, 묶음 SHA `724e65e4…2c74`, max RSS 2,916,941,824B·
  peak footprint 24,578,904B·swap 0, `codex2/a11y-audit-r2`, 구현 `2e5bdfe`,
  assignment 5200639353, exact base `2c0d8890f121205fd2464f2579422abd5486784d`)
- ♿ 학습 핵심 경로 접근성(a11y) 전수 감사 + 저위험 수리: 랜딩·`/lessons`·실제 챕터·
  `/vocab`·`/review/grammar`의 중첩 인터랙션, 네이티브 링크/포커스, 입력 이름, 라이브 리전,
  필터 상태, 모달 포커스 계약을 수리하고 `docs/review-a11y.md`에 실렌더 근거와 `/home`
  report-only·대비/44px 승인안을 고정(targeted 4파일/18테스트·전체 278파일/2,605테스트 green,
  묶음 SHA `82094f88…a76c3`, max RSS 2,539,962,368B·peak footprint 24,611,672B·swap 0,
  `codex2/a11y-audit-r1`, 구현 `353d0c2`, assignment 5200111024,
  exact base `8857a720f7d78c31bf2b2e05eef17252009d3fc6`)
- 🛠️ `src/views` Supabase 오류 확인 재감사: top-level 39파일의 직접 `await supabase.from(...)`
  48건과 Promise/then 변형을 전수 확인하고, 무응답 mutation 3곳·조회 실패의 빈 상태 오독을
  명시 오류 처리와 회귀 게이트로 고정(targeted 11·전체 274파일/2,578테스트 green,
  diff SHA `9cd3504f…3f224`, max RSS 3,708,256,256B·peak footprint 24,775,656B·swap 0,
  `codex2/audit-view-supabase-errors`, 구현 `63ca253`, base `ee578fe3fa89e6f6cbf6ab71dbccc9bf0df0082a`)
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
- ~~✍️ 산출 연동 — 오늘 복습 단어 선정 엔진(#1077 제안 16+17, 발주 5386789708)~~
  → **회수: 2026-08-23 WORKING 무표식(30분 룰) — Claude 직접 수행·완결(PR #1118)**.
- ~~📱 모바일 반응형 실측 + 수리~~ → **회수: 2026-08-08 Claude 직접 수행·완료(#876)**. 무응답 3회(이슈 2·보드 1) 후 회수. 실측 360/390/768 × 12페이지 = 36조합 가로 넘침 0건, 한자 다리 표 넘침(360px +37px) 수리. 이 열에 잔여 발주 없음.
- ~~📚 /learn 진도·스트릭 위젯(발주 5126671497)~~ → **#706 오너 squash merge 완료
  (2026-08-02).** 이 줄이 3주 넘게 '오너 승인 대기(draft 유지)'로 남아 보드가 거짓을
  말하고 있었다 — 2026-08-26 전수 대조에서 적발·정정.
- 🧊 **이하 월드 항목 = 동결**(피벗 동결 + 오너 "게임 월드는 ㄴㄴ" 2026-08-25 재확인) —
  재개 지시 시 여기서 꺼낸다.
- (P0 공통) 로컬 clone 이전 확인 코멘트
- S1 STAMP_ALBUM_NODES 85 원자 전환(선행 #387 충족 — 즉시 착수): #150 5046785938
- S4 수집 연출 정합 → S2 앨범 지역 탭·수집률 → S3 마일스톤 보상 v1(localStorage·DB 금지)
### done (최근)
- 🔎 중국어 POS 판별 재호출·캐시 조사 R1 (리포트 전용 — 구현·RFC 금지 준수):
  `docs/research-zh-disambig-cache.md`. 호출 경로 전수(라우트 단일 호출 지점 + 클라
  진입점 7종 표)·동일 입력 재호출 10 시나리오·스키마 무변경 캐시 후보 A/B/C와 무효화
  초안·user_verified 계약 분석·합성 벤치(로컬 처리 0.07~0.16ms — 실비용은 외부 모델)로
  구성. **핵심 발견**: 서버 판별 캐시 없음, Viewer/PDF는 상류 전체 응답 캐시로 이미
  방어, /quick·최초 분석·전체 재분석은 무방어. 권고는 '새 DB 스키마 없음 — 계측 먼저'.
  **미해결 4문(오너 판단 필요)**: ⑴ user_verified 보호가 DB 무손상까지인가 표시 우선까지인가
  ⑵ /quick 반복 분석에 세션 TTL 허용 여부 ⑶ stats.zhPos 관측치 추가 SPEC 필요 여부
  ⑷ Viewer/PDF 캐시 키 절단 길이 통합 여부.
  검수: 표본 사실검증 전량 일치(모델명·MAX_MARKS 120·15s timeout·35s deadline·
  user_verified 가드·캐시 키 slice(0,200)). (`codex/investigate-chinese-pos-disambiguation-cache`,
  #1128 merge dac8599)
- 🇬🇧 영어 겸류 문맥 판별: 레거시 기본 lemma 폴백을 유지하며 POS별 결정 후보·occurrence
  문맥 판별·다중 pos/뜻별 pos+위치 무관 `en_pos_v` marker·lazy backfill을 연결하고,
  선택 lemma 사전 행 미조회/판별 실패 시 현행 표시를 보존. `stats.enPos` 실측
  marks 2·HTTP 1, 대상 4파일/39·전체 303파일/2,850테스트 green, lint 0 errors
  (기존 warning 2), max RSS 3,310,452,736B·swap 0
  (`codex3/en-pos-context-r1`, 구현 `04eb3f7895809e405bfa6c2b85f9eea6db9ccd75`,
  base `12272fb1c864dd7c9bef418ad3c12c37c95c6f95`, 발주 5317440125)
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
- ~~⚡ 빠른 분석(클립보드 리더) 실측 조사(#1077 제안 11, 발주 5386791238)~~ →
  **회수: 2026-08-23 WORKING 무표식(30분 룰) — Claude 직접 조사·완료**: analyze
  API는 이미 무저장 설계(lines+language 입력 → processed_json 호환 응답, 저장은
  클라이언트 몫) + 인증 필수·사용자별 분당 20회 rate limit·입력 캡(100줄×200자)·
  Gemini 미싱 100 상한 — **서버 변경 0으로 재사용 가능**. 구현은 목업 확정 후.
- ~~🗃️ 중국어 판별 캐시 RFC(발주 5312202647 §C4)~~ → **회신 도착·머지 완결**
  (docs/research-zh-disambig-cache.md — T4 배치). 미해결 질문 1·2는 오너 확정
  (DB 무손상 = userVerifiedScope 계약 · 무기록), 남은 3문(/quick TTL·stats.zhPos
  관측치·Viewer/PDF 캐시 키 통합)은 **캐시 구현 착수 시** 결정. 2026-08-26 대조 정정.
- ~~⚡ 성능 2차 — 남은 상위 라우트~~ → **회수: 2026-08-08 Claude 직접 수행·완료(#877)**. 무응답 3회 후 회수. `next build` 표에 안 잡히던 supabase-js 197kB가 게스트 전 페이지에 로드되던 것을 적발 → 세션 쿠키 없으면 SDK 미로드. 게스트 JS -27~30%. 이 열에 잔여 발주 없음.
- ~~🏁 /learn 콘텐츠 lazy-load 완결(발주 5126671583)~~ → **RFC #707 → 구현 #709 merge
  완결** — grammar 그래프 gzip -97.78%·회귀 0·comparator 계약. 2026-08-26 대조 정정.
- 🧊 **이하 월드 항목 = 동결**(오너 "게임 월드는 ㄴㄴ" 2026-08-25) — 재개 지시 시 여기서 꺼낸다.
- P0 (운영 필수·최우선) 로컬 clone 이전 + 확인 코멘트: #150 5046786117
- P1 geo lazy-load 구현(RFC #394 승인 — 실패 UX·?spawn= 정합·scene race 주의 3건 코멘트 참조)
### done (최근)
- 🧪 엔진 기준선 벤치 하네스 R1: `scripts/bench/synth.mjs`(mulberry32 시드 고정 —
  같은 seed는 byte-identical, 계약 2핀) + `run.mjs`(Vite SSR 로더로 앱 모듈을 소스
  무수정 로드, 25회 반복 중앙값·p95 + --expose-gc heap) + `docs/bench-baseline-2026-08.md`.
  **검수에서 측정 유효성 직접 확인**(빈 경로를 재는 벤치가 아님): pickOutputWords의
  `now` 주입·이벤트 detail.word_id 매칭·isGradedReviewEvent 통과·hanjaJa.json 존재를
  코드 대조. 재현 실행 성공(Node 22 로컬: hanja 로더 12.9ms · pickOutputWords 8.1ms가
  상위 — 문서의 병목 순위와 일치, 절대값은 기기차). (`codex/add-benchmark-harness-for-engine`,
  #1127 merge 9c1e502)
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

## Codex-5 (codex5/*) — 교재 순회 장기 스트림 (Codex Cloud)
### doing
- 📚 R3 발주 중(**증량**) — N5 잔여 전체 order 13~30 **18챕터**(n5.js 16 +
  scene_emergency.js 2), SPEC = #150 코멘트 **5429640272**(구 6챕터판 5429565401 폐기).
  돈키호테 보류·오탐 예방 특별 지시 포함. 오너가 Codex Cloud에 인라인 전달 후 PR 대기.
### todo
- 순회 지도(**레벨당 1라운드 — 오너 증량 지시 2026-08-26 "릴레이 1회당 많이"**):
  R3=N5 잔여 전체 → R4=N4 전체 → R5=N3 전체(확장 신규 저작 병행 검토) → R6=N2 전체 →
  R7=N1 전체. 남은 릴레이 총 5회. **편성 확정사(2026-08-26 왕복)**: Codex 장기
  스트림(R1) → Claude 완전 무인(R2, 5428131058) → **오너 재전환 "ChatGPT한테 장기 업무"
  — R3부터 Codex-5 정본 편성**. 매 라운드: Claude SPEC 게시 → 오너 인라인 전달 →
  Codex PR(1라운드=1 PR) → Claude 검수·머지·회신. 감사표(전 챕터 행) 미제출 = 반려.
  Claude 검수 스캔 틱이 PR을 집어간다.
- 스타일 캐논 미확정 2건(오너 확정 시 일괄 라운드로): ① 전사 장음 표기 ー/- 병존
  (실측 16:13) ② yomi 가나 클래스 — SCHEMA "전체 히라가나 독음" vs 실태(ドア·マナーモード
  등 가타카나 보존 다수 병존). 캐논 미확정 동안 순회 라운드에서 손대지 않는다(오탐 방지).
- ⚠ 오너 결정 대기: ot-12-menzei의 돈키호테 상호 — IP 하드리밋(상호 무재현) vs 챕터
  정체성(무대 자체가 그 가게). 임의 개변 금지 — R3 SPEC에 보류 특별 지시로 반영됨.
- ~~N3 확장 선발주(5427476505 — 문형 후보 12+표본 2본)~~ → **착수 전 폐기**, 오너 지시
  ("N5부터 전반적으로 꾸준히 검수")로 순회 스트림(5427543001)이 대체. N3 확장은 R10~R12에서.
### done (최근)
- 📚 R2 — N5 order 07~12(ot-08-izakaya·n5-07-existence·n5-08-questions·ot-11-densha·
  n5-08-te-form·n5-09-adjectives) 감사·개보수, **Claude 무인 1호이자 마지막
  (PR #1151 squash 5fe2089 — 오너 지시로 무인 편성 즉시 중지, R3부터 Codex 복귀)**. 수정 10곳:
  IP·⑷ 겹침 1(이자카야 선택 で 예시 Suicaで — 브랜드이자 수단 で와 모순 → ホットで),
  IP 2(덴샤 Suica·PASMO → 교통계 IC 카드), ⑷ 1(의문문 writing 견본이 미학습 〜ています
  사용 → おくには どこですか, 힌트 정합), ⑺ 6(ウーロン茶 챕터 내 표기 통일 2·형용사
  ja/yomi 띄어쓰기 정렬 4). 무변경 판정: existence·te-form 전 항목 이상 없음. 오탐
  자진 폐기 3건(드릴 한자 가나화 — 파일 전체 규범 실측으로 기각). Codex-5용 R2 발주
  (5428092499)는 착수 전 회수(편성 전환 공지 5428131058).
- 📚 일본어 순회 R1 — N5 order 01~06 감사·개보수 **완결(PR #1150 squash 086329f)**.
  수용: patternKo 오탈자·じゃありません pitfall/vsKo·편의점 ローソン/からあげクン 제거
  (IP 규약 이행)·주문 문형 예문 전환. 원복(보완 커밋 f6d4b92): n5-07 제목·요약·훅 개변
  — 감사 항목 밖 무근거 수정, 챕터 내 "위장 1그룹" 용어와 모순(포인터만 유지). 검수
  회신 5427860589. 운영 실측: Codex Cloud는 #150을 못 읽어 SPEC 인라인 전달 필요,
  브랜치 접두 codex/ 강제(codex5/* 미적용), PR 생성은 오너 수동 클릭 필요.

## Claude (claude/*)
### doing
### todo (오너 전건 승인 2026-07-18 — owner-gate 해제분 포함, Codex-1 확장 큐 = #150 코멘트 5012160829)
- 🧊 **이 아래 전량 = 게임·월드 트랙 동결**(오너 "게임 월드는 ㄴㄴ" 2026-08-25).
  2026-08-26 전수 대조 결과 **비월드 잔여 0**: #1077 인박스 승인분 전량 완결(2·3·6·11·
  12·14·15·16+17·19), 발주 4열 잔여 발주 0(전건 회수·완결), 열린 PR 0, 열린 이슈는
  #150·#1077(상시 창구)와 #71(월드 백로그 — 동결)뿐. 남은 비월드 항목은 전부 대기성 —
  관측 게이트 3종(표본 축적), zh 캐시 3문(캐시 착수 시), §7 오너 결정 2건, owner-gate(월드).
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
- **🖍 상태 알약 복원 — 밴드 트랙 딸림 회귀 수리(2026-08-30, 오너 ㄱㄱ)**: 밴드 트랙
  (#1165~#1168) 전수 감사 결과 색 값·변수 드리프트 0이었으나, 상태 하이라이트(B안)가
  "면 칠 전량 밴드화"에 딸려 알약(모서리 5px·단어폭)→각형 밴드(1px·좌우 ±1px 확장)로
  바뀌며 인접 하이라이트 단어 사이가 자간 4px→2px로 줄어 한 줄로 이어져 보이는 회귀
  확인(이전 d86e1508/현재/복원안 3본 스타일시트를 같은 DOM에 물린 비교 렌더로 실증 —
  오너 지목 "단어랑 단어 배경색 겹치는 거"). 수리: 비지정 상태 4규칙(::before)에만
  radius 5px + left/right 0 복원 — 지정 밴드·T1 혼색·이음매·저장 밑줄·펄스·밴드 세로
  기하 무변경. 지정 순간 알약→밴드 폭 2px·모서리 전환은 오너 수용 트레이드오프(T1 색
  크로스페이드 유지). hlBand 계약에 ②b 알약 핀 신설. 전체 vitest 2,489 green.
- **🀄 이합사 시각 연동 R4b — 연동 띠 + 각괘선 아치(2026-08-30, 오너 확정 "각괘선도
  높이 낮춰서 ㄱㄱ")**: 시연 아티팩트 5모양(낮은 무지개·각괘선ㄇ·반원 돔·봉긋 풍선·
  방울 점선) 비교 반복 끝에 각괘선(높이 7px) 확정. 실구현: zh에서 이합사 조각
  (base 2자 ≠ 표면) 탭 시 ⑴ 같은 줄 파트너 글자에 옅은 띠(--sep-linked-bg =
  picked-bg 45% 파생, :where 특이성 (0,1,1)로 상태색·지정이 항상 이김) ⑵ 조각
  상단→파트너 상단 각괘선을 탭당 1회 드로우온(대시, reduced-motion 즉시 완성선,
  reader-area 절대 오버레이 — 그립 선례 좌표계, 잉크 상단은 밴드 계약 0.58em
  산식 재사용). 파트너 탐색 = 같은 rawIdx 접두 + data-text 정확 일치(토큰에
  data-text 신설). 카드 문구는 A안(현행 자동 병기 — fr 선례 공통 문법) 유지로
  종결. 계약 9종(sepLinkWiring — 밴드 기하 비침범·특이성·7px·1회·게이트),
  밴드/픽 기존 계약 불변 확인. 전체 vitest 2,488. **R4(이합사) 트랙 완결.**
- **🀄 이합사 대량 조달 — 공식 HSK ∥ 마커 수확층 477항(2026-08-30, 오너 승인 "ㄱㄱ")**:
  RFC 1순위 Wiktionary(3,121)는 프록시 정책 차단 실측(en.wiktionary·kaikki CONNECT
  403)으로 배제하고, 착수 조사에서 **정공 레인 재발견** — 기확보 hsk30.csv의
  WebPinyin 열에 국제중문교육 등급표준의 공식 이합사 분철 마커 ∥(帮∥忙)가 532행
  보존. RFC의 "HSK는 이합사 표기 없음"은 오판이었다. 수확: 2자 523(3자 9은 전부
  얼화 배제)·V=O 0·수제층 45 겹침 제외 → **477항**(zhSeparableHsk.json, 생성기
  build-zh-hsk.mjs ③). zhTokenFix 2층 병합(수제 55 + 대량 477 = 532 어휘).
  검증: 중립 37문 스위프 오탐 0(적대 함정 得了到北京·拿出了来自·打了个电话 포함
  — **영구 계약으로 승격**, 향후 시드 성장의 방벽), 정탐 10문 전부 발화(신규
  打车·请客·上当·出门·吃饭 — 吃饭은 공식 마커 근거로 기존 '자유 VO 배제' 방침
  정반전), 무작위 40 눈검사 40/40(V+C형 值得·赶上은 우리 패턴 밖 불활성 확인).
  공백 분철 클래스(下雨 xià yǔ류 112건)는 실이합·비이합 혼성이라 v1 배제 — 수제층
  +suspect 루프가 갭 담당. RFC §3 조달 표 실측 갱신. 계약 +9(24종), 전체 vitest
  2,479.
- **🀄 문맥 설명 R1 — [이 문장에서는?] + suspect 수확(2026-08-30, 오너 승인 "ㄱㄱ" —
  토의 확정 버튼형+suspect)**: 탭 단어 카드에 문장 맥락·구조 속 쓰임 설명을 지연
  로드(즉답 카드 불변·헛호출 0 — 선례 Language Reactor 즉답+지연 병행). /api/explain
  (오답 해설)에 token 분기로 동승 — 같은 인증·레이트리밋·flash-lite→Groq 폴백 재사용,
  temperature 0(판정성). 순수 헬퍼(explainToken.js — 프롬프트·관용 파싱·신뢰 경계
  검증) + 클라이언트(ctxExplain.js — (언어,문장,단어) localStorage 캐시) + 카드
  배선(zh부터, 본문 탭 토큰만 — id의 rawIdx로 원문 줄 유도, 시퀀스 가드).
  **suspect = 2차 방어 수확 신호**: 설명 LLM이 원문 문장 기준으로 분할·기본형 의심을
  같은 호출 부산물로 신고(추가 비용 0) → 검증(문장 글자 합성·≤4자·현 기본형과 상이)
  후 token_corrections(source: ai_explain_suspect, 사용자 JWT RLS insert — 스키마
  무변경)에 적재만. 학습자 비노출·정본 반영은 사람 검토+계약 게이트(3층 구조:
  결정 파이프라인 / 표시층 구제 / 수확 루프). 계약 15종(헬퍼 7·배선 핀 8), 전체
  vitest 2,473. 후속: suspect 검토 노출(관리·주간 리포트)·fr/ja/en 확장·자동
  프리페치(R2 — 버튼 사용률 보고).
- **🀄 R4a 보수 — 下雨 시드 누락 + V+상조사 클러스터(2026-08-30, 오너 보고 下过雨)**:
  두 겹 결함 — ⑴ 대표 이합사 下雨가 수동 시드에 누락 ⑵ jieba 사전이 下过·刮过를
  **2자 통째 등재**(下过/v + 雨)해 1자 V 규칙(B)·3자 통짜(A) 어느 쪽도 못 보는
  감지 사각. 대응: 시드 +3(下雨·下雪·刮风, 53항) + B의 V 클러스터에 V+상조사
  2자 병합 토큰 추가(클러스터 base만 VO — 표면·분할 불변, 실단어 穿过·睡着는
  사전 게이트 보호·R1 되가름 원칙 불변). 보너스로 下过班류도 합류. 계약 +3
  (클러스터·날씨 f/l 캐리어·가드), 재스위프 32문 오탐 0(为了·除了 함정 포함),
  전체 vitest 2,458. 시연 아티팩트에 下过雨 줄 추가.
- **🀄 분석 개선 R5 — 고유명사 태그 사각 수확(2026-08-30, 오너 승인 "ㄱㄱ")**:
  실문장 스모크가 적발한 사각(谢谢/nr류 — 고유명사 존중 원칙 때문에 수확·판별기
  양쪽이 못 잡음)의 체계 수확. **CEDICT 대문자 판별자**(CC-CEDICT는 고유명사
  병음을 대문자로 적는다): jieba 고유명사류(nr/ns/nt/nz) 태그 HSK 단어 중 CEDICT
  독음이 전부 소문자면 일반어 오태그로 보고 HSK 품사를 수확(明白/nr→형용사·동사,
  星星/nz→명사, 换/nz→동사, 美丽/ns→형용사, 太阳·西瓜·师傅·沙发…), 대문자 독음이
  하나라도 있으면(北京, 성씨 겸용 毛·周·金) 존중·배제, 미등재도 배제(보수).
  수확 1,099→**1,495**(+396, 존중 72), 급수 데이터 불변·기존 수확 소실 0 검증.
  드라이런 선행(스크래치 — 규모·표본 품질 확인 후 생성기 반영). 계약 R5 스팟
  7종(수확 3·배제 3·배선 1). 전체 vitest 2,455.
- **🀄 분석 개선 R4a — 이합사 인지(2026-08-30, 오너 승인 "ㄱㄱ" — 권장안 A+B·수동
  시드)**: base_form=표면형 계약의 첫 명시 예외. zhSeparable.json 수동 시드 50
  (2자 V+O 상용 이합사 — RFC 최소 시드+개회·점채) + zhTokenFix 감지 3계층:
  A 통짜 삽입형(洗过澡/v → base 洗澡 — 표면·병음 불변) / B 분리형 회랑(V 1자 뒤
  3토큰 이내 O — 단독 또는 ≤4자 수량구 캐리어 말미, 사이 전 토큰 조사·수량구
  화이트리스트 필수·밖이면 즉시 중단; O 토큰 불변=이중 계상 방지) / C x-병합 양사
  个 꼬리 분리(帮个/x→帮+个→B). 실측 보정 3건: ⑴ 감지를 POS_FIX **앞**에 —
  수확층이 문맥 태그를 뒤집어 불발(干了一杯의 干 v→a) ⑵ 창 2→3(수량구 비융합
  抽了一根烟 실측) ⑶ V 고립 기본값 태그 4종 허용(x·上下/f·理照/n·点/m — 시드
  가입+회랑이 게이트). 32문 오탐 스위프 0·정탐 확인, 쓰레기 병합(去理/x)·장거리
  삽입은 문서화 무개입. 저장·만남·FSRS 합류는 기본형 우선 규약(vocabIO) 재사용 —
  코드 무변경. 계약 15종(우주·형식·RFC 표2 전 행·가드), 전체 vitest 2,454.
  뷰어 문구(§6-3)는 R4b(목업) 대기.
- **🀄 분석 개선 보강 검사 + R2 보수(2026-08-29, 오너 "결과 검사 했나" 대응)**: 로드맵
  4라운드의 사후 전수 검사 3종을 수행해 실결함 1건을 잡았다. ① R2 전수 교차검증
  (2,029항 음절별 pinyin-pro 대조) → **성조 변조(sandhi) 회귀 적발**: CEDICT 원조
  (不在乎 bu4)를 그대로 실어 라이브러리가 맞게 내던 변조(bú, #1004)를 되돌리고 있었다
  → 생성기에 단어 내부 변조 규칙(不+4성→bú, 一+4·5성→yí, 一+1·2·3성→yì) 추가,
  재생성 2,018항. 변조 후 라이브러리와 일치해진 11항(不在乎·一辈子)은 ①필터가 정상
  제외(오버라이드 불요 — 실문장 검증). 잔여 유성조 불일치 175는 전부 다음자 교정형
  (穿着 zhuó류 — CEDICT 정본 승리, 유지). sandhi 전수 계약 추가. ② R3 수확 무작위
  40개 눈검사 → 40/40 수용(约 d→v 플립은 nr·d가 판별기 밖이라 오히려 판별 입구를
  여는 개선으로 판정). ③ 실문장 스모크 16문 → R1~R3 실전 정상 + 선재 이슈 2건 발견·
  수리: **参加=shēn jiā 병음 오독**(pinyin-pro 탐욕 매칭이 人|参加 경계를 넘어 人参
  매칭 — [수사]+人+参加 초상용 패턴 전멸) → 경계 오독 오버라이드 층 신설
  (zhPinyinFix.js, 경성 사전과 같은 토큰 정확 일치·등재 밖 무개입) / **谢谢·安静 =
  인명(nr) 오태그** → 수제 POS_FIX 수리(고유명사 태그는 수확·판별기 양쪽 사각이라
  자동 경로 없음). 후속 제안 기록: HSK 단어 중 고유명사류 태그 517건 우주의 체계
  수확(CEDICT 병음 대문자 = 진짜 고유명사 판별자) = R5 후보. 계약 +5, 전체 vitest 2,439.
- **🀄 분석 개선 R4 RFC 게시 — 이합사 인지(2026-08-29, 로드맵 완주)**: base_form=표면형
  계약의 첫 예외라 RFC 선행(rfc-zh-separable-verbs.md). 실측 표(삽입형 3양상 — V…O
  분리형·통짜 등재 洗过澡·x-병합 帮个, O의 양사구 흡수 一架·一面·一觉) + 감지 3계층
  설계(전부 zhTokenFix 후처리, 저장 키 '기본형 우선' 규약 재사용 = fr 굴절 §4.8 모형)
  + 오너 결정 3항목(감지 범위 A+B/A·시드 전략 Wiktionary 3,121 vs 수동 30~50 선행·
  뷰어 문구). **로드맵 R1~R4 처리 완료** — R4 구현은 RFC 승인("R4a ㄱㄱ") 대기.
- **🀄 분석 개선 R3 — HSK 급수·품사 계층(2026-08-29, 로드맵 연속)**: ivankra/hsk30
  (MIT, 공식 HSK 3.0 목록 11,092단어)에서 ⑴ 급수 정본 10,935항(zhHskLevel.json,
  1~6급+7-9밴드=7, 파이프 변형 분해·낮은 급수 우선) + 조회·자료 난이도 프로필 순수
  함수(zhHskLevel.js — byLevel·unknownByLevel·미담김 중앙값. UI 노출은 목업 승인 후,
  i+1 R1→R2 선례) ⑵ 품사 충돌 수확층 1,099항(zhPosFixHsk.json — jieba 계열과 HSK
  집합이 서로소인 충돌만, 내용어 한정·고유명사 제외·겸류 교집합 일치 취급·기능어
  태그(ug류 387) 존중 — 실측: HSK가 过를 V로 등재하나 문장 속 단독 过는 상조사라
  뒤집으면 오태그, 수확 조건에서 배제하고 어소·미지 태그(癌/ng류)만 미상 보강).
  zhTokenFix POS_FIX 2층 조회(수제 우선) 배선. 계약 8종, 전체 vitest 2,434.
  잔여 옵션 기록: 겸류 미인지 확장(计划 n→V/N 후보)은 판별 호출 비용 트레이드오프라
  별도 결정 대상. R4(이합사)는 RFC 게시 후.
- **🀄 분석 개선 R2 — 경성 사전 CEDICT 층 2,034항(2026-08-29, 로드맵 연속)**: 수제 44항
  위에 CC-CEDICT(© MDBG, CC BY-SA 4.0 — npm cedict-json@1.3.20251213, 124,188 표제어)
  추출층을 깐 2층 구조. 생성기(scripts/build-zh-neutral-tone.mjs)가 수제 등재 기준을
  그대로 기계화: ① 라이브러리 정답 995 제외(pinyin-pro 단어 실측 대조) ② 이독 병존
  다의어 159 배제(地道·告诉류 — 知道조차 CEDICT는 4성이라 수제가 정본, 2층 우선순위의
  실증) ③ 방향보어·边 68 배제 + 고유명사 92·얼화 650(后儿 hòu r류 — 글자수 우연 일치
  잔존을 r5 명시 배제로 봉합)·5자 이상 속담 컷. 계약 9종(형식·경성 실재 전수 자기검증,
  다의어·방향보어·라이브러리 정답 배제 스팟, 병합 우선). 전체 vitest 2,426.
- **🀄 분석 개선 R1 — 분할·품사 후처리(2026-08-29, 오너 "로드맵 승인 ㄱㄱ")**: zhTokenFix
  정본 신설(경성 사전과 같은 화이트리스트 계층). ① 没V 되가름 27종 — 상용 1자 동사 55종
  전수 프로브에서 병합 28종 수확, 실단어 没用만 제외(没有·没关系류 불변 계약). 되가른
  没는 구조 확정 부사, 단독 没은 부사·동사 후보로 문맥 판별기 이음새 재사용. ② x-조각
  (HMM OOV)의 상조사 분리(过架→过+架) — 从来没吵过架가 从来/没/吵/过/架로 선다. 일반
  V过/V着 분리는 실측상 절반이 실단어(穿过·睡着·接着)라 원칙적 배제, 배제도 계약으로
  고정. ③ POS_FIX: 自觉(d→동사+동사·형용사 후보)·很(zg 미지→부사)·自觉遵守(ns 오병합
  →분리). add_word/빈도 조작은 실측 배제 근거 명기. 계약 11종, 전체 vitest 2,417.
  다음: R2(CC-CEDICT 경성 대량 확장) → R3(HSK 품사·급수) → R4(이합사 RFC).
- **📏 막대 바닥 보정 — 전각 정방 1em(2026-08-29, 오너 실기 보고 "아래가 짧아 보임")**:
  잉크 실측 0.96em은 Noto 기준(바닥 1.54em)이라 잉크가 베이스라인 아래 0.12em까지
  내려오는 글꼴(PingFang)에선 막대 바닥이 1~2px 짧았다 → --hl-glyph-h를 전각 한 자
  크기 1em(0.58~1.58em)으로. '막대 = 글자 한 자 키'라는 글꼴 무관 정의가 되고, 하네스
  확대 크롭 실측(잉크 대조 위 1px·아래 0.5px)으로 원문과 같은 키 확인.
- **📏 막대 높이 = 글자 잉크 키(2026-08-29, 오너 지시 "글자 최대 높이에 맞춰서")**: 막대가
  밴드 범위(0.58~1.62em) 기준이라 글자 아래 여유 0.08em만큼 단어보다 길쭉해 보이던 것을,
  글자 잉크 실측(0.58~1.54em) 기준 --hl-glyph-h(0.96em)로 교체. 버튼(2.2em·top) 기준
  절대배치라 보정값 없이 좌표 공유(top = --hl-band-top), 데스크톱 right:0·모바일 left:0으로
  기존 flex 자리 유지. 하네스 실측: 막대 vs 他 잉크 Δ 1px 이내. 계약 핀 갱신(--hl-glyph-h
  확정값·top/height·transform 부활 금지 유지).
- **📐 밴드 후속 수리 — 막대 기하 정렬·색 경계 이음매(2026-08-29, 오너 실기 보고 2건)**:
  ① 세로 막대의 middle 정렬+실측 보정(0.15em)이 x-height(글꼴) 의존이라 실기 PingFang에서
  어긋남 → 버튼을 2.2em·top 정렬로 바꿔 flex 중앙 = 밴드 중앙(1.10em)을 보정값 없이 기하로
  일치(전 글꼴 정확, 히트 영역은 22px×2.2em으로 오히려 확대). ② 기본 자간(4px)에서 밴드
  ±2px가 이웃과 정확히 맞닿아 색 경계가 앞 글자 잉크에 밀착 → 밴드 ±1px + 이음매 상자
  [W, W+gap]으로 조정, 모든 색 경계에 중립 이음매 2px 노출(시연 승인 모습의 기본 자간
  등가·怪不得,大家류 경계도 기본 자간에서 복원). 하네스 재실측(막대 Δ중심 0.2px·조판
  HEAD 동일·T1 범위 불변) + 계약 핀 갱신(보정 transform 부활 금지·±1px·이음매 상자).
- **🖍️ 하이라이트 글자 밴드 + T1 혼색 전이(2026-08-29, 시연 3종→"ㄱㄱ 실구현")**: 상태·
  저장·복습·지정의 모든 면 칠을 .surface 직접 배경에서 ::before 글자 밴드(0.58~1.62em,
  잉크 실측 — 병음 y·g 디센더와 0.08em 여유)로 이전. surface를 inline-block+스택 문맥으로
  승격(인라인 절대배치 좌표계 결함의 수리 — 조판 실측 불변: 셀 좌표·총높이 동일). 지정 중
  상태는 밑줄 강등 대신 **혼색**(킨들 겹침 문법 — 지정색×상태색 color-mix, 불투명 등가
  원칙 승계), 이음매는 항상 지정색 전용 조각(:has+z:-2, 칠 범위 지정 전후 픽셀 불변),
  전이 0.18s 크로스페이드. 문장 막대 시각도 --hl-band-* 공유(히트 불변, δ 0.15em 실측).
  계약: hlBand 신설(변수·기하·혼색 4종·직접 도색 소멸·막대 공유) + pickedEffect 승계
  갱신(불투명 등가·글리프 불가침을 밴드 구조로). 하네스(실CSS+실마크업) 픽셀 검증 동봉.
- **🧩 글자 카드 R4b — 스토리 폐포 완결(2026-08-28, 오너 지적 "드릴 중 R4 설명 안
  나오는 부분" → "ㄱㄱ")**: 시드(269) 밖으로 새던 드릴 경로를 실측(한 탭 270자·전체
  폐포 454자)하고 454자 전량 자체 저작 — 획 부품("삐침"·변방 조각), 정체 변주(愛 =
  心을 되살린 판), 신자체 고리(日 칩 간선까지 폐포에 편입해 잡은 52자). 합계 723자.
  **폐포 완결 계약** 신설: 스토리 글자에서 성분·자형·日 칩으로 몇 번을 파고들어도
  스토리가 안 끊김을 고정점 계산으로 전량 검증(언급 닫힘·길이 계약도 전량 첫 판
  통과). 동봉 수리: 변형 슬롯(繁·简)에 우주 밖 확장 글자가 새던 것(탭 시 빈 카드)을
  성분과 같은 우주 소속 필터로 봉합 — 간체 슬롯의 유령 2천여 건 제거.
- **🈚 글자 카드 R5 — 신자체 구멍 봉합(2026-08-28, 오너 "R5 ㄱㄱ ④ 포함")**: 오너 질문
  "간번체만 되면 신자체는?"의 실측 답(신자체 고유 자형 楽·駅·円 등은 Unihan 간번체
  필드가 중국 간화 기준이라 자형 칩이 안 뜸)을 라운드로. 구자체 슬롯[5] 280자 =
  hanjaJa 역전 ∪ kJapaneseOldVariant — 역전만 하면 간체가 침투(楽→"乐樂" 실측)해서
  '자기 번체 보유 = 간체' 필터로 배제, 침투 금지를 데이터 계약으로 고정. 카드엔
  正 칩(정자 — 옥편·훈음 정본과 같은 자형) + 日 사슬(乐→樂→楽 자형 삼각형). ④ 자형
  칩(日·繁·简·正) 전부 탭 = 그 자형 카드로 이동 — 신자체처럼 훈이 '음만'인 글자도
  정자 카드로 건너가 온전한 훈음·분해를 본다. 신규 조달 0(전부 기확보 원천).
- **📖 글자 카드 R4 — 구성 풀이 스토리(2026-08-28, 오너 "R4 ㄱㄱ")**: 최빈 시드
  240자 안팎 자체 저작(hanjaStory.json — 참조 어휘 HSK·JLPT에서 빈도 추출한 상위
  215자 + 실본문 기능어 보강). 회의자는 조립 이미지("女가 子를 안은 모습 — 좋다"),
  형성자는 뜻+소리 정직 표기, 간체 통짜는 번체 경유. **한자 언급 닫힘 계약**: 스토리
  속 모든 한자는 자기·부수·성분(2단)·간번체(와 그 성분)만 — 엉뚱한 성분 언급이
  테스트로 차단(전량 첫 판 통과). 카드의 구성 줄 아래 한 문장, 미등재는 조용히 생략.
  획순(KanjiVG CC BY-SA)은 별도 후보로 잔류 — 오너 결정 대기.
- **🔎 글자 카드 증강 R1~R3(2026-08-28, 설계 보고 → 오너 "R1~R3 ㄱㄱ")**: "한자·뜻·음뿐
  이라 빈약·중복" 해소 — 글자 카드는 단어 카드가 못 하는 것만 갖는다. R1 이 자료
  재등장(분석 사전 본문 순 스캔 — 신규 데이터 0) + 다시 만나기 구획(이 자료·내 단어).
  R2 hanjaEtym.json 20,902자 전량(획수·부수·간번체) — unicodetools dev Unihan 4필드,
  부수 214표는 kRSUnicode 대조 자기검증이 빌드 게이트(unicode.org 직결이 프록시 차단
  → 공식 GitHub 리포로 수급). R3 구성 1단 분해 17,939자(BabelStone IDS — 허락·출처
  불요 명문 확인, GPL 계열 cjkvi-ids·makemeahanzi 배제) + 성분 훈음 칩(기존 훈음
  정본 라벨)·부수 배지·탭 재귀 탐색. **부수는 설명하지 않는다** — 배지+메타 한 줄
  ("13획 · 부수 心 마음 심")이 전부(설계 확정). 563KB 지연 청크는 글자 카드 최초
  열림에만(한자 대조 토글 무관). 닫힘성 계약(전 성분 = 음 정본 소속 — 범위 필터의
  U+9FA6+ 확장자 누수를 실측으로 잡아 교정) 포함 신규 테스트 13종.
- **Aa 읽기 설정 시트(2026-08-28, 시연 아티팩트 3안 비교 → 오너 "다시 구현" — A 표준
  시트+프리셋 줄 채택)**: 설정 카드 전면 해체 → 액션바(설정 아닌 것만: 읽기 완료·학습
  링크·분석 중단) + Aa 하단 시트. backdrop 무광(본문이 곧 미리보기 — 시연 합의), 통일
  행 문법 [2자 라벨][컨트롤], 문구 크기→글자·줄 간격→행간, 조판 순서 글자→배경→폰트→
  행간→자간. 신설 3종: ⑴ 발음 표기 3단(전체/모르는 단어만/없음 — 구 후리가나 토글
  이관 승계, '모르는 단어만' 실시맨틱 v1 = 아는 단어·담은 단어 숨김: 담은 말 능동 회상,
  신규·만남엔 크러치 유지 — furi-off 폭 예약 메커니즘 재사용) ⑵ 세피아 배경(테마 변수
  4벌 동반: 본체·--picked-bg·--ws-*·--ws-*-ln) ⑶ 말하기 속도 0.75×/1×/1.25×(서버 음성
  Audio.playbackRate + Web Speech rate 이원 매핑 — normal=현행 0.85 보존 계약, 뷰어 ▷
  3곳 공통). 읽기 모드 프리셋 3장(몰입/학습/암기 — 표시 4키만 대입, 조판 불가침) +
  도구 행(받아쓰기·재분석 — 이모지 제거, 오너 지시). 값 체계는 readingSheet.js 캐논
  +계약 테스트 10종. 문구 핀 2건(집중 모드·한자 대조) 스위치 행 기준으로 재작성,
  pinyinRuby 핀은 재사용으로 생존. **같은 날 오너 지시로 B 탭 시트 전환**: 글자/표시/
  도구 3탭(도구 없는 자료는 2탭), 프리셋 줄은 탭 무관 상단 유지, 글자 탭 안 크기 행
  라벨은 '글자'→'크기'(탭명과 중복 해소 — 오너 문구 지시).
  링큐식 배경 하이라이트를 뷰어 토글로 — 신규(파랑 진)·만난 말(파랑 연, 만남 데이터
  고유 활용)·학습 중(노랑)·복습(주황+기존 펄스)·앎(무표시 — 링큐 철학). 상태 판정은
  wordState.js 캐논(우선순위 due>saved>known>met>new 계약 테스트 11종), 데이터는 전부
  기존 정본 파생(저장·due·user_known_words·만남 스냅샷 — 신규 저장 0). 켰을 때만 계산
  (기본 경로 불변), 지정(picked) 배경이 항상 우선, 테마별 색 변수(--picked-bg 선례).
  A/B 비교는 목업 아티팩트로 합의 — UI 목업 우선 규약 준수. 보완(오너 지적): 지정 중
  상태 정보 소실 → 지정 배경 위에 상태를 밑줄로 강등 유지(picked+due는 기존 주황
  밑줄·펄스 자연 잔존).
- **🀄 병음 경성 사전(2026-08-27, 오너 보고 怪不得→guài bù dé 실측 승인)**: pinyin-pro
  내장 사전의 필독 경성 공백(朋友·时候·V不C의 不 등)을 zhNeutralTone.js 46항으로
  오버라이드 — 후보 85종을 라이브러리로 전수 실측해 오답만 등재(이미 정답 39종 제외),
  다의어(大意·买卖)는 배제하고 东西만 근거 명기 예외. customPinyin 전역 등록은 단어
  경계 오염 실측(这本|事先에 本事 매칭·东西南北 변형)으로 배제 — jieba 토큰 정확 일치
  시만 적용해 변조(不对→bú)·성어(迫不得已) 불변. 계약 테스트 7종. 기저장 단어장
  병음은 소급 안 됨(신규 분석부터), 개별 교정은 뷰어 '뜻·발음 수정' 병용.
- **🚩 진도 국기 탭 한 줄 정렬(2026-08-26, 오너 지시)**: 제목 왼쪽·국기 오른쪽 정렬
  한 줄로. #959의 2단 고정은 텍스트 칩 시절 처방 — 국기 이모지 전환 후 재정정.
- **📊 '오늘 활동' 타일 폐지(2026-08-26, 오너 확정)**: 데이터 겹침은 0이었지만 자기활동
  거울 4개 중 '오늘 활동'이 반쪽 지표(기기 localStorage 한정·'오늘 목표'와 중복·0 상시
  표시)라 제거. 이번 주 4×1 카드를 그 1×1 자리로 축소(대표 축 폴백 사슬), 전체 거울은
  탭 모달(TileModal 정본 재사용). 계약 핀 5종·역검증 2조.
- **🔤⚔ 인박스 마지막 2건(2026-08-26, 오너 "둘 다 ㄱㄱ")**: #1077-3 [더 쉽게] — 뷰어 좌측
  [자세히] 위 토글, 지정 문장을 같은 언어의 쉬운 말로(viewer_ez: 캐시, useGrammarDetail과
  같은 결, 서버·스키마 0). #1077-15 ⚔ 재대결 큐 — /vocab 히어로 스트립, 최근 2주 오답
  가중 상위 ≤12(computeWeakness 정본·14일 창 = 주간 약점 세션과 동일). startReview를
  startSession으로 정본화해 채점 경로는 한 길 유지. 이음새는 승인대로: 배너는 조회만,
  채점은 공유 원장에 쌓여 일요일 세션과 자연 dedup. 계약 23본·역검증 5조.
- **🔔 예보 푸시 cron 등록(2026-08-26, 오너 확정)**: `0 11 * * *` = KST 20시로 등록. 라우트는
  매시+preferred_hour 매칭 → **하루 1회 전원 발송**으로 전환(하루 1회 크론에서 시각으로
  거르면 그 시각 가진 소수만 받는다). **전제 정정**: Hobby 제약은 'cron 2건'이 아니라
  **주기**(하루 1회 이하)였고 개수는 100개다 — 오너가 고른 ⑶ 합병의 근거(슬롯 부족)가
  성립하지 않아, 의도(Hobby 유지·희생 없음)를 지키되 독립 일 1회 cron으로 갔다.
  #1141의 `length <= 2` 핀은 틀린 사실을 계약으로 굳힌 것이라 주기 검사로 교체.
  틀린 '슬롯 2/2' 서술을 문서 4곳에서 제거. 역검증 3핀. **남은 것은 오너 수동 — VAPID 3종·
  CRON_SECRET env.**
- **🚪 문장 목록을 독립 입구로(2026-08-25, 오너 지시)**: 본문 폼에 붙여넣은 뒤 반응하는
  감지 배너가 아니라 **PDF·EPUB와 같은 층의 세 번째 문**으로 만들었다. 제목·언어·난이도·
  과 크기를 그 안에서 다 정하고 나눈다. 초안이 자기 언어·난이도를 들고 오게 해 등록이
  본문 폼 상태에 의존하지 않는다(setState 비동기로 옛 값이 박히는 함정 차단). 본문 폼의
  배너는 한 줄 안내 + [문장 목록으로 옮기기]로 낮춰 **문을 하나로** 유지한다. 초안
  미리보기는 만든 문 옆에 펼친다. 계약 핀 역검증 3종.
- **📋 문장 목록 반입 R1+R2(2026-08-25, 오너 승인)**: HSK5 교재(1,300단어 / 320문장 /
  16문장·과)를 앱에서 이어 공부하기 위한 경로. 기존 글자 수 분할로 넣으면 챕터 1개·320줄이
  되고 /api/analyze의 100줄 캡에 잘려 **220문장이 영구 부분 실패**로 굳는다(시뮬레이션 재현).
  `splitLinesIntoChapters`(줄 수 분할·캡 클램프)·`clampLinesPerChapter`(화면·엔진 단일 규칙)·
  감지 배너·문단 자동 감지 건너뛰기(ja 요청 20→320건 방지)·비공개 고정(`privateOnly`).
  R2로 `bookFit`(챕터 types 합집합 — 평균은 재출현 단어를 반복 가산해 커버리지를 부풀린다)과
  서재 책 카드 "N단어 중 X% 앎". **스키마·서버 변경 0.** 계약 핀 역검증 5종.
- **⏰ 조용히 죽은 cron 라우트 계약(2026-08-25)**: `/api/cron/send-forecast`는 라우트가
  완성돼 있는데 vercel.json crons에 없어 한 번도 실행된 적이 없었다 — 코드·테스트·배포
  전부 green인데 기능만 없는 침묵. `cronRegistration.test.js`로 "등록됐거나 PENDING에
  이유가 있거나" 둘 중 하나를 강제해 세 번째 상태(조용한 죽음)를 없앴다. Hobby 제약도
  같은 파일에 핀. **정정(2026-08-26)**: 그 제약은 개수(2건)가 아니라 **주기**(하루 1회
  이하)였다 — 개수는 모든 플랜 100개다. 핀을 주기 검사로 바꿨다. 역검증 3핀 확인.
- **🔍 #1079형 회귀 전수 재감사(2026-08-25)**: 마이그레이션 72본에서 테이블·컬럼을 뽑아
  클라이언트 select 전량과 대조. 후보 38건 전부 `.eq` 필터·insert 페이로드 오탐, 실제
  드리프트 0건 — #1136이 마지막이었다. 감사 스크립트는 오탐률이 높아 리포에 남기지 않는다.
- **[배치 기록 2026-08-23~25]** 아래는 진행 중이던 일이 아니라 **끝난 배치의 연대기**다.
  doing에 1,180줄이 쌓여 다른 네 열과 달리 보드가 '진행 중'을 거짓으로 말하고 있어
  done으로 옮긴다(2026-08-25 정리). 이 열의 doing은 **실제로 손에 쥔 일만** 둔다.
- **🎛️ 오케스트레이션 전환(2026-08-23, 오너 "Chatgpt 세션 1~4개 있으니까 너는
  오케스트레이션해. 작업 간다 ㄱㄱ")** — #1077 제안 리스트 중 권고 4건을 분산
  발주(전부 순수 엔진+계약 테스트 — UI·카피·마이그레이션·검수·머지는 Claude
  단일 창구 유지): C1 받아쓰기 채점(5386786944) · C2 재독 선정(5386788169) ·
  C3 산출 단어 선정(5386789708) · C4 빠른 분석 조사 RFC-first(5386791238).
  WORKING 30분 룰 — 무표식 발주는 회수해 직접 수행. Claude 병행 트랙: #1077
  제안 14 '이미 앎' 설계·목업(⚠마이그레이션 — 목업 승인 후 구현) + 검수 게이트.
  참고: #1077 소화 현황 — 제안 2는 서재 i+1로, 5·19·15는 부분(문맥 cloze·주간
  대시보드·약점 재주입) 기소화 확인(2026-08-23 대조).
  **Codex Cloud 전환(오너 확정 "ㄱㄱ")**: 로컬 상주 Codex-1~4 → Cloud 태스크
  체제. AGENTS.md 개정(Cloud 규약 본체 + 구 월드 geo 규약 부록 보존) — 발주는
  이제 Claude가 복붙용 태스크 프롬프트 블록으로 제공, 병렬은 파일 비겹침
  태스크만, 산출은 태스크당 draft PR, WORKING 룰은 "PR 미도착 1시간 회수"로
  재정의 (PR #1119).
  **회수 실행(16:03 스캔 — 4건 전량 무표식)**: 회수 공지 5386950005 게시 후 직접
  수행 — ㊿ 엔진 3본(dictation.js 언어별 정규화+diffChars 채점 / rereadSchedule.js
  KST 14일 경계·최신순 3 / outputWords.js 오늘 채점·오답 우선·폴백 — 발주 SPEC
  그대로, 계약 16핀) + 빠른 분석 조사 완료(analyze API 무저장 설계 실측 — 서버
  변경 0 재사용 가능). 게이트: 전체 vitest 2,053(+16) green (#1118 merge 4985966).
  **UI 라운드 1차(오너 "좋아 이제 진행해보자" — 목업 ②③)**: 재독 홈 카드
  (RereadCard — 완독 14일 후보 있을 때만, '오늘 읽기' 아래·그룹 카드 위, 조회
  실패 조용히) + 산출 주입(useOutputWords 훅 — 오늘 KST 하한으로 서버측 축소,
  OutputWordChips: 작문 입력 카드 상단(표시 유도만 — 채점 강제 없음) · 회화 패널
  상단(학생이 쓰면 ✓) + 회화 튜터 프롬프트 시작·진행 양쪽 조건부 자연 주입
  ("Never force them")). 배선 계약 2핀. 게이트: 전체 vitest 2,055(+2) green
  (#1120 merge abbc5fc). **UI 라운드 2차(목업 ⑤ '이미 앎')**: user_known_words
  마이그레이션(own-only 3정책 — 만남과 달리 취소용 delete 포함·anon 차단·학습
  테이블 무접촉 핀) + knownWords lib(언어 코드는 만남 매핑 재사용·
  mergeKnownIntoIndex 순수 합집합 — **materialFit 엔진 시그니처 무변경 합류**) +
  서재 커버리지 정밀화(fitById에 known 합집합 인덱스) + 뷰어 단어 시트
  [👌 이미 알아요]/[표시됨—취소] 토글(저장된 단어엔 숨김·실패 조용히). 계약
  7핀. 게이트: 전체 vitest 2,062(+7) green (#1121 merge f431cc9 — 마이그레이션
  자동 적용 success). **UI 라운드 3차(목업 ① 받아쓰기)**: DictationPanel —
  지정 문장(leftPanelText) 대상 🎧 진입(문장 ▷ 옆), 열림 동안 원문 가림([본문
  보기] 전까지 — 듣기 훈련 전제), ▷ 다시 듣기(useTTS 재사용)·글자 diff 채점
  (gradeDictation — 파랑=놓침·취소선=잉여)·정답률·[한 번 더]. Codex dictationPick
  엔진(추천 문장)은 도착 시 후속 합류. 배선 계약 1핀. 게이트: 전체 vitest
  2,063(+1) green (#1122 merge a3479f5). **UI 라운드 4차(목업 ④ 빠른 분석 —
  5종 완결)**: /quick — /api/analyze 무저장 재사용(서버 변경 0 — 인증 401·분당
  20회·100줄×200자 캡을 클라가 같은 숫자로 미러, 계약 테스트가 route.js 상수와
  대조). 토큰 렌더는 뷰어 정본 부품(splitRuby·pinyinToneClass·word-token CSS·
  rt-an WebKit 수리 승계), 탭 사전은 PDF 뷰어 팝업 계약(fetchWordDetailText·
  formatDetail·TokenPosLabel) 재사용. 결과 상단 '저장 안 됨 · [자료로 저장]' —
  초안 sessionStorage 핸드오프(manabi_quick_draft 1회성)로 추가 화면 프리필
  (저장 흐름은 기존 하나뿐). 게스트는 로그인 안내. 서재 헤더 입구(무저장
  해부라 '추가 입구 하나' 원칙과 무충돌 — 주석 근거 병기). 계약 10핀. 게이트:
  전체 vitest 2,073(+10) green (#1123 merge d5552e0). **UI 라운드 ①~⑤ 전체 완결**.
  **㊿ 오너 확정 2건 계약화(2026-08-24)**: ⑴ `user_verified` 보호 = **DB 무손상까지**
  (표시 우선 아님) → `userVerifiedScope.test.js`에 **양쪽 다** 못 박음 — 지켜야 할 것
  (writeback 목록 제외 + 라우트 `source='gemini'` 이중 조건)과 지키지 않기로 한 것
  (resolveZhTokenPos가 pick을 캐시 POS보다 앞세움). 한쪽만 고정하면 '표시도 우선이어야
  하는 것 아니냐'는 오독이 조용한 동작 변경으로 들어온다. 조사 리포트 §미해결 1도 확정
  기록(2~4는 열린 상태 유지). ⑵ 받아쓰기 → review_events **기록 안 함** → 순환 지도
  이음새를 '부채'에서 **의도적**으로 재분류. 근거 기록: source를 신설해 값을 넣는 순간
  isGradedReviewEvent가 ui·dict만 제외하므로 weeklyReport·growthStats·적응 출제의 기존
  집계가 전부 새 출처를 흡수한다 — 스스로 채점해 스스로 끝나는 훈련이 그 파급을 살 이유가
  없다. 계약 5핀.
  **재독 되부름 UI 통합(오너 지시 2026-08-24)**: 전용 카드('📖 다시 읽어볼까요' + 본문 +
  버튼)를 폐지하고 '교재 이어서 학습'과 **같은 부품**(.lessons-continue)·같은 크기 한 줄로
  통합, 배치도 그 바로 아래로 이동. 근거: 둘 다 '하던 걸 이어서' 한 줄인데 서로 다른 카드
  형태를 쓰면 홈이 같은 성격을 두 문법으로 말한다. 새 CSS 0(기존 클래스 재사용 — 여백·
  높이·hover 자동 승계). 문구: kicker '다시 읽기 · 두 번째는 훨씬 빨라요' / title 자료
  제목 / meta 'n일 만에 →'. 옛 문구 부활 금지 핀 포함. **읽은 횟수는 계속 무기록**
  (오너 확정 — reading_progress에 카운트 컬럼 없음, 재독해도 아무것도 안 쌓인다).
  게이트: 전체 vitest 2,260 green + features-r2 e2e 5/5·대조군 9/9(실렌더 확인).
  **[버그 수리] 홈 단어 복습 타일이 빈 글자를 돌리던 고장(오너 제보)**: ProfileStats의
  user_vocabulary 조회가 `created_at, last_reviewed_at, next_review_at` 세 컬럼만 끄는데
  ReviewTile은 `id·word_text·meaning`을 렌더했다 — 행은 있으니 '단어 없음' 폴백으로도
  안 빠지고 3.5초마다 **빈 글자만 교체**됐다. 원인은 #1079 쿼리 다이어트(8/20)가 select를
  좁히며 표기·뜻을 빼간 것(타일은 8/19 #1053부터 그 필드 사용) — **나흘간 조용히 고장**.
  수리: 필요한 3필드 복원(다이어트 취지 유지 — `*`·source_sentence 여전히 안 끎).
  **재발 방지 2층**: ⑴ profileStatsSelect 계약 테스트가 조회 필드 ⊇ 렌더 필드를 대조
  (고장 상태로 되돌려 실패 확인 — 3핀 정확히 적중) ⑵ 기존 queryDiet 핀이 **깨진 select
  문자열을 통째로 박아둬 고장을 계약으로 고정**하고 있던 것을 의도(전 컬럼·큰 컬럼 금지)
  기준으로 교체. #1079가 좁힌 나머지 4곳도 전수 확인(홈 recentProgress는 .length만 소비 —
  무해). 게이트: 전체 vitest 2,269 green.
  **'이어서' 덱 — 한 자리 가로 넘김(오너 재지시·설계 승인 2026-08-24)**: 앞선 통합은
  세로 두 줄이었는데 오너 의도는 **같은 자리에서 옆으로 넘기는 형태**였다. ContinueDeck
  신설 — 교재 이어서 학습·다시 읽기를 항목 배열로 받아 scroll-snap 캐러셀로 낸다.
  **방식 조사**: CSS scroll-snap 채택(0kB — 관성·키보드·터치 감이 네이티브), embla(~5kB)·
  swiper(~40kB)·자체 터치 핸들러 배제(2~3장·자동재생 없음·무한루프 없음에 과잉).
  오너 확정: 라벨 없이 점만(카드 아래 중앙)·폭 무관 동일 조작. 다음 장 8% 걸침으로
  "넘길 게 있다"를 말한다. 재독 조회는 useRereadCandidate 훅으로 분리(덱이 **개수를
  먼저 알아야** 껍데기를 결정 — 컴포넌트가 스스로 null 내는 구조로는 셀 수 없다),
  RereadCard 폐지. **e2e가 잡은 실제 결함**: 단독일 때 다른 트리를 그리면 항목이 1→2로
  늘 때(교재 카드가 늦게 붙는 실경로) 카드가 remount돼 화면이 튀고 잡고 있던 노드가
  detach된다 — 구조를 한 갈래로 두고 폭·점만 바꾸는 방식으로 수리. 계약 6핀(단독 껍데기
  없음·같은 부품·점=개수·reduced-motion 양면·라이브러리 0·반응형 분기 없음).
  게이트: 전체 vitest 2,275 green + features-r2 5/5 연속 2회·learning-flow 9/9·smoke 14/14.
  **덱 확장 — 홈 알림 전부 겹치기(오너 지시 2026-08-24)**: 예보·함께 읽기까지 덱에 흡수
  (ForecastCard·GroupEntryCard 폐지 → useGroupEntryItem 훅 + forecastTapEvent lib 이관,
  예보 침묵 계약·탭 계측 보존). 순서는 기존 홈 우선순위 그대로 예보→교재→재독→함께.
  **성격별 색**: 진행=--primary 테라코타 / 시간 민감=--warning 황금 / 함께=--accent 초록
  — 함께 읽기는 성격이 달라 진행 계열의 빨강을 쓰지 않는다(오너 지시). social 규칙에
  --primary·--danger 금지 핀. **높이 고정 112px**(오너 지시 "줄 수에 따라 크기 달라지는
  거 방지 — 애초에 전부 키우던지"): 제목 2줄 클램프 + 칩 줄 max-height로 예보 카드만
  커지지 않게 상한. 계약 10핀. 게이트: 전체 vitest 2,279 green + features-r2 5/5 연속
  2회·learning-flow 9/9·smoke 14/14(실렌더).
  **받아쓰기 추천 문장 합류(Codex #1124 엔진 소비)**: 뷰어 도구줄 [🎧 받아쓰기] →
  DictationPicker — 후보는 정본 문장 단위(sentenceNav.pickableSentences) 재사용,
  고르기는 pickDictationSentences 위임(담은 단어 = 표기·기본형 합집합). **목록에 원문
  무표시(글자 수만)** — 고르는 단계에서 정답이 보이면 받아쓰기 전제가 무너진다(계약
  테스트가 p.text 렌더를 .length 경유로 강제). 지정 문장 🎧와 추천 고르기가 같은 대상
  상태(dictationSentence)로 모여 패널 하나를 공유. 배선 계약 4핀. 잔무였던
  evaluation-and-strategy Phase 4 표 갱신 동봉(학습 그룹 ❌→✅, 70%→100%).
  (#1125 merge 1a5def0) **배치 후 자립 점검**: `next build` 474페이지 green(/quick 정적
  프리렌더 7.87kB 확인 — CI가 안 도는 게이트), lint 0 errors(기존 warning 2 무관),
  리팩터 잔재(dictationOpen) 0. **architecture-and-handoff §1.1 순환 지도 갱신** —
  신규 정거장 5종(받아쓰기·이미 앎·재독 되부름·산출 주입·빠른 분석 곁길)과 받침(주간
  리포트·학습 그룹) 반영 + 이음새 4행 추가. 그중 **'받아쓰기 채점 → review_events
  무기록'은 이번 배치가 새로 만든 부채로 정직 기재**(제품 나침반 3문 ⑶ 자기 적용 —
  기록하려면 source 신설 여부가 선결). #1077 백로그 실측 재점검: 완결 7/20,
  권고 Top3 = 2 커버리지 배지(부품 완비·목업 대기)·19 주간 리포트 푸시 마무리
  (web-push·/api/push 기탑재)·3 '더 쉽게'.
  **㊾ 커버리지 배지(#1077-2, 오너 ㄱㄱ)**: 뷰어 헤더 pill `아는 단어 n% · 새 단어 m개`.
  서재 카드와 **같은 엔진·같은 인덱스**(materialFit ← 담김 ∪ '이미 앎' mergeKnownIntoIndex)
  — 두 화면이 다른 수를 보이면 서로를 반증하므로 계산 동일성을 계약 테스트로 심었다.
  표본 미달(FIT_MIN_TYPES 20)·게스트·미분석은 무표기(0% 오표기 금지 — fitBand와 같은 결).
  새 쿼리 0(savedWords·knownWordSet 재사용). 계약 5핀. 게이트: 전체 vitest 2,255(+5) green.
  **T1(e2e 확장 R2, #1131) 검수 — 머지 보류**: 자체 게이트('연속 2회 green') 미충족.
  실측 3 pass / 2 fail이 3회 반복 동일(플레이크 아님) — 받아쓰기(문장 시트 미개방)·
  /quick(분석 결과 미렌더). **환경 유효성 먼저 확보한 뒤의 판정**이다: 대조군
  learning-flow가 처음 4/9 실패해 조사한 결과, e2e README가 경고한 함정(`.next`를 다른
  NEXT_PUBLIC_*로 빌드하면 인증 e2e 불신)에 내가 걸린 것 — config webServer.env로
  재빌드하니 대조군 9/9 green, 그 위에서 T1만 2건 고정 실패. CI가 이 파일을 돌지 않아
  (#1131 CI green은 기존 스위트만) 도착 CI로는 잡히지 않는 종류.
  Codex Cloud 첫 태스크(받아쓰기 문장 선정 엔진 dictationPick) 블록 오너에게 제공
  — PR 미도착(투입 대기 추정).
  승인 후)** — 전략 문서 Phase 4 잔여 ❌(학습 그룹) 대상, RFC = docs/rfc-study-groups.md.
  **실측(소셜 자산 전수)**: 소셜 스키마 3세대(포럼 3-29 · 공유 덱 4-05 · 기수제
  cohorts 6-13)가 전부 UI 없이 DB에 잠들어 있고(XP·notifications 소비 0 — evaluation
  표의 리더보드 ✅는 낡음), 실가동 학습 소셜은 material_comments(자료 댓글)뿐.
  제1 제약 = 네 번째 무덤 금지(UI-first·라운드별 최소 스키마). **권고안**: 초대
  코드 소그룹(≤8)이 이번 주 자료 하나를 같이 읽는 모델 — R1 그룹 뼈대+"이번 주
  우리"(주간 거울 합계, 등수 없음·원장 비공개·스스로 push하는 스냅샷만) → R2 같이
  읽기+**진도 게이트 토론**(내 진도 앞 코멘트 잠금 — StoryGraph 메커니즘을
  reading_progress×코멘트 진도 비교로 자체 구현) → R3 공동 목표(Duolingo Friends
  Quest 협동 구조, 보상·페널티 없음). 선례 표 7종(Habitica 연대책임 데미지는 압박
  배제 결 위반으로 배제, BookWyrm 코드는 라이선스 배제·패턴만, cohorts는 개조 대신
  패턴 3종 차용) + 목업 A·B·C + 오너 결정 항목 7번호 동봉(#1112 merge eea7cbb).
  **§9 전 항목 확정(오너 "1 승인, 나머지도 권고대로 ㄱㄱ")** → **R1 구현**: ㊸
  마이그레이션(groups·members·snapshots — own-only RLS 6정책·is_group_member
  definer·create_group 코드 서버 생성(혼동 글자 제외 6자)·join_group 그룹 행
  잠금 정원 직렬화·3그룹 상한 서버-클라 동치 핀·anon 전면 차단·원장 테이블
  무접촉 핀) ㊹ studyGroups lib(스냅샷 = fetchWeeklyReportRows 공용화(ProfileStats
  중복 정의 제거·캐시 키 공유) → snapshotFromWeekly(정답률 대신 correct 정수 —
  합계 재계산)·sumGroupSnapshots(등수 없음)·push 5분 스로틀·실패 조용히) ㊺
  /groups 페이지(목업 A 상단·하단 + C: 그룹 카드·이번 주 우리 합계 줄·코드
  공유 클립보드·나가기 2단 확인·3그룹 상한 폼) + 홈 진입 카드(목업 B의 R1
  축소형 — §9-5 홈 확정). 게이트: 전체 vitest 2,024(+11) green (#1114 merge
  665b5b2 — supabase-migrations 자동 적용 success 확인, 3번째 실측). **R2(같이
  읽기+진도 게이트 토론)**: ㊻ reads·comments 마이그레이션 — 같이 읽기는 **공개
  자료만**(비공개는 그룹원이 못 읽음 → WITH CHECK 서버 계약, 자료·원장 RLS
  무변경), 코멘트 user_id는 profiles 참조(작성자 조인 관례)·members에 profiles
  FK 추가 ㊼ 진도원 = 뷰어 스크롤 %(useReadProgress)를 useGroupReadPush가 세션
  최대값·30초 스로틀로 스냅샷 material_pct에 push(R1 예비 컬럼 개통 — 해당
  없음·실패 조용히) ㊽ 그룹 카드에 같이 읽기 블록(자료 지정·재지정(마지막 지정
  승리)·멤버 진도 바(가입순, 등수 없음)·이어 읽기) + **진도 게이트 토론**
  (gateComments 순수함수 — 내 진도 이하만 표시, "🔒 n% 이후 댓글 k개" 잠금 안내,
  작성 시점 진도 동봉. 원문이 공개 자료라 보안 아닌 UX 게이트) + 홈 카드 목업 B
  완형(「자료」+내 진도). §4.3의 멤버 fit 병기는 원장 비공개와 충돌해 배제
  (RFC 명시). 게이트: 전체 vitest 2,032(+8) green (#1115 merge 75f17cb —
  마이그레이션 자동 적용 success 확인). **R3(공동 목표 — §9-1 방향 완결)**: ㊾
  study_group_goals(주당 1목표, 축=주간 거울 4축 1:1 CHECK — 새 축 신설 금지 핀,
  지정은 같이 읽기와 같은 신뢰 모델·멤버 정책·anon 차단) — 진행은 기존 스냅샷
  합계에서만 읽어 **새 기록 이벤트 0**(goalProgress 순수함수: 달성 경계 ≥·초과
  100% 접힘·무효 목표 null). 카드 목표 줄 "🎯 함께 복습 300문항 — 지금 132
  (44%)" + 달성 시 조용한 "✓ 함께 해냈어요" — 보상 요소 부재 계약 핀(주석 제외
  코드·카피에 보상/페널티/스탬프/젬/XP 0, §9-6). 게이트: 전체 vitest 2,037(+5)
  green (PR #1116). **학습 그룹 3라운드 전체 완결 — 전략 문서 Phase 4 소셜
  100%(자료 토론·덱 공유 스키마·리더보드 배제 결·학습 그룹).**
- **📚 우리 사전 '만남' 모델 — R1 완료·R2 진행(2026-08-22, 오너 "ㄱㄱ 착수")** — 외부
  3리포 검토(confquest·kana-dojo·Lute v3)에서 분위기 필터 통과분만 수렴한 RFC
  (docs/rfc-vocab-encounter.md, #1089 merge 7d17c57)를 오너가 목업 A~D 포함 승인.
  **R1(만남 기록)**: ① 정본 5어 신규 저작(culture_core — 食券·券売機·替え玉 식당 은어,
  おみくじ·賽銭 신사 테마 신설; 요미는 derive-yomi.cjs 파생, 콘텐츠 게이트 요미가나
  검사 0실패) ② 라멘·신사 스크립트 refs/answerRefs/assumedRefs 저작 ③ 계약 1(정본
  실재)·계약 2(정답 발화 ⊆ 선행 노출 ∪ 챕터 전제) 전수 vitest ④ `vocab-encounters:
  <lang>` 키(storageSchema 정본·문서 갱신, npc-met 계열 멱등 기록 모듈) ⑤ NpcDialog
  스텝 노출 시 기록 + 완주 카드 "🈁 오늘 만난 말"(목업 A — 정본 요미·뜻 지연 로드,
  로그인 시 [+ 담기]=user_vocabulary ignoreDuplicates upsert로 FSRS 무손상, 게스트
  무버튼) ⑥ 생성 매니페스트 재생성(N5 935→940). 게이트: lint 0 err · 콘텐츠 게이트
  오류 0 · vitest 1,959 + world 1,064 green (#1090 merge a67c37e).
  **R2(표시)**: ⑦ 도시 카드 "만난 말 n · 이 도시의 말 m"(목업 B —
  stampAlbumVocabProgress, 분모 = refs 저작 스크립트 합집합이라 배선이 늘면 자라는
  정직 분모, got 0·코퍼스 0은 null로 줄 생략) ⑧ 뷰어 단어 목록 만남 점(목업 C 조정:
  목록엔 급수 뱃지가 원래 없고 ✓·★가 저장 UI와 충돌해 **만남 ·만** 저작 — 담김은
  기존 ✓, 익힘은 ⑨가 담당) ⑨ 레퍼런스 어휘 상태 필터 칩 [전체][만난 말][담은 말]
  [익힌 말](목업 D — 0인 상태 칩 미표기, 만남은 게스트도, 익힘=fetchLearnedWordSet
  repetitions≥2). 게이트: lint 0 err · 콘텐츠 게이트 오류 0 · vitest 1,960 + world
  1,069 green (#1091 merge 9a335b3). **R3-lite**: ⑩ 뷰어 드래그 조회 만남 기록(목록에
  뜬 토큰 ∩ 정본 → 정본 표기로 기록. 표시는 진입 시점 스냅샷 유지 — 점이 실시간으로
  번지지 않게. ja만, 타 트랙은 정본 연결 후) ⑪ 도시 코퍼스 실측 고정(후쿠오카=라멘
  refs·교토=신사 refs, 실제 city payload 기준 vitest 핀). **R3 잔여 = 노드 텍스트
  refs**: 사전 조사에서 '간판'(cityDistrictBoundarySigns)은 언어 콘텐츠가 아니라 지구
  잠금 경계 표지물로 실측됨 — 실제 노출면은 노드 이름·desc 열람(A)이라 어떤 노드
  텍스트를 refs 대상으로 삼을지 저작 설계 후 별도 배치 (#1092 merge 19ee8d1).
  **R3 노드 refs(오너 "진행해", RFC §4.6 신설)**: ⑫ 노드 `refs`/`refsLang` 스키마 +
  toInteractiveNode 통과 + GameCanvas 설명 박스 열람(descOpen) 시 기록 ⑬ **저작 원칙
  "표기 실등장"**(그 표기가 name·desc에 실제 등장하는 정본 어휘만)을 계약 테스트로
  기계 강제(전 도시 전수 — 실재·짝·실등장) ⑭ 1차 저작: 후쿠오카 7노드(港·タワー·
  神社·ラーメン·城·公園)·교토 6 POI(城·神社·寺·市場, 大社·神宮은 표기 불일치라 제외)
  ⑮ cityVocabCorpus 노드 refs 합산(도시 카드 분모 성장)·코퍼스 핀 갱신. 게이트:
  lint 0 err · 콘텐츠 게이트 오류 0 · vitest 1,960 + world 1,075 green (#1093 merge
  9c8137e). **스크립트 확장 저작(오너 "남은 작업들 ㄱㄱ")**: ⑯ ja 스크립트 잔여
  8본 전체 refs/answerRefs/assumedRefs 저작 — konbini(お弁当·袋·大丈夫·カード)·
  izakaya(お通し·生ビール·一人)·ekiin(行き)·menzei(免税·パスポート·これ)·도쿄 카페
  (コーヒー·砂糖·ミルク)·도쿄 서점(どこ·いくら·サイズ·棚)·오사카 환승(乗り換え·出口·
  駅弁)·오사카 성곽(見学·人気) ⑰ 정본 3어 추가(culture_core — お通し·生ビール·駅弁,
  요미 파생·예문 포함. 계획의 居酒屋·屋台는 스크립트 텍스트 미등장으로 보류 — 노출면
  생길 때 추가) ⑱ 도시 코퍼스 핀: 후쿠오카 갱신 + 도쿄·오사카 신설, 8본 시그니처
  실측 고정. ja 도시 4곳 전부 코퍼스 개통. 게이트: lint 0 err · 콘텐츠 게이트 오류 0
  · vitest 1,960 + world 1,078 green (#1095 merge 000c279). **장면 실전어 코어
  신설**: ⑲ `travel_scene_core.js`(전철·카페 실전어 — まもなく·ホット·アイス·
  ICカード·優先席 5어, N5 병합·예문 요미 파생) — **집계 이중화 실측**: 정본 병합
  지점이 lib/japaneseVocabRegistry(월드·뷰어)와 content/japanese/index(refLangs·
  매니페스트) 두 곳이라 새 파일은 양쪽 배선 필수(파일 내 단어 추가는 자동 전파).
  ⑳ ekiin(まもなく·ICカード·優先席)·카페(ホット·アイス) refs 보완 — まもなく는
  선행 노출로 계약 2까지 성립. 매니페스트 N5 948. 게이트: lint 0 err · 콘텐츠
  게이트 오류 0 · vitest 1,960 + world 1,078 green (#1096 merge 8414db9).
  **도어·오버월드 refs(오너 "이어서 ㄱㄱ")**: ㉑ 도어 프롬프트에 desc 병기(게이트
  병기와 같은 문법) + 열림 시점 기록 — 도시 chapter 노드 13곳 저작(nakasu 屋台·免税,
  konbini류 コンビニ·お願いします·大丈夫, izakaya류 居酒屋·お通し, ekiin 駅·まもなく·
  行き 등) ㉒ 오버월드 비게이트 노드는 기존 설명 박스 경로 재사용 — 전수 스캔 후
  12노드 저작(原爆·平和·記念·公園 / 地獄·温泉 / 洗濯·神社 / 味噌·そば / 城×4 등)
  ㉓ 정본 2어 추가(屋台·居酒屋 — 도어 desc로 노출면 성립) ㉔ worldNodeRefs 전수
  계약 신설(도시와 동일 3계약 + NPC·게이트 노드 refs 금지), 도시 코퍼스 핀 4곳
  갱신(후쿠오카 12→27 등). 게이트 노드는 스캔 결과 정본 표기 실등장 0이라 저작
  대상 없음(RFC §4.6 제외 유지). 게이트: lint 0 err · 콘텐츠 게이트 오류 0 ·
  vitest 1,960 + world 1,082 green (#1097 merge 803e9e3).
  **오너 방향(2026-08-22 마감)**: "월드는 일단 보류했기 때문에 학습 웹 위주로 가는 게
  맞다" — 만남의 입구(월드 refs) 저작은 오늘로 마감하고, 이후 배치는 학습 웹
  (사전·뷰어 UX, fr/zh 트랙의 뷰어 만남 확장, 서버 정본 §4.5) 위주로 잡는다.
  채움 NPC 이원화 gate도 월드 보류에 묶여 저순위.
  **§4.5 서버 정본(오너 gate 해제 "서버 정본 §4.5 ㄱㄱ" — 학습 웹 방향 1차 배치)**:
  ㉕ `user_vocab_encounters` 마이그레이션 SQL(PK user_id·lang·word_text, own-only
  RLS select/insert만 — 만남 불변이라 update/delete 무정책, REVOKE anon,
  world_stamps 관례 헤더·전면 멱등. 적용은 main 병합 시 supabase-migrations.yml
  자동 — 운영 DB 수동 적용 없음 하드리밋 준수) ㉖ vocabEncounterSync 쌍방 병합
  (pull 서버→로컬 합집합 + push 로컬 전용분, ignoreDuplicates=DO NOTHING으로 서버
  first_met_at 보존·UPDATE 무권한 GRANT와 정합. 언어별 5분 스로틀 sessionStorage,
  실패·게스트·마이그레이션 미적용은 조용히 로컬 단독 — 무해성 계약 vitest 8건)
  ㉗ 학습 웹 진입점 2곳 배선(레퍼런스 어휘 metSet·뷰어 metWordSet — 병합으로 새
  만남이 온 경우만 재로딩, 뷰어 '세션 중 점 번짐 금지' 원칙 유지. 기록 지점 3곳
  무변경 = 쓰기 서버 왕복 0) ㉘ RFC §4.5 보류→구현 갱신·owner-gate 해소. 게이트:
  lint 0 err · 콘텐츠 게이트 오류 0 · vitest 1,960 + world 1,090 green (#1099 merge
  9426809 — supabase-migrations.yml 자동 적용 success 확인).
  **§4.7 fr/zh 뷰어 만남(오너 "fr/zh 뷰어 만남 확장 ㄱㄱ" — 학습 웹 2차 배치)**:
  ㉙ 대조 키 단일 원천 — 본편·FLELex 병합 dedup의 _normFr를 refWordNormalize로
  이관(병합·뷰어 대조가 같은 키, 동작 불변), zh는 전수 실측(6,986어 괄호·대안·공백
  0)으로 trim만, ja·en은 항등(기존 비교 불변) ㉚ refVocabLookup — ja 기존 findWord
  위임·fr/zh 레지스트리 표제어 키 지연 인덱스(학습 순서 첫 등록 우선, 실측
  famille→A0) + 뷰어 드래그 기록의 ja 하드코딩 해제. 기록은 저작형 refMain
  그대로(= [만난 말] 필터·서버 정본과 동일 문자열), 만남 점만 정규화 키 비교
  ("la famille"↔"famille") ㉛ 전제 수리 — 프랑스어가 공용하는 tokenizeEnLine의
  ASCII 한정 패턴을 라틴-1(악상·Œœ) 확장: café→caf 분해로 대조 자체가 불가했다
  (영어 핀 불변). 프랑스어 렘마타이저는 조사 후 배제(만남은 하한 기록 — 굴절
  미달 무해, §4.7 조사 표). en 뷰어 기록은 지시 범위 밖 보류. 게이트: lint 0 err ·
  콘텐츠 게이트 오류 0 · vitest 1,973 + world 1,090 green (#1100 merge 3ccbf98).
  **§4.7 en 편입(오너 "en 뷰어 기록도 ㄱㄱ")**: ㉜ en 대조 키 = 소문자화만(전수 실측
  1,382어 — 대소문자 32건 Monday·TV류가 전부, 토큰 base_form이 소문자 lemma. 관사
  시작은 관용구 8건뿐이라 fr와 달리 접지 않음 — 과잉 접기 금지) + en 로더(refLangs
  레지스트리 w.en 키, 실측 핀 family→A1·monday→저작형 Monday 유지) +
  encounterLookupLang에 English 편입 — 나머지 경로(기록·점·필터·§4.5 동기화)는 이미
  언어 중립이라 코드 무변경으로 개통, 뷰어 만남 4트랙 전부 열림. en은 토크나이저
  lemma(ran→run)가 굴절을 접어 fr보다 회수율이 높다(조회기는 렘마타이저가 아님을
  핀으로 고정). 게이트: lint 0 err · 콘텐츠 게이트 오류 0 · vitest 1,974 + world
  1,090 green (#1101 merge fff10e4).
  **§4.8 fr 굴절 대응(오너 "fr 굴절 대응도 ㄱㄱ")**: ㉝ 렘마타이저 대신 **정본
  활용형 전개** — 대조 대상이 폐집합(동사 937: -er 729·-ir 88·-re 93·-oir 20
  실측)이라 표제어 쪽에서 전개해 키로 깐다(frInflect — 결정적·무의존·전량 핀).
  -er 규칙(연음·묵음e·-eler·-yer 보정, 대조기라 병출 허용)·-ir/-dre 규칙 + **어미
  가족 저작**(venir/prendre/mettre류 — 합성동사 obtenir·apprendre가 꼬리 하나로
  접힘, 최장 일치) + être/avoir/aller·-oir 불규칙 + 명사 복수·형용사 성수.
  2패스 인덱스로 **표제어 우선** 보장(porte 명사가 porter 3단수에, pris/prise
  형용사가 prendre 분사에 안 밀림 — 실측 핀), 대안 표기 전 항 인덱싱(beau/belle
  둘 다), 동철 경합(suis)은 학습 순서 첫 등록(être) 일관. Snowball 어간 비교는
  품사 교차 오탐(porte/porter)으로 배제, vais→aller·mangeons→manger·
  journaux→le journal 실측 green. 게이트: lint 0 err · 콘텐츠 게이트 오류 0 ·
  vitest 1,988 + world 1,090 green (#1102 merge 585f55a).
  **적응 출제 RFC 게시(오너 "적응 출제 RFC도 ㄱㄱ")**: ㉞ `rfc-adaptive-quiz.md` —
  현행 적응 3축(선정 due·워밍업·약점 재주입 / 타입 rung 0~5 / 강도 EWMA 다이얼)
  전수 실측 후 공백 하나만 제안: **만남 인지 슬롯**(월드·뷰어에서 만났지만 미담김
  어휘를 세션 잔여 예산에 choice 상한 2 — rung 0→1 다리, §4.5 서버 정본이 전제
  인프라). 기록은 기존 review_events 경로(source:vocab, origin:encounter 표지)라
  담김 후 rung이 자연 연결, FSRS 무접촉·타이머 없음(kana-dojo '시간 없는' 결 유지)·
  담김은 정답 직후 제안만(자동 담김 금지). 목업 A(문항 배지)·B(담기 제안) 동봉 —
  오너 목업 A·B 승인(#1103 merge fb443ca → "목업 A·B 승인 ㄱㄱ 착수").
  **적응 출제 R1(만남 인지 슬롯)**: ㉟ 서버 조립에 만남 후보 왕복 1개 추가
  (user_vocab_encounters 최근 40 − 담김(myWords 재사용) − 최근 출제(기존 400행
  재사용), 정본 refMain exact 인덱스 실재만·shortKo 선례) + buildEncounterItems
  (choice 상한 2·due 잔여 슬롯만·dial easy 0·보기 부족은 타이핑 폴백 없이 스킵 —
  사다리 위반 금지). **실측 조정**: 조립 세션은 문단 실패 폴백이라 composeSession
  편입 대신 encounterItems 별도 반환 — 문단·프리페치·폴백 3경로 공통으로 큐 말미
  부착(중복 0). 배지 A 렌더(vocab-choice 카드 상단), review_events는 기존 경로에
  detail.origin:'encounter' 표지만 — SRS 갱신은 word_id null이라 기존 가드가 자동
  스킵(FSRS 무접촉이 구조로 성립, 브리지 핀). 게이트: lint 0 err · 콘텐츠 게이트
  오류 0 · vitest 1,997(+9) + world 1,090 green (#1104 merge 2c003eb).
  **적응 출제 R2(담기 제안, 목업 B)**: ㊱ 만남 문항 정답 직후에만 [+ 단어장에 담기]
  1줄 — NpcDialog 선례 그대로(user_vocabulary ignoreDuplicates upsert = FSRS
  무손상, meaning은 정본 뜻 전문 meaningFull·pos 후보 행에 동봉), 오답 무제안·
  자동 담김 금지·실패는 조용히 재시도 가능·넘어가기는 기존 계속 버튼이 역할.
  게이트: lint 0 err · 콘텐츠 게이트 오류 0 · vitest 1,997 + world 1,090 green
  (#1105 merge b985b4e).
  **만남 출처 문맥 R3(오너 gate 해제 "만남 출처 문맥 저장 gate도 ㄱㄱ")**:
  ㊲ context·context_source 컬럼 마이그레이션(≤200자 CHECK, 최초 insert에만 실려
  무 UPDATE로 불변이 구조로 성립 — 롤백은 컬럼 drop, 만남 기록 무손상) +
  로컬 문맥 스토어(vocab-encounter-contexts:<lang>, 첫 만남 문장만·이후 만남
  무덮음 = first_met_at 불변 철학) + 기록 4지점 배선(NPC 대사 원문·ask 정답
  선택지 / 노드 desc / 도어 desc / 뷰어 드래그 선택 첫 줄) + sync push 동봉
  (pull 무변경 — 서버 문맥은 서버 조립이 직접 소비). **문맥 cloze**: due 어휘에
  실만남 문장이 있으면 cloze 예문을 정본 예문 대신 그 문장으로(표기 실재 검사,
  컬럼 미적용·행 부재는 기존 예문 폴백 — 무해성 그대로). 게이트: lint 0 err ·
  콘텐츠 게이트 오류 0 · vitest 1,998(+1) + world 1,095(+5) green (PR #1106).
  **만남 모델 전 트랙 완결** — RFC 2본(만남·적응 출제)의 보류 항목 0.
- **🎯 서재 i+1 — 자료 맞춤도(커버리지)·수준 맞춤 추천(2026-08-23, 오너 위임
  "큰 목표 설정해서 진행"으로 자율 설정)** — 근거: evaluation-and-strategy Phase 3
  P0 "AI 난이도 적응형 추천(i+1)" ❌ 미구현(전략 문서 스스로 꼽은 최대 공백,
  학습 웹 방향 정합). 원칙: LLM 없음·결정적 계산(Lute book unknown% 선례 이식 —
  이번 세션 심층 검토분), 보상·잠금 없음. RFC = docs/rfc-material-fit.md(목업
  A 카드 줄·B 정렬 칩 동봉). **R1 엔진**: ① 실측 — 서재 목록이 processed_json
  통짜를 이미 로드(신규 왕복·스키마 0), 뷰어에 계수·저장어 대조 관용구 기존재
  ② materialFit.js — 고유 내용어(types, 조사·기호·수사·개행 제외)·커버리지
  (아는 말 = 담김, surfaces∪bases 뷰어 관용구 대조)·i+1 밴드(≥95 comfort /
  90~95 fit 스윗스팟 / 75~90 stretch / <75 hard, 표본 20 미만 무밴드)·정렬
  랭크 — 전량 핀. R2 UI는 목업 A·B 승인 대기(승인 전 화면 무접촉). 게이트:
  lint 0 err · 콘텐츠 게이트 오류 0 · vitest 2,005(+7) green (#1107 merge 3196475).
  **R2 UI(오너 "승인 ㄱㄱ")**: ㊳ 담김 전체 인덱스 쿼리 신설(기존 due 인덱스와
  별개 — 커버리지는 복습 대기와 무관) + fitById 메모(분석 완료 자료만) + 카드
  맞춤도 줄 "아는 말 n% · 새 단어 m"(fit 밴드만 「지금 읽기 좋아요」 꼬리표,
  게스트·미계산 무표기 — 0 무표기 결) + 정렬 [내 수준 맞춤]을 기존 셀렉트에
  편입(fit→stretch→comfort→hard 안정 정렬 sortByFit 핀, 게스트 옵션 미표시).
  게이트: lint 0 err · 콘텐츠 게이트 오류 0 · vitest 2,006(+1) green (PR #1108).
- **🪞 주간 리포트 — "이번 주 나" 카드(2026-08-23, 오너 연속 위임 "다음 큰 목표
  이어서 ㄱㄱ"로 자율 설정)** — 근거: evaluation-and-strategy Phase 2 P1 "주간
  리포트 ❌ 미구현"(잔여 ❌ 중 학습 웹·결정적 계산 정합 유일 항목. AI 작문 피드백
  ❌ 표기는 /study 산출 문항·writing-feedback API로 부분 해소 — 문서 낡음, 별도
  갱신 대상). 원칙: 이메일 없음(대시보드만)·증감 색상 없음(압박 배제)·LLM 없음.
  RFC = docs/rfc-weekly-report.md(목업 A: ProfileStats 상단 카드 — 복습·정답률·
  담김·만난 말·완독, 지난주 회색 병기). **R1 엔진**: weeklyReport.js 순수 집계 —
  주간 경계는 growthStats.kstWeekStartMs 정본만(신설 금지), 채점 문항 판정은
  EWMA 다이얼과 동일 결(ui·dict 제외 — isGradedReviewEvent 핀), 만난 말은
  first_met_at 첫 만남 기준(§4.5 합류), 전 축 0이면 hasAny false(카드 무표기).
  경계 정밀 핀(주 시작 정각/직전 ms) 포함 5건. **R2 UI는 목업 A 승인 대기**.
  게이트: lint 0 err · 콘텐츠 게이트 오류 0 · vitest 2,011(+5) green (#1109 merge
  9e14d0c). **정리(오너 "정리한번 하고 개발 재개")**: ㊵ 이틀 변화 보고 아티팩트
  게시(만남에서 맞춤까지 — 여정별 예상도) + 전략 문서 현황표 낡음 해소(RFC 2본
  지적분: i+1 ❌→✅ · 주간 리포트 ❌→⚠️ · 작문 피드백 ❌→✅, 2026-08-23 갱신
  주석) (PR #1110). **R2 UI(오너 "주간 리포트 목업 A 승인 ㄱㄱ")**: ㊶ ProfileStats
  bento 4x1 "이번 주" 카드 — 2주 윈도 4쿼리(events·vocab·encounters·
  reading_progress, 별도 useQuery·5분 stale·실패 조회는 빈 배열로 축 0 무해성),
  지난주 회색 병기(증감 화살표·색상 없음)·0 축 무표기·hasAny 게이트(첫 주 카드
  생략). 게이트: lint 0 err · 콘텐츠 게이트 오류 0 · vitest 2,011 green
  (#1110 동승 — 문서 정리와 같은 배치). **주간 리포트 완결 — 전략 문서 잔여 ❌
  소셜(학습 그룹, 오너 설계 필요)만 남음.**
- **🪶 리포 경량화 P1·P2(2026-08-19, 오너 승인)** — 오너 질문("월드가 무거울 텐데 따로
  보관 가능한가")에서 출발한 실측: `.git` 36M으로 **clone은 애초에 무겁지 않았고**,
  체감 비용은 게이트 시간이었다(전체 408s 중 world 265s·파일 123/305=40%).
  **P1 테스트 분리**: `npm test`=world 제외(**408s → 78s, -81%**)·`test:world`·
  `test:all`, world 전용 워크플로(`world.yml`)를 경로 필터로 분리해 일상 PR이 6.8분을
  기다리지 않게 했다. **P2 스냅샷 분리**: `scripts/data` 52파일·43M(런타임·빌드 참조 0,
  도시 재현 테스트 전용)을 `world-data` 브랜치로 보존 이관 — 체크아웃 131M→88M(-33%),
  `ensure-world-data.mjs`가 없으면 자동 복원·실패 시 안내 후 종료 1(조용한 스킵 금지),
  복원분은 인덱스 제외+gitignore 이중 방어. 삭제→복원 음성 검증 완료.
  **부수 정본화**: 그동안 없던 `vitest.config.js` 신설 — world 분리로 남은 182파일이
  촘촘히 병렬화되며 무거운 콘텐츠 로드 테스트가 연쇄 타임아웃한 것을 개별 상향(두더지
  잡기) 대신 기본 타임아웃(30s/60s)+4코어 동시성 상한으로 근본 해결. 이 과정에서
  cityRoadAutotile(60s 훅, 실측 93s)도 수리. **P3(런타임 자산 61M) 미실시** — PWA
  오프라인·SW 버전·PNG 해시 결정성 계약 리스크가 용량 이득보다 커 오너 승인대로 보류.
- **🗃️ §C4 재정의 — 드래그 분석 결과 캐시(2026-08-18)** — 오너 판단("분산되면 응답
  안 하는 경우가 많다")으로 Codex-4 발주를 회수해 직접 수행. 실측 결과 발주 원안
  ('문맥 판별 캐시')은 실익이 작았다: 판별은 요청당 최대 1회·뜻 조회와 병렬(벽시계
  추가 0)·요청 내 중복 제거 완료·마크 0이면 호출 0. 대신 상류 비대칭이 실재 —
  드래그 경로가 좌측 번역(viewer_tx)만 캐시하고 `/api/analyze`는 매번 재호출.
  `viewer_an:{lang}:{문장}` 캐시로 요청 자체를 생략해 **판별+뜻 조회 배치를 함께**
  절감하고, 무효화(교정·승격 시 프리픽스 한정 삭제 — 번역·문법 캐시와 설정 보존,
  사전 정본 무변경으로 user_verified 계약 무관)를 발주 필수 조건대로 넣었다.
  유닛 7+계약 2. **규약 변경**: 기본을 Claude 단일 세션 처리로(설계·RFC·소규모
  구현은 직접, 발주는 대량·장시간·타 기기 자원 한정, 30분 무응답 시 회수).
- **💬 문법 해설 개편(2026-08-18, #1052 merge 43b91f1)** — 오너 확정(모형 합의 후
  구현): 뉘앙스를 맥락에 통합(조건부 '말투' — 회화문에만), 문장 분해+핵심 문법을
  [자세히] 하나로 통합해 시트 좌측 인라인 확장(모달 제거), 정본 문법 챕터 링크
  (환각 slug는 목록 대조로 차단), 문장 단위 캐시, 언어별 축 분리(중국어에 '조사'를
  묻던 결함 수리 — 어순·개사·양사·보어+병음). 죽은 코드 정리: 모달 211줄·훅 257줄·
  미배선 analyzeWordInContext/selectionPopup/handleTextSelection. 노트 저장은
  인라인으로 이관 보존. 유닛·계약 24·전체 vitest 2,869(304파일)·CI green.
- **📖 문법 해설 개편(2026-08-18, 오너 목업 승인)** — 파악 요청("AI 문법 해설이 어떤
  기능인지")에서 시작해 드래그 자동 경로와의 중복을 실측: 번역·어휘 체크는 좌(번역·
  맥락)·우(단어 목록)가 이미 제공, 고유값은 문장 분해·핵심 문법·뉘앙스·꼬리 질문뿐.
  오너 제안(뉘앙스를 맥락에 통합 + 문법 2종을 [자세히] 하나로)을 평가·보완해 확정.
  ① 좌측에 **말투** 조건부 통합(회화문만, 서술문은 항목째 생략) ② 체크박스 6항목
  모달 → **[자세히] 인라인 1버튼**(구조/패턴/예문/활용 4줄, 번역·뜻풀이 금지)
  ③ **정본 문법 챕터 연결**(모델이 slug 선택 → 목록 대조로 환각 폐기 → 링크) —
  AI 출력을 일회성 소비에서 자산 진입점으로 ④ 언어별 축 분리(중국어에 조사를 묻던
  이분법 결함 수리) ⑤ 문장 단위 캐시·노트 저장 인라인 복원 ⑥ 죽은 코드 468줄 정리
  (모달·구훅·미배선 3함수). 유닛·계약 24·전체 vitest green·next build 성공.
- **⚙️ 세션 운영 자동화(2026-08-18, 오너 "ㄱㄱ")** — 2026-08-17 하루치 마찰 실측
  (PR 사이클 15회·게이트 코멘트 누락 2회·보드 단독 PR 7건=CI 14잡·fonts.gstatic
  플레이크 4회·UI 왕복 5차·계약 파손 2건·발주 토큰 누락 1회)을 근거로 절차를
  코드화. ① 규약 변경: **보드 갱신은 작업 PR에 동봉**(자기 열만 — 충돌 방지 목적
  유지, Codex 세션 선례), **UI 변경은 텍스트 목업 우선**. ② `/pr-cycle` — 커밋→
  draft PR→게이트(PIPESTATUS 보존)→결과 코멘트 실호출→CI 판정(플레이크 시그니처·
  2연속 red 백오프)→squash merge→재동기화. ③ `/codex-dispatch` — 라우팅 토큰
  ([CLAUDE] … → Codex-N)·exact allowlist·RFC-first·확장 절차 템플릿. ④
  `/codex-review` — allowlist 1:1→보완 반영→신뢰 경계→하드리밋→**병합 트리 독립
  재현**→회신→보드. ⑤ `check-content`에 챕터 3곳 등록(eager·지연 로더·매니페스트)
  게이트 추가 — 로더 등록 제거 음성 검증으로 적발 확인. 잔여 후보: CI 폰트 플레이크
  근절(Codex-2 RFC 대기), 문자열 매칭 계약의 동작 검증 이관.
- **🇯🇵 일본식 자형 대조 고도화(2026-08-17, #1040~#1043 merge) — 오너 피드백 체인 완결**
  — ① 우리 사전 표시 개편(#1040): 정본 뜻의 뜻 자리 대체(교정 최우선 가드)·박스 해체·
  pos/병음 중복 생략·예문 자연 배치·한자 노트는 대조 토글 꺼짐일 때만. ② 한자음 단독
  줄 조건부 생략(#1041): 훈음 전 글자 커버 시 중복 제거(hunsCoverWord), 훈 공백
  단어(你们)는 앵커 유지. ③ 일본식 자형 표기+재배치(#1042): 오너 확정("간체보다 일본식
  익숙") — 일본인 학습자 정석·오픈소스 조사(부품 규칙 학습이 정석, OpenCC 신자체
  402쌍 확보 검증) 후 hanjaJa.json 2,890자(간체→정체(kTV)→신자체(OpenCC opencc-data@
  1.4.1 Apache-2.0), 왕복 동형→음 계열→수록순 3단 결정, diff-only 34KB). 훈음 줄
  일본식 단독(図 그림 도 — 괄호 병기 불요 오너 확정)·대조 블록 뜻 아래 재배치·그룹
  줄바꿈·日 어형=글자 나열이면 요미만·⚠ 日 줄 통합. ④ 부수 간화 패턴 섹션(#1043):
  해설 챕터 증보 — 부품 12규칙 표(讠→言 등)+드릴 3, 처음 보는 간체 해독 일반화.
  전체 vitest 2,825(301파일)·CI green·모형→배치 개선→괄호 제거 3라운드 오너 합의 반영.
  **후속 — 한자음 단독 줄 전면 폐지(2026-08-23, 오너 지시 "한자음 여전히 남아있는
  경우 있는데 지울 것… 그 자리에 한자 뜻 음 함께 넣으면서 대체")**: ②의 조건부
  생략이 남긴 잔존 케이스(훈 공백 단어 你们류 = 부분 커버 시 '한자음 노사' 줄
  유지)를 제거 — listHanjaHunEum이 훈 없는 글자도 음만 라벨('생'·'로(노)', 두음
  병기 관례 동일)로 편입해 훈음 나열이 유일·완전한 음 앵커가 되고, 뷰어의
  한자음 합성 경로(hanjaKoOf·hunsCoverWord)는 삭제(부재 계약 핀·'한자음' 문자열
  0 핀). readHanjaKo는 생성 데이터 계약 검증용으로만 유지. 글자 탐색(④)은 자체
  음 폴백이라 무영향. 게이트: 전체 vitest 2,011 green (PR #1111).
  **훈음 데이터 3층 보수(2026-08-23, 오너 보고 "撕 서만 나옴" → 원인 실측 → 승인
  "착수!")**: 정본 zh 2,457자 중 훈 공백 225자(9.2%)를 4클래스로 실측 분해 —
  ① 전 항목 파서(첫 콤마 항목만 신뢰해 "牀의 俗字, 평상 상"류를 놓침 → 항목
  단위 전수 스캔) ② 상속 확장(kTV 미러 재확보 불가 → OpenCC STCharacters로 교체
  (hanjaJa 기채택 원천) + 한국 정자 이체 맵 KR_VARIANTS 24쌍(清→淸·教→敎·溼→濕
  등 — 전 쌍 libhangul 실측 검증)) ③ **음 교정 77자**(간체 동형 충돌: 达 체→달·
  关 소→관·灯 정→등·识 신→식 등 — 별자 계보 음이 발음 앵커를 깨던 것, 전량 감수·
  苧 '모시 저'는 ST 오매핑 차단 수기 고정) ④ 수기 훈(확신 집합만: 撕 찢을 시(음도
  시로)·你 너 니·概 대개·教 가르칠·怜 가련할 — 어기조사 吗·啊·嗯은 훈 무성립로
  음만 유지(오너 확정), 위키낱말사전 프록시 차단으로 광역 저작은 보류). 산출:
  훈 8,897자(+190 순증), 정본 공백 225→163, 구→신 전량 diff 감수(상실 2자 么·俣
  — 음 계보 정합 대가 수용). scripts/hanja-curated.mjs 신설(수기 감수 단일 레이어).
  게이트: 전체 vitest 2,013(+2) green (PR #1113).
- **🔀 보완 잔여 세션 분배(2026-08-17, 오너 "ㄱㄱ 세션 나눠서") — Claude 몫 완결,
  C1·C2 검수·머지 완료, C3·C4 회신 대기** — 발주 4건(#150 코멘트 5312202647): C1 PDF.js
  1단계 골격(**#1038 merge 1f55748 — 검수: 스코프 전량 준수·병합 트리 전체 vitest
  2,816 독립 재현·CLAUDE_REVIEW 5313464488, 2단계 배선은 Claude 설계 후 별도 발주**) ·
  C2 뷰어 e2e R1(**#1046 merge ad86ff0 — 검수: 발주 4시나리오 전부(#1030 수리 계약
  포함)·Gemini 0 라우트 카운터 실증·셀렉터 실재 대조·CI 별도 러너 e2e green 재현·
  CLAUDE_REVIEW 5316672387, 후속 산출물로 fonts.gstatic 안정화 RFC 예고됨**) ·
  C3 영어 겸류(**RFC 도착 5317318207 — 실측 대조 후 승인: saw→see lemma 충돌 발견·
  occurrence key·null-marker 이식 우수. 보완 3건(marker 위치 무관+승격 보존 계약·
  lemma 후보 사전 조회·allowlist 확장 절차) 달아 구현 발주 5317343327,
  `codex3/en-pos-context-r1` exact allowlist 9파일 → **구현 #1049 merge ffcfdd0 —
  검수: allowlist 1:1 준수·보완 3건 전량 반영·모델 응답 4중 검증(pos∈all·base_form∈
  제시 후보·길이·화이트리스트)에 모든 실패가 빈 picks 수렴·레거시 lemma 폴백 동일성
  보존·독립 재현 303파일/2,850 green, CLAUDE_REVIEW 5323042389**) · C4 판별 캐시
  RFC(회신 대기, RFC-first 구현 금지 명시).
  Claude 몫 완료: ③ 편집 패널 마감(#1036, merge 90887d8) — 실측 결함 3건(편집 중 토큰
  전환 시 이전 입력값이 새 토큰에 저장되는 stale, 저장 실패에도 패널 닫혀 입력 소실,
  빈 뜻 저장 허용)을 key 리마운트+전환 자동 닫기·per-call onSuccess 게이팅·
  buildTokenCorrections 순수화(+Esc)로 수리, 유닛 4+계약 3(구계약 1 갱신). 음독↔병음
  해설(#1037, merge bc109b2) — /studies 지역학 신설 대신 발음 특별 챕터 선례로
  chinese/grammar H2 order13 배치: ん→-n/-ng(한국음 받침 판별)·장음→-ng(받침 없으면
  모음 운미)·입성 운미 소실(성조 별도 암기 한계 명시)·동형이의어/자형 세 갈래 함정,
  드릴 8(전역 비중복). 실측 계약 학습: 신규 챕터는 eager 레지스트리+지연 로더
  (grammarLoader)+생성 매니페스트(build-ref-grammar-manifest) 3곳 정합 필수
  (refGrammarManifest byte-for-byte 게이트). 전체 vitest 2,807(299파일)×2회 green·
  게이트 3종 0 errors·CI green. 남은 것: 발주 4건 회신 검수·머지 게이트.
- **🇨🇳 뷰어·단어장 보완 ③②①(2026-08-17, #1030·#1031·#1033 merge) — 3건 전체 완결** —
  오너 제안 3건 검토→설계 확정(착수 순서 ③→②→①, "외부 소스 한 번 더 검토" 지시 반영). ③ 바텀시트 가림 수리
  (#1030, merge 3b2b253): 문장 지정 후 단어 탭 시 먼저 열린 문장 설명이 단어 상세를 가림 —
  신호 처리부가 해당 섹션을 열기만 하고 반대 섹션을 안 접는 게 원인(실측).
  resolveSignalTransition(순수)로 단독 신호=반대 섹션 접기·동시 신호(문장 드래그)=둘 다
  (#992 의도 보존)·수동 토글 무변경. 유닛 4. ② 급수·우리 사전 연동(#1031, merge 0a7c8dd):
  급수는 저장하지 않고 표시 시점에 계산(스키마 무변경·기존 단어 소급 적용·복습 큐 무오염 —
  오너 확정 '자동 분류·필터'). 콘텐츠 정본 30파일 언어별 1회 지연 로드(평시 번들 0)·중복
  단어는 낮은 급수 우선. 뷰어 시트: 급수 뱃지+'우리 사전' 섹션(정본 뜻·품사·예문 zh/병음/
  ko·한자 노트 — AI 호출 0, Gemini 상세와 병렬). 단어장: 급수 필터 select(전체/HSK1~6/생활/
  미분류, 중국어 한정 스코프·타 언어로 좁히면 자동 해제·localStorage 영속)+행 급수 뱃지.
  유닛 7+계약 6·전체 vitest 2,794(299파일)·CI green. ① 훈음 병기(#1033, merge b1f7a5c):
  한자음(발음 앵커)에 한국식 훈(뜻)을 옥편 표제 관례로 병기 — 시트·팝업에 '老 늙을 로(노)
  · 师 스승 사'. Gemini 1회 생성안을 외부 소스 재검토로 교체: libhangul hanja.txt(BSD
  3-clause, IME 생태계 표준 — 단일자 훈음 행 ~7,757) 훈 오버레이 + 간체는 훈 주석이 비어
  있어 Unihan kTraditionalVariant로 정체 훈 상속(学←學). hanjaHun.json 8,700자(직접
  6,959+상속 1,741, 143KB — 기존 hanjaKo.json 무변경 오버레이·토글 시에만 병행 지연 로드,
  회귀 0 설계). 다음자는 두음형 행 우선 규칙으로 결정적 선택(老 노 행 '늙을' — 오너 예시
  정합, 樂→즐길 낙). 훈 없는 글자는 조용히 생략(음 앵커가 커버). 오프라인 결정적 생성
  스크립트(generate-hanja-hun.mjs, BSD 고지 수록). 유닛 12 추가·전체 vitest 2,801(299
  파일)·CI green(1차 e2e red는 fonts.gstatic 플레이크 3번째 재발 — 로그 실측·amend
  재트리거 green).
- **📚 책 묶음 반입(2026-08-17, #1028 merge 49e91a2)** — 오너 아이디어("방대한 양도 일단
  받아들이되 챕터별 분석 형태로, 같은 책은 한 묶음") → 평가(자료=processed_json 한 덩어리
  구조상 성능 필연·50k 캡이 방증, 챕터=자료 유지+책 껍데기가 기존 진도·FSRS·교정 무손상)
  → P1+P2 승인. 스키마 무변경(metadata.book {key,title,order,total}). 반입: EPUB '책
  전체를 챕터별로' + 긴 붙여넣기 헤딩 감지 분할(제N장·第N章·Chapter N — 한글 뒤 \\b 불성립
  실측 우회)·무헤딩 길이 분할·45k 방어, 초안 카드에서 제목 편집·⤴ 병합(자동 감지 오차를
  사람이 흡수). 등록=분석 0회(status pending — 원문 즉시 열람), 뷰어 '이 챕터 분석하기'
  (기존 전체 재분석 경로 재사용)·책 내비(《책》3/12 이전·다음), 자료함 책 아코디언(분석
  x/n·읽음 y/n·상태 뱃지). 부수 효과: 같은 책 챕터 어휘 중복→뒤로 갈수록 분석 저렴+ja
  백필 선행. 유닛 13+계약 3·전체 vitest 2,777(296파일)·CI green.
- **📱 네이티브 앱화 — 전역 무선택 + 본문 인앱 드래그 지정(2026-08-15)** — 오너 요청("웹보다
  실제 앱처럼", 조사→제안→승인 절차). 정책: 전역 user-select none + iOS touch-callout 차단,
  예외는 타이핑 입력란 하나(복사 버튼도 최소화 — 오너 확정). P1(#1010, merge 79c844b):
  전역 CSS + 소스 계약 테스트. P2(#1011, merge 13e1818): 본문 드래그 지정을 네이티브
  선택(getSelection)에서 토큰 앵커 인앱 지정으로 전환 — 데스크톱 즉시 드래그(8px)·모바일
  길게 누르기(300ms, 스크롤 양보)·가장자리 자동 스크롤·합성 click 억제, 하이라이트는
  문장 막대(#1002) 이펙트·수명 공유, 확정 텍스트(개행 보존)를 기존 분석 파이프라인+문법
  버튼 경로에 투입. 모바일 임의 범위 지정 최초 개통. 순수 제스처 코어 분리로 판정 유닛
  고정(신규 20)·ViewerPage getSelection 부활 금지 계약. 전체 vitest 2,703(289파일)·CI
  green(1차 e2e red는 fonts.gstatic 러너 플레이크 실측·재트리거 green).
  **후속(오너 ㄱㄱ + 버그 2건)**: ① 겹침 수리(#1013, merge 89ebca4) — 반투명 이중 도색이
  인접 겹침에서 짙어짐 → 테마별 불투명 등가색(color-mix). ② 가림 수리(#1015, merge
  205758d) — ①의 불투명 전환으로 뒤 토큰 전방향 3px 그림자가 페인트 순서상 앞 글리프를
  덮음 → 확장을 안전 방향·폭만(상하 2px + 자간 이음은 연속 지정 뒤 토큰이 정확히
  --char-gap 폭, 부활 금지 계약 4). ③ P3 그립 핸들(#1014, merge 93ed3b6) — 양끝 핸들로
  범위 미세 조정, 무변경 릴리스는 재분석 생략. 전체 vitest 2,709(289파일)·CI green.
  **P3 잔여 owner-gate**: PDF 뷰어 인앱화 — 실사 결과 `<embed>` 네이티브 플러그인이라
  텍스트 DOM 접근 원천 불가, PDF.js 뷰어 전면 재작성 대공사로 범위 재조정(별도 제안·승인
  대기, 임의 착수 금지).
- **🇨🇳🇯🇵 한자 대조 학습(2026-08-15)** — 오너 발상(일본어 한자 지식 지렛대) → 인터넷 조사
  (음독↔병음 대응·신자체↔간체·동형이의어·시각 의존 함정) → 제안 → 1단계 승인(옵트인 전제·
  중국어 [자료] 한정·두음법칙 표기). 위상 확정: 한자음은 뜻이 아니라 **발음 앵커** — 뜻
  자리('선생님') 불변, '노사'는 별도 라벨 병기·복습 출제 미사용(오너 질문으로 확정한 설계).
  1단계(#1022, merge f2410e3): npm hanja(MIT)에서 메인 블록 20,902자 정적 생성(간체 직접
  수록 실측·재생성 스크립트), readHanjaKo 어두 두음법칙(로사→노사·려행→여행)·미등재 시
  생략, showHanjaKo 기본 꺼짐·중국어만 토글, 시트·팝업 병기, 테이블은 토글 시 지연 로드
  (평시 번들 0). 유닛 15·전체 vitest 2,747(292파일)·CI green(e2e 1차 red는 fonts.gstatic
  플레이크 재발 실측·재트리거 green). 2단계(#1024, merge e4e0994): 일본어 대응 병기 —
  뜻 조회 확장 필드 ja{form·yomi·diff}를 meanings jsonb 관례 필드로(스키마 무변경),
  ja:null='판정 완료·대응 없음' 기록으로 미판정(키 부재)과 구분해 백필(needsZhJaBackfill)
  무한 재조회 방지, 표시는 사전 온디맨드 조회(processed_json 무비대)로 図書館(としょかん)/
  がっこう/≒先生(せんせい) 3형태, 승격은 ja 위치 무관 보존. 유닛 14·전체 vitest
  2,760(293파일)·CI green. 3단계(#1026, merge 31ca7cc): 동형이의어 ⚠ 경고 — ja.warn
  (일본어에서 같은 표기의 다른 뜻: 汽车→기차·手纸→편지, warn:null=판정 완료 명시로 무한
  재조회 방지, 2단계 시절 행은 warn 키 부재로 1회 백필 자기 종결), 시트 '⚠ 일본어로는
  기차'(warning색)·팝업 병기. 유닛 4·전체 vitest 2,762(293파일)·CI green.
  **3단계 전체 완결** — 조사→제안→단계별 승인→완결 사이클 종료.
- **🇨🇳 OOV 병음 수리 + 뜻·발음 수동 편집(2026-08-15, #1017 merge f57ea09)** — 오너 보고
  3건. ① 这宗·这首·这片·这篇·笔在·项有 병음 누락: jieba가 사전 밖 2자 한자 조합(HMM 병합
  OOV)에 x 태그를 달고 토크나이저가 x를 무조건 기호 처리해 병음·품사 전량 소실(실측).
  x·w는 한자 미포함일 때만 기호로, 한자 조합은 병음+품사 미상(문맥 판별기가 채움),
  '기호' 오캐시 잔재는 마크 복귀로 자가 치유. 실측 笔在→bǐ zài·这宗→zhè zōng.
  ② 편집 UI(링큐식): 시트 ✏️(소유자 — materials RLS 정합) → 사전 다중 뜻(pos 태그
  동반 교정)·발음 칩 + 중국어 1자 다음자 pinyin-pro multiple 지연 로드 + 직접 입력 →
  correctTokenMutation(기존 죽은 코드 개통) 경로로 교정+이력. 순수 후보 로직 분리
  (tokenEditOptions). 유닛 13·전체 vitest 2,718(289파일)·CI green.
  **보완(오너 검토 요청→①② 승인)**: ① 단어성 판별·분리(#1019, merge e0949e2) — 실측상
  우연 병합(笔在)과 실단어 신조어(社恐, 같은 x)가 섞여 기계 분리 불가 → 문맥 판별기에
  [단어성 판정] 얹어(호출 수 불변) 병합은 글자 분해(병음 음절 재분배·연결≠원표기 폐기),
  신조어는 유지. ② 교정 사전 승격(#1020, merge d00fa0f) — 편집 패널 '이 단어 전체에
  적용' 체크 → /api/dict-correct(인증·레이트리밋)가 교정 뜻 선두 병합·user_verified
  upsert(자가 치유 보호 계약과 맞물림) + 내 단어장 항목 동기. 유닛 17 추가·전체 vitest
  2,735(291파일)·CI green. 미착수 보류: ③패널 마감 ④영어 겸류 ⑤e2e ⑥판별 캐시.
- **🇨🇳 품사 문장 맥락화(2026-08-15)** — 오너 질문(중국어 겸류사가 명사/동사 중 하나로만 표기).
  진단: jieba는 사전 등재어에 문맥 불문 단어당 한 태그(실측 计划→我计划去北京에서도 n·希望→
  我有一个希望에서도 v) + 캐시 pos 우선 병합으로 첫 품사 박제 + 중국어 Gemini pos 폐기 버그 —
  병음 박제(#1004)와 동형. 수리: ① 사전층 다중 품사('동사·명사', Gemini pos 저장 개시 + jieba
  겸류 태그 vn/vd/an/ad 확장) ② 문장층 disambiguateZhPos — 명/동/형 계열 한자어를 요청당
  flash-lite 1회로 후보 전체+맥락 품사 판별(뜻 조회와 병렬 — 벽시계 무추가, 실패 시 첫 후보
  폴백) ③ 뷰어 TokenPosLabel — 후보 전체 나열 + 맥락 품사만 강조(교정값 존중). uj/ul/ud/uv/
  uz/ug 세부 조사 태그 보강(미상 마크 낭비 차단). 스키마 무변경. 신규 유닛 21·전체 vitest
  2,676(287파일)·PR #1006 CI green·merge c4e71c1.
  **후속(오너 요청) — 뜻 정렬 문맥화**: 뜻별 pos 태그(meanings jsonb 내부 — 스키마 무변경) +
  pickZhMeaning으로 짚힌 품사 일치 뜻 우선(불일치·무태그는 첫 뜻 폴백), 레거시 행은 판별
  후보 기록→뜻 재조회 2단 자가 치유(user_verified 무손상). 신규 유닛 11·전체 vitest
  2,687(287파일)·PR #1008 CI green·merge 44a29d1.
- **🇨🇳 병음 문장 맥락화(2026-08-14, #1004)** — 오너 질문(맥락 반영 여부·다음자 처리). 진단:
  단어별 pinyin 호출로 문맥 미반영(不对→bù·走了→liǎo 실측 오류) + 캐시 reading 우선이라 첫 문맥
  병음 박제. 수리: 줄 전체 pinyin(type:all)→origin 매칭 재분배(공백 정렬 안전·폴백), route는
  중국어만 토크나이저 병음 우선(ja는 Gemini 캐시 유지). 개선 실측 不对→bú·吃了→le·박제 해소.
  잔여 한계(还书 huán 등)=pinyin-pro 판정 수준 기록. 유닛 10(변이 red)·vitest 2,647·CI green·
  merge 298fc03·배포 success.
- **✨ 문장 막대 지정 이펙트(2026-08-14, #1002)** — 오너 요청(첫 단어만 지정처럼 보임). pickedLineIdx
  상태 — 막대 탭 시 줄 전체 토큰 하이라이트(자간 gap은 그림자로 이어붙임)·막대 선명 고정, 단어
  클릭·드래그 시 해제, line-pick tap-highlight 투명화. 격리 실렌더 확증. CI green·merge 75ae1ea·
  배포 success.
- **✨ 문장 지정 막대 모바일 개통(2026-08-14, #1000)** — 오너 보고(모바일에 지정 수단 전무).
  막대가 hover:hover 전용이었음 → (hover:none)에서 줄 첫 글자 앞 인라인 상시 표시(0.45·:active
  강조·들여쓰기 18px). 모바일 에뮬 실렌더(상시 표시·탭 동작·배치). CI green·merge 179b1f7·
  배포 success.
- **✨ 번역·맥락 지정 문장 TTS(2026-08-14, #998)** — 오너 요청. 지정 원문 인용 오른쪽 ▷ 버튼 —
  원문 전체를 자료 언어로 재생. **서버 TTS VOICES에 Chinese 부재 발견**(중국어가 브라우저 저품질
  음성으로 강등 중) → 추가·실 API zh 오디오(216KB PCM) 확인. 격리 배치 실렌더. 중도 tmp purge
  1,797파일 — 유니코드 경로는 개별 checkout 불가, `checkout -- .` 전량+npm ci로 복구(수정분 백업
  선행). CI green·merge e3ffbf6·배포 success.
- **🔧 시트 핸들 스와이프 고장·재오픈 불능 수리(2026-08-13, #996)** — 오너 정밀 재보고(핸들 잡고
  내려도 안 되고 건드리면 고장, 이후 단어 탭에도 창 안 뜸)로 2중 원인 확정: ① touch-action 부재로
  브라우저가 드래그를 가로채(touchcancel) transform 잔존 → 시트가 화면 밖 고착 ② 자동 오픈이
  rising edge뿐이라 닫은 후 재오픈 신호 없음. 수리: 핸들 touch-action none·onTouchCancel 정리·
  left/rightSignal 카운터(탭·드래그마다 발신). 격리 7케이스 ✅. CI green·merge 7fdbd91·배포 success.
- **🔧 바텀시트 ✕ 제거(2026-08-13, #994)** — 오너 지시. 닫기는 핸들(탭·스와이프)+바 재탭 전담.
  44px 절대배치 ✕가 좁은 핸들에 겹쳐 터치 가로채던 여지 동시 제거. CI green·merge 960a9a9·
  배포 success.
- **🔧 바텀시트 닫기 재수리(2026-08-13, #992)** — #978 재탭 조건('해당 섹션만 열림')이 문장
  드래그(번역+단어 동시 오픈)에서 무효 — 섹션만 접혔다 펴지고 시트 영영 안 닫힘(오너 재보고).
  수리: 열린 섹션 버튼 재탭=시트 닫기·접힌 섹션 탭=섹션만 열기 + **핸들 스와이프 다운(>48px)=
  내리기**(손가락 추적·미달 복귀). 오너 시나리오 그대로 격리 5케이스 ✅. #978 검증이 한 섹션
  시나리오뿐이었던 미스 기록. CI green·merge bb9e3c3·배포 success.
- **🔧 글자 삐뚤빼뚤 진짜 원인 수리(2026-08-13, #990)** — #988 후에도 지속(오너 재보고). 실렌더
  재현: word-token(flex item) 높이가 루비 내용 따라 제각각(성조 병음 81px vs 기호·무루비 40px) +
  상자 기준 정렬 → 낮은 토큰 글자가 위로 떠 줄이 들쭉날쭉 — 실체는 크기가 아니라 **세로 정렬**.
  수리 한 줄: reader-area align-items: baseline. 실측 글리프 편차 81px→0px·스크린샷 확증.
  ja 후리가나 혼합 줄 동시 수혜. CI green·merge 403ee1d·배포 success.
- **🔧 뷰어 글자 크기 널뜀 수리(2026-08-13, #988)** — 오너 보고. 재현 확정: EPUB 배열(문단 사이
  빈 줄·안은 연속)에서 문단 첫 줄 대사 "……。"가 h2 오탐(닫는 따옴표가 문장 끝 목록에 없었음) →
  줄마다 1.25em 널뜀. 헤딩 로직을 lib/headingHeuristics.js로 추출 + 가드 2겹(닫는 따옴표·쉼표·콜론
  끝=본문, 여는 인용부 시작=본문). 유닛 3(변이 red)·제목 유지 고정. 부수 사고: 곡선 따옴표 리터럴이
  ASCII로 정규화돼 1차 무효 — 코드포인트 검증 후 고정. CI green·merge 0230daa·배포 success.
- **🎨 문장 막대 요미가나+한자 전체 높이(2026-08-13, #986)** — 오너 피드백. height 1.55em+
  translateY(-0.18em) — 실렌더 실측 rt 상단(3px 여유)~한자 하단(0px). transform이라 레이아웃 무영향.
  CI green·merge 8f1b31a·배포 success.
- **🔧 문장 막대 한자 정렬·AI 발동 본문 제한(2026-08-13, #984)** — 오너 보고 2건. ① 막대가 rt(요미
  가나) 중심에 감(실측 확증: 앵커 1em이 flex 줄 상단에 붙음) → 앵커 폐기, 줄 첫 토큰 안 인라인
  (baseline 공유·음수 마진) — 한자 중심 1px 차 실측. ② 문장 선택 AI가 본문 밖(패널·AI 결과)에서도
  발동 → selection anchor/focus가 reader-area 안일 때만(문법 팝업 포함). CI green·merge 94681d8·
  배포 success.
- **✨ 문장 지정 버튼 인용 막대화(2026-08-13, #982)** — 오너 피드백. ▸ 원형 → quote 4px 세로 막대
  (1.3em), 기본 완전 숨김·버튼 자리 호버 시만 표시(reader 호버 은은 규칙 삭제). 히트 22px 유지.
  align-self:stretch는 다중 줄 flex에서 앵커 단독 줄·높이 0 — inline-block 유지 교훈. 실렌더 스크린샷
  확인. CI green·merge 8ce4d5c·배포 success.
- **✨ 뷰어 문장 전체 지정 버튼(2026-08-13, #980)** — 오너 요청. 각 줄 왼쪽 여백에 호버 표시 ▸
  (기본 숨김→본문 호버 은은→버튼 호버 선명, hover:hover 전용) → 클릭 시 드래그와 동일 분석
  (runSelectionAnalysis 추출·재사용). 실렌더에서 0폭 앵커가 이전 줄 끝에 붙는 결함 발견→1px 수리·
  3줄 실측 green. CI green·merge 88505d9.
- **🔧 모바일 바텀시트 닫기 불능 수리(2026-08-13, #978)** — 오너 보고(버튼 충돌 추정 적중).
  시트 z110이 하단 바 z100을 덮어 바 버튼 재탭 닫기가 흡수 + ✕ 44px 미달. 수리: 시트 z95(바 아래)
  +padding-bottom 60px·재탭=닫기·핸들 탭 닫기·✕ 44×44·시트 내 mouseup 버블 차단(문장 분석 오발동).
  실렌더 실측(elementFromPoint=바 버튼, 3경로 닫힘 ✅). CI green·merge 385522c·배포 success.
- **🔧 뷰어 읽기 설정 모바일 정렬(2026-08-13, #976)** — 오너 요청. 열었을 때 left/right가 가로
  flex-wrap이라 컨트롤 뒤섞임 → ≤767px: left 세로 스택(라벨 좌·컨트롤 우, 슬라이더 flex:1 풀폭,
  글꼴 select 풀폭) + right 2열 그리드(버튼 균일·테마 중앙·학습 링크 풀폭). 격리 실렌더 375px
  전/후 확인. CI green·merge 6fd291a·배포 success. 데스크톱 무변경.
- **🇨🇳 뷰어 병음 UI 3건(2026-08-13, #974)** — 오너 보고: ① 본문 병음 배열 불안정·글자 간격 벌어짐
  — splitRuby가 단어 전체에 병음을 통째로 붙임(图书馆 3자 vs tú shū guǎn 11자) → **글자별 분배**
  (음절==글자 수, 표준 병음 조판)+rt nowrap·ruby-align center. 추출 실행 7케이스(ja·IPA 회귀 무영향)
  ② 문장 드래그 단어 리스트 병음 누락 → 독음 줄 추가 ③ 모바일 본문 폭 65%(245px/375px) →
  ≤767px 풀블리드로 **94%(351px)**(실렌더 실측). CI green·merge 4c762b6.
- **🤖 AI 모델 세대 갱신(2026-08-13, #973)** — 오너 지적(구형). 키 ListModels 실측 후 교체:
  뜻 조회 2.5-flash→**3.5-flash-lite**(A/B 실측 배치 12.7s→3.2s, 품질 동등— 60s 킬 여유 확대),
  범용·생성 경로 **3.6-flash**(+lite 폴백, 화이트리스트에 2.5 유지=구클라 호환), TTS 3.1-tts-preview
  (PCM 응답 실측), **Groq qwen3-32b 퇴역 발견(폴백 전멸 중)** → qwen3.6-27b 승계. merge 2ad9ee7.
  주의: PR CI e2e red는 폰트 fetch flaky — main CI green 확인으로 종결(checks watch도 pipefail 필수).
- **🇨🇳 중국어 분석 60s 함수 킬 수리(2026-08-13, #971)** — #969 배포 후에도 재분석 실패 지속(오너
  보고). 재조사 실측: 캐시 빈 중국어는 문단당 미싱 100개 뜻 조회가 **7배치 순차 94.4s로 maxDuration
  60s 초과** → 함수 킬 → 문단 전체 failed(두 번째 원인 — wasm은 로드만 해결). 수리: 배치 병렬
  (concurrency 3, 94.4→41.8s·99/99)+deadline 35s(초과 시 뜻 없이 반환 — 그레이스풀, 재분석 시 캐시
  백필)+개별 타임아웃(Gemini 20s·Groq 15s). 유닛 4(변이 2종 red)·vitest 2,640·e2e 22/22·CI green·
  merge bb52d06. 오너 재분석 확인 대기 — 첫 재분석에 뜻 일부 비면 한 번 더(캐시 백필 후 히트).
- **🇨🇳 중국어 분석 프로덕션 실패 수리(2026-08-13, #969)** — 오너 보고: 중국어 EPUB이 "분석 완료"로
  뜨는데 전부 실패·병음 부재. 진단: 로컬 완주는 성공 → **Vercel 서버리스의 @node-rs/jieba 네이티브
  .node 로드 실패로 격리**. 수리 ① jieba-wasm 교체(zero-deps WASM, 동일 분할·200회 2ms, .wasm
  readFileSync 표준 패턴 → NFT 플랫폼 무관 추적 실측) ② resolveAnalysisStatus — 성공 토큰 0이면
  status='failed'(기존엔 전량 실패도 'partial'이라 "분석 완료(재시도 필요)"로 가려짐) ③ failed 전용
  문구. 유닛 10(변이 red)·vitest 2,636·e2e 22/22·wasm 서버 완주 200·CI green·merge 0ff83a5.
  기존 실패 자료는 뷰어 '재분석'으로 복구 — 오너 확인 대기.
- **🇨🇳 중국어 배선 결함 수리(2026-08-12, #967)** — #965 후속 검증에서 발견: 서버에 jieba·병음을
  붙였는데 클라 analyzeText가 ja/en만 /api/analyze로 보내 **중국어가 옛 Gemini 폴백으로 새고 있었다**
  (실사용에서 새 파이프라인 미적용). 분기 수리 + 계약 테스트(클라 분기 집합 == 서버 화이트리스트,
  소스 대조 — 실행 mock은 전체 스위트 격리 깨짐으로 폐기)·변이 red 확인. lock에 jieba linux 바이너리
  존재 확인. 사고 기록: 커밋 실패 상태에서 체인 끝 `git reset --hard`가 미커밋 작업 삭제(백업 복구) —
  이후 커밋 성공(rev-list 카운트)을 확인한 뒤에만 reset 실행.
- **🇨🇳 자료실 중국어 개통(2026-08-11, #965)** — 오너 요청(중국어 몰입 중). jieba(@node-rs, 사전 동봉·
  네이티브 빌드 불필요) 단어 분할 + pinyin-pro 성조 병음, 동일 토큰 계약(furigana 슬롯=병음 → 뷰어·
  단어장·SRS 무변경 동작). analyze 화이트리스트·중국어 뜻 프롬프트·자료실 필터/레벨(ZH_LEVELS)·추가
  토글. next.config에 serverExternalPackages+tracingIncludes(.node 번들 파싱 실패·Vercel 바이너리 동봉).
  유닛 6종·실측(北京大学/图书馆 분할·성조 병음)·언어 게이트 A/B. vitest 2,629·e2e 22/22.
  **잔여 확인: 프로덕션에서 실제 중국어 자료 분석 1건**(로컬은 service_role 키 부재로 500 — 3언어 공통).
- **🔧 홈 진도 탭 국기 이모지화(2026-08-11, #963)** — 오너 지시 3보: 좁은 폭 글자 잘림을 칩 내용
  국기 이모지 단독(🇬🇧🇫🇷🇯🇵🇨🇳)으로 해소. 이름은 aria-label·title 유지·aria-pressed. 340px 잘림 0.
- **🔧 홈 진도 위젯 배치 정정(2026-08-11, #959→#961)** — 오너 확인으로 #959 해석 오류 정정:
  본뜻은 '칩 줄이 갈라지지 않게'·원래 배치는 제목 아래 칩 줄. 전 폭 2단 고정([진도]+칩 한 줄,
  좁으면 가로 스크롤)으로 복원. 4폭 실측.
- **🔧 홈 진도 위젯 한 줄 고정(2026-08-11, #959)** — 오너 직접 지시(홈 수정 금지의 예외 건).
  .lvprog__head wrap → nowrap+칩 영역 가로 스크롤(내용 불변·CSS만). 360~900px 6폭 실측 단일 행.
- **🚪 랜딩 철거(2026-08-11, #957)** — 오너 판단('무엇부터 볼까요?' 존재 이유 부재 — 전 요소가 타
  페이지 문의 복제). '/'는 상태별 리다이렉트(세션→/home·게스트→/lessons, 교재 첫 방문 소개가 현관).
  LandingPage+CSS 59블록(~7KB) 전거, a11y 계약 교체, layout metadata 4트랙 현행화. CI 1회 red는
  러너의 구글 폰트 fetch 실패(환경 flaky — 재실행 green, A/B 판정 기록).
- **🗺 일본학 지도 — 지식 포인트 층(2026-08-11, #955)** — 오너 지시(문서 직행 대신 요약 리스트 펼침).
  35핀 × 지식 포인트 108개(심층 문서 증류·테마 도트) — 카드 = 훑어보기 완결, 문서 링크는 기본 접힘
  '더 보기' details로 강등(관심 깊은 사람만). 목록 뷰도 활성 시 포인트 동기. 도쿄 food 테마 추가.
  계약 테스트 확장(포인트 ≥2·테마 정합·문장 종결). 검증 교훈: 닫힌 details 가시성은 rect가 아니라
  innerText로 판정.
- **🗺 일본학 지도 HD(2026-08-11, #953)** — 외부 API 검토 후 로컬 업그레이드 권장안 승인·이행:
  50m 해안(스냅샷 756KB 벤더링)+10m 현 경계 일본 추출본(80KB — 원본 21MB SHA 기록) 2패스 빌드,
  path 총 37KB(무의존·오프라인 유지). 디자인 폴리시(바다/육지 톤 분리·hairline 경계·핀 hover/pulse·
  reduced-motion·포커스 정리). 시코쿠·세토내해·반도 형상 복원. 실시간성 문답 기록: 베이스맵은 갱신
  실익 없음, 마쓰리 일정류 실시간화는 별도 크론 발주 사안.
- **🗺 일본학 지도 개통(2026-08-11, #951)** — 오너 지시(지역 결합·핀·테마 큐레이션). 심층 5문서의
  장소 35곳을 일본 윤곽(기존 world-atlas 스냅샷에서 일본만 추출하는 빌드 스크립트 신설, 윤곽·핀이
  projectJp 공유) 위 테마 핀으로 — 식문화 7·역사 12·문학 7·예술 8·신앙축제 10. 핀 카드 → 근거 문서
  링크(테마→문서 매핑). 목록 뷰 병설(접근성 대체 수단)·계약 테스트 4종(문서 실존 대조·bbox·최소 핀).
  /studies/japan/map + 허브 입구. vitest 2,622(+4)·e2e 22/22. tmp purge 3번째 재발(78파일) 복원.
- **📖 자료실 EPUB 반입 개통(2026-08-10, #949)** — 오너 지시(개인 소장 전자책·아오조라 EPUB).
  무의존 파서(ZIP 직접 파싱+DecompressionStream, 라이브러리 0)·챕터 선택 반입(50k 가드)·루비 독음
  벗김·원본 미보관(텍스트만, 스키마 불변)·비공개 강제(PDF와 동일 원칙). 유닛 7종+변이 2종 red 확인·
  실파일(deflate EPUB) 브라우저 전체 플로우 검증. vitest 2,618(+7)·e2e 22/22.
- **🏁 일본학 심층 로드맵 5편 완결(2026-08-10, #940·#942·#944·#946·#947)** — 자료집 수집(#938)부터
  종편까지 하루에 완주. 4호 예술 순례(#946): 유파 계보(사숙 논점 헤지)·우키요에(도카이도 53차=2호
  크로스)·공예 지리(아리타 이삼평 한일 접점)·이미지 라이선스 표. 나오시마 가가와현 교정.
  5호 신앙과 축제(#947, 종편): 이즈모 신화 해석 프레임·고야산/시코쿠 88·도호쿠 마쓰리·야나기타
  도노 이야기(PD 판정 명기)·니치분켄 DB. 가미하카리·가미아리즈키 표기 교정. 일본학 = 1기 7문서
  + 심층 5문서(전부 studiesRegistry 계약·통설 헤지·수위 준수). 차기 후보: 타국(프랑스학 등) 동일
  파이프라인 확장 또는 아오조라×언어 트랙 연계 — 발주 대기.
- **📚 일본학 심층 3호 — 문학 기행(2026-08-10, #944)** — 수위 완화안 첫 본격 적용(작가·작품 실명 —
  PD 원문 확정 작가 한정·번역문 무인용 원칙 명문화). 고전 지도·바쇼·근대 5작가·무대 표·아오조라 사용법·
  저작권 3원칙. 편찬 교정 3건(겐지 시집 '바람이 분다' 오기→봄과 수라·소라 한자·다자이 1998 재확인 —
  자료집 원본 동시 반영). 아오조라×언어 트랙 연계는 발주 판단으로 기록. 잔여: 4편 예술 → 5편 신앙.
- **📚 일본학 심층 2호 — 길과 도시로 읽는 일본사(2026-08-10, #942)** — 가도·참근교대·슈쿠바·
  조카마치·현존 12천수 표·세계유산 4선·1차 사료 진입로·통설 검증대. 편찬 교정 3건(참근교대 1635
  정례화 헤지·이와미긴잔 발견담 전승 강등·12천수 마쓰에 2015 국보 승격 반영 — 자료집 구정보 갱신).
  잔여 로드맵: 3편 문학 기행 → 4편 예술 순례 → 5편 신앙과 축제의 지리.
- **📚 일본학 심층 1호 — 식문화 편찬(2026-08-10, #940)** — 수위 완화안 오너 승인("ㄱㄱ") 후 로드맵
  1편 저작·등재(jp-food-deep, 8섹션+권역 표): 등재 대상의 정확한 정의와 '발명된 전통' 논쟁 병기,
  우마미·발효·에도 계보·동서 국물·가이세키 두 계보·통설 검증대 5건. 자료집 실출처만 인용,
  studiesRegistry 계약 green. 다음 = 로드맵 2편(길과 도시로 읽는 일본사).
- **📚 일본학 심층 자료집 완성(2026-08-10, #938)** — 리서치 세션 5개 병렬 수집 → 실측 검증(1,719줄)
  → docs/japanology/ 편찬(README+5테마 1,832줄). 핵심 수확: 아오조라문고 원문 활용 후보·농림수산성
  향토요리 DB·ColBase/e국보·니치분켄 요괴 DB·작가별 퍼블릭 도메인 표. 편찬자 교정 2건(다자이 저작권
  1998 만료 확정·마사오카 시키 오타). **오너 결정 대기: 수위 정책 완화안(문학·예술 작가/작품 언급 —
  PD 원문 기준) 승인 → 심층 문서 편찬 착수.** 로드맵 5편(식문화→길과 도시→문학 기행→예술→신앙 지리).
- **📚 일본학 심층 — 학술 자료 수집 착수(2026-08-10)** (위 완성 항목으로 갱신됨 — 이력 유지) — 오너 지시: 식문화·역사·문학·예술 등
  인문학적 가치의 지역 여행 테마로 학술 자료 선수집(지역학 1기 후속). 리서치 세션 5개 병렬 가동
  (식문화·지역사·문학·예술·종교민속 — 실존 서지 검증·출처 병기·날조 금지 규율) → docs 자료집 편찬
  → 심층 문서 목차 확정 순. 1기 수위 정책(작품·작가 무언급)과의 정합은 자료집에 검토 섹션으로.
- **📝 기록 현행화(2026-08-10, #936)** — 전략 문서 VI 추가(재평가 7.8→8.2·사설 전환으로 구 전략 종결
  선언·성능 실측표 새 기준선·다음 방향 5건) + 학습루트 문서(docs/learning-routes.md) 신설.
- **🔧 백로그 2건(2026-08-10, #934)** — 읽기 신호 편입(리딩 테스트 문항별 정오→review_events
  source='reading', 다이얼·주간 회고 합류 — 회화는 정오 신호 부재로 제외 판단) + fr/zh 수준 저장
  (마이그레이션 SQL 준비 supabase/migrations/20260810120000 — **적용은 오너 수동**, 온보딩·프로필
  저장은 컬럼 오류 폴백 배선이라 적용 전 안전·적용 즉시 자동 저장 + MyPage fr/zh 수준 UI).
  P4-14(#fff)는 리포 CSS 관례로 확인·종결.
- **🔧 자가 감사 수리 라운드(2026-08-10, #930·#931·#932)** — 오너 "자가로 개선점" 지시.
  #930 정합 일괄: 전 라우트 탭 제목 이중 브랜드(template+접미 중복, 53파일)·'강의' 노출 3곳·
  aria(자료실 칩/탭·서재/오늘 학습 언어 전환)·추천 API 500→200 [] 방어·'마이페이지'→프로필.
  #931 오늘 학습 정돈: 주 루프 본체 표면 관례 동조(국기 3·장식 이모지 4·게스트 탈출구·aria) —
  구조는 정교해 재작성 없음. #932 langNameKo 단일화(2트랙 삼항 6곳 — 자료 4트랙 확장 지뢰 제거).
  XSS 재감사 11곳 전부 안전 판정(수리 불요). 잔여 백로그 = fr/zh 수준 컬럼 SQL·읽기 신호 편입(발주 대기).
- **🎨 목록 라운드 3건(2026-08-10, #926·#927·#928)** — 뷰어·로그인·프로필 4트랙.
  뷰어(#926): 가짜 덱 문 제거(vocab_decks 소비처가 그 블록뿐 — 여는 경로 부재), '라이브러리'→자료실·
  '강의'→편, SIZE/LINE/GAP 한국어화, 저장 language 정본화(존재 않는 컬럼→정규식 폴백이던 것),
  테마 버튼 이름 등 a11y. 로그인(#927): 감성 카피→기능 설명, 가입 비번 8자 통일(재설정·계정과 정합),
  '로그인 없이 교재 둘러보기' 탈출구, 기본 목적지 /materials→/home, label 연결 0→전부.
  프로필(#928): 학습 언어 4트랙(온보딩과 대칭 복원 — 수준은 컬럼 있는 ja/en만, 소비처 전수 확인 변경 0).
- **🎨 서재·작문 정돈(2026-08-10, #924)** — 다시 보기 목적지 2종, 같은 기준 6탄. **오판 정정**:
  /writing은 기록실이 아니라 작문 연습장(프롬프트→첨삭→재작문+히스토리) — #917 카드·#921 가이드가
  라벨 유추로 오설명했던 것을 실체 동조(카드 '다시 보기'→'서재와 작문'). 명칭 통일(라이팅 스튜디오→작문·
  다시 읽기 서재→서재, 잔재 0), '내 자료로'→'내 글감으로'(#919 탭과 충돌 해소), 국기·장식 이모지 전거,
  로그인 전용 페이지 a11y 사각(aria-pressed 12·aria-expanded 4·minHeight 28). vitest 2,611·e2e 22/22.
- **🎨 가이드·프로필 정돈(2026-08-09, #921·#922)** — 같은 기준 4·5탄으로 재설계 축 5개 완결.
  가이드: 삭제된 '연습실' 명칭 정리(실경로 복습/문법만/작문 기록), 중복 문구 수렴, 이모지 헤더 제거,
  #E8763C→--accent-text, /help 구설계 답변 2건 현행화('별도 복습 화면 없음' 모순 해소).
  프로필: 알림 두 패널(로컬 시간·웹 푸시) 한 패널 통합, goal_read 슬라이더 제거(소비처 0).
- **🎨 자료실 정돈(2026-08-09, #919)** — 같은 기준 3탄. 추천 폴백 카드 제거(빈 배열 상시 노출이던
  '추가해보세요' 카드 = 상단 버튼·가이드와 같은 문 — 추천은 내용 있는 날만), 추가 입구 단일화
  ('붙여넣어 시작' 제거+pending_paste 정리), 탭·토글 한국어화(공용/내 자료/PDF), '강의'→교재 정정,
  카드 제목 실링크화(키보드), 소유자 버튼 29px(게스트 감사 사각). vitest 2,611·e2e 22/22·CI green.
- **🎨 교재 페이지 재설계(2026-08-09, #917)** — 오너 지시 "처음부터 다시 만들듯 · 중복 제거 · 적절한 건 이전".
  시제 구분을 교재 축에 적용: LearnPage 임베드 해체(오늘 CTA·예보·복습 타일·성장 벤토 = 복습·홈 정본과 중복),
  서재·작문 입구는 복습 '다시 보기' 카드로 이전(grid 'hero vocab'/'revisit vocab', 바닥 626=626 실측).
  소개 카드는 첫 방문(읽음 0)에만 + 학습 가이드 링크, 재방문은 이어서→필터→목록 직행.
  사어 -832줄(LearnPage·진도 위젯·homeProgress 2종·CSS 4계열). vitest 2,611·e2e 16/16·CI green.
- **🎨 와이드 2열 동일 높이(2026-08-09, #915)** — stretch + 짝 내 margin 0(간격은 컨테이너로).
  실측 1280: 334=334px, 상·하단차 0.
- **🎨 문법 큐 카드 제거(2026-08-09, #913)** — 오너 지적: '문법만' 링크와 같은 문(/review/grammar 목적지 동일,
  고유 내용 한 줄뿐, 예정 목록은 목적지 페이지가 이미 표시). 다음 도착일 신호는 완료 문구에 흡수
  (단어·문법 중 먼저 오는 쪽 — 실렌더 검증). 대시보드 최종형 = [오늘 할 일] + [단어장].
- **🎨 히어로 폴리시(2026-08-09, #911)** — 덱·방식 셀렉트를 ⋯ 설정 서랍으로(하루 한도와 같은 결),
  덱 걸림은 단어장 카드 요약에 접두 표시. 주 버튼 58px로 확대. 히어로 표면 컨트롤 0개.
  regex 블록 삭제가 반만 삼켜 빌드 red → 정확 문자열로 잔여 제거(경계 단언 없는 삭제 재발 사례).
- **🔗 복습에 오늘 학습 주 진입(2026-08-09, #909)** — /study 상시 입구가 교재 탭에만 있어 복습에서 안 보였다
  (오너도 위치를 몰랐음). 오늘-할-일 카드: 주=[오늘 학습 시작 →](+기능 설명 한 줄), 보조=단어만 N·문법만 N.
  라벨 원칙 유지(총계=보조 둘의 합, 중복 없음). e2e 계약 갱신. 실렌더 390·1280 확인.
- **🔧 오너 결정 B 검증 → 치명 수리(2026-08-09, #907)** — "공부 세션 정답 → 단어 SRS 전진"을 구현하려 추적한 결과:
  ① **B는 이미 구현돼 있었다**(studyExerciseBridge — 어휘 문항 FSRS 계산→user_vocabulary 갱신, 단위 테스트 포함).
    "갱신 안 함"은 워밍업 한정 규칙(비예정 조기 복습 왜곡 방지 — 유지). 내 앞선 설명이 이 주석을 과대 해석한 오판.
  ② **정작 /vocab 세션 채점이 조용히 죽어 있었다** — handleScore가 easeFactor(비존재 컬럼)를 보내고 repetitions 누락
    → PostgREST가 UPDATE 전체 거부 → 채점해도 SRS 미전진, 화면 무표시. **PATCH 페이로드 실측으로 증명** 후 수리.
  계약 고정: e2e에 채점 단계 추가(snake_case 키 존재·easeFactor 부재 단언). 변이 주입 red 확인.
  vitest 2,620 · e2e 8/8 · 배포 success.
- **🎨 홈/복습 구분 확정 + 2열 조판(2026-08-09, #905)** — 오너 질문 "홈과 복습 어떻게 구분?"에 시제 구분으로 답:
  **홈=기록(과거) / 복습=기억 관리(현재) / 교재=새로 배우기(미래)**. 오너 승인(ㄱㄱ).
  → 복습의 교재 진도 카드 제거(교재 이어서가 3곳에 있던 원흉 — 전진 축은 교재·홈 몫).
  홈의 단어 복습 타일은 기록→행동 입구로 정당해 유지. 홈 제안 1건만 남김('더 둘러보기'의 /vocab 중복 — 수정 금지라 제안).
  ≥900px 2열 그리드: 좌=행동(오늘)+짧은 조망(문법 큐), 우=목록(단어장) — 1280×800에서 문서 843px(한 화면).
  모바일은 DOM 순서 세로 유지. vitest 2,620 · e2e 8/8 · 프로덕션 양 폭 넘침·에러 0.
- **🎨 복습 = 학습 대시보드(2026-08-09, #903)** — 오너 방향: 목록 나열 대신 조망+진입, 어휘 외 영역도 같은 구성.
  모든 영역이 같은 문법(제목·수 / 진입 / 요약 / 미리보기): [오늘 할 일 행동카드] → [단어장 N — 임박순 5,
  행=상세 모달, 전체 보기=검색·필터 목록(tab browse)] → [문법 큐 N — **미래만**(예정·다음 도착, '지금'은 히어로가 말함)]
  → [교재 진도 — 시작한 트랙만, 읽은 n챕터·이어서]. 총 챕터 수는 레지스트리 클라 반입이라 안 실음(읽은 수로 충분).
  미리보기 행의 접근 가능한 이름을 목록 행 규약과 동일하게 유지 → **e2e 수정 없이 통과**.
  실렌더: 진입/복귀·상세 모달·console 0. vitest 2,620 · e2e 8/8 · 프로덕션 /vocab 0/0/0.
- **🎨 오늘-할-일 카드 v2(2026-08-09, #901)** — 오너: "관련끼리 묶고 '덱'·'방식' 라벨 제거, 심플·직관, 정렬 중요, 중복 처리".
  위계 셋으로 고정: 수(오늘 할 일 7 + ⋯ 구석) → 버튼(단어 n/문법 m — **버튼이 곧 분해**) → 셀렉트([전체 덱▾][자동▾]).
  관리(추가·CSV·Anki·통계·한도) 전부 ⋯로. 중복 3곳 제거(요약 분해·문법 이중 표기·오늘 신규 0/15).
  **라벨 불일치 수리**: '단어 복습 2개 시작'인데 실제 세션 5개(복습2+신규3)이던 것 → 통합 카운트.
  전 행 왼쪽 한 축(가로 전환 미디어쿼리 제거), 사어 CSS 5종 삭제. 계약은 셀렉트 aria-label로 이동(약화 아님).
  게이트: vitest 2,620 · e2e 8/8 · /vocab 360px 0/0 · 프로덕션 배포 확인.
- **🎨 복습 파트 재설계(2026-08-08~09, #898·#899)** — 오너 지시 "처음부터 다시 짜는 느낌으로".
  **관찰 먼저**(390×900 실렌더): 세션 화면의 절반이 크롬(헤더·칩 3줄)이라 문항 카드가 화면 아래 절반에서 시작,
  보기 잘림·단어 줄바꿈. 대기 화면은 같은 수가 4번 반복·액션 4개가 '+ 추/가'로 쪼개짐·"복습 0"인데 버튼은 "복습 시작".
  - **세션 = 문항만**: 크롬 제거(하단 네비는 body 클래스로), 상단 나가기+진행바+n/m, 타이포 clamp.
    카드 상단 750→187px · 단어 56→33px(한 줄) · 보기 4개 전부 노출. 방식 선택은 시작 전으로(세션 중 변경이 문항 초기화하던 설정).
  - **대기 = 할 일 하나**: 중복 카운트 제거, 0 항목 생략, 단어+문법 합산 한 수, 라벨이 실제 할 일을 말함("새 단어 3개 시작").
    현황 칩→텍스트 줄(위계 분리), 언어 칩은 실데이터만, 정렬 칩→select, 검색 입력 다크 수리.
  - **덱 = 세션 범위 설정**(#899): 검색창 위(목록 필터처럼 보임)에서 오늘-할-일 카드 안으로 — 덱을 고르면 위의 수가
    바로 바뀐다(실측 7→5). 지우다 발견한 도달 불가 분기(`tab==='review'`) 제거.
  a11y는 이동만, 손실 없음(진행 status+progressbar·방식 그룹 계약 테스트를 새 위치로 갱신).
  작업 중 훅을 조기 return 아래 뒀다 React #310 — #838과 같은 자리, 위로 올리고 주석.
  게이트: vitest 2,620 · e2e 8/8 · 11라우트 접근성 회귀 0 · **프로덕션 실동작**(복습 루프 채점 반영·/vocab 0/0/0).
- **🏁 접근성 전수 마감(2026-08-08, #893~#896)** — "할 거 없나"에 답하려 전 라우트를 훑다가 **내 검증 범위의 구멍**을 발견했다.
  앞선 터치/대비 작업은 **표본 4~6페이지**에서만 잰 값이었고, 손대지 않은 화면엔 결함이 그대로 있었다.
  - #893: 어휘 **302건**(저장 버튼 23×28·체크박스 18×18·**검색 입력 19px** — `.search-input`에 크기 계약이 아예 없었다)
    · 가이드 2 · 로그인 2. 체크박스는 감싸는 `<label>`을 24×24로 하고 **가장자리 탭 토글까지 기능 확인**.
  - #894: 어휘·문형 브레드크럼 16px(챕터는 #885에서 고쳤는데 **별도 사본**이 있었다)
  - #895·#896: "트랙 색"이라 뭉뚱그린 건 부정확했다 — ① UI 토큰(다크만 누락, 라이트는 이미 수리됨)
    ② 콘텐츠 데이터 색 ③ 진짜 트랙 색, 셋의 성격이 달랐다. **근본 원인은 `--accent`·`--primary`가
    배경·글자를 겸하는 것**(요구 방향이 반대) → 용도별 토큰 분리 + 계열 전수 치환(CSS 62·인라인 31건).
  **최종 실측: 21개 라우트 전부 가로 넘침 0 · 터치 AA 0 · 대비 AA 0.** 전후 캡처상 인상 변화 없음.
  부수 정정: `/viewer`는 `[id]`만 있어 404가 정상 — 이전 성능 분해의 "뷰어 584kB"는 **404 페이지를 잰 무의미한 수치**였다.
- **🏁 잔여 2건 처리(2026-08-08, #890·#891)**
  ① **기기 큐 로그인 이관**(#890): 게스트로 쌓은 복습이 로그인해도 기기에만 남던 것을 서버로 옮긴다.
     **서버가 정본** — `ignoreDuplicates`로 없는 카드만 넣고(다른 기기가 더 진행했을 수 있다),
     FSRS 상태를 그대로 옮기며, **쓰기 성공 확인 뒤에만** 로컬을 비운다(실패 시 다음 로그인에 재시도).
     DB 스키마 변경 없음. 변이 주입 3종 모두 해당 테스트만 red.
     작성 중 **테스트 자체의 헛통과**도 잡았다 — 상단 import가 캐시돼 `doMock`이 안 걸림 → `vi.resetModules()`.
  ② **접근성 R3 대비**(#891): 대비는 **가장 밝은 배경(카드 `--bg-elevated`) 위에서** 재야 한다.
     그 기준으로 `--text-muted`가 **2.96:1**(AA 4.5 미달)이었다 — 이전 패스의 '3.4'는 본문 배경 기준이라 과대평가.
     muted #8A7055→#AF8E6C(4.52), secondary도 함께(위계 뒤집힘 방지, 휘도 차 0.123 유지).
     실측: 챕터 16종→2 · 교재 9종→3 · 복습 0. 전후 캡처상 디자인 언어 변화 없음.
     **포커스 표시는 오탐이었다** — 실제 Tab 이동에선 전부 2~3px outline 정상(프로그램적 .focus()가
     `:focus-visible`을 트리거 안 해서 생긴 오탐). 고친 것 없음.
  **오너 판단 대기**: 남은 대비 미달은 전부 **트랙/브랜드 색을 작은 글자에 쓴 경우**
  (#3B6FB5 3.31 · #4A8A5C 4.07 · #4C6EF5 4.22). 색을 밝히면 트랙 정체성이 달라져 임의로 안 정한다.
- **🏁 오너 판단 2건 처리(2026-08-08, #887·#888)** — "권장대로".
  ① **44px 선별 상향**(#887): 전면 적용은 밀집 목록의 정보량을 줄이므로, **자주 누르는 조작·단독 아이콘만** 올렸다
     (발음·모바일 네비·헤더 아이콘·드릴 선택지/토큰/확인·정답 열기·skip-link). `.btn--sm` 전역은 안 건드리고
     드릴 안에서만 `.drill-action`으로. **챕터 44px 미달 80→11 · 복습 10→4**, AA는 전 페이지 0 유지.
     전후 캡처 대조 — 드릴 섹션 1027→1078px(+5%), 헤더·본문 인상 변화 없음. 칩·그룹 토글은 의도적으로 유지.
  ② **비로그인 복습 개통**(#888): 게스트 큐를 실제로 풀 수 있게 했다. `POST /api/review/drills`가
     **서버에서** 문항을 조립한다(findDrillContext가 전 챕터 레지스트리를 순회 — 클라 조립은 콘텐츠 번들 통째 다운로드).
     인증·쓰기 없음, 요청의 문항·정답은 안 쓰고 slug로 서버 콘텐츠에서만 재생성, 60행 상한.
     채점은 `applyGuestReviewResult`로 같은 FSRS를 적용해 기기 카드를 전진(미등록 카드는 생성 안 함).
     **프로덕션 실동작 확인**: 드릴→큐→재출제→채점 후 next_review_at 미래 이동, console.error 0.
  검증 규율: 두 건 모두 **변이 주입으로 새 테스트가 red가 되는지** 확인 후 원복. e2e 7/7 · vitest 2,617 green.
  **남는 것**: 기기 큐는 로그인 시 서버로 이관되지 않는다(진도 동기화와 별개 경로) — 필요 시 별건.
- **🏁 3축 라운드 완료(2026-08-08, #882~#885)** — 오너 지시 "나머지도 전부 차례차례".
  ① **라우트 성능**(#882·#883): 최대 라우트 고유 조각은 챕터가 아니라 **/lessons 세계지도 좌표 124 kB**였다.
     상대좌표 재생성(124→99 kB)+화면 근처에서만 로드 → 모바일 605→**482 kB**. 저빈도 링크 prefetch 차단으로
     랜딩 526→**409 kB**(/vocab 청크 68 kB를 방문자 전원이 미리 받고 있었다).
  ② **SRS 루프**(#884): e2e를 짜다 **게스트 넛지가 막다른 길**임을 발견 — "복습 대기 N개"라며 /review/grammar로
     보내는데 그 페이지는 로그인 세션에서만 큐를 읽는다. 게다가 **기존 e2e가 그 막다른 길을 정답으로 고정**하고 있었다
     (헤딩이 정상·빈 화면 양쪽에 다 떠서). 게스트에겐 기기 저장 사실만 알리고 로그인 권유로 교체.
     신규 테스트: 로그인 채점이 review_events 정본에 닿는지 + 게스트 큐 이중 기록 금지. **변이 주입으로 실효 확인.**
  ③ **터치 타겟**(#885): 44px(AAA) 미달이 많아 보였지만 **AA 기준은 24px**이고 실제 미달은 5종뿐이었다.
     글자·배치는 그대로 두고 히트 영역만 넓혀 3뷰포트×6페이지 18조합 **AA 미달 0**.
  프로덕션 실측(360px 게스트): 랜딩 410 · 교재 482 · 챕터 539 · 복습 526 kB, AA 미달 0, 가로 넘침 0.
  **오너 판단 대기**: 44px(AAA)는 드릴 선택지·발음 버튼·칩을 실제로 키워야 해 화면 인상이 달라진다 —
  임의로 정하지 않고 남긴다. 게스트가 **실제로 복습까지** 하게 하려면 작은 API 라우트가 필요하다(별건).
- **🔧 CI 게이트 배선 완료(2026-08-08, #880)** — 그전까지 `.github/workflows/`에 테스트 워크플로가 **없었다**
  (Supabase 마이그레이션 2개뿐). `npm test`도 e2e도 Claude 로컬에서만 돌아, e2e가 오래 red인 채로 안 걸린 구조적 원인.
  이제 PR·main push마다 **test 잡**(lint → prebuild 콘텐츠 게이트 → vitest 2,614) + **e2e 잡**
  (테스트 env 빌드 → smoke → learning-flow)이 돈다.
  **배선 첫 실행이 곧바로 결함을 잡았다**: smoke `visibility` `test timed out after 30000ms` —
  `.catch()`로 감싼 대기에 테스트와 같은 30s를 줘 catch가 실행될 틈이 없던 것. 로컬에선 `cancelled 1`로만
  집계돼 내가 오판하고 넘겼다(요약 grep이 exit code를 삼킴). 잔여 대기 5s로 수리 → **2회차 두 잡 모두 green**.
  **이제 merge 판정 기준은 CI green** — 로컬 실행은 선행 확인일 뿐.
- **🏁 회수 라운드 완료(2026-08-08, #876·#877·#878)** — Codex-3·4가 이슈 2회·보드 1회 무응답이라 Claude가 직접 수행.
  ① **모바일**(#876): 실렌더 3뷰포트 × 12페이지 36조합 감사 → 가로 넘침은 한자 다리 표 1건뿐(360px +37px)
     → 표 안 스크롤 + ≤420px 여백 축소. 수리 후 36/36 넘침 0. 프로덕션 재확인 완료.
  ② **성능**(#877): 발주서 목표(챕터 156kB)는 **잘못된 표적**이었다 — `next build` First Load는 정적 분석치이고,
     실제로는 **모든 페이지가 supabase-js 197kB를 추가로** 받고 있었다(AuthProvider가 세션 유무와 무관하게 즉시 로드).
     세션 쿠키 없으면 SDK 미로드로 전환 → **게스트 JS -27~30%**(fr 챕터 758→538kB). 프로덕션 실측 확인.
  ③ **flaky 제거**(#878): smoke `visibility`가 main 기준 3회 중 1회 red였다(A/B로 내 변경 무관 확인).
     원인 = 페이지 이동이 프로필 fetch를 끊고 그 취소가 console.error로 기록 → `pagehide` 중엔 로그 안 함. **6회 연속 fail 0**.
  **잔여(미착수, 정직 기록)**: 라우트별 분해는 안 했다 — 챕터 `[slug]` First Load 156kB·`/viewer/[id]` 162kB·`/vocab` 149kB는
  그대로다. 카나 컴포넌트 지연 로드는 **효과 0으로 확인돼 되돌렸다**(48kB 청크가 카나 전용이 아니라 챕터 클라이언트 코드 묶음).
  smoke 마지막 케이스가 실행에 따라 `cancelled 1`로 집계되는 현상은 이번 변경 전부터 있던 하네스 종료 경합 — 별건.
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
- **🔍 코드 리뷰 R1 마감(2026-08-05 심야, #849~#857)**: 위임 수리 3건 게이트·머지 — Codex-4 성능 P1~P5(#852:
  **CSS gzip -20.9%(274→217KB)·/lessons First Load -25%(183→137KB)** 실측), Codex-2 뷰 supabase error 전수 보강(#854),
  Codex-1 components C-04~C-13(#855 — TTS 가용성 계약은 serverAudio 폴백 확인 후 승인). Claude 직접 수리 = 학습 핵심
  C-01~C-03(#853 — WritingPractice hydration·챕터 전환 초안 잔존, ChapterDrills 로그인 이중 집계·기록 실패 시 재시도 영구 차단).
  **커버리지 공백 자가 발견**: 어느 세션에도 배정 안 된 `src/app` 서버 페이지를 Claude가 훑어 **soft 404 적발**(없는 챕터가
  HTTP 200 — 검색엔진 유령 색인). #856 1차 수리가 선언 누락으로 무효였고 #857에서 `dynamicParams=false`로 근본 차단·회귀 테스트 고정.
  **부수 교훈**: 세션 내내 쓰던 스모크 URL `/french/grammar/a1-01-etre`가 실재하지 않는 slug였고 soft 404 때문에 200으로 보였다
  (실제 `a1-01-pronouns-etre`) — 라우트 스모크는 매니페스트 실재 slug로만. 전체 vitest 2,594 green.
- **🔒 미결 3건 처리(오너 위임 판단, #859·#860)**: ① **word-detail 공용 사전 쓰기를 '빈 칸 채우기 전용'으로 축소** —
  로그인만 하면 기존 설명을 덮어쓸 수 있어 반달리즘 여지가 있었다(XSS는 #835에서 렌더 차단). DB 스키마 변경이 하드리밋이라
  소유권·이력 테이블 대신 정당 용도만 남김(이미 채워진 항목 skip·마크업 입력 거절·update error 확인). 교정 경로는 관리자 사전 유지.
  ③ **TTS 캐시 우회 차단** — `VOICES[lang] || 'Kore'` 폴백 때문에 `lang`만 바꿔가며 CDN 캐시를 우회해 유료 호출을 무한 유발할 수
  있었다(프로덕션 실측: 지원 외 lang 400 확인). 인스턴스 총량 차단기(분당 600) 추가 — 서버리스에서 IP 맵이 인스턴스별이라 총량 제어가
  안 되던 문제의 최소 방어. ② **engines 20.x는 변경하지 않음** — prebuild가 world 자산을 `--check`만 하고 재생성하지 않으므로
  PNG 결정성은 로컬 저작 한정 요건이다(모순 아닌 역할 분리). CLAUDE.md에 명시해 재지적·임의 변경 차단.
- **🔒 방향 전환: 공개 서비스 → 사설 학습 도구(오너 지시 2026-08-06, #863·#864)**: "지인끼리만 사용 · 홍보성 내용·페이지 제거 ·
  기본 개방하고 저장 시점에만 로그인 권유 · 미니멀리즘·실용주의 · **[홈]은 완성형이라 수정 금지, 리뷰는 하되 제안만**".
  **랜딩 300→74줄**(HERO 데모·PERSONA·HOW IT WORKS·FEATURES·STATS·FINAL CTA 삭제, '무료' 5곳 제거, 마케팅 JSON-LD 제거 —
  남긴 것은 트랙 4카드·로그인 권유 1줄·최소 푸터). **자료실 게스트 안내**(빈 목록 → '로그인하고 자료 올리기'/'로그인 없이 교재부터').
  실측: 랜딩 클릭 요소 16→7, 홍보 문구 0, 게스트 주요 라우트 6종 200. 유지 판단: /guide는 실사용 안내라 존치.
  부수 — 랜딩은 (app) 밖이라 serif 미로드(제목 serif 제거), performanceRepairs 테스트의 'var(--font-serif) 개수 == 15'
  단언은 정당한 사용마다 깨지는 지뢰라 스코프 검사로 완화.
- **🧪 e2e 학습 흐름 + 접근성 라운드(#866~#868)**: 기존 e2e 20건 중 12건이 동결 world라 **핵심 학습 루프가 미커버**였던 공백을
  메웠다 — `e2e/learning-flow.e2e.mjs` 게스트 4건(4트랙 전환·드릴 4유형 정오답+복습 넛지·써 보기 복원+이어서 학습 위치·404).
  flaky 1건은 Claude가 수리(마운트 후 복원 상태를 즉시 읽어 경합 → `waitForFunction` 대기, 3회 연속 green).
  접근성 R1·R2(#867·#868): useId 라벨 연결·동적 결과 라이브 리전·aria-expanded — 동작 변경 없는 보강만, 시각 변경은 제안으로 보류.
  **새 e2e가 즉시 값어치**: a11y가 학습 핵심을 건드렸을 때 교차 검증으로 통과 확인. 유닛 2,608 green.
  **#869 로그인 vocab e2e도 merge — 단, Claude의 반려가 오판이었다**: 두 번 반려했으나 실패 원인은 제품·픽스처가 아니라
  **내 검증 절차**였다. `NEXT_PUBLIC_*`는 빌드 시 번들에 인라인되는데 playwright 설정은 런타임 env로만 주므로,
  환경변수 없이 `next build` 후 e2e를 돌리면 `createBrowserClient`가 초기화되지 못해 클라 `user`가 null이 되고
  로그인 UI가 안 뜬다(**에러 없이 조용히 죽음**). 같은 env로 재빌드하니 **5/5 연속 2회 통과**. 정정·사과 게시하고 merge.
  → 규칙: 인증 e2e는 `NEXT_PUBLIC_* … npx next build && node --test …` 순으로 검증(메모리 e2e-build-env-trap).
- **🧹 e2e 신호 복구(#872·#873)**: `npm run e2e`가 **오래전부터 red**였고 CI·prebuild에 없어 아무도 몰랐다.
  전량 실행 시 25건 중 7건 실패 — 전부 제거·동결 기능을 검사하는 스테일 테스트(월드 네비 노출 단언·독해 트랙·world 캔버스 5).
  월드 단언은 **계약 반전**(노출돼야 함 → 없어야 함), 중단·동결분 6건은 사유 적어 `test.skip`, `waitForTimeout(500)`
  경합은 `waitForResponse('/profiles')` 조건 대기로 교체 → **3회 연속 pass 13·fail 0·skip 6**.
  실행 절차도 스크립트로 고정: `npm run e2e:full`(= 테스트 env 빌드 + 학습 흐름). 스모크와 분리해 학습 흐름 5/5 신호가 묻히지 않게 함.
  ※ skip은 삭제가 아니다 — 해동 시 사유 주석 지우고 복원.
- **📌 지정 단어 글자 = 고정 크기(2026-08-20, **오너 설계** — "너비로 환경을 예상해
  알맞은 크기로 고정")** — 글자 수로 카드 글자가 널뛰던 것(1자 220/2자 124/3자
  75/4자 56)의 수리. 선례 조사가 오너 안을 지지: Pleco·Anki 표제어 = 고정 크기가
  관례, fluid(cqi 연속 가변)를 표제어에 쓴 현행이 이례. 구현 = `--fit-cap`을 고정
  크기 의미로 재정의하고 값만 재핀(30vh/12svh → **양쪽 4rem**): 1~3자 전부
  64px 고정, 폭맞춤은 긴 단어가 칸을 넘칠 때만 아래로 개입(min — 한 줄 유지,
  데스크톱 4자 성어 56px). 시트 60svh는 본문 가시성 문제라 별개 유지. 수식·격자
  정본 무변경, e2e 캡 주입 핀은 메커니즘 검증이라 그대로(9/9). 계약 재작성 1.
  재핀 = CSS·계약 각 1줄. 전체 vitest green.
- **🔍 카드 한자 확대 — 캡을 레이아웃 세로 예산으로(2026-08-20, 오너 승인 — "여유
  있는 너비만큼 확대")** — 진단: 너비 맞춤(cqi)은 이미 작동, **8rem(128px) 고정
  캡**이 자르고 있었다. 캡을 `--fit-cap` 토큰으로: 데스크톱 우측 칸 30vh(너비
  지배 유지 — 1자 128→~220px+, 낮은 창 안전핀만), 모바일 시트 12svh(글자+병음+
  첫 뜻이 시트 첫 화면에 함께). **시트 최대 높이 70vh→60svh**(100svh 배분 추산:
  헤더 13+본문 3줄 20+바 7 — 70vh는 본문 1~2줄만 남던 실기 원인, svh 폴백 70vh
  선행). 격자·수식 정본 무변경(캡만 토큰화), 측정 JS 0 유지. 선례: fitty 계열
  재배제(cqi 유지)·cqh 배제(시트 높이 내용 유도 = 순환)·svh 채택. e2e 실렌더에
  캡 주입 200px/폭 지배 248px 양방향 핀 추가(9/9), 계약 1 신설. 전체 vitest green.
- **🔘 문장 이동 ▲▼ 모바일 재배치(2026-08-20, 오너 실기 — "시트에 겹쳐 가려짐")** —
  플로팅 필(z 40)이 바텀시트(z 95, 최대 70vh)에 덮여 시트가 열린 동안 못 쓰는
  실결함. 모바일에선 필을 끄고 **하단 바(z 100, 항상 노출) 오른쪽 끝에 ▲▼ 44px
  버튼**으로 재배치 — 바는 시트보다 항상 위라 겹침이 구조적으로 불가능하고, 시트를
  열어 번역을 보면서 문장 이동하는 흐름(비집중 모드)도 처음으로 성립한다. 같은
  버튼 한 벌(sentenceNavBtn)이 필/바 두 옷을 입어 동작 중복 0, ViewerBottomSheet는
  barNav 슬롯 합성(leftContent 선례 — 내용 무지). 데스크톱 필은 그대로. 계약 1
  신설(+헬퍼 단언 갱신). 전체 vitest green.
- **🎯 집중 모드 통합 상호작용(2026-08-20, **오너 설계 확정** — "다른 문장/단어 탭 =
  그 문장 지정 먼저, 글자 외 클릭 = 해제")** — #1082·#1083의 개별 분기를 단일
  규칙으로 대체: 집중 ON에서 지정 문장 **밖** 탭(단어·막대¦ 공통) = **순수 이동**
  (지정만 옮기고 카드·분석·발화·시트 없음 + 낡은 패널 비움), **안** 단어 탭 = 기존
  카드, **안** 막대¦ 재탭 = 전체 분석(2단계 확인 — 지정이 먼저, 뜻·분석은 안에서
  한 번 더). 문장 아닌 줄(2자 미만)은 무시(카드 폴백 제거 — 첫 탭이 카드를 띄우는
  뒷문 차단). **빈 공간 탭 = 지정+범위 해제**(전문 조망) — 토큰·¦·▲▼필·그립·버튼은
  closest 가드로 제외, 드래그 합성 클릭은 기존 캡처 차단이 앞단 방어. 드래그·집중
  꺼짐 동작은 현행 그대로. 선례 조사(오너 지시로 사전 수행): LWT/Lute v3/
  fluent-reader 등 단어 팝업 구조뿐 문장 포커스 상호작용 없음 → 직접 구현 유지,
  ReadAlongs 계열 탭=문장 하이라이트 검증은 제안 1 참고 등재. 계약 재작성 2+신설 1.
  전체 vitest 1,957 green.
- **📚 선례·오픈소스 조사 = 기본값 규약화(2026-08-20, 오너 상시 지시 — "따로 묻지
  않아도 알잘딱깔센으로")** — 아이디어·설계 검토 때 ⑴ 동일·유사 기능의 기존 구현
  사례 ⑵ 오픈소스 존재·라이선스·유지 상태 ⑶ 우리 웹 적용 가능성(이식 vs 신규 비용,
  조판·토큰 모델 결합성)을 조사해 **채택/부분 채택/배제 + 근거** 표로 제안에
  동봉하는 것을 나침반 규약으로 박음. 지시 자체가 세션이 바뀌면 증발하는 종류라
  자동 로드 위치(CLAUDE.md)에 심고 productCompass 계약으로 고정. 선례는 검증·
  배제용(fitty→cqi, jsdiff→자체 LCS, WordNet→LLM 선례). 전체 vitest 1,956 green.
- **👆 집중 모드 첫 탭 = 문장 지정(2026-08-20, **오너 설계** — "버튼 누르면 즉시
  발동이 아니라 첫 문단 선택부터 발동, 최소 단위는 문장")** — 켜는 순간엔 아무 일
  없음(자동 동작 없음 — Claude의 자동 지정안을 오너안이 대체, 설계 헌법 결).
  집중 ON + 지정 없음 상태의 본문 탭 = 그 문장을 **순수 지정**(어둡기 발동, 시트·
  분석·단어 카드·발화 전부 없음). 동반 수정: 집중 모드에선 단어 탭이 지정을 풀지
  않음(#1002 상호 배타를 집중 꺼짐으로 한정) — 풀리면 다음 탭이 문장 지정으로
  바뀌는 플립플롭 방지. 지정 불가 줄(2자 미만)은 단어 카드 폴백, ¦·드래그는 본래
  그대로. 모바일 집중 읽기 전체 흐름이 시트 0회로 성립: 켬→탭→▲▼→(원하면 ¦).
  계약 1 추가. 전체 vitest 1,956 green.
- **🔇 집중 모드 ▲▼ = 순수 이동(2026-08-20, 오너 실기 피드백 — 모바일)** — 집중
  모드에서 문장 이동 버튼을 누를 때마다 번역·맥락 시트가 올라와 읽기를 방해 →
  집중 모드의 ▲▼는 지정·스크롤만 하고 분석·시트를 걸지 않는다(안 볼 번역에
  Gemini 호출을 쓰는 낭비도 제거). 패널은 비워 이전 문장 분석이 낡은 채 남는
  불일치 차단(clearAnalysisPanels — 시트 active가 상태 유도라 스스로 잦아듦).
  막대(¦)는 본래처럼 전체 분석, 집중 꺼짐의 ▲▼도 기존 그대로. 3문 체크: 읽기
  순환 뷰어 정거장 / 기존 세터 조합(신규 개념 0) / 이음새 무신설. 계약 갱신 1
  (모드 분기·시트 신호 금지·¦ 경로 보존). 전체 vitest 1,955 green.
- **🧭 제품 나침반 심기(2026-08-20, 오너 지시 "구조와 학습 흐름을 항상 염두…기초가
  튼튼하지 않으면 안 된다" → ㄱㄱ)** — 전수 조사 산출의 세션 간 지속화. 진단: 구조
  지식은 세션 내에서만 살고 자동 로드 위치(CLAUDE.md)에 없었다. 조치 3층:
  ① CLAUDE.md '제품 나침반' 신설 — 두 순환 한 줄 + **모든 제안·구현 전 3문 체크**
  (정거장/정본 재사용/이음새) + 정본 포인터, ② arch 문서에 §1.1 두 순환·이음새 지도
  (의도적 단절 vs 부채 구분 — 임의로 잇는 사고 방지)·§2 3문 체크·§4.9-0 최근 지뢰
  3건(시트 성장 가로채기·테스트 목 은폐·다이어트 오판) 이식 + 최종 갱신일,
  ③ 존재·상호 포인터를 계약 테스트(productCompass)로 고정(문서 오독·소실 대비).
  전체 vitest 1,955 green.
- **🧹 구조 정리 C — 중복·죽은 코드 수렴(2026-08-20, 3/3 완결)** — ① 어휘 FSRS 채점
  저장 4중복(단어장 scoreMutation·인라인 복습·퀘스트·progressStore) →
  fsrs.persistVocabGrade 정본 수렴(원시 페이로드 부활 금지 계약, 기존 이름은 별칭
  유지) ② KST 주 시작 로컬 재구현 2벌(StudySessionPage·studyMaterials) → growthStats
  정본 ③ 죽은 코드 srs.js + 그 테스트 삭제(부활 금지 계약) ④ HomePage 죽은 계산
  일소(weekXP·주간/지난주 누적·todayReads·read 쿼리 1개 — 렌더 무소비 실측; **주간
  XP 사양(단어5·복습10·완독50)은 제안 19 주간 리포트의 사양서로 이 항목에 보존**,
  isNewUser가 쓰는 recentProgress는 유지) ⑤ 규약 통일: 문형 저장 조회 → 어휘와 같은
  청크 정본(fetchSavedWordSet), PDF 번역 프롬프트 → 뷰어와 같은 buildContextPrompt
  (하드코딩 사본이 말투 항목 개정에서 이미 표류). 제외 유지: PDF 패널 통합·
  StudySession 분해·VocabStats 사제 공식(동작 변화 — 기능 동봉 원칙), listenSubtitles·
  크론 슬롯(오너 결정 대기). 유닛 2 + 계약 4. 전체 vitest 1,953 green.
- **🧹 구조 정리 B — 쿼리 다이어트(2026-08-20)** — 메타만 쓰는 조회의 통짜 전송 제거:
  뷰어 다음 자료 추천(10행 × processed_json 통짜 → status/language/level 경로 3필드),
  홈 시리즈 진도(300행 통짜 → 언어 경로 1필드), 홈 최근 진행 join(제목만), 프로필
  통계(전 컬럼 → 시각 3컬럼), 단어장 IO(언어 백필 N+1 → 언어별 배치 UPDATE, 출처
  제목 청크 순차 → 병렬). **조사 정정 2건 계약으로 고정**: 자료실 목록은 dictionary·
  sequence로 자료별 due 배지를 계산해 통짜가 실사용(다이어트 대상 아님 — 애초 판정
  오류), 단어장 본체 fetchVocab도 전 컬럼 소비자(etym·hanja)라 select('*') 유지 —
  다음 다이어트가 같은 오판을 반복하지 않게 계약 테스트에 기록. 계약 5. 전체
  vitest 1,958 green.
- **🧹 구조 정리 A — 전수 조사 버그 3건(2026-08-20, 오너 "구조부터 싹 정리 ㄱㄱ")** —
  4축 병렬 전수 조사(공부·SRS·홈/푸시·정본/인프라)가 찾은 실결함 수리.
  ① '오늘 읽기' 하루 대부분 빈 카드: 수집 크론(15:00 UTC=KST 자정)은 UTC 날짜,
  조회는 UTC 오늘 — 날짜 키를 kstDateString(growthStats 정본 신설)으로 양쪽 통일.
  ② 불어·중국어 자료가 영어 보이스로 낭독: 언어→태그 매핑이 컴포넌트마다 흩어져
  중국어 누락 — speechLang.js 단일 소스 신설, ListenControls·useTTS(폴백 utterance·
  보이스 선택·저장 키) 전부 정본으로 교체. ③ 복습 채점 저장 무증상 실패: progressStore가
  오류를 콘솔로만 삼킴 — {ok} 반환으로 표면화 + 채점부 실패 토스트(낙관 전진 유지) +
  세션 완료 시 vocab 캐시 재동기. 부수 발견: 기존 progressStore 테스트의 supabase 목이
  update().eq() 체인 부재로 성공 경로를 조용히 throw시키고 있었음(반환 계약이 드러냄) —
  목 수리. 유닛 12 + 배선 계약 9. 전체 vitest 1,953 green.
- **🛠 드래그 중 시트 가로채기 수리(2026-08-20, main CI 3연속 red 대응)** — 뷰어
  드래그 e2e가 #1072부터 main에서 3연속 실패. 로컬 재빌드·재실행으로 재현 후
  pointermove 계측으로 원인 실측: **드래그 도중 비동기 데이터 도착(정본 예문·
  유의어 등)으로 바텀시트가 위로 자라 드래그 경로를 덮고, elementFromPoint가
  시트 핸들을 반환해 범위가 목표 토큰에 못 미침**. 이전 커밋(45d1971)에서도
  재현 — 신규 회귀가 아니라 기존 실사용 결함이 카드 개편(②~⑤)으로 타이밍이
  밀리며 표면화된 것(재시도도 자란 시트가 pointerdown부터 먹어 구조적 불능).
  수리: 훅이 dragging 노출 → 드래그 동안 시트·바 pointer-events:none(투과 —
  elementFromPoint가 밑의 토큰을 잡음, 그립 조정 동일). e2e는 재시도 전 시트
  닫기 + ⑤ 자동 조회 캐시 시드(Gemini 0회 계약 유지·칩 렌더 검증 겸용).
  learning-flow 9/9 ×2 재현 green. 계약 3 추가. 전체 vitest 1,940 green.
- **✏️ 원문 수정 + 증분 재분석(2026-08-20, 오너 승인 ③ — 5종 제안 완결)** —
  분석 완료 자료의 원문을 소유자가 고치면 **바뀐 줄만 재분석**한다. 성립 원리:
  토큰 ID가 줄번호를 품고(id_{줄}_…) 부분 분석 파이프라인이 failed_indices 줄만
  분석 + 나머지 프리픽스 재사용이므로, 줄 LCS diff(diffChars 선례의 줄 단위 확장 —
  jsdiff·Myers 검토 후 의존성 0 유지) → 토큰 ID 리맵(sourceEdit.js 순수 3함수)만
  얹으면 기존 파이프라인이 증분 분석기가 된다. trim 동등 비교(공백 수정 재분석
  낭비 차단), 기존 실패 줄 자동 합류, 분석 0줄이면 재조립 전용 센티널 [-1](API
  0회), ID 충돌 불변식 가드(위반 시 저장 자체 거절 — 자료 훼손 방지), O(m·n)
  규모 가드. UI: 재분석 메뉴 3항목 → 모달(초안·디바운스 요약 '바뀐 N줄 → N줄만
  분석'). useReanalyze에 override 2종(raw_text 선확정 → 낡은 캐시 우회 투입).
  유닛 16 + 배선 계약 6. 전체 vitest 1,937 green. **오너 5종 제안(①~⑤) 전량 완결.**
- **🔗 유의어·반의어(2026-08-20, 오너 승인 ⑤)** — 단어 카드 뜻 바로 아래 자동
  표시(유의어≤4·반의어≤2, 칩 탭 = 그 단어 카드로 교체). 공개 데이터 검토 후 배제
  (일본어 WordNet 수십 MB·일본어 한정, 同义词词林 연구용 라이선스, CC-CEDICT 필드
  없음) → 기존 Gemini relay+캐시 선례(wordDetail)의 축소판: 초소형 JSON 프롬프트
  ("확실한 것만·없으면 빈 배열" 강제 — 반의어 오생성 가드), localStorage 캐시
  (빈 결과 포함 — 재호출 루프 방지, 키 버전 v1). 내용어만 조회(기능어·뜻 없음
  생략 — 호출 낭비 차단), 늦은 응답 가드. DB 공유 캐시는 보류(morpheme_dictionary
  스키마 하드리밋 + detail_text 덮어쓰기 금지 정책). 유닛 7 + 배선 계약 5. 전체
  vitest 1,915 green.
- **🔍 카드 폭맞춤 확대 + 글자 탐색(2026-08-20, 오너 승인 ①④)** — 카드의 지정
  단어를 패널 폭에 맞춰 확대: 1em 격자 계약 위에서 `크기 = 100cqi ÷ 분모` CSS
  수식만으로 성립(측정 JS 0줄 — fitty 알고리즘 검토 후 컨테이너 쿼리로 대체,
  cqi 미지원 엔진은 1.5rem 폴백). 캡 8rem(한 글자 폭주 방지), 일본어는 요미 폭
  (글자수÷2)이 분모를 올려 가로 넘침 차단(志·こころざし 실렌더 99.2px 검증).
  CJK만 — 라틴 자료는 기존 크기. ④ 글자 탭 → 훈음('굳셀 강')·병음(성조색)·日
  자형·**이 글자가 든 내 단어 칩**(탭 = 그 단어 카드로 — 재인식 앵커 철학의 확장).
  데이터는 전부 기존 탑재분(음 20,902자 — 신자체 커버 실측·훈 8,700자·日 자형
  2,890자), 테이블은 탐색 열릴 때 토글 무관 지연 로드. 유닛 13 + 계약 9 + 실렌더
  e2e 1(크기 수식·캡·격자·병음 0.26em 절대배치). 전체 vitest 1,903 green.
- **🪟 단어 카드 단일화 — 리스트 탭 = 위쪽 카드(2026-08-19, 오너 승인 ② — 조사→
  설계 5종 제안→"ㅇㅋ 가자 권장한 대로")** — 문장 리스트의 단어를 탭하면 화면 중앙
  오버레이 팝업 대신 **본문 클릭과 같은 단어 카드**가 리스트 위에 붙는다(X로 닫기,
  문장 컨텍스트·집중 어둡기 유지). 팝업은 기능 축소판(예문·복습·편집 없음)이 두 벌로
  갈라지는 원인이라 뷰어에서 제거(PDF 뷰어는 자기 팝업 유지). 리스트·카드를 독립
  조각으로 분리해 합성(신규 상태 0 — 상호배타 상태를 그대로 활용), 편집(✏️)은 자료
  토큰(id 보유)에만, 카드 열림 시 패널·시트 스크롤 복귀. 팝업 참조 계약 4파일 갱신
  (부활 금지 단언으로 교체) + 신규 계약 6. Pleco 마스터-디테일 선례로 검증, 10ten식
  인접 팝업은 배제(3열 레이아웃 충돌). 전체 vitest 1,883 green. 후속: ①폭맞춤 확대
  → ④글자 탐색 → ⑤유의·반의어 → ③원문 수정+증분 재분석(전부 오너 승인, 순차 PR).
- **⏫⏬ 문장 이동 버튼(2026-08-19, 오너 승인 — 설계→ㄱㄱ)** — 문장 지정 중에만
  나타나는 우하단 플로팅 필(▲ 위 / ▼ 아래, 44px 터치 타깃·하단 내비 선례 오프셋).
  이동 = 그 문장의 막대(¦) 클릭과 동일 효과(지정+분석+집중 모드 추종)로 새 개념
  없이 배선 — 대상 문장을 화면 중앙으로 부드럽게 스크롤(모션 축소 존중), 경계에선
  비활성(순환 없음). 문장 단위는 막대와 동조(`sentenceNav.js` 순수 함수 — 임계 2자·
  헤딩 마커 정리 동일, 지정 줄 소실 시 방향 기준 회복). 유닛 6 + 배선 계약 1.
  분석은 문장 캐시(viewer_an·viewer_tx)로 재방문 무료. 전체 vitest 1,877 green.
- **🔦 집중 모드(2026-08-19, 오너 승인 — 조사→목업→ㄱㄱ)** — 지정 문장만 원래
  밝기, 나머지 토큰 18% 어둡게. 조사: 기존 문장 지정 인프라(문장 막대·드래그 픽의
  --picked 클래스)가 이미 있어 역상만 추가하면 됨을 확인, 외부 선례(MS Immersive
  Reader Line Focus 교육 연구·Emacs Focus·Obsidian Focus&Highlight)로 기법 검증 +
  오버레이 계열(driver.js류) 배제 근거 확보(줄바꿈 걸친 문장 = 비직사각형, opacity가
  엔진 중립 — WebKit rt 선례). 구현: focusMode 설정(옵트인 기본 꺼짐)·언어 공통
  토글·reader-area--focus는 지정 존재 시에만(빈 화면 전체 어두워짐 방지)·transition
  0.25s + prefers-reduced-motion. 실렌더 e2e(투명도 1 vs 0.18 + 좌표 불변) + 배선
  계약 5. 전체 vitest 1,870 green.
- **📱 iOS 병음 어긋남 수리 — WebKit의 rt 절대배치 거부(2026-08-19, 오너 실기+진단기)** —
  아이폰(전 브라우저 WebKit)에서 병음이 한자 중심에서 10px 밀리고 세로 -37px로
  내려앉으며 긴 병음 뒤 한자가 벌어져 보이는 실기 결함. 진단기 아티팩트(앱 CSS·토큰
  구조 재현 + 좌표 실측 + 크로미엄 기준 대조)를 오너 아이폰으로 돌려 **결정적 지문
  확보: rt position=static** — WebKit은 `<rt>` 요소에 한해 position:absolute를
  무시한다(크로미엄엔 없는 특례). 수리: 절대배치 경로(본문 병음·요미, 레퍼런스
  JaText)의 `<rt>`를 `<span class="rt-an">`으로 교체 — span에는 엔진 특례가 없다.
  시트·팝업의 네이티브 ruby(비절대배치)는 rt 유지. CSS는 :is(rt, .rt-an) 겸용으로
  전환, rt 표적 부활 금지 계약 추가. 조판 e2e 7/7·전체 vitest 1,865 green(크로미엄
  기하 불변). 진단기 v3(신구 마크업 병렬 비교)로 오너 재검증 예정.
- **🧯 뷰어 드래그 e2e 플레이크 경화(2026-08-19)** — main 런 6회 중 2회(33%)가
  e2e:learning 뷰어 드래그 30s 타임아웃으로 red(2785afc·cd1a690), 같은 코드 로컬
  재현 9/9 green — 코드가 아니라 느린 러너에서 폰트 스왑 리플로우가 좌표 측정과
  드래그 사이에 끼는 경합으로 판정. 측정 전 fonts.ready 안정화 + 실패 시 좌표 재측정
  1회 재시도, 부분 선택이 분석 요청을 미리 쐈을 경우 기록 리셋으로 "요청 정확히
  1회" 계약 보존. 앞서 #1065로 workflow_dispatch 재실행 수단도 확보.
- **🀄 한 글자 병음 오분류 수리(2026-08-19, 오너 발견)** — 한 글자 중국어 단어(我·去)의
  병음이 크게(0.5em) 렌더 — splitRuby의 중국어 판별에 "독음에 공백 존재" 조건이 있어
  음절 1개짜리(공백 없음)가 일본어 요미 경로로 흘렀다(격자·0.26em·Noto Sans·성조색
  전부 미적용). 공백 조건을 제거하고 라틴 스크립트 존재(`\p{Script=Latin}` — ǹ 같은
  성조 부호 단독 음절 포함)로 대체: 음절 수 == 글자 수 비교가 공백 유무를 포괄한다.
  **구조 수리 동반**: splitRuby가 컴포넌트 내부 함수라 단위 테스트 불가였던 것을
  lib로 추출(뷰어 import 전환) — 오분류가 그 사각지대에서 나왔다. 유닛 7 신설
  (한 글자·다글자·ǹg·수 불일치 폴백·일본어 무영향), 공백 조건 부활 금지 계약.
- **🎨 성조 색상 본문 미표시 수리(2026-08-19, 오너 발견)** — #1064의 성조색이 시트·
  팝업에만 나오고 **본문은 무색**이었다. 원인은 특이도 동률 + 순서: 기본 병음색
  규칙(`.word-token rt`, 0,1,1)이 성조 규칙(`rt.pinyin-tone--N`, 0,1,1)보다 파일
  뒤에 있어 이겼고, 시트·팝업 rt는 `.word-token` 밖이라 충돌이 없어 색이 나왔다.
  `.word-token rt.pinyin-tone--N`(0,2,1) 병기로 순서 무관하게 승리. **소스 검사로는
  못 잡는 종류**(규칙은 존재했음)라 실렌더 계산색 단언을 조판 e2e에 추가(7번째) —
  본문 성조 rt 색 ≠ 기본 병음색.
- **🎨 성조 색상 옵션(2026-08-19, 오너 확정 ③ — "병음만")** — 중국어 뷰어에
  성조별 병음 색(Pleco 표준: 1빨강·2초록·3파랑·4보라·경성회색). 목업 승인 절차 준수,
  한자 무착색(오너 결정). 성조는 보유한 병음의 발음 부호에서 파생(`pinyinTone.js` —
  ü·대문자 포함, 비병음 null) — DB·파이프라인 무변경 순수 표시 계층. 옵트인 기본
  꺼짐(showHanjaKo 선례), 본문·시트·팝업 3표면, 채도 낮춘 테마별 토큰(다크 기본·
  라이트 재정의). 유닛 4 + 배선 계약 1. 0.26em 소형 병음의 성조 정보를 색으로 보강.
- **🧪 조판 기하 e2e + 레퍼런스 요미 일관화(2026-08-19, 오너 승인 ①②)** —
  ① `e2e/typography.e2e.mjs` 신설: 병음·요미가나의 **실렌더 좌표**를 계약화(토글
  시프트 0·그리드 폭/top 단일값·최장 인접쌍 겹침 0·간격 대역 [-6,+6]px). 소스 계약만으론
  못 잡는 상호작용 회귀가 하루 5PR 왕복(#1055~#1059)의 원인이었다. CJK 폰트 없는
  러너에서도 성립하도록 절대 px가 아닌 등식·단일값만 단언, 빌드 불요라 CI e2e job
  최선두 배치. **음성 검증 3종 통과**: 절대배치 제거·bottom:100% 회귀(성김)·단일 축소
  제거(겹침)를 각각 잡는 것 확인 — 특히 visibility:hidden이 자리를 유지해 ON=OFF
  등식만으론 못 잡는 구멍을 간격 대역 단언으로 막았다. ② 레퍼런스(.ja-ruby)도 뷰어와
  같은 절대배치로 통일 — 긴 요미가 문장 폭을 벌리던 것 제거, lh 2.05/1.9 두 컨텍스트의
  bottom 상수를 유도식((lh-1)/2+0.05)/lh로 각각 산출(간격 -2.5/-2px, 뷰어와 정합).
- **🎌 요미가나도 한자 폭 불변(2026-08-19, 오너 요청)** — "일본어 후리가나도 한자 하나
  너비 초과하지 않도록". 병음과 조건이 달라 실측 선행: 요미:한자 비율 p50 2.0·p99 3.0·
  **최대 5**(志=こころざし·承=うけたまわ, 코퍼스 6,468 세그먼트) — 병음식 '최장 기준
  단일 축소'는 0.2em(판독 불가)이 되므로 기각. 대신 **절대배치만 이식**(크기 0.5em
  유지): base 폭이 요미와 무관해져 한자 간격·토글 시프트 0이 구조적으로 보장되고,
  넘치는 요미(14.4%)는 이웃 가나 위 빈 공간으로 흘러넘친다 — 일본 조판 표준(ruby
  overhang)이며 한자 사이에 가나가 끼는 언어 구조 덕에 실예문 231문장·rt 인접쌍 228
  전수 시뮬레이션 충돌 0. 상자 모델 함정 수리: 네이티브 display:ruby는 상자 높이가
  흔들려 bottom% 기준이 갈림 → inline-flex 통일(병음과 동일, 폭 강제만 제외).
  실측(index.css 실물 주입): ON/OFF 시프트 0·글자 top 단일값·rt 간격 -2px 단일
  (병음·기존 네이티브와 동일)·최악 인위문장(志を承る)에서만 rt 겹침 1. 계약 갱신.
- **🈁 일본어 자료도 JP 자형 우선(2026-08-19, 오너 지적)** — 중국어 폰트 검증 중
  같은 결함이 일본어에 실재함을 확인: 뷰어 본문이 사용자 설정 글꼴(KR)만 써서 한자가
  한국식 자형(直·骨·海·社)으로, 가나는 KR에 글리프가 없어 시스템 폰트로 렌더됐다.
  zh와 대칭 배선: `:lang(ja)` 규칙(JP→KR 폴백) + 뷰어 본문 3분기(zh=SC·ja=JP·기타=설정)
  + 시트·팝업·원문 인용의 lang 표식을 `contentLangTag`(zh-Hans/ja)로 공통화.
  레퍼런스는 JaText가 이미 `lang="ja"`라 규칙만으로 자동 적용. JP에 본문 굵기 400
  추가(가변 폰트라 파일 수 불변 — 그동안 500으로 반올림돼 본문이 미세하게 굵었다).
  계약 12(+1). 전체 vitest 1,853 green.
- **🈶 중국어 자형·병음 폰트 확정(2026-08-19, 오너 선택)** — 오너 요청("중국어 폰트
  단정한 걸로, 병음 폰트도 성조 표기 잘 되는 단정한 걸로 — 대표 폰트 비교 띄워줘,
  내가 직접 선택")에 폰트 시연장 아티팩트 제작(중국어 5종·병음 5종, 실제 앱 조판
  재현 미리보기 + 크기 슬라이더 + 병음 토글 + 자형 판별 글자 + 실제 크기 줄, 카드
  선택 → 적용 지시문 복사). 오너 선택: **중국어 Noto Sans SC · 병음 Noto Sans**.
  배선 — 그동안 중국어 전용 폰트가 없어 한자가 KR/JP 자형(間·直·骨 비대륙형)으로
  렌더되던 것을 수리: layout에 SC(400/500/700)·Noto Sans(400/500/700) 로드 +
  `:lang(zh)` 규칙(SC→KR 폴백, 한글 혼용 안전) + 병음 라틴 공용 규칙(`.pinyin-text`·
  `.pdf-detail-pinyin`·병음 rt·zh 인접 `.fr-example__ipa` — fr IPA는 형제 선택자로
  격리). 뷰어 본문은 zh 자료에서 SC를 사용자 글꼴 설정 앞에 인라인 배치, 시트·팝업
  단어에 zh 표식·병음 클래스 부여. 레퍼런스 zh(`lang="zh"`)·예문 3줄(`zh-Hans`)은
  기존 표식으로 자동 적용. 폰트 계약 5 추가. **주의**: 배포 빌드 폰트 요청 수
  383→약 514(+SC 124·+Noto Sans 7) — e2e는 대역이라 무영향, #150 결정과 연동.
- **🀄 병음 일자 조판 확정 — 전 음절 단일 크기(2026-08-19, 오너 확정)** — 오너 지적
  "아직도 일자가 아니라 글자마다 병음 위치가 다른데"의 원인은 길이별 font-size 축소
  (#1056·#1058): 크기가 다르면 윗변·베이스라인·글자 키가 달라져(지터 ±2px·키 28%
  편차) 한 줄로 안 읽힌다. 코퍼스 전수(426문장·인접쌍 3,191)로 대안 비교 — 등배
  0.5em 복귀는 겹침 문장 35.7%·최대 12px로 불가, 단어(어절) 단위 rt는 43%로 더
  나쁨, 중간안(단일 크기 + 넘치는 음절만 scaleX 가로 압축, 겹침 0쌍)도 구현했으나
  **오너가 더 단순한 안을 확정**: "글자 하나 폭에 가장 긴 병음이 들어가는 크기로
  전부 통일 — 작아지는 건 글자 크기 조절 기능으로 보완". 최장 음절(chuāng 계열,
  자기 글자 폭의 3.55배 실측)이 1em 셀의 0.94에 들어가는 **0.26em 단일 크기**로
  고정 — 최장이 들어가므로 어떤 인접쌍도 구조적으로 겹칠 수 없다(실측 겹침 0·병음
  윗변/아랫변 단일값·그리드 20px 단일값·ON=OFF 동일). scaleX 기제·추정 폭 테이블은
  전부 철거(rubyLayout.js 삭제), 계약은 pinyinRuby.test.js 6건으로 단순화(글자별
  차등 기제 재등장 금지 포함). 요미가나(0.5em)는 병음 선택자 밖이라 무영향.
- **🀄 병음-본문 간격 원복(2026-08-19, 오너 요청)** — "오늘 후리가나 건들이기 전 형태처럼
  후리가나와 본문 간격 유지하면서 일자로 배치". 원인은 절대배치의 기준점이었다:
  `bottom: 100%`가 잡는 상자는 ruby인데 그 높이가 `.surface`의 line-height 2.2em이라,
  병음이 글리프가 아니라 **행상자 꼭대기**에 붙어 네이티브 ruby보다 13px(0.65em) 더
  떠 있었다 — 오너가 말한 "성겨 보인다"의 실체. line-height를 줄이는 방법은 gap은
  맞지만 `.word-token`이 `vertical-align: bottom`이라 상자 높이가 바뀌며 한자만 12px
  내려앉아(비루비 토큰과 tops가 [46,34]로 갈림) 정렬이 깨졌다 — 기각. 대신 기준점을
  비율로 내렸다: `bottom: calc(100% - (0.65 / 2.2) * 100%)`. 분자는 네이티브 간격,
  분모는 `.surface` line-height라 폰트 크기에 따라 자동으로 비례한다(16·20·26px에서
  gap −0.15em 일정 실측).
  **실측(index.css 실물 주입, Playwright)** — 오늘 이전 ON: 글자 폭 20/31/26.31/20.5로
  들쭉날쭉·gap −2 / 수정 후 ON·OFF: 폭·피치 **20 단일값**, tops 41 단일값, **gap −2**로
  오늘 이전과 동일, 행 높이 104 동일, 병음 겹침 0. 즉 **간격은 예전 그대로, 배열만
  일자로**. 일본어 요미가나는 `data-pinyin` 선택자 밖이라 무영향. 계약 1 추가
  (분모와 `.surface` line-height 일치까지 고정 — 한쪽만 바뀌면 간격이 틀어진다).
- **🔤 CI fonts.gstatic 플레이크 근절 — 발주 회수 후 직접 수행(2026-08-19)** —
  Codex-2에 예고시킨 안정화 RFC가 38시간 무응답이라 30분 회수 규약대로 직접 계측했다.
  **원인 확정**: `next/font/google`은 CSS에 실린 woff2를 **전부** 내려받고 `subsets`는
  preload 여부만 정한다(next 15.5.21 `google/loader.js` 실측). 이 리포 4패밀리 =
  고유 폰트 **379개 + CSS 4개 = 빌드 1회당 383 요청·약 15.4MB**, 파일당 내부 재시도는
  3회(100·200·400ms)뿐 — 383개 중 하나만 그 안에 못 살아나면 빌드가 통째로 죽는다.
  기각한 대안도 실측으로: **weight 축소는 요청을 안 줄인다**(Google이 가변 폰트
  1파일로 서빙 — 패밀리당 124개 고정), **CI 빌드 캐시 재사용도 불가**
  (`.next/cache/webpack` 4.7G). e2e 빌드는 글꼴 렌더링을 검증하지 않으므로(선택자·
  텍스트 기반) Next가 자체 테스트용으로 열어둔 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`로
  **e2e 빌드에서만** 네트워크를 걷어냈다 — **배포 빌드 무변경, 제품 글꼴 그대로**.
  대역은 고정 URL 표가 아니라 오는 URL을 해석하는 Proxy라 layout의 weight 한 줄이
  바뀌어도 "Missing mocked response"로 깨지지 않고, 리포에 있는 진짜 woff2를 물려
  크롬 디코드 실패(console.error → e2e 실패 집계)를 예방한다. 계약 9.
  **부수 수리**: `vitest.config.js`의 `poolOptions.{threads,forks}.max*`는 vitest 4에서
  제거된 키라 **조용히 무시되고 있었다**(동시성 상한이 걸린 적 없음) — 현행 top-level
  `maxWorkers`로 교정. **제품 측 축소는 오너 대기**(#150 RFC) — Noto Serif KR 124개·
  5.4MB / Noto Sans JP 124개·6.4MB 제거는 타이포 변경이라 목업 우선 규약 대상.
- **🀄 병음 토글 시 한자 간격 불변(2026-08-19, #1055 `4a9d055` → #1056 `3543310`)** —
  오너 요청("가장 긴 병음 표기를 기준으로 충돌 없도록"). 1차는 rt를 절대배치로 띄우고
  병음 길이별로 base 폭을 예약(1/1.12/1.22/1.62em)해 시프트 0을 얻었지만, 오너 실사에서
  **"성겨 보이네, 일자로 정렬된 게 아니네"** — 폭 예약이 중국어의 정사각 그리드를
  깨뜨렸다. 시프트 0에만 집중하다 더 중요한 정렬을 희생한 판단 착오였다. 2차에서
  폭을 `1em` 균일로 되돌리고 **긴 병음만 rt를 축소**(4자 .46em·5자 .42em·6자 .36em,
  `rubyWidthStep`의 대문자 가중 포함)해 정렬과 시프트를 동시에 만족 — 실측 글자 폭
  20px 단일값·시프트 0px·줄 높이 변화 0px·겹침 0.5%(코퍼스 2,059개, 최대 2px).
  일본어 요미가나는 `data-pinyin` 표식으로 격리해 무영향.
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
- **도시 NPC 대화 진입 이원화 검토**(2026-08-22 실측): 도시 안 chapter+npc 노드는
  전부 문화 도어로 라우팅되고 NpcDialog는 chapter 없는 노드(현재 fr 채움 NPC·전국맵
  라멘/신사)만 연다. 도쿄·오사카 채움 NPC 4종은 npc==id(직접 대화 후보 계약)인데
  chapter가 있어 대화 진입이 없고, npc-met 앨범 분모에는 후보로 잡힘 — 도어
  프롬프트에 '대화' 2택 병기 또는 chapter 제거 중 픽 필요.
- **몽생미셸 조수 RFC A~C 승인**: A) 745분 주기·epoch 420·8단계 결정 시계 B) 안전 회랑
  mask 방식(소스 재생성 vs 301칸 spine 고정) C) visual-only→collision 2단계 롤아웃
  (D 성벽 카피 4상태는 Claude 승낙 완료 — RFC: #150 코멘트 4999436456)
- 런던 위성 마이크로 2~3곳 픽(윈저·옥스퍼드·케임브리지·스트랫퍼드·캔터베리·브라이튼)
- 채널터널(유로스타 파리~런던) 연출 여부
- #152 AI Relay DB 마이그레이션 승인
- 브뤼셀 아토미움 IP 수위 재확인(유럽 2차 착수 시)
- EMEA 오버월드 일반 공개 시점(releaseEligible)
