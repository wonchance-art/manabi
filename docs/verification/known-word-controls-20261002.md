# 서재 뷰어 ‘아는 단어’ 표시 통합 — 2026-10-02

## 2026-10-02 완료 증거 대조 — M07-002

기준 main은 `c9ad8a51a0d14b2479b62037a8451be70e098ed1`이다. 아래 기존 본문은 로컬 후보 검수와 운영 적용 준비 당시 기록이며, 끝의 SQL·CI·실계정·병합/운영 사후 검수 대기 문구도 그 시점의 상태로 보존한다. 이후 완료 상태는 [#1335 최종 CODEX_DONE](https://github.com/wonchance-art/manabi/pull/1335#issuecomment-5942256413)과 [PR 병합 기록](https://github.com/wonchance-art/manabi/pull/1335)을 따른다. 이번 대조는 기존 증거를 읽은 문서 작업이며 SQL·앱·실계정 검수를 다시 실행하지 않았다.

| 구분 | 완료 증거 | 확인 범위 |
| --- | --- | --- |
| 구현·병합 | 구현 `0120fa41b2ba3cf36ccd7d7d2a2d1dc90da719ff`, 검수 후보 `029056fe92d9d2e3ebc7f53638b52ee70e141a87` → squash main `9a8d2b331ec2e5232d5bf274a5c2d9b293037dec`; 2026-10-01T22:35:24Z 병합 | 최종 인계에 후보/병합 tree 동일 기록. 완료 기능 재구현·재병합 대상 아님 |
| 필수 CI | [후보 run 36934290762](https://github.com/wonchance-art/manabi/actions/runs/36934290762), [병합 main run 36935969192](https://github.com/wonchance-art/manabi/actions/runs/36935969192) 두 필수 job SUCCESS; [main world run 36935969226](https://github.com/wonchance-art/manabi/actions/runs/36935969226) SUCCESS | 인계에 단위 4,397개, 격리 PostgreSQL 새 15/기존 13개, known UI 7개 PASS 기록 |
| 운영 SQL | `known_word_controls` version `20261001221716`, SHA-256 `b8dd5426ec6a25caaad775e3c87740fa479b9cb9b7c65ef7c5bf4f5ec1229369` 적용 완료 | 실제 authenticated 역할의 RLS/보호 트랜잭션 확인 후 rollback; UPDATE 권한/정책·개인 접근 범위 확대 없음. 적용된 SQL 재실행 대상 아님 |
| 정상 로그인 Preview | 배포 `dpl_2baWt9NbitxfPitJ5uKqzCzYfoX1` READY, exact 후보 `029056fe92d9d2e3ebc7f53638b52ee70e141a87` | 정상 계정 QA268 저장 미도래 카드의 표시·재접속·직접/목록 해제·키 1–4 평가 0·320px 네 칸/넘침 0 PASS |
| 운영 배포·정상 로그인 | 배포 `dpl_6sUAf2xgvuLmsHtAcJoUDFtHu43G` READY; 당시 [운영 /api/version](https://teset-gilt.vercel.app/api/version)은 main `9a8d2b331ec2e5232d5bf274a5c2d9b293037dec` / production / 동일 배포 일치 | 같은 정상 계정 QA268 표시·네 칸 잠금·숫자키 차단·재접속·직접 해제·원래 저장 상태 PASS; 익명 exclusions 401 |
| 운영 검수 정리·보존 | known 53/어휘 350/평가 298/보호 53, 임시 표시·보호 0 | 기존 known hash `2185f184e13458ca3da589d4c601f512`, 어휘 hash `d79fdecf36d2512b5ab0207bf0474d77`, 평가 hash `ee993c601021072618b1728df8b64956` 모두 일치. 원고·신구판·브라우저 답안·환경 변수 불변은 해당 인계의 보존 기록 |

첫 수동 Preview의 release metadata 누락 및 첫 운영 배포 `dpl_s8iUmJ525PEY4nocvn79vxpEwmsA`의 기존 next/font Google URL 실패도 최종 인계의 역사적 실패로 남는다. 공개 빌드값 보완과 코드 변경 없는 동일 main 1회 재배포 뒤 위 성공 배포를 확인했으며, 실패한 배포를 성공으로 계산하지 않는다.

실제 UI 검수 표본은 저장 미도래 카드다. 도래 카드·미저장 단어·요청 실패·별칭 반례는 격리 CI/SQL/합성 UI 증거이며 정상 실계정 표본과 혼합하지 않는다. 새 물리 기기·일반 학생·발음 청감·언어 독립 감수는 미확인이다. 서재 정리→복원→원문/복습 실계정 왕복은 #1327의 별도 미확인 범위이며 이 단어 검수로 대신하지 않는다.

[M07 최초 보고](https://github.com/wonchance-art/manabi/issues/1337#issuecomment-5950764680)는 후속 기준 main `c9ad8a51a0d14b2479b62037a8451be70e098ed1`의 기존 운영 /api/version 일치와 [필수 CI SUCCESS](https://github.com/wonchance-art/manabi/actions/runs/36971809417)를 기록한다. 같은 보고의 로컬 전체 검사 418파일/4,396검사 PASS, 1파일/1검사 FAIL(독해 자가검사의 자식 stdout)은 별도 미해결 결과였으며 원격 green이나 과거 후보 4,397 PASS로 덮지 않는다. 이 문서 대조의 새 전체 게이트 실행 결과로 주장하지 않는다.

## 최신 요청과 범위

오너가 ‘제외’와 기존 ‘아는 말로 표시됨’ 취소 문구를 하나의 ‘아는 단어’ 버튼으로 정정했다. 이어 저장되어 복습 중인 단어도 표시하면 복습에서 빼는 안을 선택했다. 표시는 새 평가가 아니며 해제하면 원래 일정으로 복귀한다. 기존 네 평가 칸, 뜻·출처·FSRS 일정·평가 이력·개인 자료 권한·발행 판본을 보존한다.

합의한 배치는 ‘얼마나 알겠어요?’ 줄 오른쪽의 ‘아는 단어’ 토글이다. 표시 상태는 ‘✓ 아는 단어’; 별도 ‘제외’ 버튼과 하단의 긴 취소 문구는 제거했다. 단어장에서 접힌 ‘아는 단어’ 목록으로 해제할 수 있다. 과거 제외 기록만 있을 때에는 접힌 ‘이전 복습 제외’ 해제 경로를 유지한다.

2026-10-02 오너가 새 SQL·Preview 검수를 승인하고 “앞으로 승인 필요 없게” 지속 실행을 요청했다. 합의한 학습 UI/버그 개선은 보존·검수 게이트를 통과한 뒤 병합/운영 사후 검수까지 반복 승인 없이 진행한다. 최신 범위는 [CLAUDE.md](../../CLAUDE.md)의 지속 실행 승인이다. 기존 #1334 승인을 새 SQL 승인으로 전용하지 않았다.

## 후보와 보존 계약

- 작업 브랜치 `codex/known-word-control-20261002`, 기준 main `a27107877f4b768cc8fb3eedfee4cf4134776741`. 이전 #1334 병합/운영 완료는 반복하지 않았다.
- `user_known_words`를 실제 표시 정본으로 사용한다. 원래 키는 보존하고 비교만 NFC/기본형으로 정규화한다. 조회를 200개 단위로 끝까지 읽고, 실패를 정상 빈 목록으로 처리하지 않는다.
- 원래 알려진 표기와 기본형의 연결을 `vocabulary_exclusions.known_word_keys`에 남긴다. 삽입/삭제 트리거가 기존 복습 보호에 연결하므로 목록·일정 수·출제 LIMIT·오래된 탭·오프라인 평가도 같은 상태를 읽는다. 새 표시는 가짜 단어 카드나 평가 이벤트를 만들지 않는다.
- 같은 소유자의 기존 advisory lock을 사용한다. 트리거는 invoker/빈 search_path이며 직접 실행 권한을 주지 않는다. 다른 소유자 RLS와 익명 제한을 유지한다. 기존 known 테이블의 UPDATE 권한/정책은 추가하지 않는다.
- 원래 키의 복수 표기, 같은 언어의 표면형/기본형, 카드 삭제 뒤 옛 키로 해제, 같은 단어의 과거 제외, 언어 구분을 검수했다. 다른 활성 known 표기가 남으면 보호를 유지한다. 기존 단어의 뜻·출처 편집은 허용하고 오래된 제외 해제/링크 변경으로 보호만 제거하는 요청은 차단한다. 인증 사용자 삭제의 FK cascade는 막지 않는다.
- 클라이언트는 요청 시 소유자/언어/단어를 고정하고 같은 단어의 중복 요청을 막는다. 성공 후 관련 목록·복습 수를 다시 읽는다. 실패하면 표시를 성공 상태로 바꾸지 않으며 다른 단어의 조작을 전역으로 잠그지 않는다.
- 원고/신판 `8a8c1c1fd452773810abaf8c`/구판 `7f572327dc67893e9453246c` 파일·공개 포인터·DB의 뜻/일정/평가 이력·환경 변수·권한 변경은 실행하지 않았다.

SQL 후보: [known-word-controls.sql](../sql/known-word-controls.sql), SHA-256 `b8dd5426ec6a25caaad775e3c87740fa479b9cb9b7c65ef7c5bf4f5ec1229369`. `supabase/migrations` 밖에 보존한 검수 SQL이며 2026-10-02 승인 후 운영 적용을 진행했다. 이미 적용된 이전 제외 SQL을 다시 적용하지 않는다.

## 기대와 실제 결과

| 조건 | 로컬 실제 결과 | 증거 |
| --- | --- | --- |
| 저장/미저장 known 표시·해제, SQL 보존/보호 | 격리 PostgreSQL 15검사 PASS; 기존 제외 SQL 13검사 PASS | `.qa/known-word/known-sql-final.log`, `legacy-sql.log` |
| 기본형/언어/목록 범위/페이지 조회, 영향 계약 | 5파일 37검사 PASS | `targeted-final.log` |
| 전체 단위 게이트 | 419파일/4397검사 PASS | `full-vitest-sequential-build.log` |
| 실제 Next 앱 빌드 | 479페이지 build exit 0 | `build-final.log` |
| 내용/읽기/교과과정/월드 자산 정적 확인 | prebuild exit 0; 자산 생성 없이 --check | `prebuild-final.log` |
| 변경 JS/JSX lint·diff·기존 e2e 파일 문법 | PASS | `lint-final.log`, `git diff --check`, `node --check` |
| 저장된 도래 카드 표시 | 실제 로컬 UI에서 도래 수 제거, 네 평가 버튼 disabled, 키1–4 평가 0 | `marked-desktop.png`, 합성 상태 JSON |
| 같은 카드 해제 | 도래 수 1과 기존 네 등급 즉시 복귀, 뜻/출처/interval15/repetitions8/원래 일정 불변 | `unmarked-desktop.png`, `ui-final-state.json` |
| 미저장 단어 표시·재접속·목록 해제 | 표시 유지, 새 카드/평가 0, 접힌 목록에서 해제 뒤 항목 제거 | `final-reader.png`, `ui-after-retry.json`, `ui-final-state.json` |
| 저장 실패·연속 클릭 | 오류 안내/원래 상태 유지; 재시도 double-click은 성공 POST 하나; 임시 표시 최종 0 | `ui-before-failure.json`, `ui-after-retry.json`, `ui-final-state.json` |
| 320/390/1440px | 네 칸 유지, 헤더 오른쪽 정렬, 가로 넘침 없음, 옛 긴 취소 문구 없음 | `marked-320.png`, `marked-390.png`, `marked-1440.png` 및 CUA DOM 실측 |

브라우저는 CUA로 실제 로컬 앱을 조작했고 서버 자료는 격리 합성 fixture다. SQL은 실제 PostgreSQL 엔진의 격리 PGlite다. 이를 운영 DB·실계정 검수로 세지 않는다. `e2e/viewer-exclusion.e2e.mjs`는 기존 검수 파일을 새 의미에 맞춰 갱신했지만 이 회차에서 자동 브라우저 스위트를 실행하지 않았다. 새 Preview 후 정확한 head의 필수 CI에서 확인한다. 물리 기기/일반 학생/발음 청감은 이번 새 검수 결과에 포함하지 않는다. 발음 코드는 변경하지 않았다.

## 실패·반례와 재검토

1. 제거한 옛 문구/평가 잠금 조건을 가정한 두 계약 테스트가 처음 실패했다. 최신 직접 요청에 맞춰 해당 주장만 변경하고 다른 평가/순서/출처 계약은 유지했다.
2. 프랑스어의 같은 표기가 영어 기본형 집합으로 섞이는 새 helper 반례가 드러났다. 언어별 필터를 수정했으며 해제 후 별칭이 남지 않는 단위 검사를 유지했다.
3. build와 전체 단위 검사를 동시에 돌릴 때 작업 밖 `studiesRefs` 로딩이 60초를 넘었다. 관련 코드는 수정하지 않았다. 해당 4검사 단독 PASS 후 build 종료 뒤 전체를 2 worker로 실행해 4397검사 PASS를 확인했다. 앞선 timeout을 성공으로 계산하지 않았다.
4. localhost 합성 Supabase는 운영 hostname의 서비스워커 제외 규칙을 타지 않아, 해제 후 오래된 GET을 되돌리는 시험 환경 문제가 재현됐다. 실제 제품 SW의 Supabase hostname 제외를 확인했다. 격리 서버 응답에 Vary:*를 두고 기존 앱 캐시 비우기 UI를 사용한 뒤 표시/해제를 다시 검수했다. 제품 SW 변경은 없고, prebuild가 만든 SW 버전 변경도 후보에서 복원했다. 운영 일반 요청의 실제 새 반례로 보고하지 않는다.
5. 현재 checkout의 `docs/quality-workflow.md`/`docs/qa-live-workflow.md`는 없다. 기존 package/CI/PGlite/e2e와 검수 기록을 사용했고 별도 QA 체계는 만들지 않았다.

테스트 실행은 기준 HEAD와 작업 파일 상태에서 이루어졌다. 로컬 빌드 배지는 `dev/local`이며 배포 head의 증거가 아니다. 실행 소스 SHA-256는 `.qa/known-word/source-fingerprints.json`에 보존했다. 뒤의 검수 문서/보드 커밋을 앱 실행 버전으로 주장하지 않는다. Node24.19.0이며 월드 저작/PNG 재생성은 하지 않았다. 빌드의 기존 lessonAdapters/lessonModel 익명 default export 경고와 prebuild의 기존 교과과정 경고는 별도다.

## 운영 읽기 전용 대조와 다음 게이트

운영 프로젝트 `jdtowtxhexcweuxawrds`에 SELECT만 실행했다. 전체 DB 집계로 기존 known 표시는 53개(지원 언어 53/공백0), 새 컬럼은 미적용, 기존 제외0이었다. known과 일치하는 저장 카드2개는 모두 복습 도래 카드였다. 이 수는 관리자 특정 계정의 이전 검수 수와 다르며 혼합하지 않는다. 적용하면 원래 53개 표시/시각을 보존하면서 해당 도래 카드2개도 복습에서 빠진다. 의미/출처/일정/평가를 갱신하는 backfill은 없다.

이 exact SQL과 새 Preview 배포·정상 실계정 검수는 승인됐다. 운영 DB가 공유되므로 SQL 적용 자체가 두 기존 카드의 출제 상태에 영향을 준다. 승인 뒤에는 schema/trigger/실행 버전을 확인해 SQL을 한 번 적용하고, Preview 정확한 head/필수 CI·실계정 왕복을 확인한다. 새 앱은 known_word_keys를 조회하므로 SQL 확인 전에 배포하지 않는다. 병합/운영 앱 배포는 최신 지속 실행 승인 범위에서 검수 결과를 확인한 뒤 이어간다.

오류면 BEGIN의 DDL/backfill은 전체 rollback한다. 적용 성공 후 코드 복원은 known/보호 상태와 기존 취소 경로를 지원하는 배포를 유지한다. known 목록·제외·판본·SRS·학습 기록을 지우거나 일정을 초기화하는 복원은 하지 않는다. 이전 a271 앱도 SQL 뒤 기존 known 취소로 표시를 해제할 수 있으나, 새 토글 제공은 Preview 검수 뒤이며 중간 UI는 이전 라벨이 남는다.

현재 닫힌 조건은 로컬 구현·보존/보호 SQL 검수·최종 단위·빌드·좁은 화면이다. 남은 조건은 새 SQL 실행 확인·정확한 후보 CI·실계정·병합/운영 사후 검수다. 승인 대기를 새 콘텐츠/월드/권한 작업으로 우회하지 않는다.
