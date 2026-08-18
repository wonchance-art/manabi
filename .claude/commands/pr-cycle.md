# /pr-cycle — PR 사이클 실행 (커밋 → 게이트 → 머지 → 재동기화)

## 역할
manabi의 merge 규약을 순서대로 끝까지 실행한다. 단계 누락(게이트 코멘트 미게시 등)이
구조적으로 생기지 않게 하는 것이 이 명령의 존재 이유다.

## 요청
$ARGUMENTS
(비어 있으면 현재 워킹트리 변경을 대상으로 삼는다)

## 실행 순서 — 건너뛰지 말 것

### 0. 사전 점검
- `git status --short` / `git log --oneline -1`로 대상 확인.
- **열린 내 PR이 있으면 먼저 그것을 끝낸다**(코드가 섞이면 검수 불가).
  브랜치가 이미 머지된 PR 위에 있으면 `git fetch origin main && git reset --soft origin/main`으로
  작업분을 유지한 채 새 main 위에 재구성한다. 워킹트리가 깨끗하면 `git checkout -B <branch> origin/main`.

### 1. 커밋
- 대상 파일만 명시적으로 `git add`(`-A` 금지 — 스크래치 혼입 방지).
- 커밋 메시지: 한 줄 요약 + 빈 줄 + 근거·실측·계약. 말미에
  `Co-Authored-By:` / `Claude-Session:` 트레일러. 모델명은 어디에도 쓰지 않는다.
- **보드 갱신은 같은 PR에 별도 커밋으로 동봉**(CLAUDE.md 게이트 — 자기 열만).

### 2. 푸시 + draft PR
- `git push -u origin <branch>`(스쿼시 후 재동기화 상황이면 `--force-with-lease`).
- draft PR 본문: 배경(오너 지시 인용) / 변경 / 테스트 / 게이트. 리포 PR 템플릿이 있으면 그 구조를 따른다.

### 3. 게이트 — 병렬로 시작
- 로컬 전체 vitest를 **백그라운드**로 시작하되 **전체 로그를 파일에 남긴다**:
  `npm test > /tmp/vitest-full.log 2>&1; echo "exit=$?"; grep -E "FAIL|AssertionError" /tmp/vitest-full.log | head; tail -5 /tmp/vitest-full.log`
  - `| tail -N`으로 파이프하지 말 것 — 요약만 남고 **실패한 파일명·assertion이 통째로 사라진다**
    (2026-08-18 두 번 연속 이걸로 실패 지점을 못 찾아 전체를 재실행했다).
  - 파이프를 꼭 쓸 거면 `exit ${PIPESTATUS[0]}`로 exit code를 살릴 것(파이프가 삼킨다).
- 콘텐츠를 건드렸으면 `node scripts/lint-curriculum.mjs`·`check-content.mjs`·`lint-content.mjs`.
- 레퍼런스 챕터를 추가·수정했으면 `node scripts/build-ref-grammar-manifest.mjs` 재생성 필수.

### 4. 결과 코멘트 — **실제 도구 호출로 게시**
전체 vitest 완료 후 PR에 결과를 코멘트한다(수치 포함). 구두 보고로 대체하지 말 것 —
"게시했다"고 말하고 호출을 빠뜨린 전례가 2회 있다. 게시 후 반환된 코멘트 id를 확인한다.

### 5. CI 확인 → ready → merge
- 체크런 조회. **fonts.gstatic 플레이크**(`Failed to fetch font file` → `nextFontGoogleFontLoader`
  → `TypeError: Cannot read properties of null`)면 코드 문제가 아니다:
  `git commit --amend --no-edit && git push --force-with-lease`로 재트리거.
  **2연속 red면 즉시 재시도하지 말고 10~20분 백오프**(러너 CDN 장애 창 회피 — 2026-08-17 4회 실측).
- 양 job green → draft 해제 → **squash merge**(제목은 `<타입>: <요약> (#<번호>)`).

### 6. 재동기화 + 정리
- `git fetch origin main && git checkout -B <branch> origin/main && git push --force-with-lease`.
- `git status --short`가 비었는지 확인하고 종료.
- 후속 작업이 있으면 `send_later`로 체크인을 예약한다(폴링 금지).

## 금지
- 다른 세션 브랜치 수정, force-push(자기 브랜치 재동기화 제외), DB 스키마 변경, 시크릿 열람.
- CI red를 남긴 채 턴 종료.
