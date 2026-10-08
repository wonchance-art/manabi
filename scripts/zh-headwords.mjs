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

/**
 * 표제어 → 가장 낮은 급. HSK 3.0 급(zhHskLevel.json, 1~7)이 있으면 그것, 없으면 우리 사전 파일 급
 * (h1~h6 → 1~6, 그 밖 = 9 — refVocabIndex LEVEL_RANK와 같은 순위). 한자 창 드릴다운 빈도 순위의
 * 둘째 열쇠(generate-hanja-panel.mjs)가 쓴다.
 * @returns {Promise<Map<string, number>>}
 */
export async function readZhHeadwordLevels(root) {
  const hsk = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/data/zhHskLevel.json'), 'utf8'));
  const levels = new Map(Object.entries(hsk).map(([w, n]) => [w, Number(n) || 9]));
  const vocabDir = path.join(root, 'src/content/chinese/vocab');
  for (const f of fs.readdirSync(vocabDir).filter((x) => x.endsWith('.js')).sort()) {
    const m = /^h([1-6])/.exec(f);
    const rank = m ? Number(m[1]) : 9;
    const mod = await import(pathToFileURL(path.join(vocabDir, f)).href);
    for (const theme of mod.default?.themes || []) {
      for (const w of theme.words || []) {
        if (!w?.zh || hsk[w.zh]) continue;
        levels.set(w.zh, Math.min(levels.get(w.zh) ?? 9, rank));
      }
    }
  }
  return levels;
}
