import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween.js';

// WALL-STATES-001 ⑨: 인증 메일 제목은 Supabase 대시보드에만 저장된다. 저장소 정본은
// docs/auth-email-links.md 「한국어 템플릿」 표이고, 이 계약이 템플릿 파일과 표를 양방향으로 맞춘다 —
// 템플릿을 하나 더하고 제목 줄을 빠뜨리면(또는 표에만 남은 유령 줄이 있으면) 여기서 막힌다.
// (authEmailTemplates.test.js는 알려진 5종의 내용 계약 — 이 파일은 「디렉터리 전체에 제목이 있다」만 본다.)
const DOC = readFileSync('docs/auth-email-links.md', 'utf8');
const TABLE = sliceBetween(DOC, '| 템플릿 | 파일 | 제목(Subject) |', '\n\n');
const ROWS = [...TABLE.matchAll(/^\| ([^|]+?) \| `supabase\/templates\/([^`]+)` \| ([^|]*?) \|$/gm)]
  .map(([, template, file, subject]) => ({ template: template.trim(), file, subject: subject.trim() }));
const FILES = readdirSync('supabase/templates').filter(name => name.endsWith('.html')).sort();

describe('인증 메일 제목 — 저장소 정본(문서 표)', () => {
  it('표를 읽었다(공허 통과 방지)', () => {
    expect(FILES.length).toBeGreaterThan(0);
    expect(ROWS.length).toBe(FILES.length);
  });

  it('supabase/templates의 모든 템플릿에 제목 줄이 있다', () => {
    const documented = new Set(ROWS.map(row => row.file));
    for (const file of FILES) expect(documented.has(file), `${file}의 제목이 docs/auth-email-links.md 표에 없다`).toBe(true);
  });

  it('표의 모든 줄이 실제 템플릿 파일을 가리키고, 제목·대시보드 이름이 비어 있지 않다', () => {
    const files = new Set(FILES);
    const seen = new Set();
    for (const row of ROWS) {
      expect(files.has(row.file), `${row.file}이(가) supabase/templates에 없다`).toBe(true);
      expect(seen.has(row.file), `${row.file} 줄이 두 번 있다`).toBe(false);
      seen.add(row.file);
      expect(row.template).not.toBe('');
      expect(row.subject).not.toBe('');
      expect(row.subject).not.toContain('[manabi]');
    }
  });
});
