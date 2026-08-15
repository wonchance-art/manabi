// 한자→한국 한자음 정적 테이블 생성 — 옵트인 '한자 대조'(중국어 뷰어) 1단계 데이터.
// 소스: npm `hanja`(MIT, rockpicado/hanja)의 hanjaeum.json(27,497자 — 간체 직접 수록 실측:
// 师=사·图=도·让=양·汉=한, 상용 간체 표본 40자 미싱 0). CJK 통합 메인 블록(U+4E00–9FFF)만
// 추출해 번들 크기를 줄인다(20,902자). 네트워크 없는 결정적 생성 — 산출물은 커밋한다.
//
// 재생성: node scripts/generate-hanja-ko.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = JSON.parse(
  fs.readFileSync(path.join(root, 'node_modules/hanja/lib/data/hanjaeum.json'), 'utf8')
);

const out = {};
let count = 0;
for (const [ch, reading] of Object.entries(src)) {
  const cp = ch.codePointAt(0);
  if (cp < 0x4e00 || cp > 0x9fff) continue; // 메인 블록 외(희귀 확장 한자) 제외
  if (typeof reading !== 'string' || !reading) continue;
  out[ch] = reading;
  count++;
}

const dest = path.join(root, 'src/lib/data/hanjaKo.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`hanjaKo.json 생성 — ${count}자, ${(fs.statSync(dest).size / 1024).toFixed(0)}KB`);
