import { describe, expect, it } from 'vitest';
import { tokenizeZhLine } from '../tokenizeZh';
import { contextPinyin } from '../zhPinyinContext';
import { ZH_PINYIN_FIX } from '../zhPinyinFix';
import { ZH_NEUTRAL_TONE } from '../zhNeutralTone';

/**
 * 계약: 문맥 조건 병음 수리 (분석기 리뷰 라운드 1 — #1077 5501779373).
 *
 * 코퍼스 8,546문장을 사람이 적은 병음과 전수 대조했더니 가장 큰 오독 부류가 **구조조사를 원조로
 * 읽는 것**이었다(得 142·地 66·过 43 = 251건). 우리 오버라이드는 토큰 정확 일치라 1자 조사에는
 * 안 걸렸고, pinyin-pro 줄 병음은 변조만 처리한다. jieba 태그(ud·uv·ul·ug)와 이웃이 이미 문맥을
 * 갖고 있다 — 그걸 읽는다. 각 규칙은 **바꾸는 쪽과 두는 쪽을 한 쌍으로** 못 박는다: 「없다」로만
 * 적으면 규칙이 죽어도 다른 이유로 통과할 수 있다.
 */
const py = (line, word) => tokenizeZhLine(line).find((t) => t.text === word)?.furigana;

describe('구조조사 — jieba 전용 태그를 읽는다', () => {
  it('V得C의 得는 de, 얻다·해야 하다의 得는 그대로 — ud 태그가 셋 다 같아서 앞자리로 가른다', () => {
    expect(py('他跑得很快。', '得')).toBe('de');       // 코퍼스 오독 142건의 자리
    expect(py('你写得非常好。', '得')).toBe('de');
    expect(py('他得了第一名。', '得')).not.toBe('de');  // 뒤가 了 — 얻다(dé)
    expect(py('我得走了。', '得')).not.toBe('de');      // 앞이 대명사 — 해야 하다(děi)
    expect(py('老师得了奖。', '得')).not.toBe('de');     // 앞이 명사여도 뒤가 了면 얻다 — 了 가드의 몫(변이 실측)
    // 앞 품사를 열거하면 놓치는 자리들 — 오태그된 술어(高兴/b·图画/n)·되가름 조각(过/ug 得/x)
    expect(py('她高兴得跳了起来。', '得')).toBe('de');
    expect(py('这张图画得很漂亮。', '得')).toBe('de');
    expect(py('他的童年过得很幸福。', '得')).toBe('de');
    // 병합 토큰 V得C — 실단어가 아니면 得는 보어 표지, 실단어(觉得·获得)는 그대로
    expect(py('这本书我看得懂。', '看得懂')).toBe('kàn de dǒng');
    expect(py('今天比昨天好得多。', '好得多')).toBe('hǎo de duō');
    expect(py('我觉得很好。', '觉得')).toBe('jué de');
    expect(py('他获得了第一名。', '获得')).toBe('huò dé');
    expect(py('他迫不得已辞职。', '迫不得已')).toBe('pò bù dé yǐ'); // 성어 — HSK 표 밖이라 방벽을 지났던 자리
  });

  it('V地의 地는 de, 명사 地(土地·地方)는 dì', () => {
    expect(py('他慢慢地走。', '地')).toBe('de');
    expect(py('她认真地学习汉语。', '地')).toBe('de');
    expect(py('这块土地很肥沃。', '土地')).toBe('tǔ dì');
    // uv 오태그 — 전치사·양사 뒤의 地는 땅이다
    expect(py('孩子在地上爬。', '地')).toBe('dì');
    expect(py('这块地很肥。', '地')).toBe('dì');
    // 병합 토큰 …地(깊이 부사 중첩) — 말미 地는 상황어 표지
    expect(py('他深深地吸了一口气。', '深深地')).toBe('shēn shēn de');
  });

  it('상조사 了는 le — 「赶到了事故」에서 了事(liǎo)로 붙잡히던 경계 오독', () => {
    expect(py('警察赶到了事故现场。', '了')).toBe('le');
    expect(py('他了解情况。', '了解')).toBe('liǎo jiě'); // 실단어 了解는 무관
    expect(py('他得了第一名。', '了')).toBe('le');            // 得了(dé le) — 가능보어 liǎo 규칙을 넣었다가 여기가 깨졌다
  });

  it('경험상 过는 guo — 단독 ug(去过 되가름 후)·병합 vq(去过)·비실단어 V过(看过) 셋 다; 실단어 穿过·문두 过马路는 guò', () => {
    expect(py('我去过北京。', '去过')).toBe('qù guo');
    expect(py('我看过这本书。', '看过')).toBe('kàn guo');
    expect(py('穿过马路。', '穿过')).toBe('chuān guò');
    expect(py('过马路要小心。', '过')).toBe('guò');
    expect(py('我没吃过羊肉。', '没吃过')).toBe('méi chī guo');  // 3자 병합(没V过)
    expect(py('我帮过他一次。', '过')).toBe('guo');              // 앞이 되가름 조각 帮/x
    expect(py('他很难过。', '难过')).toBe('nán guò');            // 실단어는 그대로
  });
});

