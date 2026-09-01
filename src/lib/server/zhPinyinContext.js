// 서버 전용 — 문맥 조건 병음 수리 (분석기 리뷰 라운드 1, 오너 「순위대로 ㄱㄱ」 2026-09-02).
//
// ── 왜 세 번째 층인가
// 경성 사전(zhNeutralTone)·경계 수리(zhPinyinFix)는 **토큰 정확 일치**다. 그래서 1자 토큰의
// 문맥 오독은 못 잡는다 — 「跑得快」의 得(de)와 「得了第一名」의 得(dé)는 같은 토큰이다.
// 코퍼스 전수(8,546문장·정답 병음 대조, 리뷰 #1077 5501779373)에서 이 부류가 가장 컸다:
// 구조조사 251건(得 142·地 66·过 43) + 다음자 ~100건. pinyin-pro 줄 병음은 문장 문맥으로
// 변조는 처리하지만 조사·다음자는 원조로 낸다.
//
// ── 무엇으로 가르나 — jieba 태그와 이웃 토큰
// jieba는 이미 문맥을 태그에 새겨 준다: 得/ud·地/uv·了/ul·过/ug는 구조조사 전용 태그다.
// 단, 태그만으로 안 갈리는 것이 있어 이웃을 본다(전부 코퍼스 실측 — 아래 각 규칙에 수치):
//   · 得/ud는 「我得走了」(děi)·「得了第一名」(dé)에도 ud가 붙는다 → **앞이 동사·형용사일 때만** de.
//   · 种은 동사 자리에서도 m(양사)로 온다 → 수량 자리(수사·지시사) 뒤가 아니면 동사 zhòng.
//   · 只/d는 양사 자리(那只狗)에서도 d다 → 뒤가 명사가 아니면 부사 zhǐ.
//   · 为…所…(피동)의 为는 p(전치사)다 → 3토큰 안에 所가 오면 wéi.
// `afterCountSlot`(zhTokenFix 양사 규칙)·`markZhSeparable`(회랑 3토큰)과 같은 이웃 판독 선례다.
//
// ── 무엇을 안 하나
// 태그·이웃으로 **못 가르는** 다음자(倒车 dǎo/dào·一行 xíng/háng)는 손대지 않는다 — 틀릴 수 있는
// 건 안 싣는다(경성 사전 기준 ②). 다글자 토큰의 오독은 여기가 아니라 zhPinyinFix(토큰 정확 일치)다.
// 적용 순서: 경성 사전 > 경계 수리 > **이 층** > 줄 병음. 등재 밖은 무개입(실패 시 현행 수렴).

import { isZhRealWord } from './zhTokenFix';

const isVerb = (tag) => /^v/.test(tag || '');
const isNoun = (tag) => /^n/.test(tag || '');
/** 「…为」 결과 보어를 이끄는 동사 — 이 뒤의 为는 wéi(되다). 为/p 앞이 동사인 자리는 정답이 9:4로
 *  갈려(努力为… '위해'도 동사 뒤) 태그만으론 못 가른다 — 동사 목록이 정밀도다. */
const RESULT_VERBS = new Set(['任命', '当选', '选', '称', '视', '列', '评', '改', '变', '分', '成', '作', '化', '译', '转', '定', '封', '立', '尊', '推', '选举', '评选', '认定', '指定']);
/** 앞 토큰이 「수량 자리」인가 — zhTokenFix.afterCountSlot과 같은 판정. */
const isCountSlot = (e) => !!e && (e.tag === 'm' || e.tag === 'mq' || ['这', '那', '哪'].includes(e.word));

/**
 * @param {Array<{word:string, tag:string}>} entries fixZhTagged 출력(전체 줄)
 * @param {number} i 대상 토큰 인덱스
 * @param {string[]|null} syllables 줄 병음에서 이 토큰에 배분된 음절(글자당 1개)
 * @returns {string[]|null} 교정 음절 배열, 해당 없으면 null
 */
