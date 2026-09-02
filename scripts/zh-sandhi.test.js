import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sandhiTarget, sandhiViolations, syllabify } from './zh-sandhi.mjs';
import { collectZhPinyinPairs } from './zh-pinyin-pairs.mjs';

/**
 * 계약: 중국어 성조 변조 표기 (오너 확정 2026-09-02 — 一·不 변조 표기 통일, 个 양사 경성).
 *
 * 정답지는 카드 예문 병음으로 학습자에게 그대로 보인다. 전수 교정(457건)을 한 번 하고 끝내면 다음
 * 저작에서 다시 갈리므로, 규칙과 콘텐츠 준수를 함께 못 박는다.
 */
const v = (zh, py) => sandhiViolations(zh, py).map((x) => `${x.char}:${x.from}→${x.to}`);

describe('一 — 뒤 성조로 갈린다', () => {
  it('뒤 4성·경성은 yí, 1·2·3성은 yì', () => {
    expect(v('我有一个哥哥。', 'wǒ yǒu yī gè gēge')).toEqual(['一:yī→yí', '个:gè→ge']);
    expect(v('买了一张票。', 'mǎi le yī zhāng piào')).toEqual(['一:yī→yì']);   // zhāng 1성
    expect(v('他一直很忙。', 'tā yī zhí hěn máng')).toEqual(['一:yī→yì']);     // zhí 2성
    expect(v('看我一眼。', 'kàn wǒ yī yǎn')).toEqual(['一:yī→yì']);            // yǎn 3성
    expect(v('等一下。', 'děng yí xià')).toEqual([]);                          // xià 4성 — 이미 맞음
  });

  it('끝음절 어휘는 yī를 지킨다 — 콘텐츠 표제어에서 뽑은 닫힌 목록', () => {
    for (const [zh, py] of [['这是我第一次。', 'zhè shì wǒ dì yī cì'], ['他是我朋友之一。', 'tā shì wǒ péngyou zhī yī'],
      ['万一下雨呢。', 'wàn yī xià yǔ ne'], ['这是唯一的办法。', 'zhè shì wéi yī de bànfǎ'],
      ['同一个人。', 'tóng yī ge rén'], ['周一开会。', 'zhōu yī kāi huì']])
      expect(v(zh, py), zh).toEqual([]);
  });

  it('앞 글자가 다른 단어면 변조한다 — 四周|一片·总之|一切', () => {
    expect(v('四周一片寂静。', 'sì zhōu yī piàn jì jìng')).toEqual(['一:yī→yí']);
    expect(v('四周一片寂静。', 'sì zhōu yí piàn jì jìng')).toEqual([]);
  });

  it('이미 경성인 V一V는 손대지 않는다', () => {
    expect(v('你看一看。', 'nǐ kàn yi kàn')).toEqual([]);
  });
});

describe('不 — 뒤 4성 앞에서만 bú', () => {
  it('뒤 4성은 bú, 그 밖은 bù', () => {
    expect(v('我不要。', 'wǒ bù yào')).toEqual(['不:bù→bú']);
    expect(v('我不忙。', 'wǒ bù máng')).toEqual([]);
    expect(v('文章开头不对。', 'wénzhāng kāitóu bú duì')).toEqual([]);
  });

  it('A不A는 경성 — 앞뒤 음절이 성조까지 같을 때만', () => {
    expect(v('你能不能来？', 'nǐ néng bù néng lái')).toEqual(['不:bù→bu']);
    expect(v('热得不得了。', 'rè de bù dé liǎo')).toEqual([]);   // de/dé — A不A 아님
  });

  it('가능보어의 경성은 그대로', () => {
    expect(v('我听不懂。', 'wǒ tīng bu dǒng')).toEqual([]);
  });
});

describe('个 — 양사 자리는 경성', () => {
  it('수사·지시사 뒤는 ge', () => {
    for (const [zh, py] of [['两个人', 'liǎng gè rén'], ['每个人', 'měi gè rén'], ['这个月', 'zhè gè yuè']])
      expect(v(zh, py), zh).toEqual(['个:gè→ge']);
  });

  it('어휘의 个는 gè를 지킨다', () => {
    for (const [zh, py] of [['他个子很高。', 'tā gè zi hěn gāo'], ['个人的看法', 'gè rén de kànfǎ'],
      ['整个城市', 'zhěng gè chéngshì'], ['各个国家', 'gè gè guójiā']])
      expect(v(zh, py), zh).toEqual([]);
  });

  it('양사 자리가 어휘 예외를 이긴다 — 两个子女는 两+个+子女', () => {
    expect(v('他有两个子女。', 'tā yǒu liǎng gè zǐnǚ')).toEqual(['个:gè→ge']);
  });
});

describe('안전장치', () => {
  it('문장 첫머리 대문자를 보존한다', () => {
    expect(sandhiViolations('不要抽烟。', 'Bù yào chōuyān')[0].to).toBe('Bú');
  });

  it('정렬 불가한 줄은 손대지 않는다 — 儿화·라틴 혼용', () => {
    expect(v('我在这儿。', 'wǒ zài zhèr')).toEqual([]);
    expect(v('A比B高。', 'A bǐ B gāo')).toEqual([]);
  });

  it('음절 분해기가 표준 병음을 나눈다', () => {
    expect(syllabify('zhōngguó')).toEqual(['zhōng', 'guó']);
    expect(syllabify('yíge')).toEqual(['yí', 'ge']);
  });

  it('규칙 밖 글자는 null', () => {
    expect(sandhiTarget(['我'], ['wǒ'], 0)).toBeNull();
  });
});

describe('콘텐츠 전수 — 위반 0', () => {
  it('zh 콘텐츠 파일 전체에서 규칙 위반이 없다', () => {
    const bad = []; let pairs = 0;
    for (const sub of ['grammar', 'bunkei', 'vocab']) {
      for (const f of readdirSync(`src/content/chinese/${sub}`)) {
        if (!f.endsWith('.js')) continue;
        for (const p of collectZhPinyinPairs(readFileSync(`src/content/chinese/${sub}/${f}`, 'utf8'))) {
          pairs++;
          for (const x of sandhiViolations(p.zh, p.pinyin))
            bad.push(`${sub}/${f} ${p.zh} ∥ ${p.pinyin} — ${x.char} ${x.from}→${x.to}`);
        }
      }
    }
    expect(pairs).toBeGreaterThan(15000);   // 공허 통과 방지
    expect(bad.slice(0, 10)).toEqual([]);
    expect(bad).toHaveLength(0);
  }, 60000);
});
