import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_DESCRIPTION } from '../seo.js';

// 발매 점검 다음 묶음 ③-2 · ③-3(오너 승인 2026-11-07 KST — 목업 CrsGiHf5bS4tmQk3n2HVBx 권장 A).
const read = (p) => readFileSync(p, 'utf8');

describe('③-2 404 · 오류 화면 문구(copy-standard §1 · §2)', () => {
  it('404는 HTTP 번호 없이 탭 제목과 같은 말', () => {
    const src = read('src/app/not-found.jsx');
    expect(src).toContain("title: '페이지를 찾을 수 없어요'");
    expect(src).toMatch(/<h1[^>]*>페이지를 찾을 수 없어요<\/h1>/);
    expect(src).toContain('주소가 바뀌었거나 지워진 페이지예요. 아래에서 다시 시작해 주세요.');
    expect(src).not.toMatch(/>\s*404\s*</);
    expect(src).not.toMatch(/길을 잃으셨군요|학습해보세요/);
  });
  it('화면 오류: 원인 모를 때만 「도움말」 단추 · 오류 ID를 알릴 곳을 말한다', () => {
    const src = read('src/app/error.jsx');
    expect(src).toContain("'잠시 후 다시 시도해 주세요. 계속되면 도움말에서 아래 오류 ID와 함께 알려 주세요.'");
    expect(src).toMatch(/\{!isNetwork && \(\s*<Link href="\/help" className="btn btn--ghost btn--md">\s*도움말\s*<\/Link>/);
  });
  it('앱 전체 오류도 표준 제목 · 설명', () => {
    const src = read('src/app/global-error.jsx');
    expect(src).toContain('>문제가 발생했어요</h1>');
    expect(src).toContain('잠시 후 다시 시도해 주세요. 문제가 계속되면 아래 오류 ID를 알려 주세요.');
    expect(src).not.toContain('앱이 예상치 못한 오류로 중단됐어요');
  });
});

describe('③-3 설치 앱 매니페스트 — 설명 · 바로가기 · 설치 창 그림', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  it('설명은 사이트 설명의 첫 문장과 같은 말', () => {
    expect(SITE_DESCRIPTION.startsWith(`${m.description}.`)).toBe(true);
  });
  it('바로가기 3 — 오늘 학습 · 단어장 · 내 서재, 있는 화면 · 앱 아이콘', () => {
    expect(m.shortcuts.map(s => [s.name, s.url])).toEqual([['오늘 학습', '/study'], ['단어장', '/vocab'], ['내 서재', '/materials']]);
    for (const s of m.shortcuts) {
      expect(existsSync(`src/app/(app)${s.url}/page.jsx`), s.url).toBe(true);
      expect(s.icons).toEqual([{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }]);
    }
  });
  it('설치 창 그림 2 — 폰(narrow) · PC(wide), 적은 크기 = 실제 PNG 크기', () => {
    expect(m.screenshots.map(s => s.form_factor)).toEqual(['narrow', 'wide']);
    for (const s of m.screenshots) {
      const buf = readFileSync(`public${s.src}`);
      expect(buf.subarray(1, 4).toString('latin1'), s.src).toBe('PNG');
      expect(`${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`, s.src).toBe(s.sizes);
      expect(s.type).toBe('image/png');
      expect(s.label).toMatch(/^배움 — /);
    }
  });
});