export function contextPinyin(entries, i, syllables) {
  const e = entries[i];
  if (!e) return null;
  const { word, tag } = e;
  const prev = entries[i - 1];
  const next = entries[i + 1];
  const chars = [...word];

  if (chars.length === 1) {
    switch (word) {
      // 구조조사 — jieba 전용 태그.
      // 得: ud가 「跑得快」(de)·「我得走了」(děi)·「得了第一名」(dé) 셋 다에 붙는다. 코퍼스 분포(정답 기준)
      //     로 가르면 — 뒤가 了/문말이면 얻다(dé), 앞이 대명사면 해야 하다(děi), 나머지는 전부 보어 표지(de).
      //     앞 품사를 열거하면 안 된다: 高兴/b·图画/n·过/ug처럼 오태그된 술어가 흔하다(실측 13건).
      //     되가름 조각은 x로 오므로(过得) 태그 둘을 받는다.
      case '得':
        if ((tag === 'ud' || tag === 'x') && prev && prev.tag !== 'r' && next && next.tag !== 'ul') return ['de'];
        break;
      // 地: uv는 상황어 표지 전용 태그지만 「在地上」·「这块地」에도 잘못 붙는다(실측 4건) — 앞이
      //     전치사·양사·수사·대명사면 땅(dì)이다.
      case '地': if (tag === 'uv' && prev && !/^(p|q|m|mq|r)$/.test(prev.tag)) return ['de']; break;
      // 了: ul은 상조사·어기조사 — 「赶到了事故」에서 了事(liǎo)로 붙잡히던 경계 오독 ×9.
      //     ⚠ V得了(가능보어 「做得了吗」 liǎo)를 「앞이 得」로 잡으려다 得了第一名(dé le)까지 liǎo가
      //        됐다 — 1건 얻고 19건 잃는 규칙(실측). 가능보어는 여기서 안 다룬다.
      case '了': if (tag === 'ul') return ['le']; break;
      // 过: ug + 앞이 동사(되가름 조각 x 포함 — 帮/x 过)면 경험상 guo. 문두 过马路(guò)는 그대로.
      case '过': if (tag === 'ug' && prev && (isVerb(prev.tag) || prev.tag === 'x')) return ['guo']; break;
      // 다음자 — 태그·이웃으로 확정되는 것만
      case '种': if (!isCountSlot(prev)) return ['zhòng']; break;   // 种花·种了·种满 (m 오태그 100%)
      case '只': if (tag === 'd' && !isNoun(next?.tag)) return ['zhǐ']; break; // 只喝水·只在; 那只狗는 유지
      case '为':
        if (tag !== 'p') break;
        if (entries.slice(i + 1, i + 4).some((t) => t.word.startsWith('所'))) return ['wéi']; // 为…所… 피동
        if (prev && RESULT_VERBS.has(prev.word)) return ['wéi'];                              // 任命为·当选为
        break;
      case '长': if (tag === 'a' && next?.word === '得' && next?.tag === 'ud') return ['zhǎng']; break; // 长得像
      case '重': if (tag === 'a' && isVerb(next?.tag)) return ['chóng']; break;   // 重做·重来; 很重은 유지
      case '倒': if (tag === 'v' && next && next.tag !== 'ul') return ['dào']; break; // 倒是·倒不如; 树倒了 유지
      case '待': if (tag === 'v') return ['dāi']; break;   // 待在·待几天 (5/5 오독)
      case '教': if (tag === 'v') return ['jiāo']; break;  // 教汉语·教我们 (3/3 오독)
      case '还': if (tag === 'd' && isNoun(next?.tag)) return ['huán']; break; // 还钱·还书; 还没·还是 유지
      case '假': if (isCountSlot(prev)) return ['jià']; break; // 三天假; 假的(jiǎ) 유지
      default: break;
    }
    return null;
  }

  if (!syllables || syllables.length !== chars.length) return null;
  const last = chars[chars.length - 1];
  const real = isZhRealWord(word);
  // V过 병합 토큰 — vq(去过)는 태그 자체가 「동사+过」다. 그 밖(看过/v·没吃过/l)은 실단어(穿过·经过·
  // 难过)가 아닐 때만 — HSK 방벽이 정밀도다.
  if (last === '过' && chars.length <= 3 && (tag === 'vq' || !real)) return [...syllables.slice(0, -1), 'guo'];
  // V得C 병합 토큰(看得懂·吃得完·说得对·好得多) — 실단어(觉得·值得·获得)가 아니면 得는 보어 표지.
  // 得는 **둘째 글자**일 때만(코퍼스 실측 10/10). 성어(迫不得已/i — 得가 셋째)는 원조를 지킨다:
  // 전체 스위트가 잡았다(tokenizeZh.test 「성어는 원조 유지」).
  if (chars[1] === '得' && !real && tag !== 'i') return syllables.map((syl, k) => (k === 1 ? 'de' : syl));
  // …地 병합 토큰(深深地·静静地·高高兴兴地) — 실단어(土地·当地·各地)가 아니면 말미 地는 상황어 표지.
  if (last === '地' && chars.length >= 2 && !real) return [...syllables.slice(0, -1), 'de'];
  // 待在… 통짜 관용구(待在家里/i) — 첫 글자만 dāi
  if (chars[0] === '待' && chars[1] === '在') return ['dāi', ...syllables.slice(1)];
  return null;
}
