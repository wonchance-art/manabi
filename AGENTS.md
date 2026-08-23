# manabi — 외부 코딩 에이전트(Codex Cloud) 작업 규약

이 리포는 한국어 UI 어학연수 게임(Phaser) + 학습 웹(Next.js)이다. 오케스트레이션은
Claude 세션이 맡는다: **발주 SPEC 저작 → 너의 PR 검수 → squash merge**가 단일 창구다.
너(외부 에이전트)의 산출물은 언제나 **draft PR 1개**이고, 머지는 하지 않는다.
(2026-08-23 오너 확정: 로컬 상주 Codex-1~4 세션 체제를 Codex Cloud 태스크 체제로 전환 —
구 체제의 월드 geo 규약은 아래 부록에 보존.)

## 태스크 수행 규칙

1. **범위는 태스크 프롬프트(SPEC)가 전부다.** SPEC의 exact allowlist에 없는 파일은
   만들지도 고치지도 않는다. "적절히 개선"은 없다 — 애매하면 PR 본문에 질문을 남기고
   구현은 allowlist 안에서 멈춘다.
2. **브랜치**: `codex/<태스크-슬러그>` 로 만든다. force-push 금지.
3. **게이트**: PR을 열기 전에 리포 루트에서 `npm test`(전체 vitest)를 돌려 green을
   확인하고, PR 본문에 결과 수치(파일/테스트 수)를 적는다. `.env.local` 없이도 전량
   통과하도록 설계돼 있다(더미 폴백) — 시크릿을 요구하는 테스트는 없다.
4. **계약 테스트 동봉**: 새 모듈에는 `src/lib/__tests__/` 계약 테스트를 함께 만든다.
   **기존 테스트는 임의 수정 금지** — 내 변경으로 깨지면 고치지 말고 PR 본문에 보고한다.
5. **draft PR 본문**: 발주 SPEC의 출처(#150 코멘트 id 또는 태스크 프롬프트 요약),
   변경 파일 목록, 게이트 수치, 미해결 질문. 리뷰 코멘트에는 수정 커밋으로 응답한다.
6. **보드**: `docs/ai-tasks.md`는 SPEC이 허용한 자기 항목만 수정한다.

## 하드리밋 (위반 시 PR 반려)

- **DB 스키마 금지**: `supabase/migrations/` 파일 생성·수정 금지. 스키마가 필요하면
  PR 본문에 요청만 남긴다(마이그레이션은 Claude 저작).
- **시크릿 금지**: `.env*` 열람·출력·커밋 금지. 키·토큰을 코드에 넣지 않는다.
- **콘텐츠 카피 금지**: 사용자에게 보이는 한국어 UX 문구·학습 콘텐츠(`src/content/**`)
  신설·수정 금지 — 문구가 필요하면 placeholder 상수로 두고 PR 본문에 요청.
- **Claude 소유 파일 금지**: `scripts/verify-city-geo.mjs`, `docs/rfc-*.md`,
  `docs/evaluation-and-strategy.md` — 제안은 PR 본문으로만.
- **world 자산 재생성 금지**: `scripts/generate-*` 실행·산출물(`public/world/**`,
  `src/lib/data/hanja*.json` 등) 재생성 금지 — PNG/JSON 해시 결정성은 로컬 Node 22
  전제라 클라우드 재생성이 게이트를 깨뜨린다.
- IP 무재현(상호·인물·작품·브랜드), 실화폐 금지.

## 코드 관례

- 기존 파일의 주석 밀도·네이밍·한국어 주석 관례를 따른다.
- 새 로직은 **순수 모듈 우선**(네트워크·supabase import 없는 `src/lib/*.js` + 테스트) —
  UI 배선·카피는 Claude가 별도 라운드로 얹는다.
- 날짜·주간 경계는 `src/lib/growthStats.js`, 채점 이벤트 판정은
  `src/lib/weeklyReport.js`의 `isGradedReviewEvent` — **동일 구현을 새로 만들지 않는다**
  (중복 신설 금지가 이 리포의 제1 관례다).

## 환경 셋업 (Codex Cloud 환경 설정 권장값)

- 셋업 스크립트: `npm ci`
- 확인 명령: `npm test` (world 스위트 제외 전체 vitest — 일상 게이트),
  필요 시 `npm run lint`
- 기준 브랜치: `main`

## 부록 — 월드 geo 태스크 전용 규약 (구 로컬 세션 체제에서 승계, 해당 태스크에만 적용)

- 착수 전 게이트: 유효한 SPEC(#150) + (본생성의 경우) 스냅샷 exact handoff — 없으면
  대기하고 임의로 도시·POI·bbox를 선택하지 않는다.
- 수정 범위: 도시 전용 generator·geo·test 신규 3파일 관례. 공유 파일(CityScene·
  GameCanvas·registry) 수정 금지.
- 품질 계약: 동일 입력 2회 생성 byte-identical(geo·PNG SHA-256), BRIDGE 잔존 0,
  4방 BFS 보행 성분 검증, 마커 이격 ≥3타일, POI 재투영 ≤2.5타일, 미니맵 추정 피크
  <24MiB. 완료 시 PR 본문에 결정성 증거(2회 SHA)·메모리 실측 동봉.
- 환경: world 자산 생성은 **로컬 Node 22 공식 배포판** 전제 — 클라우드에서 재생성하지
  않는다(위 하드리밋과 동일).
