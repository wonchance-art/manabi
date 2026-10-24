import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// 계약: 로그인 복원(손님 null → 첫 계정)은 계정이 바뀐 게 아니다 — 조기 조회 자료가 복원보다 먼저 그려져 그 사이 누른 단어가
// 계정 확정 리셋에 닫히던 길(뷰어 e2e 흔들림 · 2026-10-21 KST 실측). 자료 · 언어 · 실제 계정 교체는 그대로 닫는다.
const viewer = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8');

describe('뷰어 — 로그인 복원 중 고른 단어 유지', () => {
  it('같은 자료에서 손님 → 계정이면 리셋을 건너뛴다', () => {
    expect(viewer).toContain("if (!prev || (prev.id === next.id && prev.materialLang === next.materialLang && prev.user === null)) return;");
    expect(viewer).toMatch(/resetScope\.current = next;[\s\S]{0,200}setSelectedToken\(null\);[\s\S]{0,200}\}, \[id, user\?\.id, materialLang\]\);/);
  });
});
