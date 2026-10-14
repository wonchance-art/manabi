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
- 양 job green이어도 바로 merge하지 말고 **5-1 병합 직전 점검**을 먼저 끝낸다.

### 5-1. 병합 직전 점검 — 「끝났다」고 말하기 전에 증거로 (verification-before-completion)
병합은 되돌리기 어렵다. 아래 다섯 개를 **이번 턴에 새로 조회한 결과**로 확인한다
(기억·이전 턴의 조회값 재사용 금지).
1. **검수 보고 채널을 마지막 댓글까지 읽는다.**
   - 대상: #1337(M09 검수 · 오너 지시 전달) 등 그 PR의 검수 창구.
   - 고정 페이지 하나만 읽지 말 것. 이슈의 `comments` 수로 마지막 번호를 구한다.
     `perPage 1`로 그 번호를 읽고, 그다음 페이지가 **빈 배열**인지까지 확인한다.
   - 내 마지막 배정 댓글 **이후**의 모든 댓글을 읽는다. 아래 셋 중 하나라도 있으면 병합을 멈추고 먼저 처리한다.
     - 병합 보류 요청
     - 오너 지시 전달(「이전 걸로」 · 「대조할 것」 등)
     - PASS 철회 · 안 교체
2. **보류 · 철회된 인계를 쓰지 않는다.** 남이 올린 커밋을 cherry-pick하거나 통합하기 직전에,
   그 커밋 이후 같은 작업 ID의 새 보고가 「철회 · 대체」를 말하지 않는지 다시 확인한다.
3. **검수한 head = 지금 head.** PR head 40자 SHA가 검수 보고의 SHA와 같은지 확인하고,
   merge 호출에 `expectedHeadSha`로 그 값을 넣는다.
4. **base가 움직였으면 합친 결과로 확인한다.**
   - `git log <PR base>..origin/main`으로 그사이 main에 들어온 커밋을 본다.
   - 겹치는 파일과 `git merge-tree --write-tree origin/main origin/<branch>`로 충돌을 확인한다.
   - 겹치는 코드 파일이 있으면 `git merge --no-commit origin/main` 상태에서 `npm test`를 돌린 뒤 `git merge --abort`.
5. **필수 CI 2개가 그 head에서 green**, mergeable 상태(충돌 없음).

다섯 개를 모두 확인했으면 draft 해제 → **squash merge**(제목은 `<타입>: <요약> (#<번호>)`).
병합 뒤 운영 검수 요청에는 **실제 main SHA**를 적는다. 다른 자동 배포로 운영 SHA가 지나갔으면, 그 SHA와 대상 파일 diff 0 여부를 함께 적는다.

> 근거(2026-10-14 실측): 위 1번을 고정 페이지로만 읽어서 두 번 사고가 났다.
> - #1450은 오너의 「버튼 모양 이전 걸로 · 병합 보류」 전달을 못 보고 병합했다.
> - #1459는 이미 철회된 그라데이션 커밋을 cherry-pick했다.
> 두 건 모두 테스트 · CI는 green이었다. 이 점검은 「검사 통과」가 아니라 「최신 지시 확인」을 막는다.

### 6. 재동기화 + 정리
- `git fetch origin main && git checkout -B <branch> origin/main && git push --force-with-lease`.
- `git status --short`가 비었는지 확인하고 종료.
- 후속 작업이 있으면 `send_later`로 체크인을 예약한다(폴링 금지).

## 금지
- 다른 세션 브랜치 수정, force-push(자기 브랜치 재동기화 제외), DB 스키마 변경, 시크릿 열람.
- CI red를 남긴 채 턴 종료.
