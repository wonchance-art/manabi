import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { toJaForm } from '../hanjaKo.js';
import { charDetail, charEtym } from '../charInspect.js';
import { viewerJapaneseGlyphTable } from '../viewerJapaneseReference.js';

// 계약: 일본식 자형(hanjaJa.json)은 일본 상용·인명용 한자를 다른 글자로 바꾸지 않는다
// (2026-10-07 KST 결함 수정 — 다대일 오류). 일본어 자료 글자 카드에서 面을 누르면
// 「日 麺」, 중국어 단어창 일본어 대조에 方面 → 方麺 · 历史 → 暦史 · 观众 → 観眾이 떴다.
// 원인: 간체 → 정체 후보(Unihan kTraditionalVariant) 중 드문 글자(麵·衕·閤·迴)를 고르고
// 그 신자체를 일본 자형으로 적었다. 수정: 생성기가 원 글자 자체가 일본 표준 한자
// (Unihan kJoyoKanji · kJinmeiyoKanji 본 목록)이면 그대로 두고, 표준 한자에 닿는 후보와
// OpenCC 빈도 순을 먼저 고른다(scripts/generate-hanja-ja.mjs). 화면 경로는 둘이다 —
// 단어창 toJaForm(ViewerJapaneseReference)과 글자 카드 日 칩(charDetail.ja ∪ charEtym.jaOfTrad).

