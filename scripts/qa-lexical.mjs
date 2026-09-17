// Offline editorial benchmark preparation. Never calls a model or reads accounts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function lexicalCases(gold, base) {
  const sources = { ...base.sources, ...gold.sources };
  const ids = new Set();
  const rows = gold.cases.map(row => {
    if (ids.has(row.id)) throw Error(`duplicate_case:${row.id}`);ids.add(row.id);
    const inherited = row.baseCase && base.cases.find(item => item.id === row.baseCase);
    if (row.baseCase && !inherited) throw Error(`missing_base:${row.id}`);
    const resolved = { ...inherited, ...row };
    if (!['Chinese', 'Japanese'].includes(resolved.language) || !resolved.text || !resolved.review) throw Error(`invalid_case:${row.id}`);
    if (row.mode === 'sense') {
      const source = sources[resolved.source];
      if (!source || !/^https:\/\//.test(typeof source === 'string' ? source : source.url)) throw Error(`missing_source:${row.id}`);
      for (const field of ['context', 'reading', 'pos', 'meaning', 'rejectMeaning', 'readingPolicy']) if (!resolved[field]?.trim()) throw Error(`missing_${field}:${row.id}`);
      if (resolved.meaning === resolved.rejectMeaning) throw Error(`contradictory_gold:${row.id}`);
    } else if (row.mode !== 'ambiguous' || row.context !== '' || !row.holdReason || row.alternatives?.length < 2) throw Error(`invalid_ambiguity:${row.id}`);
    return resolved;
  });
  for (const row of rows.filter(row => row.mode === 'ambiguous')) {
    for (const id of row.alternatives) if (!rows.some(item => item.id === id && item.mode === 'sense' && item.language === row.language)) throw Error(`missing_alternative:${row.id}`);
  }
  return rows;
}

const norm = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, '') : '';
// Exact curated matches are evidence of a known answer, not a general semantic
// judge. Unknown paraphrases go to review rather than becoming false failures.
export function assessLexical(row, answer) {
  if (!answer || typeof answer !== 'object') return { status: 'not-run' };
  if (row.mode === 'ambiguous') return {
    status: answer.abstain === true && !answer.selected && !answer.meaning && !answer.reading ? 'matched-abstention' : 'unsafe-certainty',
  };
  if (answer.abstain === true) return { status: 'needs-review', reason: 'abstained-with-context' };
  if (norm(answer.meaning) === norm(row.rejectMeaning)) return { status: 'contradiction', field: 'meaning' };
  if (row.rejectJapanese?.some(value => norm(value) === norm(answer.japanese))) return { status: 'contradiction', field: 'japanese' };
  if (norm(answer.reading) !== norm(row.reading)) return { status: 'needs-review', reason: 'reading-or-regional-variant' };
  if (norm(answer.pos) !== norm(row.pos)) return { status: 'needs-review', reason: 'pos-normalization' };
  if (norm(answer.meaning) !== norm(row.meaning)) return { status: 'needs-review', reason: 'unlisted-paraphrase' };
  return { status: 'matched-curated-sense', japanese: row.jaExample ? 'needs-bilingual-review' : 'not-applicable' };
}

export function inspectLexical() {
  const fixtures = new URL('../e2e/fixtures/', import.meta.url);
  const gold = JSON.parse(fs.readFileSync(new URL('lexical-gold.json', fixtures)));
  const base = JSON.parse(fs.readFileSync(new URL('lexical-senses.json', fixtures)));
  const rows = lexicalCases(gold, base);
  return { cases: rows.length, contextCases: rows.filter(r => r.mode === 'sense').length, ambiguityGuards: rows.filter(r => r.mode === 'ambiguous').length,
    checkedAt: gold.checkedAt, providerEvaluation: 'not-run', bilingualAdjudication: 'pending', hskPronunciationBenchmark: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(inspectLexical(), null, 2));
