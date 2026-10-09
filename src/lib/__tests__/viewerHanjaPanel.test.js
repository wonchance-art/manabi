import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { applyDueum } from '../hanjaKo.js';
import { loadRefVocabIndex } from '../refVocabIndex.js';
import {
  splitPinyinSyllables, samePinyin, koEumOf, sameHanjaWord, shortMeaning, selectSameHanjaTiles,
  hanjaPanelModel, panelSearchChar, soundPieceDrill, formatDrillSummary, loadHanjaPanelTable,
} from '../viewerHanjaPanel.js';

/**
 * 계약: 한자 창(팝오버) 데이터·순수 함수 — 뷰어 v2 AE-R4 PR ①(화면 변화 0).
 * 정본 VIEWER-V2-ROUNDS-001 §9 · 설계서 docs/manabi-viewer-v2-ae-r4.md §3·§7.2.
 *   ⑴ 머리: 간체 + 그 자리 병음 → 正 꼴 + 훈음, 형성자 역할이 확인된 글자만 훈 = 뜻 색 · 음 = 소리 색.
 *   ⑵ 구성: 정체 꼴로 찾는다(观의 又가 아니라 觀 = 見 + 雚), 역할 미상은 색 없이, 자료 없음은 숨김.
 *   ⑶ 같은 한자어 타일: 같은 병음만 · 지금 단어 제외 · 3개 이하 · 내 단어 → 이 자료 → HSK,
 *      한국 한자어 줄은 「정체 꼴 한국 한자음(+두음)이 뜻(ko)에 경계 규칙대로 들어 있음」 판정 통과분만.
 *   ⑷ 소리 조각 드릴다운: 같은 소리 조각 빈도순 5 + 대표 읽기 요약.
 */

const ROOT = process.cwd();
const readData = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/data', f), 'utf8'));
const koTable = readData('hanjaKo.json');
const hunTable = readData('hanjaHun.json');
const tradTable = readData('hanjaTrad.json');
const etym = readData('hanjaEtym.json');
const panel = readData('hanjaPanel.json');
const tables = { koTable, hunTable, tradTable, panel };
const byCodePoint = (a, b) => {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i].codePointAt(0) - y[i].codePointAt(0);
  return x.length - y.length;
};

let refIndex;
beforeAll(async () => {
  refIndex = await loadRefVocabIndex('Chinese');
}, 30000);

describe('병음 음절 — 런타임 pinyin-pro 없이 글자 수만큼 나눈다', () => {
  it('붙은 병음 · 띄운 병음 · 격음 부호', () => {
    expect(splitPinyinSyllables('cānguān', 2)).toEqual(['cān', 'guān']);
    expect(splitPinyinSyllables('cān guān', 2)).toEqual(['cān', 'guān']);
    expect(splitPinyinSyllables("Xī'ān", 2)).toEqual(['xī', 'ān']);
    expect(splitPinyinSyllables('guānzhòng', 2)).toEqual(['guān', 'zhòng']);
    expect(splitPinyinSyllables('yīnyuèhuì', 3)).toEqual(['yīn', 'yuè', 'huì']);
    expect(splitPinyinSyllables('lǜshī', 2)).toEqual(['lǜ', 'shī']);
  });
  it('격음 부호가 없으면 a·o·e 음절은 조각 머리에만(표준 표기) — 方案 fāng\'àn ≠ fāngàn', () => {
    expect(splitPinyinSyllables('fāngàn', 2)).toEqual(['fān', 'gàn']);
    expect(splitPinyinSyllables("fāng'àn", 2)).toEqual(['fāng', 'àn']);
    expect(splitPinyinSyllables('fǎnér', 2)).toEqual(['fǎn', 'ér']); // 격음 부호 누락 — 나누는 길이 하나뿐
  });
  it('儿화는 단어가 儿로 끝날 때만 끝 r을 한 음절로 뗀다(一会儿 yīhuìr)', () => {
    expect(splitPinyinSyllables('yīhuìr', 3, { erhua: true })).toEqual(['yī', 'huì', 'r']);
    expect(splitPinyinSyllables('yīhuìr', 3)).toBeNull(); // 儿로 끝나는 단어일 때만
  });
  it('나눌 수 없으면 null — 그 후보를 뺀다', () => {
    expect(splitPinyinSyllables('cānguān', 4)).toBeNull();
    expect(splitPinyinSyllables('shíèr', 3)).toBeNull();
    expect(splitPinyinSyllables('qwrt', 2)).toBeNull();
    expect(splitPinyinSyllables('', 2)).toBeNull();
    expect(splitPinyinSyllables('cān', 0)).toBeNull();
    expect(splitPinyinSyllables('참관', 2)).toBeNull();
  });
  it('우리 사전 병음은 거의 모두 글자 수만큼 나뉜다(실측 5,710/5,710 — 실패 0.5% 이하)', () => {
    const words = [...refIndex].filter(([zh]) => /^\p{Script=Han}{2,}$/u.test(zh));
    const fail = words.filter(([zh, e]) => !splitPinyinSyllables(e.word.pinyin, [...zh].length, { erhua: zh.endsWith('儿') }));
    expect(words.length).toBeGreaterThanOrEqual(5710);
    expect(fail.length / words.length).toBeLessThanOrEqual(0.005);
  });
  it('같은 병음은 성조 포함 완전 일치 — 一·不만 본래 성조 기준(변조 무시)', () => {
    expect(samePinyin('guān', 'guān', '观')).toBe(true);
    expect(samePinyin('guān', 'guàn', '观')).toBe(false);
    expect(samePinyin('Guān', 'guān', '观')).toBe(true);
    expect(samePinyin('yí', 'yī', '一')).toBe(true);
    expect(samePinyin('yì', 'yī', '一')).toBe(true);
    expect(samePinyin('bú', 'bù', '不')).toBe(true);
    expect(samePinyin('lè', 'yuè', '乐')).toBe(false);
    expect(samePinyin('lǜ', 'lv̀', '绿')).toBe(true);
  });
});

