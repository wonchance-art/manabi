// 서버 전용 — 중국어 토큰화(단어 분할 + 병음).
// 분할: jieba-wasm(jieba-rs의 WASM 빌드 — 플랫폼 무관 단일 .wasm, 사전 임베드).
//   네이티브 @node-rs/jieba는 Vercel 서버리스에서 플랫폼 바이너리 로드가 실패해(#969 프로덕션
//   전량 분석 실패 사고) WASM으로 교체했다 — 로컬·리눅스·서버리스 어디서나 같은 파일로 동작한다.
// 병음: pinyin-pro(성조 기호). 중국어는 활용이 없어 base_form = 표면형이 그대로 표제어다.

import { tag as jiebaTag } from 'jieba-wasm';
import { pinyin } from 'pinyin-pro';

// jieba 품사 태그(중국어 관례) → 한국어 표기. 미지 태그는 null(뜻 조회 단계에서 채워질 수 있음).
const POS_KO = {
  n: '명사', nr: '인명', ns: '지명', nt: '기관명', nz: '고유명사',
  v: '동사', vd: '부사성 동사', vn: '명사성 동사',
  a: '형용사', ad: '부사성 형용사', an: '명사성 형용사',
  d: '부사', m: '수사', q: '양사', r: '대명사', p: '전치사',
  c: '접속사', u: '조사', xc: '허사', y: '어기조사', o: '의성어',
  e: '감탄사', i: '성어', l: '관용구', j: '약어', s: '처소사',
  t: '시간사', f: '방위사', b: '구별사', z: '상태사', h: '접두',
  k: '접미', g: '어소', w: '기호', x: '기타', eng: '외국어',
};

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
  const tokens = [];
  for (const { word, tag } of tagged) {
    const text = word;
    if (!text) continue;
    const isPunct = PUNCT.test(text) || tag === 'x' || tag === 'w';
    tokens.push({
      text,
      base_form: text,                       // 중국어는 굴절이 없다 — 표면형이 곧 표제어
      furigana: isPunct || !HAS_HANZI.test(text) ? '' : pinyin(text, { toneType: 'symbol', type: 'string' }),
      pos: isPunct ? '기호' : (POS_KO[tag] ?? null),
    });
  }
  return tokens;
}
