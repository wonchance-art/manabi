// 중국어 경성(轻声) 오버라이드 사전 — 필독 경성 어휘의 표준 병음 (오너 승인 2026-08-27).
//
// 왜 필요한가: pinyin-pro(3.28.2)의 내장 사전은 경성을 부분적으로만 안다. 조사(了)·
// 친족 중첩(妈妈)·접미 子/头(椅子·石头)·일부 어휘(漂亮·便宜·喜欢)는 맞게 내지만,
// 필독 경성(必读轻声) 어휘 다수(朋友→péng yǒu, 时候→shí hòu)와 V不C 가능보어의
// 不(怪不得→guài bù dé, 실제는 guài bu de)를 원조(citation tone)로 낸다 — 오너 실측 보고.
//
// 적용 방식: tokenizeZh가 jieba 분할 뒤 **토큰 텍스트가 이 사전 키와 정확히 일치할 때만**
// 줄 병음 대신 이 값을 쓴다. pinyin-pro의 customPinyin 전역 등록은 쓰지 않는다 —
// 문자열 매칭이 단어 경계를 무시해 오염이 실측됐다(这本|事先에 本事가 걸치고,
// 东西南北가 dōng xi로 변함). 토큰 단위 적용이면 东西南北는 jieba 단일 토큰이라
// 사전 비적용(실측), 경계 걸침은 원천 불성립.
//
// 등재 기준(수제 층 — 전부 pinyin-pro 3.28.2 실측으로 걸렀다):
// ① 라이브러리가 이미 맞게 내는 39종(爸爸·妈妈류, 子/头 접미, 认识·觉得·喜欢·休息·
//    便宜·聪明·大夫 등)은 싣지 않는다. 라이브러리 업그레이드 시 재실측 후 증감.
// ② 문맥에 따라 경성 여부가 갈리는 다의어는 배제: 大意(부주의 dàyi/대의 dàyì)·
//    地道(진짜 dìdao/터널 dìdào)·买卖(장사 mǎimai/매매 mǎimài) 등 — 틀릴 수 있는 건 안 싣는다.
//    예외로 东西만 등재: 학습 텍스트에서 '물건'(dōngxi)이 압도적이고, 방향 의미의 주 출현형
//    东西南北는 단일 토큰이라 비적용. 잔여(단독 东西가 방위 의미)는 뷰어 '뜻·발음 수정'으로.
// ③ 방향보어(V+出来/下去 등)와 접미 边(上边 등)은 가벼운 읽기(可轻读) 논쟁권이라 v1 배제.
//
// 2층 구조(분석 개선 R2 — 오너 승인 2026-08-29): 아래 수제 층(HAND) 밑에 CC-CEDICT
// 추출층 2,034항(zhNeutralToneCedict.json — scripts/build-zh-neutral-tone.mjs가 위
// 기준 ①~③을 그대로 기계화해 생성, 다의어·고유명사·얼화·5자 이상 배제)을 깐다.
// 수제 층이 항상 이긴다 — CEDICT가 원조를 고집하는 필독 경성(知道 zhi1 dao4)이나
// 이독 병존(告诉)은 수제가 정본이다. CEDICT 층 데이터: CC-CEDICT © MDBG,
// CC BY-SA 4.0 (https://www.mdbg.net/chinese/dictionary?page=cc-cedict — 출처 표기 의무).
//
// 값 형식: 글자당 1음절, 공백 구분 — tokenizeZh가 split(' ')로 재분배한다.

import ZH_NEUTRAL_TONE_CEDICT from './data/zhNeutralToneCedict.json';

const HAND = {
  // ── 호칭·사람 ──
  先生: 'xiān sheng',
  太太: 'tài tai',
  姑娘: 'gū niang',
  朋友: 'péng you',

  // ── 명사 ──
  东西: 'dōng xi', // '물건' — 등재 기준 ② 예외 항목
  意思: 'yì si',
  时候: 'shí hou',
  名字: 'míng zi',
  眼睛: 'yǎn jing',
  事情: 'shì qing',
  关系: 'guān xi',
  月亮: 'yuè liang',
  星星: 'xīng xing',
  消息: 'xiāo xi',
  麻烦: 'má fan',
  热闹: 'rè nao',
  学问: 'xué wen',
  本事: 'běn shi',
  点心: 'diǎn xin',
  葡萄: 'pú tao',
  玻璃: 'bō li',
  饺子: 'jiǎo zi', // 子 접미 대부분은 라이브러리가 처리하나 饺子만 원조로 냄 — 실측 예외

  // ── 동사·형용사 ──
  知道: 'zhī dao',
  告诉: 'gào su',
  打算: 'dǎ suan',
  商量: 'shāng liang',
  打听: 'dǎ ting',
  收拾: 'shōu shi',
  打扮: 'dǎ ban',
  明白: 'míng bai',
  清楚: 'qīng chu',
  舒服: 'shū fu',
  客气: 'kè qi',
  糊涂: 'hú tu',

  // ── 가능보어 V不C·고정구 — 不·得가 경성 ──
  怪不得: 'guài bu de',
  对不起: 'duì bu qǐ',
  来不及: 'lái bu jí',
  差不多: 'chà bu duō',
  了不起: 'liǎo bu qǐ',
  受不了: 'shòu bu liǎo',
  忍不住: 'rěn bu zhù',
  舍不得: 'shě bu de', // 라이브러리는 shè bù dé — 첫 글자 성조(shě)까지 틀리는 항목
  恨不得: 'hèn bu de',
  说不定: 'shuō bu dìng',
  看不起: 'kàn bu qǐ',
  买不起: 'mǎi bu qǐ',
};

export const ZH_NEUTRAL_TONE = { ...ZH_NEUTRAL_TONE_CEDICT, ...HAND };