describe('같은 한자어 판정 — 정체 꼴 한국 한자음(+두음)이 뜻에 경계 규칙대로 들어 있음', () => {
  it('정체 꼴로 찾는다(技术 → 기술, 간체 그대로면 기출) · 어두 두음(旅行 → 여행)', () => {
    expect(koEumOf('技术', tables)).toEqual({ eum: '기술', sylls: ['기', '술'] });
    expect(koEumOf('旅行', tables).eum).toBe('여행');
    expect(koEumOf('参观', tables)).toEqual({ eum: '참관', sylls: ['참', '관'] });
  });
  it('경계 규칙 — 더 긴 한국어 단어의 일부는 같은 한자어가 아니다', () => {
    expect(sameHanjaWord('护士', '간호사', tables)).toBeNull(); // 호사 ⊂ 간호사
    expect(sameHanjaWord('学员', '학원생, 수강생', tables)).toBeNull(); // 학원 ⊂ 학원생
    expect(sameHanjaWord('广泛', '광범위하다', tables)).toBeNull(); // 광범 ⊂ 광범위
    expect(sameHanjaWord('大学', '대학교', tables)).toBeNull();
    expect(sameHanjaWord('参观', '참관하다, 견학하다', tables)?.eum).toBe('참관');
    expect(sameHanjaWord('有限', '유한한, 제한적인', tables)?.eum).toBe('유한');
    expect(sameHanjaWord('观众', '관중, 관객, 시청자', tables)?.eum).toBe('관중');
  });
  it('우리 사전 실데이터 — 읽기 설명(hanja 표기)만 있는 비단어는 통과하지 않는다', () => {
    for (const w of ['终于', '关于', '广播', '饼干', '吃惊', '签证', '护士', '学员', '广泛', '机票', '宿舍', '产量']) {
      const e = refIndex.get(w);
      expect(e, w).toBeTruthy();
      expect(sameHanjaWord(w, e.word.ko, tables), w).toBeNull();
    }
    for (const w of ['技术', '确实', '艺术', '价值', '证明', '广告', '参观', '观众', '观点']) {
      expect(sameHanjaWord(w, refIndex.get(w).word.ko, tables), w).not.toBeNull();
    }
  });
  it('정본 수치 재현 — 2자 이상 5,710개 중 간체 음 2,147 기준선 → R0+ 정체 음 2,216(잃음 0), 경계 규칙은 그 부분집합', () => {
    const words = [...refIndex].filter(([zh]) => /^\p{Script=Han}{2,}$/u.test(zh));
    const simpEum = (w) => {
      const r = [...w].map((c) => koTable[c]);
      if (r.some((x) => !x)) return null;
      r[0] = applyDueum(r[0]);
      return r.join('');
    };
    let simp = 0;
    let trad = 0;
    let judged = 0;
    const lost = [];
    const outside = [];
    for (const [zh, { word }] of words) {
      const ko = String(word.ko || '');
      const s = simpEum(zh);
      const t = koEumOf(zh, tables)?.eum;
      const sOk = !!s && ko.includes(s);
      const tOk = !!t && ko.includes(t);
      if (sOk) simp += 1;
      if (tOk) trad += 1;
      if (sOk && !tOk) lost.push(zh);
      if (sameHanjaWord(zh, ko, tables)) {
        judged += 1;
        if (!tOk) outside.push(zh);
      }
    }
    expect(simp).toBeGreaterThanOrEqual(2147);
    expect(trad).toBeGreaterThanOrEqual(2216);
    expect(trad - simp).toBeGreaterThanOrEqual(69);
    expect(lost).toEqual([]);
    expect(outside).toEqual([]);
    expect(judged).toBeLessThan(trad); // 경계 규칙이 护士류를 걸러 낸다(실측 2,166)
    expect(judged).toBeGreaterThanOrEqual(2148);
  });
  it('짧은 뜻 — 첫 조각, 괄호 설명 제거, 6자 상한', () => {
    expect(shortMeaning('악단, 밴드')).toBe('악단');
    expect(shortMeaning('주관(적인)')).toBe('주관');
    expect(shortMeaning('객관적이다; 객관')).toBe('객관적이다');
    expect(shortMeaning('아주아주아주긴뜻이에요')).toBe('아주아주아주…');
    expect(shortMeaning('')).toBeNull();
  });
});

