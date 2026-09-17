# 수업 출시 후보 · Preview 통합

> 2026-09-18 후속: 정상 계정의 비공개 원문→학습 구간→교정/재접속을 확인했고,
> 실제 일본어 오출력 방어를 보완했다. [후속 검수](authenticated-lexical-20260918.md)가 최신 상태다.
> 아래 실행 버전·실행 0건 표기는 9월17일 통합 당시 기록이다. 최신 배포는 #1321/#150 인계 참고.

2026-09-17 KST. 오너의 “좋아 진행해”에 따라 기존 출시 후보 #1321에
#1322 검수 자동화와 #1323 화면 품질 보완을 통합했다. 새 출시 PR은 만들지 않았다.

## 버전과 범위

- 통합 draft [PR #1321](https://github.com/wonchance-art/manabi/pull/1321), base `main`.
- 기존 `34a09fed87b95b0d32e18f22dbb29f81c261288f`에서 검수된 #1323
  `db8ace5b47cc889b8f137298df0ceec2a7bcb766`으로 fast-forward. 충돌·이력 재작성 없음.
- runtime/build commit: `b94300dec33bf168675fcc5f89ef21f46db1bdf9`.
- 이후 `894ef30ecd1ea334b2d20d3be8830fb7c75fa2bd`는 의미 자료·검수 도구·문서만 변경.
  `src`, `public`, 의존성, Next/Vercel 구성의 runtime diff는 0.
- exact 최종 head와 필수 CI는 #1321 checks 및 #150 CODEX_DONE으로 인계한다.
- 원래 dirty 작업 공간·다른 세션·운영 main을 변경하지 않았다.
  #1322는 base인 출시 브랜치에 내용이 포함되면서 GitHub에서 MERGED로 표시된다.
  이것은 main/운영 병합이 아니다. #1323과 이전 개별 PR은 보존한다.

## 실제 Preview

- [고정 QA 주소](https://manabi-web-v2-preview.vercel.app/home)
- [불변 배포 주소](https://manabi-gdchpstum-wonchance-arts-projects.vercel.app/home)
- deployment `dpl_7wwHHjHNqe26bpAgsCqhHrgAiUzm`, Vercel READY, Node24.
- 원격 소스 빌드 성공. 합성 인증/폰트 fixture로 빌드한 로컬 출력을 업로드하지 않았다.
- 새 배포의 공개 사전 검사 통과 후에만 고정 QA alias를 이동했다.
  이동 전후 `/api/version` 커밋·배포 ID·판본·no-store, 정상/외부 인증 복귀를 확인했다.
  candidate와 stable가 같은 배포이고 검사 도중 버전 변경도 없었다.
- 이전 QA 연결은 `dpl_3AAYnSwhEZ3znijcy9k98yrjVFCV`, runtime `1a21318fecd8a3362ceb153a71c3f5b77b14c633`.
  QA 연결 복귀 시 DB·학습 기록을 되돌리지 않는다.
- 운영 `teset-gilt.vercel.app`은 전후 동일:
  `efa44c508e862bc118518e9235008201f291341d` / `dpl_E25TGWBfQKmkragTBh2euPj5hwbM`.
- HTTP 증거: `.qa/live/2026-09-17T14-17-54.755Z-61833/` (도구 생성 내부 파일명).

## 직접 확인과 자동 검수의 구분

- Codex 브라우저의 실제 배포 홈 → N5 01과 이동, 현재 판본 42과 표시 확인.
- 1280px와 390px 교재의 가로 넘침 없음. 모바일 목차·본문·하단 내비를 직접 보았고
  검수용 viewport 변경은 복원했다. 로그인·단어 저장·수업 권한을 확인한 것으로 확대하지 않는다.
- 통합 전 #1323 exact head의 전체 Vitest 425파일/4,542 PASS·기존1 skip,
  release 10단계/재개 10단계, Chromium/WebKit 수업51·노트11·대응4,
  SQL7+26, Linux/Mac 각각 승인 이미지14개 차이0 근거를 유지한다.
  이 수치는 합성 브라우저/독립 DB 검사이며 이번 실제 UI 관찰과 별도다.
- 이번 의미 보완의 targeted 검사: 2파일42개 PASS, ESLint·diff check PASS.
  최종 통합 head의 필수 원격 CI 결과는 #150의 exact-head 인계에 기록한다.

## 의미 품질

[재검토 결과](lexical-review-20260917.md). 40사례 중 위험 지점6건의 문맥/뜻/평가 단위 보완,
기대 답안을 제외한 입력 내보내기, 기준 지문 확인, 누락/실패/저장사전/AI/합성 응답 분리,
여러 후보를 자동 선택하지 않는 반입 보고서를 추가했다. 자동 정확도 점수는 산출하지 않는다.
기준 지문: `a4424ccd70a89745fc06659e48e8525f8f4e3880e978e60491dcd3debb317a0f`.

## 남은 실제 사용 조건

1. 정상 인증 교사/학생 계정의 날짜별 수업·원본 단어 저장·뜻 수정 전달·복습 복귀.
2. 실제 AI 응답 표본과 일본어 대응의 독립 감수. 이번 공급자 실행은 0건이다.
   고정 QA 로그인 화면을 열어 안내했으며 토큰 추출·인증 우회는 하지 않는다.
3. 실제 iPad/Pencil 필기·손바닥·키보드·회전. WebKit 터치 합성 검수와 구분한다.
4. 운영 병합/전환은 이 준비 작업과 별도. 기존 승인·적용된 SQL을 다시 적용하지 않았고
   이번 DB·영구 환경 변수·운영 alias 변경은 0이다.

N5 42과 커버리지 감사는 아직 시작하지 않았다. PDF·새 음성·별도 병렬 세션도 범위 밖이다.
