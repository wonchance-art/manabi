import { describe, expect, it } from 'vitest';
import { tokenizeZhLine } from '../tokenizeZh';
import { ZH_SUPPRESS } from '../zhSuppress';
import { ZH_DEGREE_ADV } from '../zhTokenFix';
import ZH_HSK_LEVEL from '../../data/zhHskLevel.json';

/**
 * 계약: jieba 사전 억제 + 품사 미매핑 (분석기 리뷰 라운드 2 — #1077 5502239993).
 *
 * 喝咖啡가 **인명**으로, 坐地铁가 **성어**로 뷰어에 뜨던 자리. R1 되가름으로 편다는 설계는 실측에서
 * 뒤집혔다(사전 항목이라 HMM off에도 안 갈림) — 빈도 억제(add_word 0)로 간다. 억제는 전역 사전을
 * 바꾸므로 **바뀌어야 하는 것과 바뀌면 안 되는 것을 한 쌍으로** 못 박는다.
 */
const textsOf = (s) => tokenizeZhLine(s).map((t) => t.text);
const posOf = (s, w) => tokenizeZhLine(s).find((t) => t.text === w)?.pos;

describe('억제 — 병합 항목이 실단어로 갈린다 (코퍼스 문장, 기대 조각은 실측값)', () => {
  it.each([
    ['我不喝咖啡，我喝茶。', '喝咖啡', ['喝', '咖啡']],
    ['我坐地铁去公司。', '坐地铁', ['坐', '地铁']],
    ['先坐地铁，再换公交车。', '先坐', ['先', '坐']],
    ['今天天气很好。', '今天天气', ['今天', '天气']],
    ['你做完作业了吗？', '做完作业', ['做', '完', '作业']],
    ['我们去打乒乓球吧。', '打乒乓球', ['打', '乒乓球']],
    ['我不是老师。', '不是', ['不', '是']],
    ['我不是故意的。', '不是故意', ['不', '是', '故意']],
    ['这个菜好不好吃？', '好不好', ['好', '不', '好吃']],
    ['别忘了！', '别忘了', ['别', '忘', '了']],
    ['大家对这个问题很感兴趣。', '很感兴趣', ['很', '感兴趣']],
    ['字太小了，我看不清楚。', '看不清楚', ['看', '不', '清楚']],
    ['这本书我看得懂。', '看得懂', ['看', '得', '懂']],
    ['今天比昨天好得多。', '好得多', ['好', '得', '多']],
    ['我去过日本，没吃过北京烤鸭。', '没吃过', ['没', '吃', '过']],
    ['他是外科医生。', '外科医生', ['外科', '医生']],
    ['这部电影的结局令人感动。', '令人感动', ['令人', '感动']],
  ])('%s → %s가 %j로', (line, merged, pieces) => {
    const texts = textsOf(line);
    expect(texts).not.toContain(merged);
    expect(texts.join(' ')).toContain(pieces.join(' '));
  });

  it('억제가 드러낸 다음 병합(没喝)은 없다 — 기존 부품 ZH_MEI_SPLIT이 받는다', () => {
    const texts = textsOf('我今天没喝咖啡。');
    expect(texts).not.toContain('没喝');
    expect(texts.join(' ')).toContain('没 喝 咖啡');
  });

  it('억제 목록 전체가 토큰으로 살아남지 않는다 — 항목마다 그 문장에서', () => {
    for (const w of ZH_SUPPRESS) expect(textsOf(`我${w}。`), w).not.toContain(w);
  });

  it('갈리면 안 되는 것은 그대로 — HSK 밖 실단어(老虎·熊猫·胡同)·고유명사·성어', () => {
    for (const [line, w] of [['老虎很大。', '老虎'], ['熊猫很可爱。', '熊猫'], ['北京的胡同很有名。', '胡同'], ['我住在上海。', '上海'], ['请出示登机牌。', '登机牌'], ['这是一举两得的办法。', '一举两得'], ['祝你身体健康。', '身体健康'], ['请系好安全带。', '安全带']]) {
      expect(textsOf(line), w).toContain(w);
    }
  });

  it('연쇄를 낳는 항목은 싣지 않았다 — 很多(→很多人·多书), 그리고 ⑤가 이미 가르는 很快·很大', () => {
    expect(ZH_SUPPRESS).not.toContain('很多');
    for (const adv of ZH_DEGREE_ADV) for (const w of ZH_SUPPRESS) expect(w.startsWith(adv) && w.length === adv.length + 1, w).toBe(false);
    // 很多는 억제가 아니라 ⑤ 후처리(라운드 5, 多·少 허용)가 가른다 — DAG를 안 건드려 很多人 연쇄가 없다
    expect(textsOf('我有很多朋友。')).not.toContain('很多');
    expect(textsOf('很多人来了。')).not.toContain('很多人');
  });

  it('다른 부품이 받는 것은 싣지 않았다 — 吃了饭은 이합사 R4a 통짜 삽입형(base_form=吃饭)', () => {
    expect(ZH_SUPPRESS).not.toContain('吃了饭');
    expect(tokenizeZhLine('他吃了饭。').find((t) => t.text === '吃了饭')?.base_form).toBe('吃饭');
  });

  it('목록이 지키는 게 없으면서 커지지 않게 — 항목은 전부 HSK 표제어가 아니다', () => {
    for (const w of ZH_SUPPRESS) expect(ZH_HSK_LEVEL[w], `${w}는 HSK 표제어 — 억제 대상이 아니다`).toBeUndefined();
  });
});

describe('품사 — 미상으로 새던 태그', () => {
  it('喝(HSK1)이 동사다 — vg 미매핑으로 미상 ×31', () => {
    expect(posOf('我喝咖啡。', '喝')).toBe('동사');   // 억제로 갈린 뒤 喝/vg
    expect(posOf('我不喝咖啡。', '喝')).toBe('동사');
    // 喝茶·喝水는 사전 단어라 한 토큰 — 억제 대상이 아니고 동사로 맞게 온다
    expect(posOf('我喝茶。', '喝茶')).toBe('동사');
  });

  it('zg·nrt는 단어별로 — 您·啊·往·此·趟·每 / 令人·保姆', () => {
    expect(posOf('您好，您是老师吗？', '您')).toBe('대명사');
    expect(posOf('请往这边走。', '往')).toBe('전치사');   // 往前走는 사전 단어라 한 토큰
    expect(posOf('这个结局令人感动。', '令人')).toBe('동사');
    expect(posOf('她是保姆。', '保姆')).toBe('명사');
  });

  it('복합 태그 — 不要/df·去过/vq·这点/mq·晚/tg', () => {
    expect(posOf('我不要。', '不要')).toBe('부사');
    expect(posOf('我去过北京。', '去过')).toBe('동사');
    expect(posOf('这点很重要。', '这点')).toBe('수량사');
    expect(posOf('时间很晚。', '晚')).toBe('시간사');    // 很晚了는 很晚으로 붙는다(⑤는 a 게이트 — 晚은 tg)
  });

  it('고유명사 태그로 오던 보통명사 — 인명이 아니다', () => {
    expect(posOf('老虎很大。', '老虎')).toBe('명사');
    expect(posOf('熊猫很可爱。', '熊猫')).toBe('명사');
    expect(posOf('我们聊天吧。', '聊天')).toBe('동사');
    expect(posOf('我坐地铁去公司。', '咖啡') ?? posOf('我不喝咖啡。', '咖啡')).toBe('명사');
  });
});
