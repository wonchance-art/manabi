import { describe, expect, it } from 'vitest';
import {
  aozoraBlockText,
  aozoraDocumentToPlainText,
  aozoraRubyClass,
  parseAozoraText,
  validateAozoraDocument,
} from '../aozoraParser.js';
import { aozoraFixture } from './helpers/aozoraFixtures.js';

// 서식 견본은 실제 작품이 아니다(fixtures/aozora/README.md) — 경계 사례를 짧게 고정하는 용도다.
// 실물 txt 계약(정본 5편·羅生門 거부 견본)은 aozoraRealWorks.test.js에 있다.

/** 머리 + 기호 설명 블록 + 본문 + 판권으로 감싼 최소 실물형 txt. */
const wrap = (body, colophon = '底本：「見本」架空書房\n入力：甲\n校正：乙') => [
  '見本作品', '見本作者', '',
  '-------------------------------------------------------',
  '【テキスト中に現れる記号について】', '', '《》：ルビ', '（例）見本《みほん》',
  '-------------------------------------------------------', '',
  body, '', '', '', colophon,
].join('\n');

const rubies = (document) => document.blocks.flatMap((block) => block.children.filter((child) => child.type === 'ruby'));

describe('parseAozoraText — 실물 배치(서식 견본 「朝の川」)', () => {
  const document = parseAozoraText(aozoraFixture('format-sample-headings.txt'));

  it('머리의 작품명·저자를 읽고, 기호 설명 블록은 본문도 판권도 아니다', () => {
    expect(document.header).toEqual({ title: '書式見本　朝の川', author: '見本太郎', lines: ['書式見本　朝の川', '見本太郎'] });
    const plain = aozoraDocumentToPlainText(document);
    expect(plain).not.toContain('テキスト中に現れる記号');
    expect(plain).not.toContain('（例）');
    expect(plain.startsWith('一\n\n朝の川面は')).toBe(true);
  });

  it('見出し 주석은 표제 블록이 되고(버리지 않는다) 본문은 한 줄 = 한 문단', () => {
    expect(document.blocks.map((block) => block.type)).toEqual([
      'heading', 'paragraph', 'paragraph', 'paragraph', 'heading', 'paragraph', 'paragraph', 'paragraph',
    ]);
    expect(document.blocks[0]).toMatchObject({ type: 'heading', level: 2, children: [{ type: 'text', value: '一' }] });
    expect(document.blocks[4]).toMatchObject({ type: 'heading', level: 2, children: [{ type: 'text', value: '二' }] });
    expect(document.notes.map((note) => note.description)).toEqual(['５字下げ', '５字下げ', '「晴れていた」に傍点', '地から１字上げ']);
  });

  it('명시·암시 루비를 원문 그대로 구조화한다', () => {
    expect(rubies(document).map(({ base, reading }) => [base, reading])).toEqual([
      ['川面', 'かわも'], ['舟着場', 'ふなつきば'], ['今日', 'きょう'], ['船頭', 'せんどう'], ['欄干', 'らんかん'],
    ]);
  });

  it('판권은 말미의 底本：부터 — 들여쓴 연속 줄까지 항목에 붙는다', () => {
    expect(document.colophon).toEqual({
      sourceBook: ['「書式見本集」架空書房', '2026（令和8）年10月12日第1刷発行'],
      parentBook: ['「書式見本原稿」架空書房', '2026（令和8）年10月1日'],
      firstAppearance: [],
      inputter: '見本入力者',
      proofreader: '見本校正者',
      other: ['2026年10月12日作成', '青空文庫作成ファイル：', 'このファイルは書式見本です。実在する青空文庫のファイルではありません。'],
    });
    expect(aozoraDocumentToPlainText(document)).not.toMatch(/底本|入力：|校正：|青空文庫作成ファイル/);
  });

  it('기호 외자(二重山括弧)는 그 글자로 해결하고 경고가 없다', () => {
    expect(document.gaiji.map((item) => [item.status, item.char])).toEqual([['resolved', '《'], ['resolved', '》']]);
    expect(aozoraDocumentToPlainText(document)).toContain('古い看板には《渡し場》と書いてあった。');
    expect(document.warnings).toEqual([]);
  });
});

