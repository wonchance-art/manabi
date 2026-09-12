# 교재 출처 복귀 1차 검수 — 2026-09-11 KST

## 변경과 현재 상태

부모 draft #1301의 `cdf9b76c480b870474c2dacab16341fd6ddfff28`에서 분리한 `codex/classroom-source-return-20260911`이다. 단어·드래그 표현·문장을 수업 기록에 추가할 때 실제 선택 위치와 문맥을 보존하고, 수업 기록에서 현재 교재의 해당 구간을 다시 연다. 검색·교재 밖 표현 필터·날짜·불러온 기록 수·스크롤 복귀도 포함한다.

구현·로컬 빌드·자동 브라우저·격리 PostgreSQL 검수는 완료했다. 이 문서 시점에는 신규 공개 push/PR, 새 DB SQL 적용, Vercel 배포, 실계정 쓰기 검수는 하지 않았다. 기존 운영 및 공유 미리보기 주소에 이번 변경이 반영됐다는 뜻이 아니다. 실제 교재 왕복과 물리 iPad 검수는 아래 후속 단계다.

## 확인 결과

| 검사 | 결과 | 증거 |
|---|---|---|
| 전체 웹 단위 테스트 `npm test` | 381파일 / 4,135개 PASS, 종료0 | `/private/tmp/manabi-source-tests-pointer.log` |
| 저장 RPC·직접 위조 요청·권한·유니코드 | PGlite 33개 PASS, 운영 쓰기0 | `/private/tmp/manabi-source-sql-reviewed.log`, `e2e/class-source-sql.mjs` |
| 교사 Chromium | 22개 PASS, 실행 오류0, 종료0 | `/private/tmp/manabi-source-chromium-pointer/report.json` |
| 교사 WebKit 터치 | 23개 PASS, 실행 오류0, 종료0 | `/private/tmp/manabi-source-webkit-pointer/report.json` |
| 학생 Chromium / WebKit | 각각7개 PASS, 실행 오류0, 종료0 | `/private/tmp/manabi-source-student-final-chromium/report.json`, `/private/tmp/manabi-source-student-final-webkit/report.json` |
| Next.js 운영 형식 빌드 | `npm run e2e:build` PASS, 종료0 | `/private/tmp/manabi-source-pointer-build.log` |
| 정상 prebuild | PASS, 오류0 | `/private/tmp/manabi-source-prebuild.log` |
| 변경 JS/JSX lint, E2E 구문, diff 공백 | 오류0 | scoped ESLint / `node --check` / `git diff --check` |

Node 24.20.0, Next 15.5.21. e2e:build는 공개 테스트 Supabase 주소·키와 고정 서체 응답으로 운영 번들 형태를 빌드한다. 실제 비밀 환경 설정이나 실사용 DB 연결 검증을 대신하지 않는다. 기존 콘텐츠 검사 경고와 `lessonAdapters`/`lessonModel` 기본 내보내기 경고는 변경 범위 밖이며 오류는 없다. prebuild의 `public/sw.js` 변경은 콘텐츠 기반 캐시 버전 한 줄이다.

마지막 포인터 구분 보완까지 포함한 최종 번들에서 교사·학생 Chromium/WebKit 전체 흐름을 통과했다. 각 하니스는 인증 응답/교재를 격리 fixture로 제공하며 저장 RPC와 출처 권한 조회는 PGlite의 실제 SQL 및 애플리케이션 코드로 검증한다. 실계정에서 59개를 실행했다는 의미가 아니다.

## 사용 흐름과 화면

- 단어 하나를 기록한 뒤 노트/항목 ID만 담은 주소로 해당 교재 단어를 연다. 새 주소에 긴 원문·문맥을 넣지 않는다.
- 실제 마우스 드래그와 WebKit 터치 포인터 흐름으로 여러 단어를 선택·기록하고 1440/768/390px에서 범위가 복원되는지 검사했다. 전체 문장 막대는 문장 전체 경계를 저장한다.
- 분석 ID 변경·토큰 병합/분할에도 문맥으로 찾는다. 같은 원문이 여러 번 있거나 교재가 변경돼 확정할 수 없으면 안내하고 다른 구간을 선택하지 않는다. 하위 토큰이 큰 토큰으로 합쳐져도 저장 원문을 더 큰 토큰으로 덮지 않는다.
- 기록 날짜·검색·필터·스크롤 왕복을 확인했다. 새 선택 뒤 이전 복귀 효과가 반복 실행되지 않는다.
- 확대 설명을 3개 화면 크기에서 각10회 열고 닫아 본문 위치를 확인했다. 교재 주의점 저장·누적·재방문·숨김도 기존 흐름을 유지한다.
- 모바일/태블릿/데스크톱 캡처에서 선택 구간, 하단/옆 패널, 상단 불투명 배경, 가로 넘침을 직접 확인했다. 캡처는 위 브라우저 결과 폴더의 `source-range-390.png`, `source-range-768.png`, `source-range-1440.png` 등에 있다.

