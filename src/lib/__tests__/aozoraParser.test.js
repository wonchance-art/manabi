import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  aozoraDocumentToPlainText,
  parseAozoraText,
  parseAozoraXhtml,
  validateAozoraDocument,
} from '../aozoraParser.js';

const fixture = (name) => readFileSync(
  fileURLToPath(new URL(`./fixtures/aozora/${name}`, import.meta.url)),
  'utf8',
);

describe('parseAozoraText', () => {
  it('keeps headings, explicit and implicit ruby, notes, gaiji, and colophon apart', () => {
    const document = parseAozoraText(fixture('minimal.txt'), { title: '試験作品', author: '試験作者' });

    expect(document.title).toBe('試験作品');
    expect(document.blocks.map((block) => block.type)).toEqual(['heading', 'paragraph', 'heading', 'paragraph']);
    expect(document.blocks[1].children).toContainEqual({ type: 'ruby', base: '先生', reading: 'せんせい' });
    expect(document.blocks[3].children).toContainEqual({ type: 'ruby', base: '明日', reading: 'あした' });
    expect(document.notes).toEqual([{ type: 'editorial-note', description: 'ここから２字下げ' }]);
    expect(document.gaiji).toEqual([{ type: 'gaiji', description: '「魚へんに花」、外字', status: 'unresolved' }]);
    expect(document.colophon).toEqual({ sourceBook: '架空の底本', inputter: '入力者', proofreader: '校正者' });
    expect(aozoraDocumentToPlainText(document)).not.toContain('底本');
    expect(aozoraDocumentToPlainText(document)).toContain('私は先生と東京へ行った。');
    expect(aozoraDocumentToPlainText(document)).toContain('〓［「魚へんに花」、外字］');
  });

  it('normalizes line endings and returns deterministic immutable output', () => {
    const source = '第一章\r\n｜先生《せんせい》。\r\n';
    const first = parseAozoraText(source);
    const second = parseAozoraText(source);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.blocks[0].children)).toBe(true);
    expect(() => { first.blocks.push({}); }).toThrow();
  });

  it('reports malformed ruby instead of silently dropping its markers', () => {
    const document = parseAozoraText('｜壊れた《ルビ');
    expect(document.warnings).toEqual([{ code: 'MALFORMED_RUBY', source: '｜壊れた《ルビ' }]);
    expect(aozoraDocumentToPlainText(document)).toBe('｜壊れた《ルビ');
  });
});

describe('parseAozoraXhtml', () => {
  it('preserves rt readings instead of flattening them like generic EPUB text', () => {
    const document = parseAozoraXhtml(fixture('minimal.xhtml'));

    expect(document.blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    expect(document.blocks[1].children).toContainEqual({ type: 'ruby', base: '先生', reading: 'せんせい' });
    expect(document.blocks[2].children).toContainEqual({ type: 'ruby', base: '明日', reading: 'あした' });
    expect(aozoraDocumentToPlainText(document)).toBe('第一章\n\n私は先生と東京へ行った。\n\n明日も読む。');
  });
});

describe('validateAozoraDocument', () => {
  it('accepts parser output and fails closed for unknown structures', () => {
    expect(validateAozoraDocument(parseAozoraText('本文'))).toBe(true);
    expect(() => validateAozoraDocument({ schemaVersion: 1, format: 'pdf', blocks: [], notes: [], gaiji: [], warnings: [] }))
      .toThrow('Unsupported Aozora document format');
    expect(() => parseAozoraText(null)).toThrow('Aozora text source must be a string');
  });
});
