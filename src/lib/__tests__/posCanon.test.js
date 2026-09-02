import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { POS_CANON, POS_CANON_ALL, isCanonPos, canonPosOrNull, filterCanonPosParts, canonizeTokenPos } from '../server/posCanon';
import { buildPromotedEntry } from '../server/promoteDictCorrection';
import { buildTokenizationPrompt } from '../gemini';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/**
 * 계약: X 품사 정본 게이트 (별건, 오너 지시 2026-09-02 — #1077 5504885559).
 * 네 언어 각각, 정본 밖 문자열로 온 pos·all·meanings[].pos가 어느 테이블에도 쓰이지 않는다.
 * 정본 밖 pos를 받은 토큰은 pos: null로 살아남는다. 영어 fail-closed는 한 바이트도 안 바뀐다.
 */
describe('정본 집합 — 현재 코드가 생산하는 값에서 뽑았다(추측 금지)', () => {
  const values = (src, anchorStart, anchorEnd) => new Set([...sliceBetween(src, anchorStart, anchorEnd).matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]));

  it('zh = tokenizeZh POS_KO 값 전부', () => {
    const src = read('src/lib/server/tokenizeZh.js');
    const koValues = values(src, 'const POS_KO = {', '};');
    expect([...koValues].sort()).toEqual([...POS_CANON.Chinese].sort());
    expect(POS_CANON.Chinese.size).toBe(37);
  });

  it('ja = tokenizeJa POS_MAP 값 전부', () => {
    const src = read('src/lib/server/tokenizeJa.js');
    const mapValues = values(src, 'const POS_MAP = {', '};');
    expect([...mapValues].sort()).toEqual([...POS_CANON.Japanese].sort());
    expect(POS_CANON.Japanese.size).toBe(14);
  });

  it('en = fetchMeanings ENGLISH_POS 그대로(행 단위 fail-closed 불변), fr = en + 기호', () => {
    const src = read('src/lib/server/fetchMeanings.js');
    const en = new Set([...sliceBetween(src, 'const ENGLISH_POS = new Set([', ']);').matchAll(/'([^']+)'/g)].map((m) => m[1]));
    expect([...en].sort()).toEqual([...POS_CANON.English].sort());
    expect([...POS_CANON.French].sort()).toEqual([...en, '기호'].sort());
    // 영어 fail-closed 블록 그대로
    expect(src).toContain("enPosCandidates.some((pos) => !ENGLISH_POS.has(pos))");
    expect(src).toContain('if (invalidMeaning || missingCandidate) return;');
  });

  it('판정 — 조각 전부가 집합 안이어야 참, 빈 값 거짓, 언어 미지면 합집합', () => {
    expect(isCanonPos('Chinese', '동사·명사')).toBe(true);
    expect(isCanonPos('Chinese', '동사·喝咖啡')).toBe(false);
    expect(isCanonPos('Chinese', '')).toBe(false);
    expect(isCanonPos('Chinese', null)).toBe(false);
    expect(isCanonPos('French', 'boire')).toBe(false);
    expect(isCanonPos('French', '관사')).toBe(true);
    expect(isCanonPos('Japanese', '形容動詞')).toBe(false);
    expect(isCanonPos('Japanese', '형용동사')).toBe(true);
    expect(isCanonPos('English', '수량사')).toBe(false); // zh 전용 값은 영어에서 거짓
    expect(isCanonPos(null, '수량사')).toBe(true);       // 합집합
    expect(POS_CANON_ALL.has('喝咖啡')).toBe(false);
    expect(canonPosOrNull('Chinese', ' 동사 · 명사 ')).toBe('동사·명사');
    expect(canonPosOrNull('Chinese', '동사·喝咖啡')).toBeNull();
    expect(filterCanonPosParts('Chinese', ['동사', '喝咖啡', '명사'])).toEqual(['동사', '명사']);
  });

  it('토큰 게이트 — 정본 밖 pos는 null로 살아남고(토큰 삭제 아님), 정본이면 같은 객체', () => {
    const bad = { text: 'boire', pos: 'boire', meaning: '마시다' };
    expect(canonizeTokenPos(bad, 'French')).toEqual({ text: 'boire', pos: null, meaning: '마시다' });
    const good = { text: 'boire', pos: '동사', meaning: '마시다' };
    expect(canonizeTokenPos(good, 'French')).toBe(good);
    const empty = { text: '.', pos: '' };
    expect(canonizeTokenPos(empty, 'French')).toBe(empty);
  });
});

