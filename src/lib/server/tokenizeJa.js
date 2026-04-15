// 서버 전용 — 일본어 형태소 분석 (kuromoji)
// Vercel serverless에서 dict는 node_modules에서 읽음. 첫 호출 시 ~1-2초 로드 후 인스턴스 캐시.

import { getTokenizer } from 'kuromojin';
import path from 'node:path';

let _tokenizerPromise = null;

function getDictPath() {
  // node_modules/kuromoji/dict 를 런타임에 찾아감
  // Next.js/Vercel 빌드 시 dict 파일도 포함되도록 outputFileTracing 필요 (next.config)
  // 일단 일반 경로 사용
  return path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict');
}

export async function getJaTokenizer() {
  if (_tokenizerPromise) return _tokenizerPromise;
  _tokenizerPromise = getTokenizer({ dicPath: getDictPath() });
  return _tokenizerPromise;
}

/** 카타카나 → 히라가나 */
export function katakanaToHiragana(str) {
  if (!str) return '';
  return str.replace(/[\u30A1-\u30FA]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** kuromoji 품사(일본어) → 한국어 표기 */
const POS_MAP = {
  '名詞': '명사',
  '動詞': '동사',
  '形容詞': '형용사',
  '形容動詞': '형용동사',
  '副詞': '부사',
  '連体詞': '연체사',
  '接続詞': '접속사',
  '感動詞': '감탄사',
  '助詞': '조사',
  '助動詞': '조동사',
  '記号': '기호',
  '接頭詞': '접두사',
  'フィラー': '간투사',
  'その他': '기타',
};

function posToKorean(jaPos) {
  return POS_MAP[jaPos] || jaPos || '기타';
}

/**
 * 한 줄을 kuromoji로 분석해 토큰 배열 반환
 * 반환 형식은 processed_json의 dictionary 항목과 호환
 */
export async function tokenizeJaLine(line) {
  if (!line || !line.trim()) return [];
  const tokenizer = await getJaTokenizer();
  const tokens = tokenizer.tokenize(line);

  return tokens.map((t) => {
    // basic_form이 "*"면 surface 그대로 사용
    const baseForm = (t.basic_form && t.basic_form !== '*') ? t.basic_form : t.surface_form;
    const reading = katakanaToHiragana(t.reading || '');
    const pos = posToKorean(t.pos);

    return {
      text: t.surface_form,
      base_form: baseForm,
      furigana: reading,
      pos,
      // meaning은 DB/Gemini에서 나중에 채움
    };
  });
}
