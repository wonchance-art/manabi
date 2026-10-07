import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { toTraditional, toTraditionalTW, zhengForm, zhengSure } from '../hanjaKo';
import { glyphColumnLayout, glyphRows, jaGlyphRow, jaWarnFromTable, jaWordFromTable, readDictJa } from '../glyphColumn';
import { loadJaWordsTable, loadZhengTable, prefetchGlyphTables, resetGlyphTablesForTest } from '../glyphTables';
import { JA_FALSE_FRIENDS } from '../../../scripts/hanja-curated.mjs';

/**
 * 계약: 뷰어 v2 AE-R3 자형 열(正 · 日) 데이터·판정 — PR ①(화면 변화 0).
 * 정본: VIEWER-V2-ROUNDS-001 §6 · 설계서 docs/manabi-viewer-v2-ae-r3.md §3·§4·§7.3.
 *
 * 正 = 대만 표준 자형(OpenCC s2tw = s2t + TWVariants), 간체와 다를 때만, 모호하면 숨김.
 * 日 = 확인된 일본어 표기만(사전 행 ja → JMdict 파생 표 → 없음), 요미와 함께. 계산한 꼴은 보이지 않는다.
 */

const ROOT = process.cwd();
const readData = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/data', f), 'utf8'));
const trad = readData('hanjaTrad.json');
const jaWords = readData('jaWords.json');
const dictWith = (ja) => ({ meanings: [{ meaning: '뜻', ja }] });
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

describe('正 — 대만 표준 자형(s2tw), 다를 때만', () => {
  it.each([
    ['体育场', '體育場', [true, false, true]],
    ['壮观', '壯觀', [true, true]],
    ['尽量', '儘量', [true, false]],
    ['技术', '技術', [false, true]],
    ['发展', '發展', [true, false]], // 发 모호 — 검증 표제어(ok)
    ['干净', '乾淨', [true, true]], // 干 모호 — 구절 표
    ['头发', '頭髮', [true, true]],
  ])('%s → %s', (word, form, diff) => {
    expect(zhengForm(word, trad)).toEqual({ form, diff });
  });

  it('간체와 꼴이 같으면 숨긴다 — 眼前 · 方面 · 只是', () => {
    for (const w of ['眼前', '方面', '只是']) expect(zhengForm(w, trad), w).toBeNull();
  });

  it('대만 이체를 건다 — 喫·羣·着이 아니다', () => {
    expect(zhengForm('吃饭', trad)?.form).toBe('吃飯');
    expect(zhengForm('群众', trad)?.form).toBe('群眾');
    expect(zhengForm('着急', trad)?.form).toBe('著急');
    expect(zhengForm('为了', trad)?.form).toBe('為了');
    expect(zhengForm('里面', trad)?.form).toBe('裡面');
    expect(zhengForm('面条', trad)?.form).toBe('麵條');
    // 대만 꼴이 간체와 같아지면 正이 사라진다(s2t만 다르던 단어)
    for (const w of ['小吃', '秘密', '病床']) expect(zhengForm(w, trad), w).toBeNull();
  });

  it('어휘 변환(s2twp)은 하지 않는다 — 글자 꼴만', () => {
    expect(toTraditionalTW('出租车', trad)).toBe('出租車'); // 計程車 아님
    expect(toTraditionalTW('软件', trad)).toBe('軟件'); // 軟體 아님
    expect(toTraditionalTW('自行车', trad)).toBe('自行車'); // 腳踏車 아님
    expect(toTraditionalTW('信息', trad)).toBe('信息'); // 資訊 아님
  });

  it('R0+ s2t(toTraditional)는 그대로다 — 훈음 조회 꼴과 正 줄은 갈린다', () => {
    expect(toTraditional('吃饭', trad)).toBe('喫飯');
    expect(toTraditional('群众', trad)).toBe('羣衆');
    expect(toTraditional('为了', trad)).toBe('爲了');
  });

  it('모호 한 글자는 문맥이 없어 숨긴다 — 干(幹/乾) · 发(發/髮) · 了 · 于', () => {
    for (const ch of ['干', '发', '了', '于', '只', '台']) {
      expect(zhengSure(ch, trad), ch).toBe(false);
      expect(zhengForm(ch, trad), ch).toBeNull();
    }
    // 모호하지 않은 한 글자는 보인다
    expect(zhengForm('着', trad)?.form).toBe('著');
    expect(zhengForm('观', trad)?.form).toBe('觀');
  });

  it('표 밖 토큰의 모호 글자를 첫 후보로 채우면 숨긴다 — 吃干(乾이어야) · 干完 · 发了', () => {
    for (const w of ['吃干', '干完', '发了', '卷起来']) expect(zhengForm(w, trad), w).toBeNull();
  });

  it('검증 표제어를 품은 표 밖 토큰은 그 조각이 같게 바뀔 때만 보인다 — 发展中 · 干净的 · 头发长', () => {
    expect(zhengForm('发展中', trad)?.form).toBe('發展中');
    expect(zhengForm('干净的', trad)?.form).toBe('乾淨的');
    expect(zhengForm('头发长', trad)?.form).toBe('頭髮長');
  });

  it('표 미로드 · 한자 없음은 숨김', () => {
    expect(zhengForm('体育场', null)).toBeNull();
    expect(zhengForm('abc', trad)).toBeNull();
    expect(zhengForm('', trad)).toBeNull();
  });
});

