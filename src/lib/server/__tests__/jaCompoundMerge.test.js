import { describe, expect, it } from 'vitest';
import { compoundYomi, mergeJaCompounds } from '../jaCompoundMerge';
import { tokenizeJaLine } from '../tokenizeJa';

/**
 * 계약: 일본어 복합명사 재병합 (분석기 라운드 10, 2026-09-02).
 *
 * kuromoji가 映画館·誕生日·お皿를 형태소로 낸다. 교재 표제어가 곧 어휘 단위이니 정본 읽기 색인(jaYomiIndex)의 역색인으로
 * 합치고 읽기도 색인 값을 쓴다. 바꾸는 쪽(합침·읽기)과 두는 쪽(수사 창·조사 낀 구·표제어 아님)을 한 쌍으로 못 박는다.
 */
const tok = async (line) => (await tokenizeJaLine(line)).filter((t) => t.pos !== '기호');
const find = async (line, text) => (await tok(line)).find((t) => t.text === text);

describe('합치는 쪽 — 명사류 창의 결합이 표제어', () => {
  it('映画館(名詞+接尾)·誕生日(サ変+接尾)·お皿(接頭詞+名詞)·天気予報(名詞+サ変) — 한 토큰, 읽기는 색인', async () => {
    expect((await find('駅前に映画館ができた。', '映画館'))?.furigana).toBe('えいがかん');
    expect((await find('今日は姉の誕生日です。', '誕生日'))?.furigana).toBe('たんじょうび'); // kuromoji 결합은 たんじょうひ
    expect((await find('お皿を綺麗に洗った。', 'お皿'))?.furigana).toBe('おさら');
    expect((await find('天気予報を見ます。', '天気予報'))?.furigana).toBe('てんきよほう');
    expect((await find('駐車場は満車です。', '駐車場'))?.furigana).toBe('ちゅうしゃじょう');
    const t = await find('駅前に映画館ができた。', '映画館');
    expect(t?.pos).toBe('명사');
    expect(t?.base_form).toBe('映画館');
  });

  it('3토큰 창(お手伝いさん)과 접두어+サ変(お手洗い)', async () => {
    expect((await find('お手洗いはあちらにあります。', 'お手洗い'))?.furigana).toBe('おてあらい');
    expect((await tok('お手伝いさんが来ました。')).map((t) => t.text)).toContain('お手伝いさん');
  });
});

describe('두는 쪽 — 규칙의 정밀도', () => {
  it('수사가 든 창은 안 합친다 — 三時十分의 十分은 じゅっぷん(10분)이지 표제어 十分(じゅうぶん)이 아니다', async () => {
    const toks = await tok('今三時十分です。');
    const jf = toks.find((t) => t.text === '十分' || t.text === '分');
    expect(jf?.furigana ?? '').not.toBe('じゅうぶん');
    expect(compoundYomi([{ surface_form: '十', pos: '名詞', pos_detail_1: '数' }, { surface_form: '分', pos: '名詞', pos_detail_1: '接尾' }])).toBe(null);
  });

  it('조사가 낀 구(男の人)·표제어 아닌 결합(今日中)·2자 미만 창은 무개입', async () => {
    expect((await tok('あの男の人は先生です。')).map((t) => t.text)).toEqual(expect.arrayContaining(['男', 'の', '人']));
    expect((await tok('今日中に終わらせます。')).map((t) => t.text)).not.toContain('今日中');
    expect(compoundYomi([{ surface_form: '映画', pos: '名詞', pos_detail_1: '一般' }])).toBe(null);
    expect(compoundYomi([{ surface_form: '映画', pos: '名詞', pos_detail_1: '一般' }, { surface_form: 'を', pos: '助詞', pos_detail_1: '格助詞' }])).toBe(null);
  });

  it('함수 단위 — 원 토큰 불변·긴 창 우선·합친 토큰의 형상', () => {
    const raw = [
      { surface_form: 'お', basic_form: 'お', reading: 'オ', pos: '接頭詞', pos_detail_1: '名詞接続', word_position: 1 },
      { surface_form: '手伝い', basic_form: '手伝い', reading: 'テツダイ', pos: '名詞', pos_detail_1: '一般', word_position: 2 },
      { surface_form: 'さん', basic_form: 'さん', reading: 'サン', pos: '名詞', pos_detail_1: '接尾', word_position: 5 },
      { surface_form: 'が', basic_form: 'が', reading: 'ガ', pos: '助詞', pos_detail_1: '格助詞', word_position: 7 },
    ];
    const out = mergeJaCompounds(raw);
    expect(out.map((t) => t.surface_form)).toEqual(['お手伝いさん', 'が']);
    expect(out[0]).toMatchObject({ basic_form: 'お手伝いさん', reading: 'おてつだいさん', pos: '名詞', pos_detail_1: '一般', word_position: 1, compound: true });
    expect(raw[0].surface_form).toBe('お'); // 입력 불변
  });
});
