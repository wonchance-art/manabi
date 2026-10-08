// 중국어 표제어 우주 — HSK 3.0(src/lib/data/zhHskLevel.json) ∪ 우리 사전(src/content/chinese/vocab의 zh).
// 정체 표(generate-hanja-trad.mjs)와 일본어 표기 표(generate-ja-words.mjs)가 같은 우주를 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** @returns {Promise<Set<string>>} 표제어 집합(가공 없음 — 길이·글자 필터는 생성기가 한다) */
export async function readZhHeadwords(root) {
  const heads = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/zhHskLevel.json'), 'utf8'))));
  const vocabDir = path.join(root, 'src/content/chinese/vocab');
  for (const f of fs.readdirSync(vocabDir).filter((x) => x.endsWith('.js')).sort()) {
    const mod = await import(pathToFileURL(path.join(vocabDir, f)).href);
    for (const theme of mod.default?.themes || []) for (const w of theme.words || []) if (w?.zh) heads.add(w.zh);
  }
  return heads;
}