describe('正 데이터 — hanjaTrad.json의 tw · twPhrases · amb · ok', () => {
  it('OpenCC TWVariants 38자 · TWVariantsPhrases 4행을 그대로 싣는다', () => {
    expect(Object.keys(trad.tw)).toHaveLength(38);
    expect(trad.tw).toMatchObject({ 喫: '吃', 爲: '為', 着: '著', 羣: '群', 衆: '眾', 裏: '裡', 牀: '床', 祕: '秘', 麪: '麵' });
    expect(Object.keys(trad.twPhrases)).toHaveLength(4);
    for (const [k, v] of Object.entries(trad.tw)) expect([...k].length === 1 && [...v].length === 1, k).toBe(true);
  });

  it('모호 글자·검증 표제어는 코드포인트 순 · 중복 없음(결정성), 검증 표제어는 모두 모호 글자를 담는다', () => {
    const amb = [...trad.amb];
    expect(amb.length).toBeGreaterThan(200);
    expect([...amb].sort(byCodePoint)).toEqual(amb);
    expect(new Set(amb).size).toBe(amb.length);
    for (const ch of '干发里只台后历系面卷') expect(trad.amb, ch).toContain(ch);
    expect([...trad.ok].sort(byCodePoint)).toEqual(trad.ok);
    expect(new Set(trad.ok).size).toBe(trad.ok.length);
    const ambSet = new Set(amb);
    expect(trad.ok.filter((w) => [...w].length < 2 || ![...w].some((c) => ambSet.has(c)))).toEqual([]);
    expect(trad.ok).toEqual(expect.arrayContaining(['发展', '历史', '系统', '后来']));
  });

  it('검증 표제어는 모두 확신으로 판정된다', () => {
    expect(trad.ok.filter((w) => !zhengSure(w, trad))).toEqual([]);
  });
});

