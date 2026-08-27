// 서버 전용 — 중국어 토큰화(단어 분할 + 병음).
// 분할: jieba-wasm(jieba-rs의 WASM 빌드 — 플랫폼 무관 단일 .wasm, 사전 임베드).
//   네이티브 @node-rs/jieba는 Vercel 서버리스에서 플랫폼 바이너리 로드가 실패해(#969 프로덕션
//   전량 분석 실패 사고) WASM으로 교체했다 — 로컬·리눅스·서버리스 어디서나 같은 파일로 동작한다.
// 병음: pinyin-pro(성조 기호). 중국어는 활용이 없어 base_form = 표면형이 그대로 표제어다.

import { tag as jiebaTag } from 'jieba-wasm';
import { pinyin } from 'pinyin-pro';
import { ZH_NEUTRAL_TONE } from './zhNeutralTone';

// jieba 품사 태그(중국어 관례) → 한국어 표기. 미지 태그는 null(뜻 조회 단계에서 채워질 수 있음).
const POS_KO = {
  n: '명사', nr: '인명', ns: '지명', nt: '기관명', nz: '고유명사',
  v: '동사', vd: '부사성 동사', vn: '명사성 동사',
  a: '형용사', ad: '부사성 형용사', an: '명사성 형용사',
  d: '부사', m: '수사', q: '양사', r: '대명사', p: '전치사',
  c: '접속사', u: '조사', xc: '허사', y: '어기조사', o: '의성어',
  // jieba 세부 조사 태그(uj=的·ul=了·ud=得·uv=地·uz=着·ug=过) — 누락 시 초고빈도 조사가
  // 품사 미상으로 남아 문맥 판별 대상에 매번 끼어든다(프롬프트 낭비).
  uj: '조사', ul: '조사', ud: '조사', uv: '조사', uz: '조사', ug: '조사',
  e: '감탄사', i: '성어', l: '관용구', j: '약어', s: '처소사',
  t: '시간사', f: '방위사', b: '구별사', z: '상태사', h: '접두',
  k: '접미', g: '어소', w: '기호', x: '기타', eng: '외국어',
};

// jieba 겸류(兼类) 태그 → 품사 후보('·' 연결, 기본 계열 우선). 중국어는 한 단어가 명사·동사
// 등으로 두루 쓰이는데 jieba는 문맥과 무관하게 단어당 한 태그만 단다(실측: 工作은 我在工作
// 에서도 vn). 후보를 pos_all로 실어 보내면 /api/analyze의 문맥 판별기(disambiguateZhPos)가
// 문장에 맞는 하나를 짚고, 판별 실패 시 첫 후보가 폴백 표시가 된다.
const POS_ALL = { vn: '동사·명사', vd: '동사·부사', an: '형용사·명사', ad: '형용사·부사' };

const HAS_HANZI = /[一-鿿]/;
const PUNCT = /^[\s。、，．！？!?,.:;：；""''「」『』（）()【】…·\-—～~]+$/;

/**
 * 한 줄 → 토큰 배열. 다른 언어 토크나이저와 동일 계약:
 *   { text, base_form, furigana, pos }
 * furigana 슬롯에 병음을 담는다(영어가 IPA를 담는 것과 같은 관례 — 뷰어·단어장이 그대로 렌더).
 */
export function tokenizeZhLine(line) {
  if (!line || !line.trim()) return [];
  const tagged = jiebaTag(line, true);

  // 병음은 단어별이 아니라 줄 전체를 한 번에 — pinyin-pro가 문장 문맥으로 다음자·성조
  // 변조를 처리한다(단어별 호출은 不对→bù(변조 누락)·走了→liǎo(오독) 등 실측 오류, #1004).
  // type:'all'은 줄의 모든 문자를 순서대로 돌려주므로 글자 수만큼 소비해 토큰에 재분배한다.
  const perChar = pinyin(line, { toneType: 'symbol', type: 'all' });
  let ci = 0;
  // 토큰 글자를 perChar의 origin과 맞춰 소비 — jieba가 건너뛰는 문자(공백 등)가 있어도
  // 정렬이 어긋나지 않게 매칭될 때까지 전진한다. 매칭 실패 시 단어 단위 폴백.
  const takeSyllables = (chars) => {
    const out = [];
    for (const ch of chars) {
      while (ci < perChar.length && perChar[ci].origin !== ch) ci++;
      if (ci >= perChar.length) return null;
      out.push(perChar[ci].pinyin || '');
      ci++;
    }
    return out;
  };

  const tokens = [];
  for (const { word, tag } of tagged) {
    const text = word;
    if (!text) continue;
    // x(기타)·w(기호) 태그는 문장부호가 관례지만, jieba는 사전에 없는 한자 조합
    // (这宗·笔在·项有 등 HMM 병합 OOV)에도 x를 단다 — 한자를 포함하면 실단어로 취급해
    // 병음을 달고 품사는 미상(null)으로 남긴다(문맥 판별기가 채움). 오너 보고 실측.
    const isPunct = PUNCT.test(text) || ((tag === 'x' || tag === 'w') && !HAS_HANZI.test(text));
    const chars = [...text];
    // 줄 병음을 먼저 소비해 글자-병음 정렬을 유지하고, 필독 경성 어휘는 토큰 단위로만
    // 오버라이드한다(zhNeutralTone.js — customPinyin 전역 등록은 단어 경계 오염 실측으로 배제).
    const lineSyllables = takeSyllables(chars);
    const override = !isPunct && ZH_NEUTRAL_TONE[text];
    const syllables = override
      ? override.split(' ')
      : (lineSyllables ?? [pinyin(text, { toneType: 'symbol', type: 'string' })]).filter(Boolean);
    tokens.push({
      text,
      base_form: text,                       // 중국어는 굴절이 없다 — 표면형이 곧 표제어
      furigana: isPunct || !HAS_HANZI.test(text) ? '' : syllables.join(' '),
      pos: isPunct ? '기호' : (POS_KO[tag] ?? null),
      ...(!isPunct && POS_ALL[tag] ? { pos_all: POS_ALL[tag] } : {}),
    });
  }
  return tokens;
}
