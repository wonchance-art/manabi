// 青空文庫 공식 색인(list_person_all_extended_utf8.csv)·접속 순위·텍스트 zip을 다루는 순수 함수 — 작품 추가 자동화
// (scripts/literature/candidates.mjs · add-work.mjs)의 공용 부품. 네트워크는 호출하는 쪽이 한다(여기는 바이트·문자열만).
//
// 왜 색인을 쓰나(2026-10-14 KST): 작품 추가의 손일(도서 카드 읽기 → 초출·몰년·文字遣い種別·역할 확인 → zip 받기 →
// SHA-256 → Shift_JIS 변환 → entry.json 손으로 쓰기)은 색인 한 줄에 거의 다 있다. 법률 판단은 여전히 사람이
// 기록하지만(aozoraRights — fail-closed 증거 계약), 그 근거 수집과 1차 판정(일본 보호기간)은 기계가 한다.
import { inflateRawSync } from 'node:zlib';
import { aozoraJurisdictionVerdict } from '../../src/lib/aozoraRights.js';

export const AOZORA_INDEX_URL = 'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip';
/** 연도별 접속 순위(XHTML 열람 상위 500) — 유명도 지표. 2023년 이후는 게시되지 않았다(2026-10 실측). */
export const AOZORA_RANKING_YEARS = Object.freeze([2020, 2021, 2022]);
export const aozoraRankingUrl = (year) => `https://www.aozora.gr.jp/access_ranking/${year}_xhtml.html`;

/** RFC 4180 CSV — 따옴표 안 쉼표·줄바꿈·이중 따옴표를 푼다. 첫 줄은 머리글(BOM 제거). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text).replace(/^﻿/u, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])));
}

/** 「1916（大正5）年2月」·「「新思潮」1916（大正5）年2月」 → 1916. 서력 네 자리가 없으면 null. */
export function firstYear(text) {
  const match = String(text || '').match(/(1[5-9]\d\d|20\d\d)/u);
  return match ? Number(match[1]) : null;
}

/** 색인 행들 → 작품별 묶음(Map workId → 작품). 한 작품에 번역자·삽화가 등 다른 역할 행이 있으면 roles에 함께 남는다. */
export function aozoraIndexWorks(rows) {
  const works = new Map();
  for (const row of rows) {
    const workId = String(Number(row['作品ID']));
    if (!/^\d+$/u.test(workId) || workId === '0') continue;
    const work = works.get(workId) ?? {
      workId,
      title: row['作品名'],
      titleReading: row['作品名読み'],
      subtitle: row['副題'],
      firstAppearance: row['初出'],
      charset: row['文字遣い種別'],
      copyrighted: row['作品著作権フラグ'] === 'あり',
      cardUrl: row['図書カードURL'],
      textUrl: row['テキストファイルURL'],
      textCharset: row['テキストファイル文字集合'],
      people: [],
    };
    work.people.push({
      personId: String(row['人物ID']).padStart(6, '0'),
      name: `${row['姓']}${row['名']}`,
      role: row['役割フラグ'],
      deathYear: firstYear(row['没年月日']),
      copyrighted: row['人物著作権フラグ'] === 'あり',
    });
    works.set(workId, work);
  }
  for (const work of works.values()) {
    const authors = work.people.filter((person) => person.role === '著者');
    work.author = authors.length === 1 ? authors[0] : null;
    work.publishedYear = firstYear(work.firstAppearance);
  }
  return works;
}

/**
 * 선정 기준(D5 + 원문 조건)에 못 미치는 이유 목록 — 빈 배열이면 후보. 권리는 1차 판정일 뿐이다(사람이 도서 카드로 확인해 기록).
 * publishedYear는 색인 初出 → 없으면 원문 판권 初出(add-work가 넘긴다). 둘 다 없으면 사람이 채운다.
 */
