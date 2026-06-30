// 오십음표(gojūon) 순서 데이터 — 히라가나·가타카나, 기본 + 탁음/반탁음 + 요음.
// 카나 문자만 보관(없는 칸은 null). 로마자는 kanaRomaji.toRomaji로 산출(중복 정의 X).
import { toRomaji } from './kanaRomaji';

// ── 히라가나 기본 5×10 (없는 칸 null) ──
const HIRA_BASIC = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', null, 'ゆ', null, 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', null, null, null, 'を'],
  ['ん', null, null, null, null],
];

// ── 탁음·반탁음 ──
const HIRA_DAKUTEN = [
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
];

// ── 요음 ──
const HIRA_YOON = [
  ['きゃ', 'きゅ', 'きょ'],
  ['しゃ', 'しゅ', 'しょ'],
  ['ちゃ', 'ちゅ', 'ちょ'],
  ['にゃ', 'にゅ', 'にょ'],
  ['ひゃ', 'ひゅ', 'ひょ'],
  ['みゃ', 'みゅ', 'みょ'],
  ['りゃ', 'りゅ', 'りょ'],
  ['ぎゃ', 'ぎゅ', 'ぎょ'],
  ['じゃ', 'じゅ', 'じょ'],
  ['びゃ', 'びゅ', 'びょ'],
  ['ぴゃ', 'ぴゅ', 'ぴょ'],
];

// 히라가나 → 가타카나 (메인 블록 U+3041–U+3096 만 +0x60). 가타카나 표는 자동 생성.
function hiraToKata(s) {
  if (s == null) return null;
  return [...s].map(c => {
    const code = c.charCodeAt(0);
    return code >= 0x3041 && code <= 0x3096 ? String.fromCharCode(code + 0x60) : c;
  }).join('');
}
const kataTable = rows => rows.map(row => row.map(hiraToKata));

export const GOJUON = {
  hiragana: { basic: HIRA_BASIC, dakuten: HIRA_DAKUTEN, yoon: HIRA_YOON },
  katakana: { basic: kataTable(HIRA_BASIC), dakuten: kataTable(HIRA_DAKUTEN), yoon: kataTable(HIRA_YOON) },
};

export const SET_LABELS = { basic: '기본', dakuten: '탁음·반탁음', yoon: '요음' };
export const ALL_SETS = ['basic', 'dakuten', 'yoon'];

// 선택한 세트의 카나를 평면 배열로 (없는 칸 제외)
export function kanaList(kind, sets = ALL_SETS) {
  const t = GOJUON[kind];
  const out = [];
  for (const s of sets) {
    for (const row of t[s] || []) {
      for (const k of row) if (k) out.push(k);
    }
  }
  return out;
}

// 테스트 정답 허용셋 — 헵번(toRomaji) + 흔한 대체표기(훈령식 등)
const ALIASES = {
  shi: ['si'], chi: ['ti'], tsu: ['tu'], fu: ['hu'],
  ji: ['zi', 'di'], zu: ['du'],
  sha: ['sya'], shu: ['syu'], sho: ['syo'],
  cha: ['tya'], chu: ['tyu'], cho: ['tyo'],
  ja: ['zya', 'jya'], ju: ['zyu', 'jyu'], jo: ['zyo', 'jyo'],
};

export function acceptedRomaji(kana) {
  const base = toRomaji(kana);
  const set = new Set([base]);
  (ALIASES[base] || []).forEach(a => set.add(a));
  if (kana === 'を' || kana === 'ヲ') set.add('wo');   // toRomaji는 'o' — wo도 허용
  if (kana === 'ん' || kana === 'ン') set.add('nn');   // n / nn 모두 허용
  return set;
}
