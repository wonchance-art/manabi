# AI 태스크 보드 (todo → doing → done)

3세션(Claude·Codex-1·Codex-2)이 매 사이클 이 파일 하나로 상태를 동기화한다.
규칙: **자기 열만 옮긴다**(todo→doing은 착수 선언, doing→done은 CODEX_DONE/CLAUDE 검수와 함께).
보드 갱신 커밋은 다른 변경과 섞지 않는다. 상세 스펙·핑퐁은 기존대로 #150(이 보드는 인덱스).
오너 결정 대기 항목은 owner-gate 섹션에 — 어떤 세션도 임의 착수 금지.

## Codex-1 (codex/*)
### doing
- (없음)
### todo
- 코트다쥐르 오버월드 게이트: EMEA 니스 노드(≈7.27/43.70) city gate + 왕복 테스트 (파리·몽생미셸 문법) — cote-dazur 도시 등록과 같은 라운드
### done (최근)
- 몽생미셸 노르망디 게이트+수도원 씬+라 카제른 (#155 merge)
- 부산·서울 교량 3분류·수계 (#151·#153 merge)

## Codex-2 (codex2/*)
### doing
### todo
- 베이징 geo — 최종 SPEC #150 댓글 5003321961 수신(bbox [116.35,39.88,116.43,39.95],
  20m/zh, POI 12·역 4·병기 16/16·민감지역 하드 규칙); 선제 감사 grid 342×390,
  예상 6,268,860 bytes <24MiB PASS. 타이베이·홍콩·상하이 선례 비교로 전용 generator·geo·test
  3파일, 4방 BFS·BRIDGE 0·결정성/PNG 검증 체크리스트 확정. Codex-1 snapshot exact handoff 전
  POI·역·본생성 금지.
### done (최근)
- 런던권 geo (#160 main merge e69a98bb0c78fea277425259de01db0e17282c50,
  main fa40fae official verifier 전 gate·타워브리지 260m/260m·targeted 18/18 PASS,
  #150 CODEX_DONE 5003344796; EMEA runtime node는 후속 별도 범위)
- 상하이 geo (#185·replacement #191 main merge 8db980456ea8f87f9335bcc478e889873a80e2b3,
  merged main official verifier·targeted 11/11·139 files/1,680 tests·BFS·결정성·PNG PASS,
  #150 CODEX_DONE 5002925294; ancestry가 끊긴 stacked #188은 superseded close)
- 홍콩 geo (#182·#183 main merge e52130f3, 구현 exact 1e53bcabae6b381bf763ecb54ac4a79c87ef5dee,
  merged main official verifier·137 files/1,661 tests·Star Ferry 포함 BFS·결정성 PASS,
  #150 CODEX_DONE 5001551674; runtime·desc 배선만 후속 의존)
- 타이베이 geo (#173·#179 main merge 67216edf, 구현 exact d5c8650c2be9ed922b4b9c5d4c31ea09ec43ea0d,
  main verifier 54a9927d 전 gate·130 files/1,619 tests·결정성 PASS, #150 CODEX_DONE 5000243893;
  Claude desc 13종 콘텐츠 배선만 후속 의존)
- 브뤼셀 geo (#169 main merge 55d3aa0, main verifier ebf658f 전 gate green·CODEX_DONE)
- 코트다쥐르 geo (#158 merge, CODEX_DONE·공식 gate 완료)
- 템스 타워브리지 수면 폭 원인 확인(원본 240~300m 정상, verifier 교량 회피창 부족 — #150 근거 보고)
- 그랑파리 geo+교량 3분류 (#157 merge), frenchCityRuntimeAdapter(#159 merge)

## Claude (claude/*)
### doing
- 사이클 운영(웹훅+cron+Routine), 코트다쥐르 CODEX_DONE 시 desc 18종 주입(검증 완료 대기 중)
### todo
- 런던 desc 24종 주입(검증 완료 — geo merge 대기)
- 코트다쥐르 도시 콘텐츠 파일(cote-dazur.js — 파리 패턴) / 영어 도어 en-01~06 저작(track 필드 라우터 일반화 포함)
- 몽생미셸 도어 msm-01~06 tile 배선(geo 좌표 확정) / 렌더크래프트: 파리·MSM 프롭
### done (최근)
- 유럽 1차 콘텐츠 전량(파리 desc·도어·씬 텍스트), 한국 2도시 desc, 검증기 정본(#161)

## owner-gate (오너 결정 대기 — 착수 금지)
- 런던 위성 마이크로 2~3곳 픽(윈저·옥스퍼드·케임브리지·스트랫퍼드·캔터베리·브라이튼)
- 채널터널(유로스타 파리~런던) 연출 여부
- #152 AI Relay DB 마이그레이션 승인
- 브뤼셀 아토미움 IP 수위 재확인(유럽 2차 착수 시)
- EMEA 오버월드 일반 공개 시점(releaseEligible)
