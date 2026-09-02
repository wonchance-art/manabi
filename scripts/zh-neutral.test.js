import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPLEMENT_WORDS, GUO_VERBS, NEUTRAL_WORDS, neutralViolations } from './zh-neutral.mjs';
import { collectZhPinyinPairs } from './zh-pinyin-pairs.mjs';

/**
 * 계약: 콘텐츠 병음 경성 게이트 (오너 결정 2026-09-02 「추천대로」 — 라운드 7 보고의 콘텐츠 후보 이행).
 *
 * 정답지가 원조로 적고 사전·라이브러리·구조 규칙이 경성으로 내던 45줄을 한 번 고치고, 규칙과 콘텐츠 준수를
 * 함께 못 박는다(성조 변조 게이트 zh-sandhi.mjs와 같은 구조). 표는 오너 승인 항목으로 닫혀 있다.
 */
const v = (zh, py) => neutralViolations(zh, py).map((x) => `${x.char}:${x.from}→${x.to}`);

describe('① 필독 경성 어휘 — 둘째 음절', () => {
  it('任务 rènwu·队伍 duìwu·答应 dāying — 원조면 위반, 경성이면 통과', () => {
    expect(v('你必须按时完成任务。', 'nǐ bìxū ànshí wánchéng rènwù')).toEqual(['务:wù→wu']);
    expect(v('你必须按时完成任务。', 'nǐ bìxū ànshí wánchéng rènwu')).toEqual([]);
    expect(v('门口排着长长的队伍。', 'ménkǒu pái zhe chángcháng de duìwǔ')).toEqual(['伍:wǔ→wu']);
    expect(v('他终于肯答应了。', 'tā zhōngyú kěn dāyìng le')).toEqual(['应:yìng→ying']);
  });

  it('음절 base가 다르면(다른 독음) 손대지 않는다 — 표는 「경성 여부」만 판정한다', () => {
    expect(v('他的衣服很新。', 'tā de yī fú hěn xīn')).toEqual(['服:fú→fu']);
    expect(v('他的衣服很新。', 'tā de yī fo hěn xīn')).toEqual([]); // 잘못 적힌 다른 음절은 음절 수 게이트의 몫
  });
});

describe('② 가능보어 가운데 不·得', () => {
  it('看得见 de·放不下 bu·看不见 bu', () => {
    expect(v('从这里看得见大海。', 'cóng zhèlǐ kàn dé jiàn dàhǎi')).toEqual(['得:dé→de']);
    expect(v('东西太多，箱子里放不下。', 'dōngxi tài duō, xiāngzi lǐ fàng bú xià')).toEqual(['不:bú→bu']);
    expect(v('黑夜里什么都看不见。', 'hēiyè lǐ shénme dōu kàn bu jiàn')).toEqual([]);
  });
});

describe('③ 경험상 过 — 닫힌 동사 목록 뒤, 방향보어·복합어 머리 앞은 제외', () => {
  it('去过·看过·吃过는 guo; 穿过·经过·错过는 목록 밖이라 원조 유지', () => {
    expect(v('我去过长城。', 'wǒ qù guò Chángchéng')).toEqual(['过:guò→guo']);
    expect(v('你有没有看过这部电影?', 'nǐ yǒu méiyǒu kàn guò zhè bù diànyǐng')).toEqual(['过:guò→guo']);
    expect(v('我去过长城。', 'wǒ qù guo Chángchéng')).toEqual([]);
    expect(v('他穿过马路。', 'tā chuān guò mǎlù')).toEqual([]);
    expect(v('我们经过公园。', 'wǒmen jīngguò gōngyuán')).toEqual([]);
    expect(GUO_VERBS.has('穿')).toBe(false);
    expect(GUO_VERBS.has('错')).toBe(false);
  });

  it('过来·过去·过年은 过가 뒤 글자와 한 단어 — 앞이 목록 동사여도 손대지 않는다', () => {
    expect(v('你看过来。', 'nǐ kàn guòlái')).toEqual([]);
    expect(v('我们去过年。', 'wǒmen qù guònián')).toEqual([]);
    expect(v('他说过去的事。', 'tā shuō guòqù de shì')).toEqual([]);
  });
});

describe('표는 닫혀 있고 콘텐츠는 전수 준수', () => {
  it('표 크기 핀 — 오너 승인 항목 그대로(넓히려면 실측과 함께)', () => {
    expect(Object.keys(NEUTRAL_WORDS)).toHaveLength(10);
    expect(Object.keys(COMPLEMENT_WORDS)).toHaveLength(3);
    expect(GUO_VERBS.size).toBe(27);
  });

  it('콘텐츠 트리(grammar·bunkei·vocab) 전수 — 위반 0 (2026-09-02 45건 교정 후)', () => {
    const bad = [];
    let pairs = 0;
    for (const sub of ['grammar', 'bunkei', 'vocab']) {
      const dir = `src/content/chinese/${sub}`;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.js')) continue;
        for (const { zh, pinyin } of collectZhPinyinPairs(readFileSync(`${dir}/${f}`, 'utf8'))) {
          pairs++;
          for (const x of neutralViolations(zh, pinyin)) bad.push(`${sub}/${f}: ${zh} — ${x.char} ${x.from}→${x.to}`);
        }
      }
    }
    expect(pairs).toBeGreaterThan(10000);
    expect(bad).toEqual([]);
  });
});