describe('한자 창 머리 · 구성 — hanjaPanelModel', () => {
  const model = (ch, word, reading, index) => hanjaPanelModel({ ch, word, reading, index, tables });

  it('观(参观) → 观 guān → 觀 볼 관, 구성 見(뜻) + 雚(소리), 머리 색 = 조각 색', () => {
    const m = model('观', '参观', 'guān', 1);
    expect(m.head).toEqual({ ch: '观', reading: 'guān', zheng: '觀', hun: '볼', eum: '관', label: '볼 관', tone: { hun: 'meaning', eum: 'sound' } });
    expect(m.lookup).toBe('觀');
    expect(m.parts.known).toBe(true);
    expect(m.parts.pieces).toEqual([
      { ch: '見', role: 'meaning', target: '見', hun: '볼', eum: '견', label: '볼 견' },
      { ch: '雚', role: 'sound', drill: true, hun: '황새', eum: '관', label: '황새 관' },
    ]);
    // 머리 색과 조각 색은 같은 역할 이름(같은 토큰으로 칠한다 — PR ②)
    expect(m.head.tone.hun).toBe(m.parts.pieces[0].role);
    expect(m.head.tone.eum).toBe(m.parts.pieces[1].role);
  });
  it('간체 줄임 기호가 아니라 정체 구성으로 — 观의 又·见이 조각에 나오지 않는다', () => {
    const m = model('观', '壮观', 'guān', 1);
    expect(m.parts.pieces.map((p) => p.ch)).toEqual(['見', '雚']);
    expect(m.parts.pieces.some((p) => '又见'.includes(p.ch))).toBe(false);
  });
  it('변형 부수 뜻 조각은 본자 훈음 라벨(亻 사람 인 · 氵 물 수 · 訁 말씀 언 · 釒 쇠 금)', () => {
    expect(model('价', '价格', 'jià', 0).parts.pieces[0]).toMatchObject({ ch: '亻', target: '人', label: '사람 인' });
    expect(model('语', '汉语', 'yǔ', 1).parts.pieces[0]).toMatchObject({ ch: '訁', target: '言', label: '말씀 언' });
    expect(model('银', '银行', 'yín', 0).parts.pieces[0]).toMatchObject({ ch: '釒', target: '金', label: '쇠 금' });
    expect(hanjaPanelModel({ ch: '灌', tables }).parts.pieces[0]).toMatchObject({ ch: '氵', target: '水', label: '물 수' });
  });
  it('역할 미상(術 — 3성분) → 머리 색 없음, 조각 역할 없음(「역할 미상」)', () => {
    const m = model('术', '技术', 'shù', 1);
    expect(m.head).toMatchObject({ zheng: '術', label: '재주 술', tone: { hun: null, eum: null } });
    expect(m.parts.known).toBe(false);
    expect(m.parts.pieces.map((p) => p.ch)).toEqual(['彳', '术', '亍']);
    expect(m.parts.pieces.every((p) => p.role === null)).toBe(true);
  });
  it('구성 자료 없음(育)·4성분 이상(樂)·획 조각 분해(工 = 丅+一) → 구성 null', () => {
    expect(model('育', '体育', 'yù', 1).parts).toBeNull();
    expect(model('乐', '音乐', 'yuè', 1).parts).toBeNull();
    expect(model('乐', '音乐', 'yuè', 1).head).toMatchObject({ zheng: '樂', label: '풍류 악' });
    expect(model('工', '工人', 'gōng', 0).parts).toBeNull();
  });
  it('간체 = 正(工) → 正 없음(화살표 없음) · 모호(1자 发) → 正 숨김', () => {
    expect(model('工', '工人', 'gōng', 0).head.zheng).toBeNull();
    expect(model('发', '发', 'fā', 0).head.zheng).toBeNull();
    expect(model('发', '头发', 'fa', 1).head.zheng).toBe('髮');
  });
  it('正 꼴은 AE-R3 正 줄과 같고 훈음은 R0+(为 → 為 · 할 위)', () => {
    expect(model('为', '因为', 'wèi', 1).head).toMatchObject({ zheng: '為', label: '할 위' });
  });
  it('병음 — 이 자리 읽기만, 없으면 비운다(사전 대표 읽기로 메우지 않는다)', () => {
    expect(model('观', '参观', null, 1).head.reading).toBeNull();
  });
  it('역할 확인 글자만 색 — 모든 글자에서 tone ≠ null ⇔ 구성이 역할 확인', () => {
    for (const [ch, w] of [['观', '参观'], ['术', '技术'], ['价', '价格'], ['乐', '快乐'], ['江', '长江'], ['情', '情况'], ['一', '一起']]) {
      const m = model(ch, w, null);
      const known = !!m.parts?.known;
      expect(m.head.tone.hun !== null || m.head.tone.eum !== null, `${w}의 ${ch}`).toBe(known);
    }
  });
  it('뜻 조각 창(문맥 없음) — 글자 자신이 정체, 병음 = 대표 읽기, 라벨 보정(金 쇠 금), 단어는 간체로 찾는다', () => {
    const m = hanjaPanelModel({ ch: '見', tables });
    expect(m.head).toMatchObject({ ch: '見', reading: 'jiàn', zheng: null, label: '볼 견' });
    expect(hanjaPanelModel({ ch: '金', tables }).head.label).toBe('쇠 금');
    expect(panelSearchChar('見', panel)).toBe('见');
    expect(panelSearchChar('木', panel)).toBe('木');
  });
  it('단어 문맥이 있는데 정체 표가 아직 없으면 null — 术 「삽주뿌리 출」을 잠깐도 보이지 않는다', () => {
    expect(hanjaPanelModel({ ch: '术', word: '技术', reading: 'shù', index: 1, tables: { koTable, hunTable, panel } })).toBeNull();
  });
  it('한자가 아니면 null', () => {
    expect(hanjaPanelModel({ ch: 'a', tables })).toBeNull();
    expect(hanjaPanelModel({ ch: '观观', tables })).toBeNull();
  });
});

