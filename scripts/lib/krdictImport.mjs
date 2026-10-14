// 한국어기초사전(krdict) 내려받기 데이터 → `krdict_senses` 행 변환(순수 함수, 네트워크·DB 없음).
//
// 입력: 공식 "사전 전체 내려받기" XML(LMF DTD rev.16), 또는 그 XML을 expat(Python ElementTree)으로
// 파싱한 측정용 JSONL 사본(한 줄 = {id, word, hom, unit, pos, level, senses[{no, def, eq{언어:{lemma, def}}}]}).
// 두 입력은 같은 중간 형태(entry)로 모인 뒤 같은 규칙을 탄다. 2026-06-19 사본 전량에서 두 입력의
// 산출 해시가 같다(output_sha256 623e0764…3765, 71,927행).
//
// 규칙(결정적 — 같은 입력이면 같은 행·같은 해시):
//   ① 관용구·속담 항목 제외. 부모 단어와 항목 ID를 공유해(가다 27500 + 관용구·속담 7개)
//      senseKey가 충돌한다. 2단계에서 별도 네임스페이스를 검토한다.
//   ② 활용 어간 안내(`(걸어, 걸어서 …)→ 걷다 2`)와 상호 참조(`→ 칸막이`) 뜻 제외 — 뜻이 아니다.
//   ③ 문자열은 인코딩 결함만 복원한다: NFC, 앞뒤 공백 제거, 이중 이스케이프(`&amp;quot;`)
//      한 단계 해제. 내용(중복 대역 `墙壁，墙壁` 등)은 고치지 않는다 — 감수 대상으로 보고만 한다.
//   ④ 중국어는 간체 대역만 저장한다. `(无对应词汇)`이면 대역 없음 표시 + 중국어 뜻풀이. zh-TW 파생 안 함.
//   ⑤ 음성·예문·다른 언어 대역은 가져오지 않는다(음성은 재배포 불가).
//   ⑥ 처음 보는 어휘 단위·등급, 중복 (항목ID, 뜻ID), 깨진 XML은 조용히 넘기지 않고 실패한다.
import { createHash } from 'node:crypto';
import { formatSenseKey, isKrdictRelease, normalizeLookupForm } from '../../src/lib/krdictSenses.js';

export const KRDICT_IMPORTER_VERSION = 'krdict-import-v1';
export const KRDICT_NO_EQUIVALENT_ZH = '(无对应词汇)';

const INCLUDED_UNITS = new Set(['단어', '구', '문법‧표현']);
const EXCLUDED_UNITS = new Set(['관용구', '속담']);
const LEVELS = new Set(['초급', '중급', '고급']);
const CONJUGATION_GUIDE = /^\([^)]*\)\s*→/u;
const CROSS_REFERENCE = /^→/u;
// XML 1.0에서 허용하지 않는 C0 제어문자(2026-06-19판 실측 7개). 탭·LF·CR은 허용.
const XML_INVALID_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu;

export const sha256 = data => createHash('sha256').update(data).digest('hex');

function decodeXmlEntities(value) {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);|&/g, (match, body) => {
    if (body === undefined) throw new Error('krdict_xml_bare_ampersand');
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    const named = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[body];
    if (named === undefined) throw new Error(`krdict_xml_unknown_entity:${body}`);
    return named;
  });
}

function parseAttributes(source, stats) {
  const attrs = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(source))) {
    const raw = match[2] ?? match[3];
    if (raw.includes('<')) stats.unescapedLtInAttribute++;
    // XML 1.0 §3.3.3 속성값 정규화: 날것의 탭·줄바꿈은 공백이 된다(문자 참조 &#9;는 그대로).
    // expat(사본 JSONL을 만든 파서)과 같은 결과여야 두 입력의 산출 해시가 같다(대역 8건에 탭 실측).
    attrs[match[1]] = decodeXmlEntities(raw.replace(/\r\n?/g, '\n').replace(/[\t\n]/g, ' '));
  }
  return attrs;
}

function newStats() {
  return { controlCharsRemoved: 0, unescapedLtInAttribute: 0 };
}

