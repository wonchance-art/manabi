# N4 앱 후보 등록과 발행

N4 원고의 웹 검토본을 앱에서 제공하기 위한 발행 계약이다. 원고·출력 검수, 앱 통합 검수, 실제 계정 검수와 공개 발행을 각각 기록한다. 로컬 패키징이 운영 발행을 의미하지 않는다.

## 2026-10-17 통합 후보와 확인 결과

- 대상 main `55cbdc54031cf8167571043ef654b33af4f0808b`의 성능·캐시·보안·접근성 개선을 통합했다. N5의 기존 175개 파일과 공개 포인터는 보존한다.
- N4 판본 `f4a6411c0945bbd3f8767af7`, 내용 SHA-256 `f4a6411c0945bbd3f8767af72619474fadd45d0fbd0f403463c2c04ccd1b27c5`, 자산 묶음 SHA-256 `16c62d4ae663e23de47b8538d29622c45e59af9d341473120c9023fb2a6d459a`.
- 독립 감수한 읽기 294개를 추가했다. 기존 일본어 본문·뜻·보기·정답은 동일하다. 브라우저에서 한자 읽기 지원과 336개 화면 조건을 확인했고, 700px 반응형 전환을 컨테이너 규칙으로 옮긴 뒤 기존 화면과 같은 배치를 확인했다.
- 전체 Vitest 699파일·8,187검사, 전체 ESLint, 변경 후 migration/asset 추적 관련 38검사 통과. 구체 초기 발행 SQL은 격리 PostgreSQL의 5개 시나리오, DB 호환 SQL은 권한·소유권·보존·재실행을 포함한 10개 시나리오를 통과했다.
- 실제 로컬 Next와 격리 HTTP backend에서 N4 진입·42과·검색·답안 재로드·표현 저장·중복 방지·복습 범위·소개 후 채점·같은 판본 원문 복귀·N5 분리·비로그인 401을 확인했다. 합성 사용자를 사용했으며 **실제 운영 계정 로그인 검증은 수행하지 않았다.** 기존 SRS의 legacy cohort 채점 경로를 확인한 것으로, 별도 full-state FSRS 등록이나 TTS 성공을 뜻하지 않는다.
- 운영 Manabi DB에 `20261017050212_textbook_n4_book_support`를 적용했다. 이력과 동일한 SQL을 migration 파일에 보존했다. 적용 전후 N5 판본 2개·포인터 1개·단어 1,246개·문맥 325개의 전체 행 집계 해시가 모두 같았다. 과거 migration을 다시 적용하지 않는다.

검수 영수증과 근거: `docs/verification/n4-app-release-20261017/`. 배포·발행의 최종 실행 식별자는 완료 시 별도 기록한다. 새 PDF와 음성은 제작하지 않았다.

## 판본과 보존

- N4 원고는 `src/content/textbookManuscripts/japanese-n4/`에서 읽는다. 전체 원고의 정렬된 canonical JSON SHA-256으로 내용을 식별하며 앞 24자가 판본 ID다. 템플릿 해시도 원고에 포함되므로 표현이 바뀌면 새 판본을 만든다.
- 각 출력은 `src/content/textbookEditions/<edition>/`에 저장한다. N4 후보 목록만 `src/content/textbookEditions/japanese-n4/index.json`에 둔다. 기존 N5 `index.json`과 판본 파일을 바꾸지 않는다.
- `scripts/textbooks/package-n4-release.mjs`는 이미 존재하는 판본을 덮어쓰지 않는다. 같은 원고·자산·검수 영수증이 바이트 단위로 같은 경우에만 반복 실행을 허용한다. 별도의 후보를 추가해도 이전 후보 ID를 목록에서 제거하지 않는다.
- 출력 검수의 `qa.passed`와 운영 DB의 발행 포인터를 혼동하지 않는다. 후보 목록은 관리자 편집용이며 공개 여부는 DB가 결정한다.

## 로컬 패키징

원고를 다시 빌드한 원시 출력의 `qa.passed`는 항상 false다. 실제 구조·독립 내용·브라우저 검수의 근거를 묶은 다음 패키징한다.

```sh
node scripts/textbooks/package-n4-release.mjs --artifact /absolute/reviewed-build --verification /absolute/verification/release.json
node scripts/textbooks/package-n4-release.mjs --artifact /absolute/reviewed-build --verification /absolute/verification/release.json --check
```

`--out-root`로 격리된 등록 루트를 지정할 수 있다. 기본은 현재 체크아웃의 `src/content/textbookEditions`다. DB 연결이나 네트워크 쓰기는 수행하지 않는다. 명령은 자체 구조 검사, 원고·자산의 SHA-256, 세 검수 범위와 그 근거 파일의 SHA-256을 검사한다. 확인되지 않은 후보를 관리자 화면에서 발행 가능하다고 보이게 만들기 위해 검수를 통과 처리하지 않는다.

검수 영수증 형식은 다음과 같다. 각 scope의 식별값은 최상위와 같아야 한다. `evidence[].path`는 영수증 디렉터리를 기준으로 한 상대 경로이며 상위 경로·심볼릭 링크를 거부한다. 예시의 해시와 경로는 실제 결과로 채운다.