describe('같은 한자어 타일 — selectSameHanjaTiles', () => {
  const tiles = (p) => selectSameHanjaTiles({ refIndex, tables, ...p });

  it('壮观의 观 — 내 단어 参观 → 이 자료 观众·观点(정본 시안), 판정 통과분만 한국 한자어', () => {
    const material = {
      sequence: ['a', 'b', 'c', 'd'],
      dictionary: {
        a: { text: '壮观', reading: 'zhuàng guān', meaning: '장관이다' },
        b: { text: '观众', reading: 'guān zhòng', meaning: '관중' },
        c: { text: '观点', reading: 'guān diǎn', meaning: '관점' },
        d: { text: '观光', reading: 'guān guāng', meaning: '관광', failed: true },
      },
    };
    const savedRows = [
      { word_text: '参观', meaning: '참관하다', language: 'Chinese' },
      { word_text: '観光', meaning: '관광', language: 'Japanese' },
    ];
    const t = tiles({ ch: '观', reading: 'guān', headText: '壮观', index: 1, savedRows, material });
    expect(t.map((x) => x.word)).toEqual(['参观', '观众', '观点']);
    expect(t.map((x) => x.ko)).toEqual(['참관', '관중', '관점']);
    expect(t.map((x) => x.mine)).toEqual([true, false, false]);
    expect(t.map((x) => x.source)).toEqual(['mine', 'material', 'material']);
    for (const x of t) {
      expect(x.syllables[x.at]).toBe('guān');
      expect([...x.word][x.at]).toBe('观');
      expect(x.koSylls[x.at]).toBe('관');
      expect(x.dim).toBe(false);
    }
  });
  it('우리 사전만 — 3개 이하 · 지금 단어 제외 · 같은 병음 · HSK 급 낮은 순', () => {
    const t = tiles({ ch: '观', reading: 'guān', headText: '参观', index: 1 });
    expect(t.length).toBe(3);
    expect(t.map((x) => x.word)).not.toContain('参观');
    expect(t[0].word).toBe('观众'); // H4 — 나머지(H5)보다 먼저
    for (const x of t) expect(x.syllables[x.at]).toBe('guān');
    const rank = (w) => Number(refIndex.get(w).level.slice(1)) || 9;
    expect(t.map((x) => rank(x.word))).toEqual([...t.map((x) => rank(x.word))].sort((a, b) => a - b));
  });
  it('같은 병음만 — 快乐의 乐(lè) 칸에 音乐会(yuè)가 없다, 音乐의 乐(yuè) 칸에 乐观(lè)이 없다', () => {
    const le = tiles({ ch: '乐', reading: 'lè', headText: '快乐', index: 1, cap: 10 });
    expect(le.length).toBeGreaterThan(0);
    expect(le.map((x) => x.word)).not.toContain('音乐会');
    for (const x of le) expect(x.syllables[x.at]).toBe('lè');
    const yue = tiles({ ch: '乐', reading: 'yuè', headText: '音乐', index: 1, cap: 10 });
    expect(yue.map((x) => x.word)).toContain('音乐会');
    expect(yue.map((x) => x.word)).not.toContain('乐观');
  });
  it('모자란 칸 = 판정 실패 후보의 짧은 뜻(흐림) — 音乐의 乐: 音乐会 음악회 · 乐曲 악곡 · 乐队 「악단」 흐림', () => {
    const t = tiles({ ch: '乐', reading: 'yuè', headText: '音乐', index: 1 });
    expect(t.map((x) => x.word)).toEqual(['音乐会', '乐曲', '乐队']);
    expect(t.map((x) => x.ko)).toEqual(['음악회', '악곡', null]);
    expect(t[2]).toMatchObject({ short: '악단', dim: true });
    expect(t.slice(0, 2).every((x) => !x.dim && x.short === null)).toBe(true);
  });
  it('경계 위반 단어(护士 「호사」)는 한국 한자어 줄에 오지 않는다 — 내 단어라도 흐린 짧은 뜻', () => {
    const t = tiles({ ch: '护', reading: 'hù', headText: '保护', cap: 20, savedRows: [{ word_text: '护士', meaning: '간호사', language: 'Chinese' }] });
    const nurse = t.find((x) => x.word === '护士');
    expect(nurse).toMatchObject({ ko: null, dim: true, short: '간호사', mine: true });
    expect(t.filter((x) => x.ko).every((x) => sameHanjaWord(x.word, refIndex.get(x.word)?.word.ko, tables))).toBe(true);
  });
  it('一·不 변조 — 一起의 一(yì) 칸에 yí·yī로 적힌 단어도 같은 병음', () => {
    const t = tiles({ ch: '一', reading: 'yì', headText: '一起', index: 0, cap: 10 });
    expect(t.length).toBeGreaterThan(0);
    for (const x of t) expect(x.syllables[x.at].normalize('NFD').replace(/[̀-ͯ]/g, '')).toBe('yi');
    expect(t.some((x) => x.syllables[x.at] !== 'yì')).toBe(true);
    const bu = tiles({ ch: '不', reading: 'bú', headText: '不错', index: 0, cap: 10 });
    expect(bu.some((x) => x.syllables[x.at] === 'bù')).toBe(true);
  });
  it('토큰 병음이 없으면 지금 단어의 사전 병음 그 자리로 같은 병음을 고른다', () => {
    const a = tiles({ ch: '观', reading: null, headText: '参观', index: 1 });
    const b = tiles({ ch: '观', reading: 'guān', headText: '参观', index: 1 });
    expect(a).toEqual(b);
    expect(tiles({ ch: '观', reading: null, headText: '没有的词', index: 0 })).toEqual([]);
  });
  it('병음을 확인할 수 없는 후보는 뺀다(내 단어에 읽기가 없고 사전·자료에도 없음)', () => {
    const t = tiles({ ch: '观', reading: 'guān', headText: '参观', savedRows: [{ word_text: '观观观', meaning: '관관관', language: 'Chinese' }], cap: 10 });
    expect(t.map((x) => x.word)).not.toContain('观观观');
  });
  it('한자가 아니거나 문맥이 없으면 빈 목록', () => {
    expect(tiles({ ch: 'a', reading: 'a', headText: 'ab' })).toEqual([]);
    expect(selectSameHanjaTiles({ ch: '观', reading: 'guān', headText: '参观', tables })).toEqual([]);
  });
});

