/**
 * 정본 읽기 색인 생성기 겸 신선도 계약 — ja (분석기 리뷰 라운드 4, #1077 5502565922).
 *
 * ── 왜 필요한가
 * 정본 조회(`refVocabLookup`)는 표제어 키만 안다. 가나 전용 텍스트(N5 교재의 첫 텍스트)에서
 * 「がくせい」는 표제어 学生과 못 만나고, kuromoji는 がく+せい로 조각낸다(코퍼스 799문장 실측:
 * 내용어 정본 적중 47.6%). 정본 항목마다 `yomi`가 있다 — 그 읽기로 색인을 만들면 문절 덮임이
 * 43% → 69.5%로 오른다(실측). 콘텐츠 재사용이지 새 사전이 아니다.
 *
 * ── 왜 생성 JSON인가
 * 서버 분석기(`/api/analyze`)가 콘텐츠 트리 전체(어휘 7,299항)를 지고 다니면 콜드스타트·번들이
 * 커진다. 부채 ① R2의 `drillRefs.json`과 같은 선례 — 시험에서 만들고 신선도를 CI가 지킨다.
 *
 * 재생성:  UPDATE_JA_YOMI_INDEX=1 npx vitest run src/lib/__tests__/jaYomiIndexBuild.test.js
 *
 * ── 색인 형식
 * { [yomi]: [[main, level, cls], ...] } — 후보는 급수 오름차순(N5가 앞). cls = n·v·a·na·d·x.
 * 2자 이상 가나만 싣는다(1자는 조각 위험 — 분절기가 애초에 2자 이상만 머리로 본다).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT = path.join(fileURLToPath(new URL('../data/', import.meta.url)), 'jaYomiIndex.json');
const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];
const KANA = /^[ぁ-ゖー]+$/;
const k2h = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export function posClass(pos) {
  const p = String(pos || '');
  if (/な형용사|형용동사/.test(p)) return 'na';
  if (/い형용사|형용사/.test(p)) return 'a';
  if (/동사/.test(p)) return 'v';
  if (/부사/.test(p)) return 'd';
  if (/명사|대명사|고유/.test(p)) return 'n';
  return 'x';
}

export function normalizeYomi(yomi) {
  const y = k2h(String(yomi || '')).replace(/[（(][^）)]*[）)]/g, '').split(/[;；/／、]/)[0].replace(/[\s　]/g, '');
  return y;
}

export async function buildJaYomiIndex() {
  const mod = await import('../../content/japanese/index.js');
  const idx = new Map();
  for (const m of mod.JA_LEVEL_META || []) {
    const vocab = mod.getVocab(m.key);
    if (!vocab) continue;
    for (const theme of vocab.themes || []) {
      for (const w of theme.words || []) {
        const y = normalizeYomi(w.yomi);
        if (!y || y.length < 2 || !KANA.test(y)) continue;
        const main = String(w.ja || '').split(/[;；]/)[0].trim();
        if (!main) continue;
        if (!idx.has(y)) idx.set(y, []);
        const arr = idx.get(y);
        if (!arr.some((e) => e[0] === main)) arr.push([main, m.key, posClass(w.pos)]);
      }
    }
  }
  const rank = (lv) => { const i = LEVEL_ORDER.indexOf(lv); return i < 0 ? LEVEL_ORDER.length : i; };
  const out = {};
  for (const key of [...idx.keys()].sort()) out[key] = [...idx.get(key)].sort((a, b) => rank(a[1]) - rank(b[1]));
  return out;
}

describe('정본 읽기 색인 — ja (라운드 4)', () => {
  it('산출물이 콘텐츠와 맞는다 (낡으면 여기서 잡힌다)', async () => {
    const built = `${JSON.stringify(await buildJaYomiIndex())}\n`;
    if (process.env.UPDATE_JA_YOMI_INDEX) { writeFileSync(OUTPUT, built, 'utf8'); return; }
    expect(built).toBe(readFileSync(OUTPUT, 'utf8'));
  }, 120000);

  it('형식 — 2자 이상 가나 키, 후보는 급수 오름차순, 학生은 がくせい로 찾힌다', async () => {
    const idx = await buildJaYomiIndex();
    expect(Object.keys(idx).length).toBeGreaterThan(5000);
    for (const [k, v] of Object.entries(idx).slice(0, 500)) { expect(k.length).toBeGreaterThanOrEqual(2); expect(KANA.test(k)).toBe(true); expect(v.length).toBeGreaterThan(0); }
    expect(idx['がくせい']?.[0]?.[0]).toBe('学生');
    expect(idx['せんせい']?.[0]).toEqual(['先生', 'N5', 'n']);   // 専制(N2)보다 앞
    expect(idx['くるま']?.[0]?.[2]).toBe('n');
  }, 120000);
});
