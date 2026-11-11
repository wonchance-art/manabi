import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tokenizeZhLine } from '../tokenizeZh';
import { inconsistentZhReadings, summarizeZhPinyinChecks, verifyZhSyllables, zhPinyinCandidates } from '../zhPinyinVerify';

/**
 * 계약: 중국어 병음 검증 패스 (ZH-PINYIN-CHECK — 오너 지시 2026-11-11 KST 「중국어 분석 후 병음 맞는지 다시 확인하는 절차」).
 *   ① 줄 문맥 오독은 사전 둘(CC-CEDICT · 낱말 단독 pinyin-pro)이 합의할 때만 고친다 — 회귀 표.
 *   ② 둘 다 어긋나면 값은 그대로 두고 표식만(관측) — 화면 · 저장 모양 변화 0.
 *   ③ 규칙 버그 3건(V着 · 2자 명사 …地 · 为 결과 보어).
 *   ④ 「음절 수 = 글자 수」 불변식 · 정답 대조 어긋남 수 상한(유형별 기록).
 *   ⑤ 검증표는 서버 전용 — 클라이언트 번들 밖.
 */
const HAN = /[一-鿿]/;
const LAT = /[A-Za-z0-9０-９]/;
/** 교재 정답 병음 문장 — zhCorpusPinyin.test.js의 collectZhCorpus와 같은 걸음(테스트 파일끼리 가져오면 그 describe가 함께 돈다). */
async function collectZhCorpus() {
  const mod = await import('../../../content/chinese/index.js');
  const seen = new Set(); const rows = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node.zh === 'string' && typeof node.pinyin === 'string' && HAN.test(node.zh)) rows.push({ zh: node.zh, pinyin: node.pinyin });
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
  };
  for (const ch of mod.ALL_CHAPTERS || []) walk(ch);
  for (const m of mod.ZH_LEVEL_META || []) { walk(mod.getBunkei(m.key)); walk(mod.getVocab(m.key)); }
  const uniq = new Map();
  for (const r of rows) if (!LAT.test(r.zh) && !uniq.has(r.zh)) uniq.set(r.zh, r);
  return [...uniq.values()];
}
const reading = (line, word) => tokenizeZhLine(line).find((t) => t.text === word)?.furigana;

describe('① 줄 문맥 오독 — 사전 둘이 합의하면 고친다', () => {
  it('검증 함수: 후보 밖 줄 병음 + 단독 병음 ∈ 후보 → fixed', () => {
    expect(verifyZhSyllables('认为', ['rèn', 'wèi'])).toMatchObject({ verdict: 'fixed', syllables: ['rèn', 'wéi'] }); // 운영 id 372 21번 줄
    expect(verifyZhSyllables('力量', ['lì', 'liáng'])).toMatchObject({ verdict: 'fixed', syllables: ['lì', 'liàng'] }); // 운영 실측
    expect(verifyZhSyllables('相似', ['xiāng', 'shì'])).toMatchObject({ verdict: 'fixed', syllables: ['xiāng', 'sì'] }); // 운영 실측
    expect(verifyZhSyllables('认为', ['rèn', 'wéi']).verdict).toBe('ok');
    expect(verifyZhSyllables('力量', ['lì', 'liàng']).verdict).toBe('ok'); // 후보 lì liang(경성)과 단독 병음 일치 — 허용
  });
  it('검증 밖: 1자 · 一/不 포함 · 표에 없음 · 음절 수 불일치', () => {
    expect(verifyZhSyllables('为', ['wèi']).verdict).toBe('skip');
    expect(verifyZhSyllables('一起', ['yì', 'qǐ']).verdict).toBe('skip');
    expect(verifyZhSyllables('不同', ['bù', 'tóng']).verdict).toBe('skip');
    expect(verifyZhSyllables('伯里克', ['bó', 'lǐ', 'kè']).verdict).toBe('skip');
    expect(verifyZhSyllables('认为', ['rèn']).verdict).toBe('skip');
  });
  it('토크나이저 회귀 — 교재 정답 대조에서 고쳐진 줄 문맥 오독', () => {
    for (const [line, word, py] of [
      ['他去看中医治疗感冒。', '中医', 'zhōng yī'],
      ['我们的想法相同。', '相同', 'xiāng tóng'],
      ['这家公司非常注重创新。', '创新', 'chuàng xīn'],
      ['学校对作弊的学生进行了处罚。', '学校', 'xué xiào'],
      ['很多人参与了这次活动。', '参与', 'cān yù'],
      ['联合国秘书长发表了讲话。', '发表', 'fā biǎo'],
      ['火车沿着轨道行驶。', '行驶', 'xíng shǐ'],
      ['类似的问题层出不穷，必须从根本上解决。', '类似', 'lèi sì'],
    ]) expect(reading(line, word), line).toBe(py);
  });
  it('깨지지 않음 — 줄 문맥이 맞던 자리(분절 오류 낱말의 경성 · 옛 CEDICT 독음 · 지속상 着)', () => {
    expect(reading('高速公路上车很多。', '上车')).toBe('shang chē');
    expect(reading('文件下载还需要两分钟。', '下载')).toBe('xià zài');
    expect(reading('她穿着红色的衣服。', '穿着')).toBe('chuān zhe');
  });
});

