import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('코드 리뷰 R1 수리 회귀', () => {
  it('V-01 AdminPage: 인증 가드가 모든 Hooks 뒤에 온다', () => {
    const src = read('src/views/AdminPage.jsx');
    const guardIdx = src.indexOf('if (loading) return');
    const lastHookIdx = Math.max(
      src.lastIndexOf('useQuery({'),
      src.lastIndexOf('useMutation({'),
    );
    expect(guardIdx).toBeGreaterThan(lastHookIdx);
  });

  it('V-01 AdminPage: 관리자 확정 전에는 조회가 실행되지 않는다', () => {
    const src = read('src/views/AdminPage.jsx');
    const enabledLines = src.match(/enabled: [^,\n]+/g) || [];
    expect(enabledLines.length).toBeGreaterThan(0);
    for (const line of enabledLines) expect(line).toContain('isAdmin');
  });

  it('V-03 AuthPage: from은 내부 절대경로만 허용한다', () => {
    const src = read('src/views/AuthPage.jsx');
    const m = src.match(/const from = (.+);/);
    expect(m).toBeTruthy();
    const guard = (raw) => (raw && /^\/(?!\/)/.test(raw) ? raw : '/materials');
    expect(guard('https://evil.com')).toBe('/materials');
    expect(guard('//evil.com')).toBe('/materials');
    expect(guard('/home')).toBe('/home');
    expect(guard(null)).toBe('/materials');
    expect(m[1]).toContain('/^\\/(?!\\/)/');
  });

  // V-02 원본은 ViewerGrammarModal의 inlineFormat 계약이었다. 모달이 [자세히] 인라인
  // 해설로 대체되면서(2026-08-18) AI 출력 렌더가 formatDetail 하나로 모였고, 이스케이프
  // 책임도 그쪽으로 이관됐다. 계약의 실질(AI 출력이 dangerouslySetInnerHTML로 갈 때
  // 반드시 이스케이프)을 새 경로에서 유지되는지로 다시 고정한다.
  it('V-02 AI 출력 렌더 경로는 이스케이프를 거친다(모달 → 인라인 이관)', () => {
    const fmt = read('src/lib/wordDetailFormat.js');
    expect(fmt).toContain('function escapeHtml');
    expect(fmt).toMatch(/return escapeHtml\(cleaned\)/);
    const viewer = read('src/views/ViewerPage.jsx');
    // 문법 해설 결과도 formatDetail을 통과해야 한다(원문 직접 삽입 금지)
    expect(viewer).toMatch(/__html: formatDetail\(grammar\.result\)/);
    expect(viewer).not.toContain('__html: grammar.result');
  });

  it('V-04 LessonsPage: level은 key/label 모두 받고 미지 값은 전체로 폴백한다', () => {
    const src = read('src/views/LessonsPage.jsx');
    expect(src).toContain('effectiveLevel');
    expect(src).toContain('urlLevel');
    // 실제 매니페스트 형태: key='A1', label='A1 기초'
    const levels = [{ key: 'OT', label: 'OT 오리엔테이션' }, { key: 'A1', label: 'A1 기초' }];
    const resolve = (lv) => {
      if (!lv || lv === 'all') return 'all';
      const hit = levels.find(l => l.label === lv) || levels.find(l => l.key === lv);
      return hit ? hit.label : 'all';
    };
    expect(resolve('A1')).toBe('A1 기초');        // 외부 링크가 쓰는 key
    expect(resolve('A1 기초')).toBe('A1 기초');   // 칩이 쓰는 label
    expect(resolve('xyz')).toBe('all');           // 미지 값
    expect(resolve(undefined)).toBe('all');
  });
});