describe('소리 조각 드릴다운', () => {
  it('雚 → 觀 guān 관 · 權 quán 권 · 歡 huān 환 · 勸 quàn 권 · 灌 guàn 관, 요약 「雚이 들면 대개 관·권·환 (guan·quan·huan)」', () => {
    const d = soundPieceDrill('雚', tables);
    expect(d.items).toEqual([
      { ch: '觀', py: 'guān', eum: '관' },
      { ch: '權', py: 'quán', eum: '권' },
      { ch: '歡', py: 'huān', eum: '환' },
      { ch: '勸', py: 'quàn', eum: '권' },
      { ch: '灌', py: 'guàn', eum: '관' },
    ]);
    expect(d).toMatchObject({ piece: '雚', reading: 'guàn', label: '황새 관' });
    expect(d.summary).toEqual({ eums: ['관', '권', '환'], pys: ['guan', 'quan', 'huan'] });
    expect(formatDrillSummary(d)).toBe('雚이 들면 대개 관·권·환 (guan·quan·huan)');
  });
  it('음이 1종이면 「대개 ○」, 받침 없는 조각은 「가」', () => {
    expect(formatDrillSummary(soundPieceDrill('方', tables))).toBe('方이 들면 대개 방 (fang)');
    const d = soundPieceDrill('古', tables);
    expect(formatDrillSummary(d)).toMatch(/^古가 들면 대개 /);
  });
  it('드릴다운이 없는 조각은 null', () => {
    expect(soundPieceDrill('賈', tables)).toBeNull();
    expect(soundPieceDrill('观', tables)).toBeNull();
  });
});