describe('parseAozoraText — #1295 실측 결함 4건 회귀', () => {
  it('① 「｜」 없는 《》의 기준은 바로 앞 같은 문자종 연속뿐이다', () => {
    const document = parseAozoraText(wrap([
      '私は先生《せんせい》と歩いた。',
      '見本の町《まち》へ行く。',
      '姉はノート《帳面》を開いた。',
      '東京タワー《とうきょうたわー》が見える。',
      '名札にＡＢＣ《えーびーしー》とある。',
      '窓の外では、かげろう《陽炎》が揺れた。',
      '人々《ひとびと》が集まった。',
    ].join('\n')));
    expect(rubies(document).map((ruby) => ruby.base)).toEqual(['先生', '町', 'ノート', 'タワー', 'ＡＢＣ', 'かげろう', '人々']);
    expect(aozoraDocumentToPlainText(document).split('\n\n')[0]).toBe('私は先生と歩いた。');
    expect([aozoraRubyClass('々'), aozoraRubyClass('ー'), aozoraRubyClass('、')]).toEqual(['kanji', 'katakana', null]);
  });

  it('② 머리의 대시 블록을 판권으로 오인하지 않는다 — 본문이 통째로 사라지지 않는다', () => {
    const document = parseAozoraText(wrap('本文の一行目。\n本文の二行目。'));
    expect(aozoraDocumentToPlainText(document)).toBe('本文の一行目。\n\n本文の二行目。');
    expect(document.colophon.sourceBook).toEqual(['「見本」架空書房']);
  });

  it('③ 底本： 다음의 들여쓴 연속 줄을 놓치지 않는다(전각·반각 들여쓰기)', () => {
    const document = parseAozoraText(wrap('本文。', '底本：「見本全集１」架空書房\n　　　1990（平成2）年1月1日第1刷発行\n   2000（平成12）年2月2日第5刷\n入力：甲\n校正：乙'));
    expect(document.colophon.sourceBook).toEqual(['「見本全集１」架空書房', '1990（平成2）年1月1日第1刷発行', '2000（平成12）年2月2日第5刷']);
  });

  it('④ 판권은 마지막 底本： 줄부터 — 본문 속 「底本」 언급은 본문이다', () => {
    const document = parseAozoraText(wrap('この底本：という言葉は本文の中にある。\n本文の終わり。'));
    expect(aozoraDocumentToPlainText(document)).toBe('この底本：という言葉は本文の中にある。\n\n本文の終わり。');
    expect(document.colophon.inputter).toBe('甲');
  });
});

describe('parseAozoraText — 見出し 주석의 여러 형태', () => {
  it('［＃中見出し］…［＃中見出し終わり］ 감싸기형과 大·小 단계', () => {
    const document = parseAozoraText(wrap('［＃大見出し］上［＃大見出し終わり］\n［＃小見出し］１［＃小見出し終わり］\n本文。'));
    expect(document.blocks.map((block) => [block.type, block.level ?? null, aozoraBlockText(block)]))
      .toEqual([['heading', 1, '上'], ['heading', 3, '１'], ['paragraph', null, '本文。']]);
  });

  it('同行見出し — 같은 줄 뒤 글은 문단이 된다', () => {
    const document = parseAozoraText(wrap('一［＃「一」は同行中見出し］　朝が来た。'));
    expect(document.blocks.map((block) => block.type)).toEqual(['heading', 'paragraph']);
    expect(aozoraDocumentToPlainText(document)).toBe('一\n\n朝が来た。');
  });

  it('지목 글자와 표제 글이 다르거나 여러 줄 見出し면 경고로 남긴다(사람 확인)', () => {
    expect(parseAozoraText(wrap('第一の章［＃「一」は中見出し］')).warnings.map((item) => item.code)).toEqual(['HEADING_TARGET_MISMATCH']);
    expect(parseAozoraText(wrap('［＃ここから中見出し］\n一\n［＃ここで中見出し終わり］')).warnings.map((item) => item.code))
      .toEqual(['UNSUPPORTED_HEADING', 'UNSUPPORTED_HEADING']);
  });
});

