# 설명판 계정 저장 검수

2026-09-16 KST. 선행 #1316 head240e32d7 기반 독립 작업. PR #1317, `codex/teaching-board-cloud-20260916`. 실행 코드 `5eda8e645771c29885ac4266c46988c33908455f`. 앱/기기 초안·학생 수업 기록·개인 노트 보존. 범위와 운영 경계는 `docs/manabi-teaching-board-cloud.md`.

## 완료한 검사

- 전체 Vitest 408파일/4,333개 PASS. 최종 실행 보완 후 핵심 모델/API 16개 재검사 PASS. 3MiB 초과 페이지·20페이지 roundtrip·해시 위변조·학생/익명/다른 소유자 거절 포함.
- 폐기용 PostgreSQL 실제 SQL 26조건 PASS: RLS·Storage 경로/불변성·직접 쓰기 금지·CAS·중복 요청·권한 회수·기존 수업 자료 불변. 서버 요청과 별개로 DB 권한도 검사한다.
- 최종 프로덕션 빌드 480페이지 PASS. JSX/JS 명시 lint 오류 0. 기존 import/no-anonymous-default-export 경고 2개는 배포 빌드에 남아 있다.
- 최종 Chromium 22흐름, WebKit 터치 22흐름 PASS, 각각 실행 오류 0. 기존 단어/필기/정렬/발표/교재 이동/수업 기록 회귀와 새 계정 저장/기기 초안 없는 복원/지난 날짜/충돌/오프라인 새로고침/응답 유실/390·1024 화면을 포함한다.
- 최신 판을 느리게 내려받는 사이 새 판을 추가하는 경합도 재현했다. 새 필기가 화면과 기기에 남고 이후 계정 저장도 가능함을 확인했다.
- 기존 기기 저장만 있는 수업 판의 자동 이전 및 원래 IndexedDB 행 불변을 확인했다. 기존 복구본을 함께 읽으며 날짜 전환 뒤 늦은 저장 요청이 다른 수업 판을 덮어쓰지 않도록 scope를 검사한다.
- 공유 필기 컴포넌트를 사용하는 개인 노트 Chromium 11흐름 PASS/오류 0. 원본 필기·필기 인식·후보 정리·중복 저장·충돌/오프라인·서재 이어 정리를 포함한다.
- 저장 상태·지난 날짜·충돌 화면의 실제 캡처를 확인했다. 중복 안내 제거, 오류 구름 아이콘, 닫기 초점 복귀, 모바일 넘침/키보드/캔버스 보존을 검사했다.

## 검수 방법과 한계

브라우저 검수는 실제 React 프로덕션 번들 + 합성 계정 + HTTP fixture + 실제 폐기용 PostgreSQL이다. 물리 iPad/Pencil 검수로 세지 않는다. 실제 Supabase 계정 검수는 아래 적용 후 기록으로 구분한다. WebKit의 Playwright 요청 본문이 Blob 파일을 0바이트로 노출하는 제한을 확인했다. 그 엔진만 fetch 직전의 실제 Blob을 관찰해 업로드 fixture에 전달하며 DB 크기/해시/권한 검사는 유지한다. 예상하지 않은 SQL 오류는 실패로 기록한다. Chromium은 요청 multipart를 표준 FormData 파서로 읽는다.

최종 실행 Preview: https://manabi-2x9ongcyd-wonchance-arts-projects.vercel.app . 배포 ID `dpl_BeSWG6tu6FYNojrCzWrSpYkeNjMV`, 실행 SHA5eda8e64. 이후 커밋은 검수 도구·문서·자기 작업 보드만 갱신하며 실행 소스는 동일하다. 최종 READY/API 버전/정확한 PR head/CI 결과는 PR #1317 및 #150 CODEX_DONE에 기록한다.

## 운영 적용 경계

읽기 전용 확인에서 Manabi DB에는 class_teaching_boards와 teaching-board-pages 버킷이 없다. 기존 reading_materials.id는 bigint로 신규 FK와 일치한다. 기존 Storage 정책은 material-originals/user-pdfs 버킷에 한정되어 새 버킷의 소유자 정책을 넓히지 않는다. 이 최초 확인 후 오너 승인을 받아 아래 신규 DB 적용을 수행했다. 운영 merge·환경 변수 변경·기존 교재/개인 단어/학생 수업 기록 직접 수정 없음.

제공할 SQL은 새로운 비공개 테이블·인덱스·소유자 정책·원자적 저장 RPC·비공개 JSON 버킷을 생성한다. 데이터 삭제/기존 교재나 단어의 갱신은 없다. DB 적용 전에는 기기 저장과 ‘계정 저장 준비 중’ 상태를 제공했다. CLAUDE.md의 운영 DB 적용 오너 규약 및 이번 설계의 별도 승인 범위에 따라 승인을 받은 뒤 적용했다.

최근 100개 수업 이후 목록 확장, 오래된 미참조 업로드의 자동 수거, 지난 판 선택 복사는 후속이다. 복구본 보호를 위해 이 차수에서 Storage 객체를 자동 삭제하지 않는다.

## 승인 후 실제 DB·교사 계정 검수

- 오너가 ‘신규 DB·Storage 적용 승인’으로 명시 승인. Supabase apply_migration 성공, 실제 이력20260916030644_teaching_board_cloud. 승인 원문20260916022136의 SQL 바이트는 변경하지 않고 저장소 파일명·E2E 참조만 실제 원격 버전에 정렬했다. 원격 history repair/재적용은 하지 않았다. 개명 후 폐기용 SQL26조건 재검사 PASS.
- 실제 DB: table RLS=true, anon SELECT=false, authenticated SELECT=true/직접 INSERT·UPDATE·DELETE=false. 버킷 public=false/JSON 전용6MiB. RPC2개의 anon execute=false, authenticated=true, search_path 고정. Storage SELECT/INSERT 소유자 정책2개, table owner SELECT1개 확인.
- Security advisor도 확인했다. 신규 RPC2개는 authenticated SECURITY DEFINER 호출 가능이라는 일반 경고에 해당한다. 직접 테이블 쓰기를 닫은 의도적인 원자적 RPC이며 auth.uid·교사 루트 소유권을 함수 내부에서 다시 검사한다. 익명 호출은 차단됐고 SQL26조건으로 다른 소유자·학생·권한 회수를 검증했다. 기존 범위 밖 항목은 변경하지 않았다.
- 최종 Preview2x9ongcyd에서 오너가 교사 계정으로 로그인. 원래 비어 있던 수업일 판에 검수용 표현1개와 선1개를 추가하고 ‘계정에 저장됨’을 확인했다. 실DB에 commit된 판1개/페이지1개 확인.
- ‘최신 판 확인’으로 실제 비공개 파일을 내려받아 표현/획 복원, 브라우저 새로고침 후 같은 내용/계정 저장 상태 복원 PASS. 다른 날짜의 빈 판에서 ‘지난 설명판’ 목록을 열어 저장한 날짜로 복귀했고 같은 표현·획이 다시 나타남을 확인했다.
- 학생의 ‘오늘 표현0개’가 유지됐다. 추가한 검수용 표현·획은 캔버스의 되돌릴 수 있는 삭제로 정리했다. Storage의 복구용 과거 객체를 영구 삭제하지 않았다. 교재 본문·개인 단어장·학생 수업 기록에는 쓰지 않았다.
- 별도 물리 기기/별도 학생 계정 확인은 여전히 후속이다. 계정이 같은 완전히 새 기기의 복원은 격리된 브라우저 QA로 확인했으며 물리 기기 실험으로 세지 않는다.