WebKit 최초 검수는 터치 길게 누르기가 취소되어 실패했다. 이벤트 추적 결과 다른 포인터의 마우스 이동을 터치 제스처로 처리하던 실제 결함이었다. 시작한 pointerId/type만 처리하도록 본문/핸들 모두 보완했고, 터치 중 별도 마우스 이동·놓기를 명시적으로 주입하는 회귀 검사까지 통과했다. 실패 실행을 성공 개수에 포함하지 않는다. 이 터치 검사는 자동화한 포인터 입력이며 물리 iPad 조작이라고 주장하지 않는다.

## 저장·권한 계약

- 같은 요청 재전송, 같은 위치의 실수 중복, 다른 위치의 동일 표현, 명시적 반복, 여러 줄 표현의 중복 방지를 SQL로 확인했다.
- 위치/문맥/토큰/자료 ID 위조, 타 소유자·타 교재, anon 호출, 학생 소유자 RPC 호출을 거부한다. 소유자 원문과 학생 사본을 자동 수정하지 않는다.
- UTF-16 위치를 DB에서 검증한다. 이모지 중간 위치는 거부하고 앞뒤 문맥의 서로게이트를 보존한다. 기존 수업 표현 5,000단위와 주의점 1,000단위 제한은 별개로 유지한다.
- 출처 API는 기존 팀 해제 토큰·현재 공유 노트·현재 공유 교재를 확인해 허용된 출처만 반환한다. 학생 뷰어는 자기 사본의 source_ref를 확인한다. 게스트 local 뷰어는 네트워크 없이 기기 사본과 제한 시간 탐색 힌트만 사용한다.
- 저장된 항목의 원문 줄이 편집돼 달라졌으면 낡은 출처를 연결하지 않는다. 교재 주의점/날짜별 수업 기록/개인 단어/FSRS의 저장 목적과 경로를 유지한다.
- 기존 테스트 `sharedCopy.test.js`의 코드 문자열 계약 한 줄은 복귀 주소 래퍼에 맞췄다. 학생 실제 사본 연결 흐름은 브라우저/SQL로 별도 검사한다.

## DB 적용 전 상태와 이후 순서

신규 SQL은 `supabase/migrations/20260911051522_classroom_source_anchors.sql`이다. 새 테이블·RLS 정책 없이, 기존 `classroom_append_study`를 보완하고 순수 검증 함수2개를 추가한다. 전부 SECURITY INVOKER·고정 search_path이며 authenticated에만 실행권한을 준다.

원격 읽기 전용 확인: 기존 함수 정의 MD5는 `a3f6b06b957a42ffbb6f906e593149f4`, INVOKER, anon 실행불가, authenticated 실행가능이며 신규 검증 함수는 없다. 이 시점 신규 SQL은 미적용이다. DB 적용 전 부모/함수 상태를 다시 확인하고 다른 SQL과 혼합하지 않는다.

1. 최종 커밋을 공개 브랜치와 부모 #1301 위의 draft PR로 준비한다. merge/force-push는 하지 않는다.
2. `CLAUDE.md`의 운영 DB 오너 수동 규칙에 따라 이번 SQL 적용 승인을 확인한다. 승인 후 적용 이력·함수 권한·원문 보존을 검수한다. Vercel 환경 변수 신규 변경은 필요하지 않다.
3. 동일 커밋의 최종 Preview에서 배포 식별값/자동 회귀를 확인한 뒤 그 주소로 실계정 검수를 모은다. 임시 수업 기록만 만들고 정리하며 실제 교재 재분석은 하지 않는다.
4. 물리 iPad의 키보드·회전·앱 전환·입력기와 실교실 네트워크 검수는 별도로 기록한다. 운영 통합은 Claude 창구로 인계한다.

환경 파일·실제 교재·개인 자료·브라우저 인증 정보는 변경/공개 대상이 아니다. PDF·음성·시험·신규 split view·운영 병합은 이번 변경에 포함하지 않는다.

## 승인 후 적용·실계정 검수 완료 — 2026-09-11 KST

출처 SQL은 원격 이력20260911072945로 적용됐고 draft #1302 / Preview10851b15에서 검증했다. 실제 교사 계정의 정식 교재 선택→수업용 뜻 수정→확대→기록→출처 단어 선택 복귀→기록 검색어/스크롤355px 복원이 통과했다. 임시 노트1개/표현2개는 정리했고 기존 교재20과·단어338건·복습 이벤트288건 지문은 동일하다. `오늘 교재` 선택은 원래 상태로 복원하되 정상 수정 시각/revision은 갱신됐다. 이 과정은 이전 수업 노트 자료를 교재로 간주한 검수와 구별한다. 상세와 물리 iPad/별도 실제 학생 계정 미검수 한계는 `docs/verification/classroom-tablet-20260911.md` 마지막 절에 기록했다.
