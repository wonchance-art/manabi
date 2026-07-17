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
- 런던권 geo (codex2/london-geo — Claude 선제 실측: **타워브리지 단면 160m 1건만 FAIL**,
  실폭 ~250m 대비 얇음 → 소스 마스크 대조 요청. verify 게이트는 main에 배치 완료)
- 브뤼셀 geo (bbox [4.32,50.79,4.42,50.90], 20m, fr canonical+nameNl 100%, POI 12·역 4; 아토미움은 마커+명칭만)
### todo
- (없음)
### done (최근)
- 코트다쥐르 geo (#158 merge, CODEX_DONE·공식 gate 완료)
- 템스 타워브리지 수면 폭 원인 확인(원본 240~300m 정상, verifier 교량 회피창 부족 — #150 근거 보고)
- 그랑파리 geo+교량 3분류 (#157 merge), frenchCityRuntimeAdapter(스코프 클린 확인)

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
