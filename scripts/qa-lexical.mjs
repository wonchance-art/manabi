// Offline editorial benchmark preparation. Never calls a model or reads accounts.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
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
      if (resolved.acceptedMeanings && (!Array.isArray(resolved.acceptedMeanings) || resolved.acceptedMeanings.some(value => typeof value !== 'string' || !value.trim() || norm(value) === norm(resolved.rejectMeaning)))) throw Error(`invalid_accepted_meanings:${row.id}`);
      if (resolved.usageSource && !sources[resolved.usageSource]) throw Error(`missing_usage_source:${row.id}`);
      if (resolved.unit && !['word', 'morpheme'].includes(resolved.unit)) throw Error(`invalid_unit:${row.id}`);
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
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { status: 'not-run' };
  if (row.mode === 'ambiguous') return {
    status: answer.abstain === true && !answer.selected && !answer.meaning && !answer.reading ? 'matched-abstention' : 'unsafe-certainty',
  };
  if (answer.abstain === true) return { status: 'needs-review', reason: 'abstained-with-context' };
  if (norm(answer.meaning) === norm(row.rejectMeaning)) return { status: 'contradiction', field: 'meaning' };
  if (row.rejectJapanese?.some(value => norm(value) === norm(answer.japanese))) return { status: 'contradiction', field: 'japanese' };
  if (norm(answer.reading) !== norm(row.reading)) return { status: 'needs-review', reason: 'reading-or-regional-variant' };
  if (norm(answer.pos) !== norm(row.pos)) return { status: 'needs-review', reason: 'pos-normalization' };
  if (![row.meaning, ...(row.acceptedMeanings || [])].some(value => norm(answer.meaning) === norm(value))) return { status: 'needs-review', reason: 'unlisted-paraphrase' };
  return { status: 'matched-curated-sense', japanese: row.jaExample ? 'needs-bilingual-review' : 'not-applicable' };
}

export function loadLexicalCases() {
  const fixtures = new URL('../e2e/fixtures/', import.meta.url);
  const gold = JSON.parse(fs.readFileSync(new URL('lexical-gold.json', fixtures)));
  const base = JSON.parse(fs.readFileSync(new URL('lexical-senses.json', fixtures)));
  return { gold, rows: lexicalCases(gold, base) };
}

// Export only inputs. Expected answers must never be sent to the model under test.
export function lexicalRequestBundle(rows) {
  return { schemaVersion: 1, fixtureDigest: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    cases: rows.map(({ id, language, text, context, mode, unit }) => ({ id, language, text, context, mode, unit: unit || 'word' })) };
}

// Import observed answers; this function never calls a provider or authenticates.
// Candidate lists are not a learner's selected sense. Do not pick their first item.
export function lexicalResponseReport(rows, run) {
  const bundle = lexicalRequestBundle(rows);
  if (run?.schemaVersion !== 1 || run.fixtureDigest !== bundle.fixtureDigest) throw Error('lexical_fixture_mismatch');
  if (!Array.isArray(run.responses)) throw Error('lexical_responses_required');
  const responses = new Map();
  for (const record of run.responses) {
    if (!rows.some(row => row.id === record?.id) || responses.has(record.id)) throw Error('unknown_or_duplicate_response');
    if (!['ai', 'stored', 'synthetic'].includes(record.source)) throw Error('lexical_response_source_required');
    responses.set(record.id, record);
  }
  const results = rows.map(row => {
    const record = responses.get(row.id);
    if (!record) return { id: row.id, status: 'not-run' };
    if (record.error) return { id: row.id, source: record.source, status: 'request-failed' };
    if (Array.isArray(record.answer?.senses)) return { id: row.id, source: record.source,
      status: 'needs-review', reason: 'candidate-list-not-selected-sense' };
    return { id: row.id, source: record.source, ...assessLexical(row, record.answer) };
  });
  const counts = {};
  for (const row of results) counts[row.status] = (counts[row.status] || 0) + 1;
  return { schemaVersion: 1, fixtureDigest: bundle.fixtureDigest, total: rows.length, counts, results,
    evidence: 'imported-responses-not-independently-authenticated', accuracy: null,
    bilingualAdjudication: 'pending', hskPronunciationBenchmark: false };
}

export function inspectLexical() {
  const { gold, rows } = loadLexicalCases();
  return { cases: rows.length, contextCases: rows.filter(r => r.mode === 'sense').length, ambiguityGuards: rows.filter(r => r.mode === 'ambiguous').length,
    checkedAt: gold.checkedAt, providerEvaluation: 'not-run', bilingualAdjudication: 'pending', hskPronunciationBenchmark: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let result;
    if (!args.length) result = inspectLexical();
    else if (args.length === 1 && args[0] === '--export-inputs') result = lexicalRequestBundle(loadLexicalCases().rows);
    else if (args.length === 2 && args[0] === '--responses') result = lexicalResponseReport(loadLexicalCases().rows, JSON.parse(fs.readFileSync(args[1], 'utf8')));
    else throw Error('invalid_lexical_options');
    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.error('lexical_report_failed: check options, fixture digest and response schema');
    process.exitCode = 1;
  }
}