describe('parseAozoraText — 외자·깨진 루비·경계', () => {
  it('U+ 표기와 JIS X 0213 면-구-점(제3·4수준)은 그 글자로 해결, 번호도 표기도 없으면 미해결(〓)', () => {
    // 실물 표기: 羅生門 「※［＃「木＋世」、第3水準1-85-56］」(枻), 2면 「第4水準2-13-28」(揷)
    const document = parseAozoraText(wrap('古い※［＃「木＋世」、第3水準1-85-56］と※［＃「土へん＋竒」、U+57FC、10-3］、※［＃「插」でつくりの縦棒が下に突き抜けている、第4水準2-13-28］、※［＃「口＋世」］。'));
    expect(document.gaiji.map((item) => [item.status, item.char ?? null, item.line]))
      .toEqual([['resolved', '枻', 11], ['resolved', '埼', 11], ['resolved', '揷', 11], ['unresolved', null, 11]]);
    expect(aozoraDocumentToPlainText(document)).toBe('古い枻と埼、揷、〓。');
    // 비한자 외자는 수준 없이 면-구-점만(吾輩は猫である 「小書き片仮名ヒ、1-6-84」), 쪽-줄 두 마디(「168-12」)는 번호가 아니다
    const small = parseAozoraText(wrap('ア※［＃小書き片仮名ヒ、1-6-84］と※［＃小書き平仮名ん、168-12］'));
    expect(small.gaiji.map((item) => [item.status, item.char ?? null])).toEqual([['resolved', 'ㇶ'], ['unresolved', null]]);
  });

  it('JIS X 0213 표는 0208 밖 칸만 싣는다 — 제1면 1,918 + 제2면 2,436 = 4,354(JIS X 0213:2004 추가 문자 수)', async () => {
    const { default: table } = await import('../aozoraJisx0213.json');
    const keys = Object.keys(table);
    expect(keys).toHaveLength(4354);
    expect(keys.filter((key) => key.startsWith('1-'))).toHaveLength(1918);
    expect(table['1-87-71']).toBe('犍');
    expect(table['1-16-1']).toBeUndefined(); // 亜 — JIS X 0208 칸(외자가 아니다)
    // 제2면은 JIS X 0213이 쓰는 구만(1·3–5·8·12–15·78–94) — JIS X 0212 칸이 섞이지 않는다
    expect(keys.some((key) => /^2-(2|6|7|9|10|11|16|77)-/u.test(key))).toBe(false);
  });

  it('깨진 루비는 기호를 조용히 지우지 않고 경고한다', () => {
    const broken = parseAozoraText(wrap('｜壊れた《ルビ'));
    expect(broken.warnings).toEqual([{ code: 'MALFORMED_RUBY', line: 11, source: '｜壊れた《ルビ' }]);
    expect(aozoraDocumentToPlainText(broken)).toBe('｜壊れた《ルビ');
    const baseless = parseAozoraText(wrap('「《よみ》」'));
    expect(baseless.warnings.map((item) => item.code)).toEqual(['RUBY_WITHOUT_BASE']);
    expect(aozoraDocumentToPlainText(baseless)).toBe('「《よみ》」');
  });

  it('판권이 없으면 경고 — 크레딧 없는 공개를 막는 근거', () => {
    expect(parseAozoraText('見本作品\n見本作者\n\n本文。').warnings).toEqual([{ code: 'NO_COLOPHON' }]);
  });

  it('BOM·CRLF를 정규화하고 결정적·깊은 동결 결과를 낸다', () => {
    const source = `\uFEFF${wrap('私は先生《せんせい》と歩いた。').replace(/\n/g, '\r\n')}`;
    const first = parseAozoraText(source);
    const second = parseAozoraText(source);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.header.title).toBe('見本作品');
    expect(Object.isFrozen(first.blocks[0].children)).toBe(true);
    expect(() => { first.blocks.push({}); }).toThrow();
  });

  it('입력·구조 위반은 fail-closed', () => {
    expect(() => parseAozoraText(null)).toThrow('Aozora text source must be a string');
    expect(() => parseAozoraText('見本\uE000')).toThrow('reserved private-use');
    expect(validateAozoraDocument(parseAozoraText(wrap('本文。')))).toBe(true);
    expect(() => validateAozoraDocument({ ...parseAozoraText(wrap('本文。')), format: 'xhtml' })).toThrow('Unsupported Aozora document format');
  });
});