describe('다음자 — 태그·이웃으로 확정되는 것만', () => {
  it('种: 수량 자리 뒤가 아니면 동사 zhòng (jieba가 동사 자리에서도 m을 단다)', () => {
    expect(py('院子里种了很多花。', '种')).toBe('zhòng');
    expect(py('路的两边种满了树。', '种')).toBe('zhòng');
    expect(py('这种花很香。', '这种')).toBe('zhè zhǒng');
    expect(py('一种方法。', '一种')).toBe('yì zhǒng');
  });

  it('只: 뒤가 명사가 아니면 부사 zhǐ, 양사 자리(那只狗)는 zhī', () => {
    expect(py('他只喝水。', '只')).toBe('zhǐ');
    expect(py('我只想休息一下。', '只')).toBe('zhǐ');
    expect(tokenizeZhLine('那只狗很可爱。').find((t) => t.text === '只')?.furigana ?? 'zhī').toBe('zhī');
  });

  it('为…所…: 피동의 为는 wéi, 「为你」의 为는 wèi', () => {
    expect(py('这首歌为年轻人所熟知。', '为')).toBe('wéi');
    expect(py('他的精神为大家所敬佩。', '为')).toBe('wéi');     // 所가 뒤 토큰에 붙어 있어도(所敬佩)
    expect(py('他被任命为局长。', '为')).toBe('wéi');           // 결과 보어 동사 뒤
    expect(py('我为你高兴。', '为')).toBe('wèi');
    expect(py('我们要为人民服务。', '为')).toBe('wèi');          // 동사 뒤라도 목록 밖이면 그대로
  });

  it('长得·重做·倒是·待在·教汉语·还钱·三天假', () => {
    expect(py('她长得很像妈妈。', '长')).toBe('zhǎng');
    expect(py('这条路很长。', '长')).toBe('cháng');
    expect(py('这道题请重做一遍。', '重')).toBe('chóng');
    expect(py('这个很重。', '重')).toBe('zhòng');
    expect(py('他倒是很好。', '倒')).toBe('dào');
    expect(py('树倒了。', '倒')).toBe('dǎo');
    expect(py('我在北京待了五天。', '待')).toBe('dāi');            // 단독 待/v
    expect(py('他待在家里。', '待在家里')).toMatch(/^dāi /);         // jieba가 관용구로 묶는 자리 — 첫 글자만
    expect(py('他教我们汉语。', '教')).toBe('jiāo');
    expect(py('你还钱了吗？', '还')).toBe('huán');
    expect(py('我还没吃。', '还')).toBe('hái');
    expect(py('我请了三天假。', '假')).toBe('jià');
  });

  it('등재 밖은 무개입 — 규칙 함수가 null을 돌려 줄 병음이 그대로 간다', () => {
    expect(contextPinyin([{ word: '我', tag: 'r' }], 0, ['wǒ'])).toBe(null);
    expect(contextPinyin([{ word: '重要', tag: 'a' }], 0, ['zhòng', 'yào'])).toBe(null);
    expect(contextPinyin([{ word: '得', tag: 'ud' }], 0, ['dé'])).toBe(null); // 앞 토큰 없음
  });
});

describe('토큰 정확 일치 층 보강 — pinyin-pro가 실제로 틀리는 것만 실었다', () => {
  it('등재 항목은 전부 분석기 출력에 그대로 반영된다', () => {
    for (const [word, value] of Object.entries(ZH_PINYIN_FIX)) {
      expect(py(`${word}。`, word), word).toBe(value);
    }
    // 단독 문장에선 맞게 내다가 **문맥에서** 틀리는 항목 — 등재의 실효는 그 문맥에서만 보인다(변이 실측: 举行).
    expect(py('两国领导人举行会议。', '举行')).toBe('jǔ xíng');
  });

  it('맞게 내던 이웃은 싣지 않았다 — 목록이 지키는 게 없으면서 커지지 않게', () => {
    for (const w of ['成为', '认为', '校长', '重建', '头发', '睡着']) expect(ZH_PINYIN_FIX[w]).toBeUndefined();
    expect(py('他成为了医生。', '成为')).toBe('chéng wéi');
    expect(py('校长来了。', '校长')).toBe('xiào zhǎng');
  });

  it('필독 경성 공백 5항 — 那里만 있고 这里가 없던 비일관을 닫는다', () => {
    for (const w of ['早上', '晚上', '这里', '哪里', '故事']) expect(ZH_NEUTRAL_TONE[w], w).toBeDefined();
    expect(py('晚上好。', '晚上')).toBe('wǎn shang');
    expect(py('这里很好。', '这里')).toBe('zhè li');
    expect(py('故事很长。', '故事')).toBe('gù shi');
    // 기준 ②·③은 그대로 — 다의 地方, 방향보어 起来는 여전히 배제
    expect(ZH_NEUTRAL_TONE['地方']).toBeUndefined();
    expect(ZH_NEUTRAL_TONE['起来']).toBeUndefined();
  });
});
