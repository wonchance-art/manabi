import { describe, expect, it } from 'vitest';
import { tokenizeJaLine } from '../tokenizeJa';
import { decomposeKanaChunk, kuromojiBroke, segmentKanaTokens } from '../jaKanaSegment';
import JA_YOMI_INDEX from '../../data/jaYomiIndex.json';

/**
 * 계약: 가나 문절 분절 (분석기 리뷰 라운드 4 — #1077 5502565922).
 * 픽스처는 코퍼스 실측의 실제 붕괴 사례다. 바꾸는 쪽(부서진 문절)과 두는 쪽(정렬된 문절·동급 동음이의·
 * 띄어쓰기 없는 텍스트)을 한 쌍으로 못 박는다.
 */
const toks = async (s) => (await tokenizeJaLine(s)).filter((t) => t.pos !== '기호');
const brief = async (s) => (await toks(s)).map((t) => `${t.text}/${t.base_form}[${t.pos}]`).join(' ');

describe('부서진 문절 — 정본 분절로 바꾼다', () => {
  it('조각: えいが(え+いが)·がくせい(がく+せい)·にほんご(に+ほん+ご)·みず(み+ず)', async () => {
    // えいが의 정본 N5 표제어는 가나 그대로(えいが) — 기본형은 정본을 따른다. 핵심은 え[간투사]+いが 조각이 사라진 것.
    const eiga = await brief('わたしは きのう ともだちと えいがを みました。');
    expect(eiga).toContain('えいが/えいが[명사] を/を[조사]');
    expect(eiga).not.toContain('え/え[간투사]');
    expect(await brief('わたしは がくせいです。')).toContain('がくせい/学生[명사] です/です[조동사]');
    // べんきょう도 N5 표제어가 가나(べんきょう) — 勉強은 N1 항목이라 뒤로 밀린다(최저 급수 우선)
    expect(await brief('がっこうで にほんごを べんきょうします。')).toContain('がっこう/学校[명사] で/で[조사] にほんご/日本語[명사] を/を[조사] べんきょう/べんきょう[명사] します/する[동사]');
    expect(await brief('みずを のみます。')).toContain('みず/水[명사] を/を[조사]');
    expect(await brief('あには かいしゃいんです。')).toContain('あに/あに[명사] は/は[조사]');
  });

  it('동사 오독: くるま(くるむ)·かれ(かれる)·まえ(まえる) — 정본은 명사', async () => {
    expect(await brief('あかい くるま')).toContain('くるま/車[명사]');
    expect(await brief('かれは がくせいです。')).toContain('かれ/彼[명사] は/は[조사]');
    expect(await brief('えきの まえに あります。')).toContain('まえ/前[명사] に/に[조사]');
  });

  it('접미 2단어: にほんじん = 日本+人. 머리가 N5·N4일 때만 — 勧告+じん은 안 된다', async () => {
    expect(await brief('わたしは にほんじんです。')).toContain('にほん/日本[명사] じん/人[명사] です/です[조동사]');
    expect(decomposeKanaChunk('かんこくじんです')?.tails?.[0]?.surface_form ?? null).not.toBe('じん');
  });
});

describe('두는 문절 — kuromoji가 맞는 곳은 손대지 않는다', () => {
  it('정렬된 문절(ともだちと·きのうは)은 그대로 — 기본형도 kuromoji의 것', async () => {
    const t = await toks('わたしは きのう ともだちと えいがを みました。');
    expect(t.find((x) => x.text === 'ともだち')?.base_form).toBe('ともだち');
    expect(t.find((x) => x.text === 'きのう')?.base_form).toBe('きのう');
  });

  it('동급 동음이의(あめ 雨/飴·はし 橋/箸)는 부서졌더라도 기본형을 표면으로 둔다', () => {
    const dec = decomposeKanaChunk('あめが');
    expect(dec.cands.length).toBeGreaterThan(1);
    const out = segmentKanaTokens([{ surface_form: 'あ', pos: 'フィラー' }, { surface_form: 'めが', pos: '名詞' }]);
    expect(out[0]).toMatchObject({ surface_form: 'あめ', basic_form: 'あめ', pos: '名詞' });
  });

  it('동사 활용 문절(たべます·あります)은 정본이 사전형이라 안 덮인다 — kuromoji가 맞게 낸다', async () => {
    expect(await brief('パンを たべます。')).toContain('たべ/たべる[동사] ます/ます[조동사]');
    expect(decomposeKanaChunk('あります')).toBe(null);
  });

  it('띄어쓰기 없는 가나 텍스트는 문절 경계가 없어 손대지 않는다(현행 수렴)', async () => {
    const t = await toks('わたしはがくせいです。');
    expect(t.map((x) => x.text)).not.toContain('がくせい');   // 알려진 한계 — 문절 경계는 저자가 준다
  });

  it('한자 문장은 무관 — 가나 런이 조사뿐이라 덮일 게 없다', async () => {
    expect(await brief('私は学生です。')).toBe('私/私[명사] は/は[조사] 学生/学生[명사] です/です[조동사]');
  });
});

describe('규칙 부품', () => {
  it('kuromojiBroke — 조각이거나 동사 오독일 때만', () => {
    const dec = { head: 'くるま', cands: [['車', 'N5', 'n']] };
    expect(kuromojiBroke([{ surface_form: 'くるま', pos: '動詞' }], dec)).toBe(true);
    expect(kuromojiBroke([{ surface_form: 'くるま', pos: '名詞' }], dec)).toBe(false);
    expect(kuromojiBroke([{ surface_form: 'くる', pos: '動詞' }, { surface_form: 'ま', pos: '名詞' }], dec)).toBe(true);
  });

  it('색인에 1자 키가 없다 — 「り」가 머리가 못 되는 실제 방벽(루프 가드는 의도 표기, 변이 실측)', () => {
    for (const k of Object.keys(JA_YOMI_INDEX)) expect(k.length, k).toBeGreaterThanOrEqual(2);
  });

  it('머리는 2자 이상, 꼬리는 닫힌 집합 — 「り」 같은 조각은 애초에 머리가 못 된다', () => {
    expect(decomposeKanaChunk('を')).toBe(null);
    expect(decomposeKanaChunk('きってを')?.head).toBe('きって');        // 切手(N5)
    expect(decomposeKanaChunk('おにぎりを')).toBe(null);               // 정본에 없다 — 드릴 R2 감사와 같은 결과, kuromoji로 폴백
  });
});
