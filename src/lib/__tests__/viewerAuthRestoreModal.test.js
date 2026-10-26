import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// 계약: 로그인 복원(손님 null → 첫 계정)은 계정이 바뀐 게 아니다 — 뷰어 창(「학습」 · Aa · 받아쓰기 …)도 닫지 않는다.
// 조기 조회 자료가 복원(whenDocumentParsed — 기다리는 경계가 남으면 최대 3초)보다 먼저 그려져, 그 사이 연 「학습」 창이
// 복원 순간 닫혔다: 소유자는 「자료 관리」를 끝내 못 봤고, viewer-boundary-edit e2e가 새로고침 직후 그 항목을 30초 기다리다
// 실패했다(CI 간헐 · 2026-10-25~26 KST, 재현: 경계 하나를 붙잡아 복원을 3초 늦추면 매번). 고른 단어의 같은 규칙은
// viewerAuthRestoreSelection.test.js. 자료가 바뀌거나 실제 계정이 바뀌면(A → 손님 · A → B) 지금처럼 닫는다.
const viewer = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8');

describe('뷰어 — 로그인 복원 중 연 창 유지', () => {
  it('같은 자료에서 손님 → 계정이면 창 닫기 · 자동 넘김 멈춤 · 받아쓰기 초안 비우기를 건너뛴다', () => {
    expect(viewer).toMatch(/const prev=modalScope\.current,next=\{id,user:user\?\.id\?\?null\};\s*modalScope\.current=next;\s*if\(prev&&prev\.id===next\.id&&prev\.user===null\)return;\s*setActiveModal\(null\);setPaceRunning\(false\);dictationDrafts\.current\.clear\(\);\s*\},\[id,user\?\.id\]\);/);
  });

  it('계정 의존 리셋에서 창을 무조건 닫는 옛 줄이 남지 않는다', () => {
    expect(viewer).not.toMatch(/useEffect\(\(\)=>\{setActiveModal\(null\);[^}]*\},\[id,user\?\.id\]\);/);
  });
});