/**
 * LMF XML 한 파일 → { creationDate, entries[] }. 이 사전이 쓰는 범위(속성만 있는 요소, 주석,
 * 선언, 외부 DTD 참조)만 받는 엄격한 토크나이저다. 속성값 안의 `>`(의미 범주 `자연 > 지형`)와
 * 2019판의 이스케이프 안 된 `<`는 따옴표 안이면 값으로 읽는다.
 */
export function parseKrdictXml(text, stats = newStats()) {
  const cleaned = text.replace(XML_INVALID_CONTROL, () => { stats.controlCharsRemoved++; return ''; });
  const entries = [];
  const stack = [];
  const global = {};
  let entry = null, sense = null, equivalent = null;
  let i = 0;
  const fail = code => { throw new Error(`krdict_xml_${code}@${i}`); };
  while (i < cleaned.length) {
    const lt = cleaned.indexOf('<', i);
    const gap = lt < 0 ? cleaned.slice(i) : cleaned.slice(i, lt);
    if (/\S/u.test(gap)) fail('unexpected_text');
    if (lt < 0) break;
    i = lt;
    if (cleaned.startsWith('<!--', i)) {
      const end = cleaned.indexOf('-->', i + 4);
      if (end < 0) fail('unterminated_comment');
      i = end + 3; continue;
    }
    if (cleaned.startsWith('<?', i)) {
      const end = cleaned.indexOf('?>', i + 2);
      if (end < 0) fail('unterminated_declaration');
      i = end + 2; continue;
    }
    if (cleaned.startsWith('<!', i)) {
      const end = cleaned.indexOf('>', i + 2);
      if (end < 0 || cleaned.slice(i, end).includes('[')) fail('unsupported_doctype');
      i = end + 1; continue;
    }
    // 따옴표 짝이 맞는 첫 `>`가 태그 끝이다.
    let end = cleaned.indexOf('>', i + 1);
    while (end >= 0 && (cleaned.slice(i, end).split('"').length - 1) % 2 === 1) end = cleaned.indexOf('>', end + 1);
    if (end < 0) fail('unterminated_tag');
    const raw = cleaned.slice(i + 1, end);
    i = end + 1;
    if (raw[0] === '/') {
      const name = raw.slice(1).trim();
      if (stack.pop() !== name) fail(`mismatched_end:${name}`);
      if (name === 'LexicalEntry') { entries.push(entry); entry = null; }
      else if (name === 'Sense' && sense) { entry.senses.push(sense); sense = null; }
      else if (name === 'Equivalent' && equivalent) {
        if (sense) sense.equivalents.push(equivalent);
        equivalent = null;
      }
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const nameMatch = /^[A-Za-z_][\w.-]*/.exec(body);
    if (!nameMatch) fail('bad_tag');
    const name = nameMatch[0];
    const attrs = parseAttributes(body.slice(name.length), stats);
    const parent = stack[stack.length - 1];
    if (name === 'feat') {
      if (!selfClosing) fail('feat_not_self_closing');
      const target = parent === 'GlobalInformation' ? global
        : parent === 'LexicalEntry' ? entry?.feats
          : parent === 'Lemma' && stack[stack.length - 2] === 'LexicalEntry' ? entry?.lemma
            : parent === 'Sense' ? sense?.feats
              : parent === 'Equivalent' ? equivalent
                : null;
      if (target) (target[attrs.att] ||= []).push(attrs.val);
      continue;
    }
    if (selfClosing && (name === 'LexicalEntry' || name === 'Sense' || name === 'Equivalent')) fail(`empty_${name}`);
    if (name === 'LexicalEntry') {
      if (entry) fail('nested_entry');
      if (attrs.att !== 'id') fail('entry_without_id');
      entry = { id: attrs.val, feats: {}, lemma: {}, senses: [] };
    } else if (name === 'Sense') {
      if (parent !== 'LexicalEntry' || sense) fail('unexpected_sense');
      if (attrs.att !== 'id') fail('sense_without_id');
      sense = { id: attrs.val, feats: {}, equivalents: [] };
    } else if (name === 'Equivalent') {
      if (parent !== 'Sense') fail('unexpected_equivalent');
      equivalent = {};
    }
    if (!selfClosing) stack.push(name);
  }
  if (stack.length) fail('unclosed_elements');
  const first = (feats, key) => (feats[key] ? feats[key][0] : undefined);
  return {
    creationDate: first(global, 'creationDate') ?? null,
    entries: entries.map(e => ({
      entryId: e.id,
      headword: first(e.lemma, 'writtenForm'),
      homographNo: first(e.feats, 'homonym_number'),
      lexicalUnit: first(e.feats, 'lexicalUnit'),
      pos: first(e.feats, 'partOfSpeech'),
      level: first(e.feats, 'vocabularyLevel'),
      senses: e.senses.map(s => {
        const zhs = s.equivalents.filter(q => first(q, 'language') === '중국어');
        if (zhs.length > 1) throw new Error(`krdict_xml_multiple_zh_equivalents:${e.id}:${s.id}`);
        const zh = zhs[0];
        return {
          senseNo: s.id,
          definition: first(s.feats, 'definition'),
          zh: zh ? { lemma: first(zh, 'lemma') ?? null, definition: first(zh, 'definition') ?? null } : null,
        };
      }),
    })),
  };
}

/**
 * 측정용 JSONL 사본 → entries[]. 줄은 `\n`으로만 나눈다: 사본에 U+2028이
 * 날것으로 1개 있어 readline 기본 분할을 쓰면 레코드가 잘린다(2026-10-07 실측).
 */
export function parseKrdictJsonl(text) {
  return text.split('\n').filter(line => line.trim() !== '').map(line => {
    const e = JSON.parse(line);
    return {
      entryId: e.id,
      headword: e.word,
      homographNo: e.hom == null ? undefined : String(e.hom),
      lexicalUnit: e.unit,
      pos: e.pos ?? undefined,
      level: e.level ?? undefined,
      senses: (e.senses || []).map(s => ({
        senseNo: String(s.no),
        definition: s.def ?? undefined,
        zh: s.eq?.['중국어'] ? { lemma: s.eq['중국어'].lemma ?? null, definition: s.eq['중국어'].def ?? null } : null,
      })),
    };
  });
}

/** `2026/06/19 12:38:52` → `krdict-20260619`. */
export function releaseFromCreationDate(creationDate) {
  const match = /^(\d{4})\/(\d{2})\/(\d{2}) \d{2}:\d{2}:\d{2}$/.exec(creationDate || '');
  if (!match) throw new Error(`krdict_bad_creation_date:${creationDate}`);
  const release = `krdict-${match[1]}${match[2]}${match[3]}`;
  if (!isKrdictRelease(release)) throw new Error(`krdict_bad_creation_date:${creationDate}`);
  return release;
}

function makeTextNormalizer(normalization) {
  return value => {
    if (value == null) return null;
    let text = value.normalize('NFC');
    if (text !== value) normalization.nfcChanged++;
    const trimmed = text.trim();
    if (trimmed !== text) normalization.trimmed++;
    // 원본의 이중 이스케이프(`&amp;quot;` → 파싱 후 `&quot;`)만 한 단계 더 푼다.
    const decoded = trimmed.replace(/&(quot|apos|lt|gt|amp);/g, (m, name) => ({ quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' })[name]);
    if (decoded !== trimmed) normalization.doubleEscapedEntities++;
    return decoded === '' ? null : decoded;
  };
}

const positiveIntFrom = (value, code) => {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error(`${code}:${value}`);
  return Number(value);
};

/**
 * entries → { rows, report }. rows는 (entry_id, sense_no) 순으로 정렬된 DB 행(snake_case,
 * 생성 열 sense_key 제외)이다. 예외 없이 끝나면 모든 행이 senseFromRow 계약을 만족한다.
 */
export function buildKrdictRows(entries, { release }) {
  if (!isKrdictRelease(release)) throw new Error(`krdict_bad_release:${release}`);
  const normalization = { nfcChanged: 0, trimmed: 0, doubleEscapedEntities: 0 };
  const clean = makeTextNormalizer(normalization);
  const counts = {
    entries: entries.length,
    entriesByUnit: {},
    entriesExcluded: { idiomOrProverb: 0, noIncludedSense: 0 },
    senses: 0,
    sensesExcluded: { idiomOrProverb: 0, conjugationGuide: 0, crossReference: 0 },
    rows: 0,
    zhCn: { equivalent: 0, noEquivalent: 0, missing: 0 },
    quality: { zhDuplicateItems: 0 },
  };
  const rows = [];
  const seen = new Set();
  for (const entry of entries) {
    const unit = entry.lexicalUnit;
    counts.entriesByUnit[unit] = (counts.entriesByUnit[unit] || 0) + 1;
    counts.senses += entry.senses.length;
    if (EXCLUDED_UNITS.has(unit)) {
      counts.entriesExcluded.idiomOrProverb++;
      counts.sensesExcluded.idiomOrProverb += entry.senses.length;
      continue;
    }
    if (!INCLUDED_UNITS.has(unit)) throw new Error(`krdict_unknown_lexical_unit:${unit}`);
    const entryId = positiveIntFrom(entry.entryId, 'krdict_bad_entry_id');
    const headword = clean(entry.headword);
    if (!headword) throw new Error(`krdict_missing_headword:${entryId}`);
    const lookupForm = normalizeLookupForm(headword);
    if (!lookupForm) throw new Error(`krdict_empty_lookup_form:${entryId}`);
    const homographNo = entry.homographNo === undefined ? 0 : Number(entry.homographNo);
    if (!Number.isSafeInteger(homographNo) || homographNo < 0) throw new Error(`krdict_bad_homograph:${entryId}`);
    const pos = clean(entry.pos);
    if (!pos) throw new Error(`krdict_missing_pos:${entryId}`);
    const level = entry.level === undefined || entry.level === '없음' ? null : entry.level;
    if (level !== null && !LEVELS.has(level)) throw new Error(`krdict_unknown_level:${level}`);
    let kept = 0;
    entry.senses.forEach((sense, index) => {
      const senseNo = positiveIntFrom(sense.senseNo, 'krdict_bad_sense_no');
      const definition = clean(sense.definition);
      if (!definition) throw new Error(`krdict_missing_definition:${entryId}:${senseNo}`);
      if (CONJUGATION_GUIDE.test(definition)) { counts.sensesExcluded.conjugationGuide++; return; }
      if (CROSS_REFERENCE.test(definition)) { counts.sensesExcluded.crossReference++; return; }
      const key = formatSenseKey(entryId, senseNo);
      if (seen.has(key)) throw new Error(`krdict_duplicate_sense_key:${key}`);
      seen.add(key);
      const zhLemma = clean(sense.zh?.lemma);
      const zhDefinition = clean(sense.zh?.definition);
      const noEquivalent = zhLemma === KRDICT_NO_EQUIVALENT_ZH;
      if (!sense.zh || (!zhLemma && !zhDefinition)) counts.zhCn.missing++;
      else if (noEquivalent) counts.zhCn.noEquivalent++;
      else counts.zhCn.equivalent++;
      if (zhLemma && !noEquivalent) {
        const items = zhLemma.split(/[，,]/u).map(s => s.trim()).filter(Boolean);
        if (new Set(items).size !== items.length) counts.quality.zhDuplicateItems++;
      }
      rows.push({
        release_id: release,
        entry_id: entryId,
        sense_no: senseNo,
        headword,
        lookup_form: lookupForm,
        homograph_no: homographNo,
        pos,
        vocab_level: level,
        lexical_unit: unit,
        display_order: index + 1,
        definition_ko: definition,
        zh_cn_equivalent: noEquivalent ? null : zhLemma,
        zh_cn_definition: zhDefinition,
        zh_cn_no_equivalent: noEquivalent,
      });
      kept++;
    });
    if (kept === 0) counts.entriesExcluded.noIncludedSense++;
  }
  rows.sort((a, b) => a.entry_id - b.entry_id || a.sense_no - b.sense_no);
  counts.rows = rows.length;
  return { rows, report: { release, counts, normalization } };
}

/** 정렬된 행의 정규 직렬화(NDJSON) 해시. 입력 형식(XML/JSONL)·파일 이름과 무관하다. */
export function rowsDigest(rows) {
  return sha256(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
}

/** 파일 이름과 무관한 입력 다이제스트(공식 ZIP 이름 `1_5000_…xml`과 사본 `001.xml` 비교용). */
export function inputDigest(files) {
  return sha256(files.map(f => f.sha256).sort().join('\n') + '\n');
}

/** release 메타 행. imported_at은 DB 기본값(now())이라 넣지 않는다 — 산출물·보고서는 시각 없이 결정적이다. */
export function buildReleaseRow({ release, sourceKind, inputFormat, files, rows }) {
  if (!['official', 'unofficial-copy'].includes(sourceKind)) throw new Error(`krdict_bad_source_kind:${sourceKind}`);
  if (sourceKind === 'official' && inputFormat !== 'xml') throw new Error('krdict_official_requires_xml');
  const day = release.slice('krdict-'.length);
  return {
    id: release,
    snapshot_date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
    source_kind: sourceKind,
    source_label: '국립국어원 한국어기초사전',
    source_url: 'https://krdict.korean.go.kr',
    license: 'CC BY-SA 2.0 KR',
    license_url: 'https://creativecommons.org/licenses/by-sa/2.0/kr/',
    input_format: inputFormat,
    input_files: files.map(({ name, sha256: hash, bytes }) => ({ name, sha256: hash, bytes })),
    input_digest: inputDigest(files),
    output_sha256: rowsDigest(rows),
    sense_count: rows.length,
    importer_version: KRDICT_IMPORTER_VERSION,
  };
}

/**
 * service_role 클라이언트(supabase-js 호환 최소 인터페이스)로 한 판본을 적재한다.
 * - 판본 행이 이미 있고 산출 해시가 다르면 중단한다(판본 행은 불변 — 덮어쓰지 않는다).
 * - 뜻 행은 ON CONFLICT DO NOTHING으로 넣어 중단 뒤 재실행이 이어서 채운다(UPDATE 권한 불필요).
 * - 끝에 판본 행 수를 다시 세어 sense_count와 다르면 실패한다.
 * 이 함수가 건드리는 표는 krdict_releases·krdict_senses뿐이다(카드 표에 쓰지 않는다).
 */
export async function writeKrdictRelease(client, { releaseRow, rows }, { batchSize = 500 } = {}) {
  if (rows.length !== releaseRow.sense_count || rowsDigest(rows) !== releaseRow.output_sha256) throw new Error('krdict_write_plan_mismatch');
  const existing = await client.from('krdict_releases').select('id,output_sha256,sense_count').eq('id', releaseRow.id).maybeSingle();
  if (existing.error) throw new Error(`krdict_write_read_release:${existing.error.message}`);
  if (existing.data && existing.data.output_sha256 !== releaseRow.output_sha256) throw new Error('krdict_release_conflict');
  if (!existing.data) {
    const inserted = await client.from('krdict_releases').insert(releaseRow);
    if (inserted.error) throw new Error(`krdict_write_release:${inserted.error.message}`);
  }
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const result = await client.from('krdict_senses').upsert(batch, { onConflict: 'release_id,entry_id,sense_no', ignoreDuplicates: true });
    if (result.error) throw new Error(`krdict_write_senses@${start}:${result.error.message}`);
  }
  const counted = await client.from('krdict_senses').select('entry_id', { count: 'exact', head: true }).eq('release_id', releaseRow.id);
  if (counted.error) throw new Error(`krdict_write_count:${counted.error.message}`);
  if (counted.count !== releaseRow.sense_count) throw new Error(`krdict_write_incomplete:${counted.count}/${releaseRow.sense_count}`);
  return { release: releaseRow.id, resumed: Boolean(existing.data), count: counted.count };
}