describe('日 — 확인된 일본어 표기만, 요미와 함께', () => {
  it('사전 행 ja(같은 단어) → 표기 + 요미, 출처 dict', () => {
    expect(jaGlyphRow({ word: '体育场', dictEntry: dictWith({ form: '体育場', yomi: 'たいいくじょう' }) }))
      .toEqual({ form: '体育場', yomi: 'たいいくじょう', source: 'dict', diff: [false, false, true] });
  });

  it('ja가 null(판정 완료 · 대응 없음)이면 표에 있어도 숨긴다', () => {
    expect(jaWordFromTable('眼前', jaWords)).not.toBeNull();
    expect(jaGlyphRow({ word: '眼前', dictEntry: dictWith(null), jaTable: jaWords })).toBeNull();
  });

  it('diff(다른 말) · warn(동형이의어 경고)이면 숨긴다 — 더 알아보기로 간다(PR ②)', () => {
    expect(jaGlyphRow({ word: '老师', dictEntry: dictWith({ form: '先生', yomi: 'せんせい', diff: true }), jaTable: jaWords })).toBeNull();
    expect(jaGlyphRow({ word: '汽车', dictEntry: dictWith({ form: '汽車', yomi: 'きしゃ', warn: '기차' }), jaTable: jaWords })).toBeNull();
  });

  it('같은 단어가 아니면 숨긴다 — 글자 수가 다르거나 한자가 아닌 표기', () => {
    expect(jaGlyphRow({ word: '熊猫', dictEntry: dictWith({ form: 'パンダ', yomi: 'ぱんだ' }) })).toBeNull();
    expect(jaGlyphRow({ word: '不过', dictEntry: dictWith({ form: 'でも', yomi: 'でも' }) })).toBeNull();
    expect(jaGlyphRow({ word: '走', dictEntry: dictWith({ form: '走る', yomi: 'はしる' }) })).toBeNull();
  });

  it('형식이 어긋난 사전 값은 믿지 않는다 — 요미 없음 · 가나 아님 · 마크업', () => {
    for (const ja of [{ form: '壮観' }, { form: '壮観', yomi: 'soukan' }, { form: '<b>壮観</b>', yomi: 'そうかん' }, { form: '壮観', yomi: 'そう\nかん' }]) {
      expect(jaGlyphRow({ word: '壮观', dictEntry: dictWith(ja) }), JSON.stringify(ja)).toBeNull();
    }
    expect(readDictJa({ form: ' 壮観 ', yomi: ' そうかん ' })).toEqual({ form: '壮観', yomi: 'そうかん', diff: false, warn: null });
  });

  it('ja 미판정(undefined — 게스트) → JMdict 표, 출처 jmdict', () => {
    expect(jaGlyphRow({ word: '壮观', dictEntry: null, jaTable: jaWords }))
      .toEqual({ form: '壮観', yomi: 'そうかん', source: 'jmdict', diff: [false, true] });
    expect(jaGlyphRow({ word: '壮观', dictEntry: { meanings: [{ meaning: '웅장하다' }] }, jaTable: jaWords })?.source).toBe('jmdict');
  });

  it('둘 다 없으면 숨긴다 — 尽量(일본어 단어 없음)', () => {
    expect(jaWordFromTable('尽量', jaWords)).toBeNull();
    expect(jaGlyphRow({ word: '尽量', jaTable: jaWords })).toBeNull();
    expect(jaGlyphRow({ word: '壮观' })).toBeNull();
  });

  it('사전 행과 JMdict가 같은 표기인데 요미가 다르면 JMdict 요미(출처 jmdict)', () => {
    expect(jaGlyphRow({ word: '壮观', dictEntry: dictWith({ form: '壮観', yomi: 'そうがん' }), jaTable: jaWords }))
      .toMatchObject({ form: '壮観', yomi: 'そうかん', source: 'jmdict' });
  });

  it('글자 변환 다대일이 日에 나오지 않는다 — 方面은 方麺이 아니고 历史는 暦史가 아니다', () => {
    expect(jaGlyphRow({ word: '方面', jaTable: jaWords })).toMatchObject({ form: '方面', yomi: 'ほうめん' });
    expect(jaGlyphRow({ word: '历史', jaTable: jaWords })).toMatchObject({ form: '歴史', yomi: 'れきし' });
    expect(jaGlyphRow({ word: '复杂', jaTable: jaWords })).toMatchObject({ form: '複雑' }); // 復雑 아님
    expect(jaGlyphRow({ word: '头发', jaTable: jaWords })).toMatchObject({ form: '頭髪' }); // 頭発 아님
    expect(jaGlyphRow({ word: '关系', jaTable: jaWords })).toMatchObject({ form: '関係' }); // 関繋 아님
    // 소스 계약: 日 판정은 글자 변환(toJaForm)을 부르지 않는다
    const src = fs.readFileSync(path.join(ROOT, 'src/lib/glyphColumn.js'), 'utf8');
    expect(src).not.toMatch(/toJaForm\s*\(/);
    expect(src).not.toMatch(/['"]AI['"]/);
  });
});

describe('정본 예 — 眼前 = 日만 · 体育场·壮观 = 둘 다 · 尽量 = 正만', () => {
  const rows = (word, dictEntry) => glyphRows({ word, tradTable: trad, dictEntry, jaTable: jaWords });
  it('眼前 — 正 없음(간체 = 정체), 日 がんぜん(꼴이 같아도 요미 때문에 보인다)', () => {
    const r = rows('眼前');
    expect(r.zheng).toBeNull();
    expect(r.ja).toEqual({ form: '眼前', yomi: 'がんぜん', source: 'jmdict', diff: [false, false] });
  });
  it('体育场 — 正 體育場 · 日 体育場 たいいくじょう(사전 행에서 올 때)', () => {
    const r = rows('体育场', dictWith({ form: '体育場', yomi: 'たいいくじょう' }));
    expect(r.zheng?.form).toBe('體育場');
    expect(r.ja).toMatchObject({ form: '体育場', yomi: 'たいいくじょう', source: 'dict' });
  });
  it('壮观 — 正 壯觀 · 日 壮観 そうかん', () => {
    const r = rows('壮观');
    expect(r.zheng?.form).toBe('壯觀');
    expect(r.ja).toMatchObject({ form: '壮観', yomi: 'そうかん' });
  });
  it('尽量 — 正 儘量만', () => {
    const r = rows('尽量');
    expect(r.zheng?.form).toBe('儘量');
    expect(r.ja).toBeNull();
  });
});

describe('日 데이터 — jaWords.json(JMdict 파생, CC BY-SA 4.0)', () => {
  const words = jaWords.words;
  const entry = (w) => jaWordFromTable(w, jaWords);

  it('파일 머리에 원천·판본·라이선스를 적는다(이 파일만 CC BY-SA 4.0)', () => {
    expect(jaWords._source).toMatch(/JMdict\/EDICT \(EDRDG/);
    expect(jaWords._source).toMatch(/Created: \d{4}-\d{2}-\d{2}/);
    expect(jaWords._source).toMatch(/sha256 [0-9a-f]{64}/);
    expect(jaWords._license).toMatch(/^CC BY-SA 4\.0/);
    expect(jaWords._license).toContain('이 파일만');
    expect(jaWords._license).toContain('Electronic Dictionary Research and Development Group');
  });

  it('키는 코드포인트 순(결정성) · 값은 요미 또는 [표기, 요미]', () => {
    const keys = Object.keys(words);
    expect(keys.length).toBeGreaterThan(2000);
    expect([...keys].sort(byCodePoint)).toEqual(keys);
    for (const [w, v] of Object.entries(words)) {
      const ok = typeof v === 'string' || (Array.isArray(v) && v.length === 2 && v[0] !== w);
      expect(ok, w).toBe(true);
    }
  });

  it('표기는 표제어와 글자 수가 같은 한자, 요미는 가나', () => {
    const bad = Object.keys(words).filter((w) => {
      const { form, yomi } = entry(w);
      return [...form].length !== [...w].length || !/^\p{Script=Han}+$/u.test(form) || !/^[ぁ-ゖァ-ヺー]+$/u.test(yomi);
    });
    expect(bad).toEqual([]);
  });

  it('표기에 구자체가 남지 않는다(Unihan kJapaneseNewVariant 구자체 표본)', () => {
    const OLD = new Set([...'國學體會氣圖廣觀價發歷戰鐵驛樂藝聲號從對當黨擧實寫應單區縣獨讀變戀壓圍擔斷晝嚴稱醫雜雙靈齒龍經濟關臺壯參證歡傳']);
    expect(Object.keys(words).filter((w) => [...entry(w).form].some((c) => OLD.has(c)))).toEqual([]);
  });

  // 기대 짝 — 생성 규칙을 정하기 전에 고른 같은 단어(설계서 §3.3 정밀도 계약)
  it.each([
    ['眼前', '眼前', 'がんぜん'], ['壮观', '壮観', 'そうかん'], ['技术', '技術', 'ぎじゅつ'], ['历史', '歴史', 'れきし'],
    ['参观', '参観', 'さんかん'], ['价格', '価格', 'かかく'], ['证明', '証明', 'しょうめい'], ['图书馆', '図書館', 'としょかん'],
    ['经济', '経済', 'けいざい'], ['文化', '文化', 'ぶんか'], ['社会', '社会', 'しゃかい'], ['学生', '学生', 'がくせい'],
    ['电话', '電話', 'でんわ'], ['关系', '関係', 'かんけい'], ['发展', '発展', 'はってん'], ['问题', '問題', 'もんだい'],
    ['国家', '国家', 'こっか'], ['经验', '経験', 'けいけん'], ['复杂', '複雑', 'ふくざつ'], ['冲突', '衝突', 'しょうとつ'],
    ['动物', '動物', 'どうぶつ'], ['银行', '銀行', 'ぎんこう'], ['天气', '天気', 'てんき'], ['时间', '時間', 'じかん'],
    ['学习', '学習', 'がくしゅう'], ['汉字', '漢字', 'かんじ'], ['运动', '運動', 'うんどう'], ['意见', '意見', 'いけん'],
    ['研究', '研究', 'けんきゅう'], ['环境', '環境', 'かんきょう'], ['头发', '頭髪', 'とうはつ'], ['体育', '体育', 'たいいく'],
  ])('기대 짝 %s → %s %s', (w, form, yomi) => {
    expect(entry(w)).toEqual({ form, yomi });
  });

  // 금지 오답 — 같은 표기지만 일본어 주된 뜻이 다른 동형이의어(관문 통과 오탐 포함)
  it.each([
    '老师', '工作', '大家', '东西', '告诉', '爱人', '汽车', '手纸', '勉强', '新闻',
    '丈夫', '结束', '口气', '想念', '流氓', '游人', '先生', '便宜', '十分', '意思',
    '马上', '再见', '颜色', '质量', '可怜', '一定', '到底', '交接', '里面', '结构',
  ])('금지 오답 %s — 표에 없다', (w) => {
    expect(entry(w)).toBeNull();
  });

  // 요미 우선순위 없는 입력(EDICT — 가나 순 정렬)에서 다중 요미는 버린다: 파일 순으로 고르면
  // 情緒 じょうしょ(1순위 じょうちょ)·気質 かたぎ(1순위 きしつ)처럼 틀린 읽기가 나간다(생성 로그 「요미 미정으로 뺌」).
  it.each(['情绪', '气质', '分泌', '半年', '唯一', '明日', '牧场', '诗歌', '包子', '字典'])('요미가 하나로 정해지지 않는 %s — 표에 없다', (w) => {
    expect(entry(w)).toBeNull();
  });

  it('수기 거부 목록(JA_FALSE_FRIENDS)의 키는 모두 표에서 빠진다', () => {
    expect(Object.keys(JA_FALSE_FRIENDS).length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(JA_FALSE_FRIENDS).filter((w) => w in words)).toEqual([]);
  });
});

describe('안 1 / 안 2 — 폭으로 판정(em 추정 + 컨테이너 폭)', () => {
  const ja = (yomi) => ({ yomi });
  it.each([
    ['壮观 · 390 시트(332)', { chars: 2, zheng: true, ja: ja('そうかん'), containerPx: 332 }, 'side'],
    ['壮观 · 320 화면(288)', { chars: 2, zheng: true, ja: ja('そうかん'), containerPx: 288 }, 'side'],
    ['眼前 日만 · 336 패널(304)', { chars: 2, zheng: false, ja: ja('がんぜん'), containerPx: 304 }, 'side'],
    ['体育场 · 390 시트(332)', { chars: 3, zheng: true, ja: ja('たいいくじょう'), containerPx: 332 }, 'table'],
    ['身体素质 · 1440 패널(304)', { chars: 4, zheng: true, ja: ja('しんたいそしつ'), containerPx: 304 }, 'table'],
    ['壮观 · 글자 200%(332)', { chars: 2, zheng: true, ja: ja('そうかん'), containerPx: 332, scale: 2 }, 'table'],
    ['尽量 正만 · 390(332)', { chars: 2, zheng: true, ja: null, containerPx: 332 }, 'side'],
  ])('%s → %s', (_, input, want) => {
    expect(glyphColumnLayout(input)).toBe(want);
  });

  it('글자 수가 같아도 요미 길이로 갈린다 — 판정은 폭이다', () => {
    const base = { chars: 2, zheng: true, containerPx: 300 };
    expect(glyphColumnLayout({ ...base, ja: ja('かい') })).toBe('side');
    expect(glyphColumnLayout({ ...base, ja: ja('きゅうきょくてきに') })).toBe('table');
  });

  it('훈음 칸이 병음 칸보다 넓으면 그 폭을 쓴다', () => {
    const base = { chars: 2, zheng: true, ja: ja('そうかん'), containerPx: 288 };
    expect(glyphColumnLayout(base)).toBe('side');
    expect(glyphColumnLayout({ ...base, hunPx: [90, 90] })).toBe('table');
  });

  it('자형 열이 없거나 입력이 잘못되면 null', () => {
    expect(glyphColumnLayout({ chars: 2, zheng: false, ja: null, containerPx: 332 })).toBeNull();
    expect(glyphColumnLayout({ chars: 0, zheng: true, containerPx: 332 })).toBeNull();
    expect(glyphColumnLayout({ chars: 2, zheng: true, containerPx: 0 })).toBeNull();
    expect(glyphColumnLayout({ chars: 2, zheng: true, containerPx: NaN })).toBeNull();
  });
});

describe('지연 로드(T1) — 유휴 시간에 두 표를 한 번만', () => {
  it('같은 표를 여러 번 불러도 같은 결과', async () => {
    resetGlyphTablesForTest();
    const [a, b] = await Promise.all([loadZhengTable(), loadZhengTable()]);
    expect(a).toBe(b);
    expect(a.tw.喫).toBe('吃');
    const ja = await loadJaWordsTable();
    expect(jaWordFromTable('壮观', ja)).toEqual({ form: '壮観', yomi: 'そうかん' });
  });

  it('유휴 예약으로 받고, 취소하면 받지 않는다', async () => {
    resetGlyphTablesForTest();
    const idle = vi.fn(() => 7);
    const cancelIdle = vi.fn();
    const cancel = prefetchGlyphTables({ scheduler: { idle, cancelIdle } });
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(7);
    idle.mock.calls[0][0](); // 취소 뒤 늦게 불려도 받지 않는다
    let run = null;
    prefetchGlyphTables({ scheduler: { idle: (fn) => { run = fn; return 1; } } });
    run();
    expect((await loadZhengTable()).amb).toBe(trad.amb);
  });
});

// AE-R3 PR ②(메인 세션 결정 2026-10-08 KST): 日 줄 = 「확인된 단어 표기(jaWords.json) 우선 → 없을 때만 글자 단위 폴백」.
// 폴백(toJaForm, #1368 보수 규칙)은 확인되지 않은 꼴이라 日 줄에 「확인 표기처럼」 보이지 않는다 — 설계서 §3.2 규정대로
// 표시하지 않는다(계산 꼴은 jaWords 생성기의 열쇠 후보로만 쓴다). #1368이 글자 단위로 고칠 수 없었던 악화 표본은
// 확인 표기로 나온다.
describe('日 — 확인된 단어 표기 우선, 글자 단위 폴백은 확인 표기처럼 보이지 않는다(PR ②)', () => {
  const WORSENED_BY_1368 = {
    以后: '以後', 最后: '最後', 机会: '機会', 准备: '準備', 标准: '標準', 根据: '根拠',
    杂志: '雑誌', 制造: '製造', 特征: '特徴', 战斗: '戦闘', 干杯: '乾杯', 头发: '頭髪',
  };
  it('#1368 악화 표본 12개는 日 줄에 확인 표기(JMdict)로 나온다 — 게스트·로그인 모두', () => {
    for (const [word, form] of Object.entries(WORSENED_BY_1368)) {
      expect(jaGlyphRow({ word, jaTable: jaWords }), word).toMatchObject({ form, source: 'jmdict' });
      expect(jaGlyphRow({ word, dictEntry: { meanings: [{ meaning: '뜻' }] }, jaTable: jaWords }), word).toMatchObject({ form, source: 'jmdict' });
    }
  });

  it('사전 행이 글자 변환 꼴(以后 · 准备)을 적어도 확인 표기가 이긴다 — 사전 행은 판정(null·diff·warn)만 가른다', () => {
    expect(jaGlyphRow({ word: '以后', dictEntry: dictWith({ form: '以后', yomi: 'いご' }), jaTable: jaWords }))
      .toEqual({ form: '以後', yomi: 'いご', source: 'jmdict', diff: [false, true] });
    expect(jaGlyphRow({ word: '准备', dictEntry: dictWith({ form: '准備', yomi: 'じゅんび' }), jaTable: jaWords }))
      .toMatchObject({ form: '準備', source: 'jmdict' });
    // 판정은 그대로 사전 행이 가른다
    expect(jaGlyphRow({ word: '以后', dictEntry: dictWith(null), jaTable: jaWords })).toBeNull();
    expect(jaGlyphRow({ word: '以后', dictEntry: dictWith({ form: '今後', yomi: 'こんご', diff: true }), jaTable: jaWords })).toBeNull();
  });

  it('확인 표기가 없는 단어는 글자 변환 꼴을 日 줄에 올리지 않는다 — 日历(日歴) · 后来 · 手机', () => {
    for (const word of ['日历', '后来', '手机']) {
      expect(jaWordFromTable(word, jaWords), word).toBeNull();
      expect(jaGlyphRow({ word, jaTable: jaWords }), word).toBeNull();
    }
  });
});

// AE-R3 PR ② 검수(2026-10-08 KST): 回复(답장) ↔ 回復(회복)처럼 뜻이 갈리는 동형이의어는 확인 표기로 보이면 오해를 부른다.
// 수기 거부 목록(JA_FALSE_FRIENDS)을 jaWords.json warn으로도 내보내 日 줄을 숨기고 경고로 보인다.
describe('日 — 수기 동형이의어는 日 줄 대신 경고(jaWords.json warn)', () => {
  it('warn = 표제어 우주 안의 거부 목록 키 전부, [일본어 표기, 주된 뜻] — 값 형식 「표기 — 뜻(중국어는 …)」에서 가른다', () => {
    const keys = Object.keys(jaWords.warn);
    expect(keys).toEqual([...keys].sort(byCodePoint));
    expect(keys.length).toBeGreaterThanOrEqual(50);
    for (const k of keys) {
      expect(Object.hasOwn(JA_FALSE_FRIENDS, k), k).toBe(true);
      expect(k in jaWords.words, k).toBe(false);
      const [form, meaning] = jaWords.warn[k];
      expect(JA_FALSE_FRIENDS[k].startsWith(`${form} — ${meaning}(중국어`), k).toBe(true);
      expect([...form].length).toBe([...k].length);
    }
    expect(jaWords.warn.回复).toEqual(['回復', '회복']);
    expect(jaWords.warn.汽车).toEqual(['汽車', '기차']);
    expect(jaWords.warn.老师).toEqual(['老師', '노스승·노승']);
  });

  it('回复은 日 줄이 없다 — 게스트도, 사전 행이 같은 표기(回復)를 같은 단어로 적어도', () => {
    expect(jaWordFromTable('回复', jaWords)).toBeNull();
    expect(jaWarnFromTable('回复', jaWords)).toEqual({ form: '回復', meaning: '회복' });
    expect(jaGlyphRow({ word: '回复', jaTable: jaWords })).toBeNull();
    expect(jaGlyphRow({ word: '回复', dictEntry: dictWith({ form: '回復', yomi: 'かいふく' }), jaTable: jaWords })).toBeNull();
    expect(jaWarnFromTable('壮观', jaWords)).toBeNull();
  });

  it('#1368 재생성으로 들어온 나머지 9항은 같은 단어로 판정해 日 줄에 남는다(PR ② 검수)', () => {
    const same = { 了解: '了解', 厨房: '厨房', 回归: '回帰', 失踪: '失踪', 携带: '携帯', 斗志: '闘志', 联合: '連合', 质朴: '質朴', 踪迹: '踪跡' };
    for (const [w, form] of Object.entries(same)) expect(jaGlyphRow({ word: w, jaTable: jaWords }), w).toMatchObject({ form, source: 'jmdict' });
  });
});

describe('안 1 폭 — 실글꼴 보정(PR ②): 오른쪽 열 구분선(padding 12 + 테두리 1)까지 넣는다', () => {
  it('壮观: 표제어 99.2 + 간격 16 + 구분선 13 + 열 133 = 261.2px — 그 폭이면 안 1, 1px 모자라면 안 2', () => {
    const input = { chars: 2, zheng: true, ja: { yomi: 'そうかん' } };
    expect(glyphColumnLayout({ ...input, containerPx: 261.2 })).toBe('side');
    expect(glyphColumnLayout({ ...input, containerPx: 260.2 })).toBe('table');
  });
  it('안 2 표마저 넘치면 안 2b(stack) — 라벨 칸(1.75rem)만큼 들인 표제어가 한 줄에 안 들어갈 때(글자 200% · 긴 단어)', () => {
    const tiyu = { chars: 3, zheng: true, ja: { yomi: 'たいいくじょう' } };
    // 3 × 99.2(200%) = 297.6 + 56 = 353.6
    expect(glyphColumnLayout({ ...tiyu, scale: 2, containerPx: 353.6 })).toBe('table');
    expect(glyphColumnLayout({ ...tiyu, scale: 2, containerPx: 332 })).toBe('stack');
    expect(glyphColumnLayout({ ...tiyu, containerPx: 332 })).toBe('table');
    // 그려진 칸 폭(긴 병음·훈음)이 추정보다 넓으면 그 폭으로 판정한다
    expect(glyphColumnLayout({ ...tiyu, containerPx: 332, hunPx: [110, 110, 110] })).toBe('stack');
  });
});

describe('지연 로드(T1) — 받은 표를 호출부에 넘긴다(PR ② 배선)', () => {
  it('유휴 예약이 돌면 두 표를 onLoad로 넘기고, 취소하면 넘기지 않는다', async () => {
    resetGlyphTablesForTest();
    let run = null;
    const onLoad = vi.fn();
    prefetchGlyphTables({ scheduler: { idle: (fn) => { run = fn; return 1; } }, onLoad });
    run();
    await vi.waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    const [{ zheng, jaWords: ja }] = onLoad.mock.calls[0];
    expect(zheng.amb).toBe(trad.amb);
    expect(jaWordFromTable('壮观', ja)).toEqual({ form: '壮観', yomi: 'そうかん' });
    const late = vi.fn();
    let run2 = null;
    const cancel = prefetchGlyphTables({ scheduler: { idle: (fn) => { run2 = fn; return 2; } }, onLoad: late });
    run2();
    cancel();
    await new Promise((r) => setTimeout(r, 20));
    expect(late).not.toHaveBeenCalled();
  });
});