describe('② 의심 표시 — 값은 그대로, 관측만', () => {
  it('둘 다 후보 밖이면 suspect, 줄 병음 그대로', () => {
    const r = verifyZhSyllables('学校', ['xué', 'jiāo']);
    expect(['suspect', 'fixed']).toContain(r.verdict);
    if (r.verdict === 'suspect') expect(r.syllables).toEqual(['xué', 'jiāo']);
  });
  it('표식은 열거되지 않는다 — 토큰 모양(저장 · 응답)이 그대로', () => {
    const toks = tokenizeZhLine('很多人参与了这次活动。');
    const t = toks.find((x) => x.text === '参与');
    expect(Object.keys(t).sort()).toEqual(Object.keys(tokenizeZhLine('我们参观。').find((x) => x.text === '参观')).sort());
    expect(JSON.stringify(t)).not.toContain('pinyinCheck');
  });
  it('요약: 같은 요청 안에서 같은 낱말이 다른 병음이면 inconsistent', () => {
    const lines = [[{ text: '认为', furigana: 'rèn wéi', pos: '동사' }], [{ text: '认为', furigana: 'rèn wèi', pos: '동사' }, { text: '一起', furigana: 'yì qǐ' }]];
    expect(inconsistentZhReadings(lines)).toEqual([{ word: '认为', readings: ['rèn wèi', 'rèn wéi'] }]);
    expect(summarizeZhPinyinChecks(lines)).toMatchObject({ fixed: 0, suspect: 0, inconsistent: [{ word: '认为' }] });
  });
});

describe('③ 규칙 버그 3건', () => {
  it('V着 병합 토큰 — 지속상 zhe(실단어 着急 · 穿着는 그대로)', () => {
    expect(reading('他打着伞走了。', '打着')).toBe('dǎ zhe');
    expect(reading('冬天大家围着火炉取暖。', '围着')).toBe('wéi zhe');
    expect(reading('他着急了。', '着急')).toBe('zháo jí');
  });
  it('2자 명사 …地 — 땅 dì(상황어 표지 de로 오발하지 않는다), 3자 이상 상황어는 그대로', () => {
    expect(reading('这是一片泽地。', '泽地')).toBe('zé dì');
    expect(reading('他恳切地请求大家原谅。', '恳切地')).toBe('kěn qiè de');
  });
  it('为 결과 보어 — 表现为 · 称 X 为 → wéi(为了 · 因为는 그대로)', () => {
    expect(reading('这种情绪常常表现为焦虑。', '为')).toBe('wéi');
    expect(reading('大家称他为老师。', '为')).toBe('wéi');
    expect(reading('他为了考试努力学习。', '为了')).toBe('wèi le');
  });
});

