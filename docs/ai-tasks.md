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
- 제네바 geo 준비(#150 Codex-1 snapshot SPEC 5011426511):
  corrected bbox `[6.105,46.175,6.185,46.240]`, 20m/fr,
  exact Web Mercator correction `0.6920486897479066`, grid `309×362`,
  `111,858` cells, 예상 `5,257,326 bytes`(5.014MiB),
  24MiB headroom `19,908,498 bytes` PASS.
  현재 `codex/geneva-prefetch` remote branch·open PR과 Codex-2 상세 좌표 SPEC은
  없다. snapshot handoff가 나타나면 ODbL 1.0·16 partitions·48/48·7개 RLE
  각각 decode `111,858`·manifest/raw/snapshot SHA·결정성·전체 PNG와
  레만호/론강·road/rail mask를 감사한다. snapshot main merge와 상세
  Codex-2 SPEC, recipient/kind/scope/exact 40자 head, active
  PLAN/WORKING/FREEZE 부재가 모두 확인되기 전에는 POI·역·본생성·재수집을
  시작하지 않는다.
### todo
- (없음)
### done (최근)
- 가와구치코/후지 geo (#269 snapshot head
  `0cbb1c68d07606351c11cc6c5ac647ea967c18bd` → main merge
  `98ec05ad03619a37b89c49bff69c4690da029439`, #276 implementation head
  `3495b60b4e883240ffee63d24fa83bc8c888f301` → main merge
  `10b39b317c155aac093844c0a5460dfa0aa0910e`, 전용 3파일 byte-identical):
  official verifier 반입 merge
  `eb74ba0ed16ff2838d5e23759f820d392afc398b`·latest validated main
  `bc603c9a9d76385b42edf021a2708494bb78da3f`·blob
  `40b82e9f913e99a6f7e9c8369eff6f94104f0bea`, 20m/ja·POI worst
  subaru-5th 1.23타일·가와구치호 2,560m/2,480m·BRIDGE 0·snapshot
  v2+·roadStyle 전 gate PASS. targeted 18/18·전체 172 files/1,890 tests,
  메인 보행 성분 98,201·5합목 별도 산지 성분 33·22,998,087 bytes
  <24MiB·결정성 PASS. terrain SHA `f39c90be`·railway SHA `f49fcf26`·
  final PNG SHA `91b526d4`, #150 CODEX_DONE 5011389141.
- 도시 geo 프로필 hard gate (#150 승인 5010610812, PR #266 head
  `e3aa018bdbbb844fc5d379b3d57b177157618bae`, verifier blob
  `144f64e1c87bb864b63056eeb2c3b50f85077cb1` → main merge
  `ddbb7239c474764d81df03973ea43c1bf0c3e178` byte-identical):
  latest main `73e4a145663ded1a850055f291523d3d5332f5c4` 결합에서
  16 official profiles 전 gate, 19도시 결정성 165/165,
  전체 single-worker 168 files/1,863 tests, node/ESLint/diff-check PASS.
  Marseille band는 제외/report-only 유지. #150 CODEX_DONE 5010880738.
- 마르세유 geo (#251 snapshot main merge
  `c55ab6d0e79ba46acd2d425fdc907363aa16efc9`, #260 head
  `71e309e880b6579fd5547451b1636eb3685569d6` → main merge
  `c7a3c7dcf09693d78e1e50d34e868f42f32cd994` byte-identical 3파일):
  official verifier first merge
  `d27115dd7a67b9a86ba04065caf1e32f7b9cd1b7`·blob `4be26181`,
  20m/fr·구항 320m/320m·이프성 해협 2,220m/2,220m·BRIDGE 0,
  targeted 16/16·latest-main 전체 168 files/1,863 tests,
  ferry-aware BFS 85,437/85,437·8,510,572 bytes <24MiB·결정성·정책 PASS.
  terrain SHA `282b339f`·railway SHA `d706d373`·final PNG SHA `d1871893`,
  #150 CODEX_DONE 5010811856.
- 멜버른 geo (#224 snapshot merge, ancestry 재작성으로 stacked #225 superseded close,
  exact-main replacement #227 head 8ec951b54be8993a964992eaa4301f1fcdaea196,
  official verifier #229 main 94fce93d3dc149ed1000ce8765fbc2db257e4ec5·
  blob 44eee21f 전 gate, Yarra River 120m/120m·BRIDGE 0·Princes Bridge 회랑,
  targeted 14/14·latest-main 전체 155 files/1,775 tests·
  BFS 226,175/226,175·12,670,636 bytes <24MiB·결정성·정책 PASS,
  geo SHA a78e598a·final PNG SHA fdaaf77b,
  #150 CODEX_DONE 5009517615; #227 main merge
  2187d1dba3d224680089825c64ecf778759d11b3 byte-identical 3파일,
  #230 content/registry main merge
  7decee7c261345623496789114370665a7db69f6,
  Codex-1 overworld node #231 head
  84bd0e44c65a4e936470e898f378aeaa7baea4b5 → main merge
  8efc7e8cb2b6d4b3f11b67e63a695cc398490657)
- 캔버라 geo (#215 snapshot merge, #219 head
  596c7f77d1b78381f4ca52623ae327627010f079 → main merge
  207e7f6d2c08401faa147ff0d049ac007e7c86b8,
  Dickson 좌표를 OSM snapshot 철도축 `149.13374,-35.25056`,
  tile `[335,58]`로 보정하고 Alinga/Dickson rail-mask 7/0타일을 회귀 고정.
  official verifier #221 main e3a5a3f·blob 8e7c388 전 gate,
  벌리그리핀호 1,040m/900m·BRIDGE 0·두 교량 차도 회랑,
  targeted 14/14·latest-main 전체 151 files/1,751 tests·
  BFS 234,974/234,974·12,856,662 bytes <24MiB PASS.
  geo module SHA 069457d5·final PNG SHA 2275cfeb,
  #150 CODEX_DONE 5008884966; merge·runtime·desc는 후속)
- 시드니 geo (#212 snapshot merge, #216 head
  3fb2dd1b9db86a139e86463add1baaad7fbbbb03 → main merge
  030f47e44f5c2905c7bb7cab53ef456b9e9230c1,
  official verifier #217 main merge 46e8b129a9619d116acd25dcd879e2bb223a6f0e
  전 gate·latest-main 149 files/1,742 tests·BFS·결정성·PNG PASS,
  #150 CODEX_DONE 5008556556; runtime·desc는 후속)
- 브리즈번 geo (#208 snapshot merge, #211 head
  b8ef57cd9b32d87f16843126e6b80715a4174783 → main merge
  19dd18bda66b5b8e27c39444897e8d0f97984dbb, official verifier
  main 1cb9166 전 gate·latest-main 147 files/1,728 tests·BFS·결정성·PNG PASS,
  #150 CODEX_DONE 5008140889; runtime·desc·overworld node와 merge는 후속)
- 베이징 geo (#194 snapshot merge, ancestry 재작성으로 stacked #197 superseded close,
  exact-main replacement #199 head 439e60f1a72f0974aaa37cdeffe1243a7d602e13 →
  main merge aeddc1f6684fd759ab7270a4a45bf3306ee95340 byte-identical 3파일,
  official verifier main d0d0b27 전 gate·141 files/1,694 tests·BFS·결정성·PNG PASS,
  #150 CODEX_DONE 5003858711; runtime·desc·overworld node는 후속)
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
