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
  ['わ', null, 'ん', null, 'を'],
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

// 한국어 근사음 — 한국인 입문자용(로마자보다 직관적). 헵번 로마자 기준 매핑.
const KO_BY_ROMAJI = {
  a: '아', i: '이', u: '우', e: '에', o: '오',
  ka: '카', ki: '키', ku: '쿠', ke: '케', ko: '코',
  ga: '가', gi: '기', gu: '구', ge: '게', go: '고',
  sa: '사', shi: '시', su: '스', se: '세', so: '소',
  za: '자', ji: '지', zu: '즈', ze: '제', zo: '조',
  ta: '타', chi: '치', tsu: '츠', te: '테', to: '토',
  da: '다', de: '데', do: '도',
  na: '나', ni: '니', nu: '누', ne: '네', no: '노',
  ha: '하', hi: '히', fu: '후', he: '헤', ho: '호',
  ba: '바', bi: '비', bu: '부', be: '베', bo: '보',
  pa: '파', pi: '피', pu: '푸', pe: '페', po: '포',
  ma: '마', mi: '미', mu: '무', me: '메', mo: '모',
  ya: '야', yu: '유', yo: '요',
  ra: '라', ri: '리', ru: '루', re: '레', ro: '로',
  wa: '와', n: '응',
  kya: '캬', kyu: '큐', kyo: '쿄',
  sha: '샤', shu: '슈', sho: '쇼',
  cha: '차', chu: '추', cho: '초',
  nya: '냐', nyu: '뉴', nyo: '뇨',
  hya: '햐', hyu: '휴', hyo: '효',
  mya: '먀', myu: '뮤', myo: '묘',
  rya: '랴', ryu: '류', ryo: '료',
  gya: '갸', gyu: '규', gyo: '교',
  ja: '자', ju: '주', jo: '조',
  bya: '뱌', byu: '뷰', byo: '뵤',
  pya: '퍄', pyu: '퓨', pyo: '표',
};

export function koReading(kana) {
  return KO_BY_ROMAJI[toRomaji(kana)] || '';
}
