# 규약 정정과 공개 배포 사전 검사

2026-09-17 KST. 작업 공간 `/private/tmp/manabi-qa-workflow-20260917`, 기존 PR #1322에 동봉한다.

## 승인과 변경

오너의 “승인. 다음 작업 진행”은 직전 별도 승인안에 대한 답변이다. AGENTS·CLAUDE의
웹 Node24/월드 Node22 사실 정정·월드 규칙 적용 범위·직접 요청과 제한적 Cloud 발주의 구분·
force-with-lease 예외 제거만 반영했다. 병합 명시 승인/최신 head/CI·운영 DB/env 별도 승인·
시크릿·데이터·다른 세션 보호를 유지했다. 원본 iCloud 작업 공간은 변경하지 않았다.

`qa:live`는 기존 releaseVerificationErrors를 재사용해 개별 Preview/고정 주소를 비교한다.
GET만 사용하고 인증 헤더·cookie·공급자 로그인을 보내지 않는다. 버전·no-store·판본·
로그인 화면 HTML·코드 없는 callback 내부 복귀/외부 경로 거절을 확인하고 마지막 버전을 다시 읽는다.
같은 커밋을 재빌드한 다른 deploymentId도 같은 배포로 간주하지 않는다.
예외/본문/cookie를 로그에 싣지 않고 공개 식별자를 추려 `.qa/live`에 기록한다.

## 실측

- 신규 계약 14개 PASS: 정상 비교, 오래된 alias, 같은 커밋의 다른 배포, 검사 중 교체,
  배포 보호 redirect, 캐시, 잘못된 JSON/HTML, production, 초과 크기 응답,
  외부 복귀/예상 밖 auth redirect, 로그 민감 값 제외, 별도 alias 미검사, 입력 검증.
- 변경 파일 ESLint·공백 검사 PASS.
- 실제 공개 HTTP: 후보 `1a21318fecd8a3362ceb153a71c3f5b77b14c633` PASS.
  고정 주소는 `2932e88986395aacb0433881bafbcb81999b4c6c`로 불일치하여 도구가 exit1을 반환했다.
  버전/로그인/안전한 callback 자체는 작동하며 실패 항목은 기대 실행 버전 불일치다.
- Vercel 메타데이터에서 위 두 deploymentId·READY와 프로젝트 Node24.x 확인.
- 전체 Vitest: 423파일·4,534통과·기존1skip. 최신 head CI 결과는 #150 CODEX_DONE/PR checks에 기록한다.

실측 보고서는 `.qa/live/2026-09-17T08-46-58.035Z-3845/result.json`에 있다(생성 파일명은 내부 시각).
전체 검수 로그는 `/private/tmp/manabi-qa-live-vitest-20260917.log`다.
이번 변화는 앱 실행 코드/의존성 버전/SQL/env/alias/운영 merge/사용자 계정 변경을 포함하지 않는다.
고정 주소 연결안·실계정 검수 순서는 `docs/qa-live-workflow.md`에 정리했다.

## 후속 승인과 고정 주소 연결 — 2026-09-17 KST

- 사용자 “승인. 할 수 있는 작업 검토”는 직전 고정 주소 연결 승인 질문에 대한 답변이다.
- 변경 직전 기존 alias/후보의 배포ID·READY·실행 SHA, #1321/#1322의 최신 head·CI 성공을 다시 확인했다.
- 고정 주소 `manabi-web-v2-preview.vercel.app`을 후보
  `manabi-2rgzutmdd-wonchance-arts-projects.vercel.app`로 연결했다.
  Vercel CLI 성공 후 메타데이터에서도 `dpl_3AAYnSwhEZ3znijcy9k98yrjVFCV`를 확인했다.
- 같은 `qa:live` 명령을 재실행해 두 주소 모두 PASS·같은 실행 SHA
  `1a21318fecd8a3362ceb153a71c3f5b77b14c633`·같은 deploymentId·판본·no-store·
  코드 없는 callback의 안전한 복귀·검사 중 배포 불변을 확인했다. exit0.
- 생성 보고서: `.qa/live/2026-09-17T11-13-07.377Z-39739/result.json`(내부 실행 식별자).
- 운영 `teset-gilt.vercel.app`은 전후 모두 `dpl_E25TGWBfQKmkragTBh2euPj5hwbM` /
  `efa44c508e862bc118518e9235008201f291341d`다. 앱 재배포·운영 승격·merge·DB/env·계정 변경 없음.
- 이번 추가 변경은 기록 문서와 보드뿐이다. 실행/검사 코드는87368f08 검증본 그대로이며,
  해당 head CI35201878769·world35201878764 성공, 전체4,534통과·기존1skip은 이전 결과로 보존한다.
  현재 후속 문서 head의 CI는 PR checks에서 별도로 확인한다.
- 실제 교사/학생 로그인·OAuth 허용 목록·물리 기기 검수 완료를 의미하지 않는다.
