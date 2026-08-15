import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildPromotedEntry } from '../promoteDictCorrection.js';

// 계약: 교정의 사전 승격 — 교정 뜻은 선두(priority 1), 기존 뜻은 중복 제거 후 뒤로,
// source는 반드시 user_verified(자가 치유·재조회 로직이 이 마크를 보호 근거로 쓴다).

describe('buildPromotedEntry — 승격 행 구성', () => {
  const existing = {
    pos: '동사·명사',
    reading: 'gōngzuò',
    meanings: [
      { meaning: '일하다', priority: 1, pos: '동사' },
      { meaning: '일, 직업', priority: 2, pos: '명사' },
    ],
  };

  it('교정 뜻이 선두로, 기존 뜻은 중복 제거 후 우선순위를 밀어 유지한다', () => {
    const entry = buildPromotedEntry(existing, { meaning: '근무하다', pos: '동사' });
    expect(entry.meanings).toEqual([
      { meaning: '근무하다', priority: 1, pos: '동사' },
      { meaning: '일하다', priority: 2, pos: '동사' },
      { meaning: '일, 직업', priority: 3, pos: '명사' },
    ]);
    expect(entry.source).toBe('user_verified');
  });

  it('교정 뜻이 기존과 같으면 중복 없이 선두 확정만 한다', () => {
    const entry = buildPromotedEntry(existing, { meaning: '일, 직업', pos: '명사' });
    expect(entry.meanings.map((m) => m.meaning)).toEqual(['일, 직업', '일하다']);
    expect(entry.meanings[0].pos).toBe('명사');
  });

  it('발음 교정은 reading을 바꾸고, 없으면 기존 유지', () => {
    expect(buildPromotedEntry(existing, { furigana: 'gōng zuò' }).reading).toBe('gōng zuò');
    expect(buildPromotedEntry(existing, { meaning: '근무' }).reading).toBe('gōngzuò');
  });

  it('교정 pos는 기존 다중 후보의 선두로 합류한다(중복 없이)', () => {
    expect(buildPromotedEntry(existing, { meaning: '일', pos: '명사' }).pos).toBe('명사·동사');
    expect(buildPromotedEntry(existing, { meaning: '일하다', pos: '동사' }).pos).toBe('동사·명사');
  });

  it('미등재 단어는 교정 뜻만으로 새 행을 만든다', () => {
    const entry = buildPromotedEntry(null, { meaning: '붓', pos: '명사', furigana: 'bǐ' });
    expect(entry).toEqual({
      pos: '명사',
      reading: 'bǐ',
      meanings: [{ meaning: '붓', priority: 1, pos: '명사' }],
      source: 'user_verified',
    });
  });

  it('뜻이 전혀 없으면 null — 발음만으로는 사전 행이 성립하지 않는다', () => {
    expect(buildPromotedEntry(null, { furigana: 'bǐ' })).toBeNull();
  });
});

// 계약: 승격 경로 배선 — 편집 패널의 전역 적용 체크가 API·단어장 동기로 이어져야 한다.
describe('전역 적용 배선 계약', () => {
  it('편집 패널이 applyGlobal 옵션을 전달한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/TokenEditPanel.jsx'), 'utf8');
    expect(src).toContain("onSave(corrections, { applyGlobal })");
  });

  it('뷰어가 승격 API와 단어장 동기를 호출한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toContain("fetch('/api/dict-correct'");
    expect(src).toContain(".from('user_vocabulary').update(patch)");
  });

  it('승격 API는 user_verified로만 upsert한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/dict-correct/route.js'), 'utf8');
    expect(src).toContain('buildPromotedEntry');
    const lib = fs.readFileSync(path.join(process.cwd(), 'src/lib/server/promoteDictCorrection.js'), 'utf8');
    expect(lib).toContain("source: 'user_verified'");
  });
});