```json
{
  "schemaVersion": 1,
  "bookId": "japanese-n4",
  "editionId": "<24 lowercase hex>",
  "contentHash": "<64 lowercase hex>",
  "bundleHash": "<64 lowercase hex>",
  "passed": true,
  "checks": {
    "structure": { "bookId": "japanese-n4", "editionId": "<same>", "contentHash": "<same>", "bundleHash": "<same>", "passed": true, "evidence": [{ "path": "structure.json", "sha256": "<64 lowercase hex>" }] },
    "language": { "bookId": "japanese-n4", "editionId": "<same>", "contentHash": "<same>", "bundleHash": "<same>", "passed": true, "evidence": [{ "path": "language.json", "sha256": "<64 lowercase hex>" }] },
    "browser": { "bookId": "japanese-n4", "editionId": "<same>", "contentHash": "<same>", "bundleHash": "<same>", "passed": true, "evidence": [{ "path": "browser.json", "sha256": "<64 lowercase hex>" }] }
  }
}
```

근거 파일의 내용과 실제 검수 수행 여부는 담당자가 검토해야 한다. 해시 검사는 결과를 새 판본에 잘못 재사용하는 것을 막으며 언어 품질을 자동 인증하지 않는다. 브라우저가 격리 fixture인지 실제 운영 계정인지도 근거에 명시한다. 패키저는 검수 영수증의 SHA와 범위를 bundle에 기록하되 실제 계정 검수·공개 발행은 별도라고 표시한다.

## 운영 적용 순서

1. 대상 Supabase 프로젝트·Vercel 프로젝트와 현재 운영 배포, N5 공개 포인터·판본 해시를 읽기 전용으로 기록한다. 원고·개인 학습 기록은 이 식별 검사에 필요하지 않다.
2. 새 migration으로 `textbook_book_drafts`, `textbook_book_editions`, `textbook_book_releases`의 `book_id` CHECK만 N5와 N4를 허용하도록 확장한다. 과거 N5 migration을 수정하거나 재적용하지 않는다. 기존 RLS·권한·`security invoker` RPC·낙관적 버전 검사는 유지한다.
3. 새 판본 파일을 포함한 코드의 미리보기 배포를 만든다. 실제 빌드 SHA·판본 ID와 자산 응답을 대조하고, 익명/일반 사용자/관리자 경계, N5 회귀와 N4 화면·원문 복귀를 검사한다.
4. 관리자 인증 세션이 있다면 기존 초안 저장·발행 RPC를 사용한다. 없다면 초기 등록은 관리 DB 경로로만 수행할 수 있으며 **실제 로그인 버튼 검수로 기록하지 않는다.** 사용자 세션/JWT를 조작해 로그인한 것처럼 만들지 않는다. 새 초안·판본·공개 포인터의 부재 또는 정확한 기대 버전을 검사하고 실제 기존 관리자 식별값을 발행 담당자로 사용한다. 이 결정과 적용자는 실행 기록에 남긴다.
5. 등록 트랜잭션 안에서 N4 교재별 advisory lock과 기대 버전을 검사한다. 판본은 INSERT만 수행하고 중복 판본의 원고·content hash·artifact manifest가 다르면 중단한다. 공개 포인터를 교재 ID로 한정한다. N5 포인터·판본이나 사용자의 단어·FSRS 기록을 변경하지 않는다.
6. 공개 전환 전에 실제 운영 계정으로 표현 저장 → 동일 계정의 복습 목록 → 같은 판본·원문 위치 복귀를 검증한다. 다른 계정 접근 거절과 비로그인 401, 임의 quote/lesson/edition 조합 거절을 확인한다. 실제 인증을 확보하지 못하면 이 항목을 미검증으로 남긴다.
7. 정확한 코드·배포·판본이 확인된 후보를 운영 승격한 뒤 현재 공개 포인터·자산 해시와 N5 기준값을 재확인한다. 새 음성·PDF를 제작하지 않았다면 버튼·자산 요청을 노출하지 않는다.

## 복원

N4 후속 개정은 기존 발행 RPC의 restore 모드로 이전 N4 판본을 다시 선택한다. 내용과 자산은 삭제하거나 덮어쓰지 않는다. 새 판본에서 저장한 출처도 그 판본에 계속 연결돼야 한다.

N4 최초 공개에 문제가 있으면 먼저 이전 코드 배포로 복원해 진입점을 숨긴다. 범위가 좁은 운영 중지로 N4 공개 포인터를 내릴 필요가 있으면 발행 담당자가 별도 트랜잭션에서 정확한 N4 ID·기대 버전을 확인한다. N5 포인터와 발행 판본은 유지한다. CHECK 확장 migration은 데이터 삭제 없이 남겨도 안전하며 N4 데이터가 있는 상태에서 CHECK를 N5 전용으로 되돌리지 않는다. 이미 생성된 학습 출처를 없애기 위해 판본/학습 데이터를 삭제하지 않는다.