describe('구멍 셋에 같은 게이트', () => {
  it('① 프랑스어 전용 프롬프트에 품사 열거가 있고, 복사 직전 canonizeTokenPos를 탄다', () => {
    const fr = buildTokenizationPrompt('Je bois.', 'French');
    for (const p of POS_CANON.French) expect(fr).toContain(`"${p}"`);
    expect(fr).toContain('이 목록 밖의 값 금지');
    expect(fr).not.toContain('형태소 단위로 분석'); // 일본어 프롬프트 폴백 아님
    expect(buildTokenizationPrompt('x', 'Japanese')).toContain('형태소 단위로 분석');
    const at = read('src/lib/analyzeText.js');
    expect(at).toContain("import { canonizeTokenPos } from './server/posCanon';");
    expect(at).toContain('currentJson.dictionary[newId] = canonizeTokenPos(res.payload.dictionary[oldId], lang);');
    expect(at).not.toContain('currentJson.dictionary[newId] = res.payload.dictionary[oldId];');
  });

  it('② zh 문맥 판별 후보 all을 정본으로 거른 뒤 pos∈all 검사', () => {
    const src = read('src/lib/server/disambiguateZhPos.js');
    expect(src).toContain("import { isCanonPos } from './posCanon';");
    expect(src).toContain(".map((p) => p.trim().slice(0, 20)).filter((p) => isCanonPos('Chinese', p)).slice(0, 4)");
    expect(src).toContain('if (!pos || !all.includes(pos)) return;');
  });

  it('③ 뜻별 pos는 언어 무관 게이트(정본 밖이면 그 pos만 떼고 뜻은 저장) · ④ zh 상위 pos도 게이트', () => {
    const src = read('src/lib/server/fetchMeanings.js');
    expect(src).toContain("...(m?.pos && typeof m.pos === 'string' && isCanonPos(language, m.pos) ? { pos: String(m.pos).trim().slice(0, 20) } : {}),");
    expect(src).toContain("(isCanonPos('Chinese', entry.pos) ? String(entry.pos).slice(0, 30) : source.pos)");
  });

  it('승격 — 정본 밖 pos를 받아도 뜻·발음 승격은 진행되고 pos는 기존값 유지; 라우트는 language를 넘긴다', () => {
    const existing = { pos: '동사', reading: 'hē', meanings: [{ meaning: '마시다', priority: 1 }] };
    const out = buildPromotedEntry(existing, { meaning: '들이켜다', furigana: 'hē', pos: '喝咖啡' }, 'Chinese');
    expect(out.pos).toBe('동사');
    expect(out.meanings[0]).toEqual({ meaning: '들이켜다', priority: 1 });
    expect(out.source).toBe('user_verified');
    const ok = buildPromotedEntry(existing, { meaning: '들이켜다', pos: '명사' }, 'Chinese');
    expect(ok.pos).toBe('명사·동사');
    expect(read('src/app/api/dict-correct/route.js')).toContain('buildPromotedEntry(existing, corrections, language)');
  });

  it('2차 방어 — TokenPosLabel이 합집합 정본으로 조각을 거른다', () => {
    const src = read('src/views/TokenPosLabel.jsx');
    expect(src).toContain("import { isCanonPos } from '../lib/server/posCanon';");
    expect(src).toContain("const pos = isCanonPos(null, token?.pos) ? token.pos : '';");
    expect(src).toContain('.filter((s) => isCanonPos(null, s))');
  });
});

describe('정합 SQL — 코드로만, 정규식은 정본 집합에서 재생성한 값과 같다', () => {
  const sql = read('supabase/migrations/20260902120000_pos_canon_cleanup.sql');
  const re = (set) => { const alt = [...set].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'); return `^(${alt})(·(${alt}))*$`; };

  it('언어별 UPDATE(비 user_verified만)·user_verified 목록 SELECT, DDL 없음', () => {
    for (const lang of ['Chinese', 'Japanese', 'English', 'French']) {
      expect(sql).toContain(`UPDATE morpheme_dictionary SET pos = NULL\n WHERE language = '${lang}' AND source <> 'user_verified' AND pos IS NOT NULL AND pos !~ '${re(POS_CANON[lang])}';`);
      expect(sql).toContain(`WHERE language = '${lang}' AND source = 'user_verified' AND pos IS NOT NULL AND pos !~ '${re(POS_CANON[lang])}';`);
    }
    expect(sql).not.toMatch(/ALTER TABLE|CREATE TABLE|DROP /i);
    expect(sql).not.toMatch(/UPDATE[^;]*user_verified'[^;]*SET/); // user_verified를 고치는 UPDATE 없음
  });
});