describe('한자 창 데이터 — hanjaPanel.json 생성 계약', () => {
  it('파일 머리에 원천·판본·라이선스 — Unihan(Unicode License v3)·BabelStone·OpenCC, 대조 자료(LGPL)는 싣지 않는다', () => {
    expect(panel._source).toMatch(/Unicode Unihan \(Unicode License v3/);
    expect(panel._source).toContain('e4a5a6c9');
    expect(panel._source).toMatch(/kPhonetic/);
    expect(panel._source).toMatch(/BabelStone IDS/);
    expect(panel._source).toMatch(/OpenCC/);
    expect(panel._source).toContain('scripts/generate-hanja-panel.mjs');
    const raw = fs.readFileSync(path.join(ROOT, 'src/lib/data/hanjaPanel.json'), 'utf8');
    expect(raw).not.toMatch(/Make Me a Hanzi|makemeahanzi|LGPL/i);
  });
  it('키는 코드포인트 순(결정성) · 크기 상한(raw 100KB · gzip 45KB)', () => {
    for (const k of ['roles', 'comps', 'drill', 'py', 'simp', 'lab']) {
      const keys = Object.keys(panel[k]);
      expect(keys.length, k).toBeGreaterThan(0);
      expect([...keys].sort(byCodePoint), k).toEqual(keys);
    }
    const raw = fs.readFileSync(path.join(ROOT, 'src/lib/data/hanjaPanel.json'));
    expect(raw.length).toBeLessThan(100 * 1024);
    expect(zlib.gzipSync(raw, { level: 9 }).length).toBeLessThan(45 * 1024);
  });
  it('역할 — 두 조각이 그 글자의 1단 성분에 있고, 셋째 글자는 그 글자의 부수 본자', async () => {
    const { ROLE_OVERRIDES } = await import('../../../scripts/hanja-curated.mjs');
    expect(Object.keys(panel.roles).length).toBeGreaterThan(1800);
    for (const [c, v] of Object.entries(panel.roles)) {
      const [sem, ph, base] = [...v];
      const comps = [...(etym[c]?.[2] || '')];
      expect(comps.includes(sem) && comps.includes(ph) && sem !== ph, c).toBe(true);
      if (base) expect(base, c).toBe(etym[c][1]);
      if (!Object.hasOwn(ROLE_OVERRIDES, c)) expect(comps.length, c).toBe(2);
    }
    for (const [c, v] of Object.entries(ROLE_OVERRIDES)) {
      if (v) expect(panel.roles[c].startsWith(v), c).toBe(true);
      else expect(panel.roles[c], c).toBeUndefined();
    }
  });
  it('역할 미상 성분 — 2~3개, hanjaEtym 1단 분해 그대로, 획 조각 없음, 역할 글자와 겹치지 않음', () => {
    const STROKES = /[一丨丶丿乀乙乚乛亅丷丆丅丄]/u;
    for (const [c, v] of Object.entries(panel.comps)) {
      expect([...v].length >= 2 && [...v].length <= 3, c).toBe(true);
      expect(v, c).toBe(etym[c][2]);
      expect(STROKES.test(v), c).toBe(false);
      expect(panel.roles[c], c).toBeUndefined();
    }
  });
  it('드릴다운 — 목록은 모두 같은 소리 조각을 가지고(2~5자), 대표 병음이 있다', () => {
    for (const [ph, list] of Object.entries(panel.drill)) {
      const cs = [...list];
      expect(cs.length >= 2 && cs.length <= 5, ph).toBe(true);
      for (const c of cs) {
        expect([...panel.roles[c]][1], `${ph}의 ${c}`).toBe(ph);
        expect(panel.py[c], c).toBeTruthy();
      }
    }
    expect(panel.drill['雚']).toBe('觀權歡勸灌');
  });
  it('정체 → 간체(뜻 조각 창의 단어 찾기)와 라벨 보정', () => {
    expect(panel.simp['見']).toBe('见');
    expect(panel.simp['門']).toBe('门');
    expect(Object.entries(panel.simp).every(([t, s]) => t !== s)).toBe(true);
    expect(panel.lab['氵']).toBe('물 수');
    expect(panel.lab['宀']).toBe('집 면');
  });
});

describe('지연 로드 경로(T1 준비) — 소스 계약', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/viewerHanjaPanel.js'), 'utf8');
  it('표는 동적 import로만 받는다(정적 import 0) · 런타임 pinyin-pro 0', () => {
    expect(src).toContain("import('./data/hanjaPanel.json')");
    expect(src).not.toMatch(/^import[^;]*hanjaPanel\.json/m);
    expect(src).not.toMatch(/from ['"]pinyin-pro|import\(['"]pinyin-pro/);
  });
  it('loadHanjaPanelTable은 같은 표를 한 번만 받는다', async () => {
    const a = await loadHanjaPanelTable();
    const b = await loadHanjaPanelTable();
    expect(a).toBe(b);
    expect(a.drill['雚']).toBe('觀權歡勸灌');
  });
});
