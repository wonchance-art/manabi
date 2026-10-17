// 과 본문 기억(BOOKS-FLOW-001) — 교재 과를 오갈 때(다음 과 → 뒤로 · 다른 화면에서 뒤로) 같은 과를 다시 받지 않는다.
// 공개 판본 본문은 판본 id + 과가 정하는 고정 출력물이고 사용자 값이 없다(bookReadingCache.test.js). 미리보기(미발행)는 기억하지 않는다.
// 계약 = 기억 규칙(순수) + 배선. 실제 요청 수 · 빈 화면은 빌드 Playwright가 본다.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { forgetUnits, rememberUnit, rememberedUnit } from '../../components/books/unitMemory';

const reader = fs.readFileSync(path.join(process.cwd(), 'src/components/books/BookReader.jsx'), 'utf8');

describe('기억 규칙 — 최근 과 8개', () => {
  beforeEach(() => forgetUnits());
  it('같은 키면 같은 본문, 없으면 null', () => {
    const sections = [{ id: 'u01-start', unit: 'u01', html: '<p>a</p>' }];
    rememberUnit('japanese-n5:e1:u01', sections);
    expect(rememberedUnit('japanese-n5:e1:u01')).toBe(sections);
    expect(rememberedUnit('japanese-n5:e2:u01')).toBeNull(); // 다른 판본
    expect(rememberedUnit('japanese-n4:e1:u01')).toBeNull(); // 다른 교재
  });
  it('9번째부터 가장 오래 쓰지 않은 과를 버린다 — 꺼내 쓴 과는 최근으로', () => {
    for (let i = 1; i <= 8; i++) rememberUnit(`b:e:u0${i}`, [i]);
    expect(rememberedUnit('b:e:u01')).toEqual([1]); // u01을 최근으로
    rememberUnit('b:e:u09', [9]);
    expect(rememberedUnit('b:e:u02')).toBeNull(); // 가장 오래된 u02가 빠진다
    expect(rememberedUnit('b:e:u01')).toEqual([1]);
    expect(rememberedUnit('b:e:u09')).toEqual([9]);
  });
});

describe('배선 — BookReader 본문 받기', () => {
  const load = sliceBetween(reader, 'const controller = new AbortController();', 'return () => controller.abort();\n  }, [bookId, book.edition, unit, preview]);');
  it('기억한 과는 받지 않고 바로 그린다(빈 본문을 거치지 않는다) — 미리보기는 기억을 쓰지 않는다', () => {
    expect(load).toContain("const memoryKey = `${bookId}:${book.edition}:${unit}`, remembered = preview ? null : rememberedUnit(memoryKey);");
    expect(load).toContain('if (remembered) { setSections(remembered); setLoading(false); return () => controller.abort(); }');
    expect(load.indexOf('if (remembered)')).toBeLessThan(load.indexOf('setSections([]); setLoading(true);'));
    expect(load.indexOf('if (remembered)')).toBeLessThan(load.indexOf('fetch('));
  });
  it('받은 본문은 공개 판본일 때만 기억한다', () => {
    expect(load).toContain('.then(data => { if (!preview) rememberUnit(memoryKey, data.sections); setSections(data.sections); setLoading(false); })');
  });
  it('표지로 가면 본문을 비운다(지난 과가 남지 않게)', () => {
    expect(load).toContain("if (!unit || unit === 'cover') { setSections([]); setLoading(false); return () => controller.abort(); }");
  });
});