export function aozoraCandidateIssues(work, { publishedYear = work.publishedYear } = {}) {
  const issues = [];
  if (!work.author) issues.push('저자가 한 명이 아니다');
  if (work.people.some((person) => person.role !== '著者')) issues.push(`저자 외 역할(${[...new Set(work.people.filter((p) => p.role !== '著者').map((p) => p.role))].join('·')})`);
  if (work.charset !== '新字新仮名') issues.push(`文字遣い種別 ${work.charset || '없음'}(新字新仮名만)`);
  if (work.copyrighted || work.author?.copyrighted) issues.push('저작권 존속 작품');
  if (!/^https:\/\/www\.aozora\.gr\.jp\/cards\/\d{6}\/files\/[\w.-]+\.zip$/u.test(work.textUrl || '')) issues.push('텍스트 zip 주소 없음');
  const verdict = aozoraJurisdictionVerdict({ publishedYear: publishedYear ?? undefined, authorDeathYear: work.author?.deathYear ?? undefined });
  if (!verdict.ok) issues.push(`보호기간 ${['JP', 'KR'].filter((code) => !verdict[code]).join('·')} 미확인/보호`);
  return issues;
}

/** 접속 순위 XHTML → Map(workId → 열람 수). 표의 「cardNNN.html … 숫자</td></tr>」를 읽는다. */
export function parseAozoraRanking(html) {
  const counts = new Map();
  for (const match = /card(\d+)\.html[\s\S]*?<td class=normal>(\d+)<\/td>\s*<\/tr>/gu; ;) {
    const found = match.exec(html);
    if (!found) break;
    const id = String(Number(found[1]));
    counts.set(id, (counts.get(id) ?? 0) + Number(found[2]));
  }
  return counts;
}

/** zip(青空文庫 텍스트 zip — 저장·deflate만) → [{name, bytes}]. 중앙 디렉터리 기준이라 data descriptor가 있어도 된다. */
export function unzipEntries(buffer) {
  const bytes = Buffer.from(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('zip 끝 레코드를 찾지 못했다');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const entries = [];
  for (let n = 0; n < count; n += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('zip 중앙 디렉터리가 깨졌다');
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('latin1');
    if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('zip 지역 머리글이 깨졌다');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = bytes.subarray(start, start + compressed);
    if (method !== 0 && method !== 8) throw new Error(`지원하지 않는 zip 압축 방식 ${method}`);
    entries.push({ name, bytes: method === 8 ? inflateRawSync(data) : Buffer.from(data) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// WHATWG Shift_JIS(= Windows-31J 대응)와 JIS X 0208 표준 대응(glibc `iconv -f SHIFT_JIS`)이 갈리는 여섯 칸 — 青空文庫 원문은
// JIS X 0208이므로 표준 대응으로 되돌린다. 예전 절차(iconv)로 만든 source.txt와 바이트까지 같아진다(실측: 鼻·文鳥의 0x8160 「〜」).
// 이 글자들은 WHATWG에서 각각 한 바이트 쌍에서만 나온다(U+FFE2는 IBM 확장 0xEEF9·0xFA54에서도 나오지만 JIS X 0208 원문에 없다).
const WINDOWS_TO_JIS = Object.freeze({ '\uFF5E': '\u301C', '\u2225': '\u2016', '\uFF0D': '\u2212', '\uFFE0': '\u00A2', '\uFFE1': '\u00A3', '\uFFE2': '\u00AC' });

/** 青空文庫 txt(Shift_JIS) → UTF-8 문자열. Node 내장 디코더 + JIS 표준 대응 — 외부 iconv 없이 예전 절차와 같은 결과. */
export function decodeAozoraText(bytes) {
  return new TextDecoder('shift_jis', { fatal: true }).decode(bytes).replace(/[\uFF5E\u2225\uFF0D\uFFE0\uFFE1\uFFE2]/gu, (char) => WINDOWS_TO_JIS[char]);
}

/** 원문 판권의 「初出：」 줄 → 연도(색인에 初出이 비어 있을 때 쓴다 — 사후 출간작 등). */
export function colophonFirstAppearanceYear(text) {
  const match = String(text).match(/^初出：(.+)$/mu);
  return match ? firstYear(match[1]) : null;
}