describe('④ 불변식 · 정답 대조 상한', () => {
  it('음절 수 = 글자 수 · 정답 대조 어긋남 수가 실측 상한을 넘지 않는다(유형별 기록)', async () => {
    const rows = await collectZhCorpus();
    const BARE = { ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü' };
    const bare = (s) => [...s].map((c) => BARE[c] ?? c).join('');
    const toned = (s) => [...s].some((c) => BARE[c]);
    const V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
    const syllabify = (w) => { const out = []; let i = 0; const n = w.length; while (i < n) { let j = i; while (j < n && !V.includes(w[j])) j++; let k = j; while (k < n && V.includes(w[k])) k++; let c = k; if (c < n && w[c] === 'n') { if (c + 1 < n && w[c + 1] === 'g' && (c + 2 >= n || !V.includes(w[c + 2]))) c += 2; else if (c + 1 >= n || !V.includes(w[c + 1])) c += 1; } else if (c < n && w[c] === 'r' && (c + 1 >= n || !V.includes(w[c + 1]))) c += 1; if (k === j) break; out.push(w.slice(i, c)); i = c; } return out; };
    const gold = (py) => py.normalize('NFC').toLowerCase().replace(/v/g, 'ü').replace(/[’'\-·,，。！？?!.:;：；"“”()（）…]/g, ' ').trim().split(/\s+/).filter(Boolean).flatMap(syllabify);
    const cat = { neutralMissing: 0, neutralExtra: 0, toneOnly: 0, yiBu: 0, other: 0 };
    let total = 0; let misaligned = 0;
    for (const r of rows) {
      const toks = tokenizeZhLine(r.zh).filter((t) => t.pos !== '기호' && HAN.test(t.text) && t.furigana);
      for (const t of toks) expect(t.furigana.split(' ').length, `${r.zh} ${t.text}`).toBe([...t.text].length);
      const got = toks.flatMap((t) => t.furigana.split(' '));
      const chars = toks.flatMap((t) => [...t.text]);
      const g = gold(r.pinyin);
      if (g.length !== got.length) { misaligned++; continue; }
      g.forEach((y, i) => {
        if (y === got[i]) return;
        total++;
        if ('一不'.includes(chars[i])) cat.yiBu++;
        else if (bare(y) === bare(got[i]) && !toned(y)) cat.neutralMissing++;   // 정답 경성 · 분석기 원조 — 경성 정책 차이
        else if (bare(y) === bare(got[i]) && !toned(got[i])) cat.neutralExtra++; // 분석기 경성 · 정답 원조 — 경성 정책 차이
        else if (bare(y) === bare(got[i])) cat.toneOnly++;
        else cat.other++;
      });
    }
    if (process.env.ZH_PINYIN_REPORT) writeFileSync(process.env.ZH_PINYIN_REPORT, `${JSON.stringify({ rows: rows.length, misaligned, total, cat }, null, 1)}\n`);
    // 실측(2026-11-11 KST, 이 검증 패스 · 규칙 3건 적용 뒤) — 늘면 실패. 경성 둘은 정책 차이(오류 아님)라 따로 센다.
    expect(total).toBeLessThanOrEqual(ZH_PINYIN_CAPS.total);
    expect(cat.toneOnly + cat.other).toBeLessThanOrEqual(ZH_PINYIN_CAPS.errors);
  }, 180000);
});

describe('⑤ 검증표는 서버 전용', () => {
  it('src/lib/server 밖에서 zhPinyinCheck.json · zhPinyinVerify · zhErhua(.json)를 가져오지 않는다', () => {
    const hits = [];
    const walk = (dir) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { if (!/node_modules|__tests__/.test(p)) walk(p); continue; }
        if (!/\.(m?jsx?|tsx?)$/.test(f) || p.startsWith(join('src', 'lib', 'server'))) continue;
        if (/zhPinyinCheck|zhPinyinVerify|zhErhua/.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    walk('src');
    expect(hits).toEqual([]);
    expect(zhPinyinCandidates('认为')).toEqual(['rèn wéi']);
  });
});

// 측정값(위 ④) — 갱신 절차: ZH_PINYIN_REPORT=<파일> npx vitest run src/lib/server/__tests__/zhPinyinVerify.test.js 로 실측을 보고 낮춘다.
// 2026-11-11 KST 교재 정답 16,644문장(정렬 16,446) — 적용 전(main 47f46b85) 672자(경성 누락 309 · 경성 과잉 98 · 성조만 109 · 一/不 44 · 그 밖 112)
//   → 적용 뒤 648자(308 · 98 · 101 · 44 · 97). 오류(성조만 + 그 밖) 221 → 198. 경성 둘은 정책 차이 — 상한 밖에서 따로 본다.
const ZH_PINYIN_CAPS = { total: 648, errors: 198 };
