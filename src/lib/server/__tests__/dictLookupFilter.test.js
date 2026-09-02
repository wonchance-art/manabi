import { describe, expect, it } from 'vitest';
import { isWordToken } from '../../wordState';
import { collectMissingBaseForms } from '../dictLookup';
import { tokenizeZhLine } from '../tokenizeZh';
import { tokenizeJaLine } from '../tokenizeJa';
import { tokenizeEnLine } from '../tokenizeEn';
import { collectZhCorpus } from './zhCorpusPinyin.test.js';

/**
 * 계약: 공유 사전 조회(morpheme_dictionary)에 어휘 아닌 토큰이 새지 않는다.
 *
 * 왜 계약인가 — 분석기의 모든 토큰이 `base_form`을 단다. 문장부호도 예외가 아니라서,
 * `/api/analyze`가 미싱 목록을 만들 때 거르지 않으면 `。`·`，`의 뜻을 Gemini에 묻고 그 답을
 * 전 사용자 공유 사전에 적재한다. 실제로 그렇게 쌓인 4행(，。“ ”)을 운영 감사에서 찾았다
 * (2026-09-02). 지우기만 하면 다음 분석에 다시 쌓이므로 원천을 계약으로 막는다.
 *
 * 판정자는 뷰어가 쓰는 `isWordToken` 그대로다 — 같은 질문에 술어를 두 벌 두면 한쪽만 낡는다.
 */
describe('사전 조회 대상 판정 — 기호가 공유 사전에 새지 않는다', () => {
  it('수확기가 기호를 빼고 어휘만 담는다 — 중복·캐시 적중도 뺀다', async () => {
    const lines = [{ tokens: tokenizeZhLine('我说：“好。”') }, { tokens: tokenizeZhLine('我很好。') }];
    const forms = collectMissingBaseForms(lines, new Map()).map((m) => m.base_form);
    expect(forms).toEqual(['我', '说', '好', '很']);          // 기호 4종 제외 · 我/好 중복 1회
    // 캐시에 이미 있는 것은 다시 묻지 않는다
    expect(collectMissingBaseForms(lines, new Map([['我', {}], ['好', {}]])).map((m) => m.base_form))
      .toEqual(['说', '很']);
    // pos·reading을 함께 실어 보낸다(Gemini 프롬프트가 쓴다)
    expect(collectMissingBaseForms([{ tokens: tokenizeZhLine('图书馆。') }], new Map())[0])
      .toMatchObject({ base_form: '图书馆', pos: '명사' });
  });

  it('이합사 O 조각(sep_link)은 수확하지 않는다 — 歉 낱글자를 Gemini에 묻던 자리(운영 DB 歉 행)', () => {
    const lines = [{ tokens: tokenizeZhLine('他向我道了歉。') }];
    const forms = collectMissingBaseForms(lines, new Map()).map((m) => m.base_form);
    expect(forms).toContain('道歉');       // V가 VO로 한 번
    expect(forms).not.toContain('歉');     // O는 제외
    expect(forms).not.toContain('道');
  });

  it('세 언어 모두 수확기를 통과한 목록에 기호가 없다', async () => {
    const lines = [
      { tokens: tokenizeZhLine('我说：“好。”') },
      { tokens: await tokenizeJaLine('私は「はい」と言った。') },
      { tokens: tokenizeEnLine('He said, "yes."') },
    ];
    const forms = collectMissingBaseForms(lines, new Map()).map((m) => m.base_form);
    const symbols = lines.flatMap((l) => l.tokens).filter((t) => t.pos === '기호').map((t) => t.text);
    expect(symbols.length).toBeGreaterThan(0);
    for (const sym of symbols) expect(forms, sym).not.toContain(sym);
    expect(forms).toContain('我');   // 공허 통과 방지
  });

  it('세 언어 분석기의 문장부호 토큰을 전부 거른다', async () => {
    const zh = tokenizeZhLine('我说：“好。”');
    const ja = await tokenizeJaLine('私は「はい」と言った。');
    const en = tokenizeEnLine('He said, "yes."');
    for (const [name, toks] of [['zh', zh], ['ja', ja], ['en', en]]) {
      const passed = toks.filter(isWordToken).map((t) => t.text);
      const symbols = toks.filter((t) => t.pos === '기호').map((t) => t.text);
      expect(symbols.length, `${name} 픽스처에 기호가 있어야 계약이 공허하지 않다`).toBeGreaterThan(0);
      for (const s of symbols) expect(passed, `${name} ${s}`).not.toContain(s);
    }
    // 공허 통과 방지 — 실단어는 그대로 통과해야 한다
    expect(zh.filter(isWordToken).map((t) => t.text)).toEqual(['我', '说', '好']);
  });

  it('코퍼스 전수 — 기호 토큰은 하나도 통과하지 않는다', async () => {
    const rows = await collectZhCorpus();
    const leaked = new Set();
    let symbols = 0;
    for (const r of rows) {
      for (const t of tokenizeZhLine(r.zh)) {
        if (t.pos !== '기호') continue;
        symbols++;
        if (isWordToken(t)) leaked.add(t.text);
      }
    }
    expect(symbols).toBeGreaterThan(5000);   // 공허 통과 방지
    expect([...leaked]).toEqual([]);
  }, 120000);
});