const readData = (f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data', f), 'utf8'));
const ja = viewerJapaneseGlyphTable(readData('hanjaJa.json')); // 화면과 같은 표(ViewerPage 로드 경로)
const etym = readData('hanjaEtym.json');
// 글자 카드 日 칩 = ViewerPage formChip('日', [d.ja, etym.jaOfTrad]) — 일본어 자료는 단어 맥락 없음
const jaChip = (ch) => [...new Set([charDetail(ch, { jaTable: ja })?.ja, charEtym(ch, etym, { jaTable: ja })?.jaOfTrad].filter(Boolean))];

// main(db86e433)에서 다른 글자로 바뀌던 상용한자 53자(出·表·家는 viewerJapaneseGlyphTable이
// 이미 보정)와 인명용 한자 21자(庄은 번체 경유 사슬로 荘). 설계서 AE-R3 §3.2 C의 52자
// (KANJIDIC 등급 ≤8 기준)를 Unihan kJoyoKanji 2010 기준으로 다시 잰 목록이다.
const JOYO_REMAPPED = '了借克冬准出制剥千厘合同后向回困坂填家干征志惧戯折挙据携斗旋曲朱朴机松板沈注症着秋系累致芸蔑表谷踊踪采里面';
const JINMEIYO_REMAPPED = '丑云俣卜厨厩只叶怜挽晒栖栗淀瑶筑肴胡蒙郁庄';

// Unihan kJapaneseNewVariant(unicodetools @ e4a5a6c9, 호환 한자 제외) 구자체→신자체 302쌍 —
// 본문이 구자체로 와도 신자체 정본으로 보인다(國→国 · 學→学). 이 수정 전후 불변.
const KJNV_PAIRS = '乘乗亂乱亞亜佛仏來来倂併假仮傳伝僞偽價価儉倹兒児兩両剩剰劍剣劑剤勞労勳勲勵励勸勧區区卷巻卽即參参單単嚴厳囑嘱圈圏國国圍囲圓円圖図團団增増墮堕壓圧壘塁壞壊壤壌壯壮壹壱壽寿奧奥奬奨孃嬢學学寢寝實実寫写寬寛寶宝將将專専對対屆届屬属峽峡嶽岳巢巣帶帯廢廃廣広廳庁彈弾彌弥徑径從従徵徴德徳恆恒惠恵惡悪惱悩愼慎慘惨應応懷懐戀恋戰戦戲戯戾戻拂払拔抜拜拝挾挟插挿揭掲搖揺搜捜擇択擊撃擔担據拠擧挙擴拡攝摂收収效効敍叙敕勅數数斷断晚晩晝昼曆暦曉暁曾曽會会條条棧桟榮栄槪概樂楽樓楼樞枢樣様橫横檢検櫻桜權権歐欧歡歓步歩歷歴歸帰殘残殼殻毆殴每毎氣気涉渉淚涙淨浄淺浅渴渇溪渓溫温滯滞滿満潛潜澁渋澤沢濕湿濟済濱浜瀧滝瀨瀬灣湾燈灯燒焼營営爐炉爭争爲為犧犠狀状狹狭獨独獵猟獸獣獻献瓣弁甁瓶畫画當当疊畳瘦痩癡痴發発盜盗盡尽眞真硏研碎砕祕秘禪禅禮礼稱称稻稲穗穂穩穏竊窃竝並粹粋絲糸經経綠緑緖緒緣縁縣県縱縦總総繩縄繪絵繼継續続纖繊缺欠罐缶聲声聽聴肅粛腦脳膽胆臟臓臺台與与舊旧艷艶莊荘莖茎萬万薰薫藏蔵藝芸藥薬處処虛虚號号螢蛍蟲虫蠶蚕蠻蛮衞衛裝装襃褒覺覚覽覧觀観觸触謠謡證証譯訳譽誉讀読變変讓譲豐豊豫予貳弐賣売賴頼贊賛踐践輕軽轉転辨弁辭辞辯弁遞逓遲遅邊辺郞郎鄕郷醉酔醫医釀醸釋釈錄録錢銭鍊錬鎭鎮鐵鉄鑄鋳鑛鉱關関陷陥隨随險険隱隠雙双雜雑霸覇靈霊靜静顯顕飜翻餘余餠餅騷騒驅駆驗験驛駅髓髄體体髮髪鬭闘鷄鶏鹽塩麥麦麵麺黃黄黑黒默黙點点黨党齊斉齋斎齒歯齡齢龍竜龜亀';

describe('일본식 자형 — 일본 표준 한자는 다른 글자로 바뀌지 않는다', () => {
  it('중국어 단어창 일본어 대조: 方面 · 历史 · 观众 등 대표 단어가 일본 자형으로 보인다', () => {
    const cases = {
      方面: '方面', 表面: '表面', 历史: '歴史', 经历: '経歴', 观众: '観衆', 大众: '大衆',
      同学: '同学', 合作: '合作', 回来: '回来', 方向: '方向', 了解: '了解', 冬天: '冬天',
      歌曲: '歌曲', 一千: '一千', 控制: '控制', 光线: '光線', 冲突: '衝突',
    };
    for (const [word, form] of Object.entries(cases)) expect(toJaForm(word, ja), word).toBe(form);
  });

  it('일본어 자료 글자 카드: 面·同·合·回·了 등을 눌러도 日 칩에 다른 글자가 없다', () => {
    for (const ch of '面同合回了千冬曲向系征据斗干里表出家') expect(jaChip(ch), ch).toEqual([]);
  });

  it('main에서 바뀌던 상용 53자 · 인명용 21자 전부 — 단어창 꼴과 글자 카드 칩이 그 글자 그대로', () => {
    expect([...JOYO_REMAPPED]).toHaveLength(53);
    expect([...JINMEIYO_REMAPPED]).toHaveLength(21);
    for (const ch of JOYO_REMAPPED + JINMEIYO_REMAPPED) {
      expect(toJaForm(ch, ja), ch).toBe(ch);
      expect(jaChip(ch), ch).toEqual([]);
    }
  });
});

describe('일본식 자형 — 기존 정상 매핑 회귀', () => {
  it('구자체→신자체 302쌍(kJapaneseNewVariant)이 단어창·글자 카드 모두 그대로다', () => {
    const pairs = [...KJNV_PAIRS];
    expect(pairs).toHaveLength(604);
    for (let i = 0; i < pairs.length; i += 2) {
      const [oldForm, newForm] = [pairs[i], pairs[i + 1]];
      expect(toJaForm(oldForm, ja), oldForm).toBe(newForm);
      expect(charDetail(oldForm, { jaTable: ja }).ja, oldForm).toBe(newForm);
    }
  });

  it('간체 → 일본 자형 표본(老師 · 図書館 · 発 · 譲)과 인명용 구자체 쌍(遙→遥 · 祿→禄)은 유지', () => {
    expect(toJaForm('老师 图书馆 让 广 单 译', ja)).toBe('老師 図書館 譲 広 単 訳');
    expect(toJaForm('发', ja)).toBe('発');
    expect(toJaForm('遙 祿', ja)).toBe('遥 禄');
  });
});

describe('생성기 계약 — 보존 규칙과 결정적 입력', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'scripts/generate-hanja-ja.mjs'), 'utf8');
  it('상용·인명용 한자 목록을 오프라인 인자로 읽고, 보존 대상이 키로 남으면 생성이 실패한다', () => {
    expect(src).toContain('<kJoyoKanji.txt> <kJinmeiyoKanji.txt>');
    expect(src).toContain('const keepsOwnForm = (ch) => joyo.has(ch) || (jinmeiyo.has(ch) && !isOldForm(ch));');
    expect(src).toMatch(/if \(kept\.length\) throw new Error/);
    expect(src).toContain('17.0.0');
  });
});
