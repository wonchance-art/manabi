# manabi — Claude 세션 운영 규약

한국어 UI 어학연수 게임(Phaser 도시맵 + 오버월드) + 학습 웹(Next.js) + 지역학(/studies).
이 파일은 어느 기기에서 세션을 열어도 같은 규약으로 이어가기 위한 인계 문서다.
현재 작업 상태의 단일 진실원은 **`docs/ai-tasks.md`(보드)** 와 **이슈 #150**(상세 핑퐁)이다.

## 세션 편성과 브랜치 규칙
- **Claude** = 기획·SPEC 발주·검수 게이트·**merge 단일 창구**·콘텐츠(desc·도어·씬 카피·지역학) 전량.
  브랜치: `claude/*`. 다른 세션은 절대 merge하지 않는다.
- **Codex-1** (`codex/*`) = 비콘텐츠 수집(Overpass 스냅샷)·엔진/씬 골격·오버월드 게이트.
- **Codex-2** (`codex2/*`) = 도시 geo 본생성·verifier 하드닝 제안.
- **Codex-3** (`codex3/*`) = 게임 시스템 확장(스탬프·보상 루프·앨범 계약) — 타 기기 세션.
- **Codex-4** (`codex4/*`) = 성능·인프라(메모리·lazy-load·벤치) — 타 기기 세션.
- 새 세션을 추가하면 새 네임스페이스(`codex3/*` 등)와 보드 열을 먼저 배정한다.
- 자기 네임스페이스 밖 파일 수정 금지. force-push 금지(자기 claude/* 브랜치의
  squash-merge 후 `--force-with-lease` 재동기화만 확립 관례).

## 도시 릴레이 파이프라인 (표준 절차)
1. Claude가 수집 SPEC 게시(#150) → Codex-1이 4×4 Overpass 48/48 + 20m 스냅샷(결정성 2회) PR
2. Claude 검수(해시 독립 재현·PNG 시각 감사)·merge → 본생성 SPEC(POI 좌표 표·역·도선) 게시
3. Codex-2 본생성 PR → Claude가 `scripts/verify-city-geo.mjs`에 프로필 저작(단면 실측 pin)
4. 독립 검증(BFS·단면·POI 스냅) green → merge → Claude가 도시 배선(desc·도어·TRANSIT·스킨)
5. Codex-1 오버월드 게이트 → Claude 노드 desc → 완성 선언
- `scripts/verify-city-geo.mjs`는 **Claude 소유** — 다른 세션은 제안만, 편집 금지.
- 분리 성분(섬·산정 등)은 억지 연결 금지 — 도선/특수 TRANSIT 또는 report-only(이프성·5합목 선례).

## 게이트 (merge 전 필수)
- **전체 vitest green** (`npm test`) — 병렬 flaky는 단독 재실행 확인 후 명시 timeout 부여 선례.
- PR은 draft → 검수 → ready → **squash merge** → 자기 브랜치를 `origin/main`으로 재동기화.
- 보드 갱신 커밋은 다른 변경과 섞지 않는다(자기 열만 수정).

## 하드리밋 (위반 금지)
- DB 스키마 변경 금지(마이그레이션 SQL은 코드로만 — **운영 DB 적용·Vercel env는 오너 수동**).
- 시크릿 열람·출력 금지(.env*, service_role 키 등). 실화폐 금지.
- IP: 상호·인물·작품·브랜드·국기·엠블럼 무재현 — 건축 외관·일반 지리 참조만.
  중화권 정치 서술 완전 배제. 민감지역은 지리·외관만(중난하이 무표기 등 선례 유지).
- 오너 결정 대기(owner-gate) 항목 임의 착수 금지.

## 개발 환경
- **Node 22 공식 배포판(nvm) 필수** — brew Node는 공유 zlib 때문에 PNG 해시 게이트가 깨진다.
- 테스트·스크립트는 리포 루트에서 실행. `.env.local` 없이도 `npm test`는 전량 통과하도록
  설계돼 있다(더미 폴백). 실제 DB 기능 로컬 실행 시에만 Vercel/Supabase 대시보드 값으로 생성.
