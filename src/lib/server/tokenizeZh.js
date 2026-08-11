// 서버 전용 — 중국어 토큰화(단어 분할 + 병음).
// 분할: @node-rs/jieba(Rust 네이티브 바인딩, 사전 동봉 — 네이티브 빌드 불필요).
// 병음: pinyin-pro(성조 기호). 중국어는 활용이 없어 base_form = 표면형이 그대로 표제어다.
// 인스턴스는 모듈 스코프 lazy 싱글턴 — 사전 로드(11MB급)를 요청마다 반복하지 않는다.

import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict.js'; // ESM은 확장자 필수(번들러 밖 순수 Node 실행 대비)
import { pinyin } from 'pinyin-pro';

let jieba = null;
function getJieba() {
  if (!jieba) jieba = Jieba.withDict(dict);
  return jieba;
}

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
  const tagged = getJieba().tag(line, true);
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
