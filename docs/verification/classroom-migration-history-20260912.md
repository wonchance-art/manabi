# 수업 마이그레이션 이력 정합 (2026-09-12 KST)

수업 통합 #1303은 b5f87bcdbaac25f00e410801a6b30a2642fb315d로 main에 병합됐고 운영 배포 dpl_J3TetFrJMqJbMEhF8WxaUpeKqiSE는 READY다. 병합 전 CI34667146597 전 job SUCCESS. AGENTS.md·CLAUDE.md의 오너 승인 후 ChatGPT/Codex 직접 병합 권한도 함께 반영됐다.

## 원인과 수정

- 병합 후 Supabase Migrations 실행34667436779는 원격 버전20260911072945에 대응하는 로컬 파일이 없어 db push 적용 전에 중단됐다.
- 이미 승인·적용·검수한 classroom_source_anchors의 초기 로컬 파일 번호는20260911051522, 실제 MCP 적용 번호는20260911072945였다. 앞선 검수 문서에 이 차이가 기록돼 있었다.
- 해당 SQL 파일만 실제 원격 번호로 개명하고, 이를 읽는 e2e4파일과 설계 문서의 경로를 갱신했다. 과거 검수 기록의 초기 번호와 적용 경위는 보존했다.
- SQL 내용 변경·새 마이그레이션·원격 이력 repair·운영 DB 쓰기·환경 변수 변경 없음. 앱 실행 코드와 개인 자료·단어·수업 기록에도 변경 없음.

## 검증

- Supabase 읽기 전용 조회: 원격 이력92개. 개명 후 로컬92개와 버전 집합 일치, 로컬 전용0·원격 전용0.
- 원격20260911072945의 단일 SQL 문자열은10664자이며, 마지막10264자가 저장소 SQL과 동일한 MD5를 가진다. 앞400자는 당시 적용 전 중단 조건이다. 쿼리는 일치 여부와 길이만 반환하며 원문 데이터나 시크릿을 조회하지 않았다.
- 개명 전후 SQL byte-identical. SHA-256: d8e7c2cb82c2d7ff5d9fc49024f4e0dc6831a8bb90b83c75c95c526f2c63970b.
- e2e/class-source-sql.mjs: 격리 PGlite33검사 PASS, productionWrites0. e2e 경로4개 문법 검사 및 git diff --check 통과.
- 새 PR의 CI와 후속 main 자동 DB 검사 결과는 PR 및 이슈 #150에 기록한다. 새 필수 CI 통과 후 같은 승인 범위의 배포 마무리 수정으로 병합한다.

운영 학생 팀 암호 입장을 위한 SHARE_LINK_SECRET 등록과 최종판의 실제 계정/물리 iPad 검수는 별도 후속이다.
