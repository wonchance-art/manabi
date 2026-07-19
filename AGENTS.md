# manabi — Codex 세션 운영 규약

이 저장소는 3세션 오케스트라(Claude·Codex-1·Codex-2)로 운영된다. 전체 규약은
루트 `CLAUDE.md`, 현재 작업 상태는 `docs/ai-tasks.md`(보드)와 이슈 #150을 따른다.

## Codex 세션 핵심 규칙
- 브랜치 네임스페이스: Codex-1 = `codex/*`, Codex-2 = `codex2/*`. 새 세션은 배정받은
  네임스페이스만 사용. **merge·force-push 절대 금지** — merge는 Claude 단일 창구.
- 착수 전 게이트: 유효한 SPEC(#150) + (본생성의 경우) 스냅샷 exact handoff가 모두
  있어야 시작. 없으면 대기하고 임의로 도시·POI·bbox를 선택하지 않는다.
- 자기 허용 범위 파일만 수정(보통 도시 전용 generator·geo·test 신규 3파일).
  공유 파일(CityScene·GameCanvas·registry·`scripts/verify-city-geo.mjs`·DB) 수정 금지.
- 완료 신호: PR(draft) + `[AI-HANDOFF][CODEX_DONE]` 코멘트(#150) — exact 40자 head,
  결정성 증거(2회 byte-identical SHA), targeted+전체 테스트 결과, 메모리 실측 포함.
- 보드는 자기 열만 갱신(todo→doing 착수 선언, doing→done은 CODEX_DONE과 함께).
  보드 커밋은 구현 커밋과 분리.

## 품질 계약 요약
- 결정성: 동일 입력 2회 생성 byte-identical(geo·PNG SHA-256 고정).
- 지형: BRIDGE 잔존 0(교량→차도/수면 흡수), 4방 BFS 보행 성분 검증, 마커 이격 ≥3타일,
  POI 재투영 ≤2.5타일, 미니맵 추정 피크 <24MiB.
- IP·수위: 상호·인물·작품·브랜드 무재현, 건축 외관·지리만. 정치 서술 배제.
- 환경: Node 22 공식 배포판(nvm) — brew Node는 PNG 해시 게이트가 깨진다.
