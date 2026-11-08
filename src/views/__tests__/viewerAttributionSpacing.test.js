import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 출처 줄은 「출처:」 뒤를 한 칸 띄운다(2026-11-09 KST). 유튜브 줄만 `{vt("출처:")}{at.channel}`로 붙어
 * 「출처:Comprehensible Japanese」로 그려졌다(SOURCE-ATTR-WEB-001 목업 실제 빌드 캡처에서 발견). 아오조라 · Standard Ebooks ·
 * 위키문헌 · 퍼블릭 도메인 사이트 · 작품 카드 줄은 모두 띄어 쓴다.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('출처 줄 — 「출처:」 뒤 한 칸', () => {
  for (const file of ['src/views/ViewerPage.jsx', 'src/components/viewer/ViewerArtCard.jsx']) {
    it(`${file}: 「출처:」 바로 뒤에 다른 표현식이 붙지 않는다`, () => {
      const src = read(file);
      const lines = [...src.matchAll(/\{vt\(["']출처:["']\)\}(.)/g)];
      expect(lines.length).toBeGreaterThan(0);
      for (const [whole, after] of lines) expect(after, whole).toBe(' ');
    });
  }
});
