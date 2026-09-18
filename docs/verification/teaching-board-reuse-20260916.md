# 지난 설명판 페이지 재사용 검수

2026-09-16 KST · PR #1318 · base #1317 (94e555a82c3cf3ab2b4c96ed1c98eb2b4447db65)

실행 코드: `5c97b63742f63908bea14a5bf64d9c09bfa104c4`.

## 구현

현재 수업의 지난 설명판 메뉴에서 날짜 옆 가져오기 → 실제 페이지 미리보기와 체크 → 새 페이지로 복사. 목적지 수업 날짜를 명시하며 화면 이동 없이 첫 복사 페이지 전체를 맞춰 보여 준다. 원본·기존 필기·교재 출처를 보존하고 동일 판본 재복사와 20페이지/6MiB 초과를 막는다. 학생 수업 기록은 기존 명시적 저장 버튼으로만 추가한다.

기존 private 다운로드·teacher owner 검사·계정 revision/CAS·기기 초안·복구를 재사용. DB/schema/env/의존성/운영 사이트/교재 내용/개인 SRS 변경 없음. 독립 worktree에서 작성, 공유 원래 체크아웃의 변경은 보존했다.

## 로컬 검증

- 전체 Vitest **409파일 / 4,340개 PASS**, 새 재사용 모델 7개 및 기존 cloud/API 합계23개 PASS.
- 요소·묶음·화살표·프레임·결합 글자의 ID 연결, 삭제 요소 제외, 교재 source 보존, 원본 불변, 선택/중복/용량, 계정 pack/unpack 후 출처 메타데이터를 검사.
- JS/JSX 명시 lint 오류·경고0. 빌드 **480페이지 PASS**. 빌드의 기존 lessonAdapters/lessonModel 기본 export 경고2는 변경 범위 밖.
- Chromium 최종 실행 코드 **26흐름 PASS**, 오류0. WebKit 터치 **26흐름 PASS**, 오류0. 이미지 실제 디코딩까지 확인.
- 390px/1024px 선택 화면을 직접 확인. 키보드 Space 선택, 날짜 목록 복귀 초점, 화면 내부 복사 버튼과 가로 넘침 없음. 전체 보기 보완 뒤 복사 페이지의 표현·필기를 한 화면에서 확인.
- 저장·다운로드는 합성 교사 인증 + 실제 폐기용 PostgreSQL RPC/Storage 메타데이터를 사용한다. 실제 사용자 자료·AI·학생 기록에 쓰지 않는다. 원본 immutable 페이지 파일 bytes와 manifest를 대조하고 학생 수업 기록 개수가 변하지 않음을 확인했다.

검수 중 바로잡은 것: 첫 대상 판 비교에서 Excalidraw의 null/[] 빈 연결 목록 정규화를 동일 의미로 비교(다른 필드는 그대로 비교). 숨긴 메뉴의 저장 문구까지 잡던 선택자를 실제 저장 패널로 한정. WebKit만 라우팅하는 앱 내부 Blob 이미지를 검수 네트워크 허용 대상에 넣고 naturalWidth>0 디코딩 검증을 추가. 홈을 강제로 떠나기 전 실제 초기화/미리읽기 완료를 기다려 요청 취소를 만들지 않는다. 오류 무시 규칙을 추가하지 않았다.

## 배포·후속

- 실행5c97b637의 CI35065027461 두 job SUCCESS, PR CLEAN 확인.
- 최종 Preview 검수 대상: https://manabi-o8w5h1ghx-wonchance-arts-projects.vercel.app / dpl_BxmbJTNsgQwAGFo9VmQSYdun48D4. 배포 READY·버전·배포 환경 E2E 결과와 최종 문서 head CI는 PR/#150 CODEX_DONE에 기록한다. 본 문서 작성 시 원격 폰트 다운로드 재시도로 빌드 진행 중이며, 성공으로 간주하지 않았다.
- #1316/#1317/#1318 운영 병합은 하지 않음. 이번 범위에 새 DB 적용이나 환경 변수 승인이 필요하지 않다.
- 새 Preview 실계정 페이지 복사, 물리 iPad/Pencil·회전·키보드, 요소+주변 필기의 부분 선택은 별도 후속. 기존 계정 저장 실검수(#1317)와 이번 합성 검수를 혼동하지 않는다.
- world/PNG 결정성·지형·미니맵 메모리 게이트는 이번 웹 UI 범위에 해당하지 않는다.

로컬 증거: `/private/tmp/manabi-board-reuse-alltests.log`, `manabi-board-reuse-build-fit.log`, `manabi-board-reuse-chromium-fit/report.json`, `manabi-board-reuse-webkit-complete/report.json`.
