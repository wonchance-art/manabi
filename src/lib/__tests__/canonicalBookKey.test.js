import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import aozora from '../../content/literature/aozora/manifest.generated.json';
import standardEbooks from '../../content/literature/standardebooks/manifest.generated.json';
import { artBookKey, artBooks } from '../artBook';
import { makeBookKey } from '../bookMeta';
import { isCanonicalBookKey } from '../canonicalBookKey';

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

describe('정본 책 key 판정(isCanonicalBookKey)', () => {
  it('대조표 · 그림 책의 모든 key를 정본으로 본다', () => {
    const keys = [...Object.keys(aozora.works), ...Object.keys(standardEbooks.works), ...artBooks().map(({ book }) => book.key), artBookKey('x')];
    expect(keys.length).toBeGreaterThan(30);
    expect(keys.filter((key) => !isCanonicalBookKey(key))).toEqual([]);
  });
  it('사용자 책 key(bk_)와 빈 값은 정본이 아니다', () => {
    for (let i = 0; i < 20; i++) expect(isCanonicalBookKey(makeBookKey())).toBe(false);
    for (const key of [null, undefined, '', 42, 'bk_aozora-1']) expect(isCanonicalBookKey(key)).toBe(false);
  });
  it('서재 두 입구가 같은 판정으로 이어 적기 · 과 추가 · 과 번호 수정을 막는다', () => {
    expect(read('src/views/MaterialsPage.jsx')).toContain(') : !isCanonicalBookKey(b.key) && b.chapters[0]?.owner_id === user.id ? (');
    const chapters = read('src/components/library/LibraryBookChapters.jsx');
    expect(chapters).toContain('const locked=isCanonicalBookKey(row.target_id)');
    expect(chapters).toMatch(/!locked&&expanded&&query\.isSuccess&&<button ref=\{addButton\}/);
    expect(chapters).toMatch(/!locked&&chapter\.order!=null&&<button/);
  });
});
