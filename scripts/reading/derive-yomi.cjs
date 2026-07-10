#!/usr/bin/env node
/**
 * derive-yomi — kuromoji로 일본어 문장의 전문(全文) 히라가나 요미를 파생한다.
 * 헌법: 요미는 사람이 손으로 쓰지 않는다(생성 게이트 통과 후 입고). 이 모듈이 유일한 요미 원천.
 *
 * 모듈 사용:  const { deriveYomi } = require('./derive-yomi.cjs'); await deriveYomi('私は空港へ行く');
 * CLI 사용:   node scripts/reading/derive-yomi.cjs "私は空港へ行く"
 *             echo "私は空港へ行く" | node scripts/reading/derive-yomi.cjs
 *
 * 규칙:
 *   - 각 토큰의 reading(카타카나)을 히라가나로 변환해 이어 붙인다.
 *   - reading이 없는 토큰(기호·숫자·미지어)은 표층형(surface_form)을 그대로 통과시킨다.
 *   - 출력은 check-furigana.mjs의 alignFurigana 정렬을 통과하는 형식(구두점 보존).
 */
const path = require('node:path');
const kuromoji = require('kuromoji');

const DIC_PATH = path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict');

let _tokenizer = null;
let _building = null;

/** kuromoji 토크나이저를 1회 빌드 후 캐시 */
function getTokenizer() {
  if (_tokenizer) return Promise.resolve(_tokenizer);
  if (_building) return _building;
  _building = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: DIC_PATH }).build((err, tok) => {
      if (err) return reject(err);
      _tokenizer = tok;
      resolve(tok);
    });
  });
  return _building;
}

/** 카타카나 → 히라가나 (장음부 ー는 그대로) */
function kataToHira(str) {
  return String(str || '').replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/** 한 토큰의 요미 조각을 만든다 — reading 우선, 없으면 표층형 통과 */
function tokenYomi(t) {
  const reading = t.reading && t.reading !== '*' ? t.reading : null;
  if (!reading) return t.surface_form; // 숫자·기호·미지어 통과
  return kataToHira(reading);
}

/**
 * 문장의 전문 히라가나 요미를 파생한다.
 * @param {string} sentence 일본어 문장
 * @returns {Promise<string>} 히라가나 요미(구두점 보존)
 */
async function deriveYomi(sentence) {
  if (!sentence || !sentence.trim()) return '';
  const tok = await getTokenizer();
  const tokens = tok.tokenize(sentence);
  return tokens.map(tokenYomi).join('');
}

module.exports = { deriveYomi, kataToHira, getTokenizer };

// ── CLI ──
if (require.main === module) {
  (async () => {
    let input = process.argv.slice(2).join(' ').trim();
    if (!input) {
      input = require('node:fs').readFileSync(0, 'utf8').trim();
    }
    if (!input) {
      console.error('usage: node scripts/reading/derive-yomi.cjs "<일본어 문장>"');
      process.exit(1);
    }
    // 줄 단위 처리(여러 문장 파이프 입력 허용)
    const lines = input.split(/\r?\n/).filter((l) => l.trim());
    for (const line of lines) {
      console.log(await deriveYomi(line));
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
