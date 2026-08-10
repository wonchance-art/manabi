/**
 * EPUB 반입 — 무의존 파서.
 * EPUB = ZIP(컨테이너) + OPF(목차·메타) + XHTML(본문). 외부 라이브러리 없이
 * ZIP 중앙 디렉터리를 직접 읽고, deflate 항목은 브라우저 내장 DecompressionStream
 * ('deflate-raw')으로 푼다. 본문 추출은 정규식 기반(잘 형성된 XHTML 전제) —
 * DOM 의존이 없어 브라우저·테스트 양쪽에서 동일하게 동작한다.
 *
 * 정책: 루비(후리가나)는 벗겨서 본문만 남긴다(<rt>·<rp> 제거) — 요미가나는
 * 분석 파이프라인이 다시 달아 주므로 원문 오염(인라인 독음)을 만들지 않기 위함.
 */

const td = (bytes) => new TextDecoder('utf-8').decode(bytes);

/** ZIP 중앙 디렉터리 파싱 → { name → { offset, method, compSize } } */
function parseZipDirectory(buf) {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // EOCD(0x06054b50) 시그니처를 뒤에서 탐색 (주석 최대 64KB)
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65536); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP 형식이 아님(EOCD 없음)');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true); // 중앙 디렉터리 시작
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP 중앙 디렉터리 손상');
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = td(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { offset, method, compSize });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** 개별 항목 바이트 추출(+deflate 해제) */
async function readZipEntry(buf, entry) {
  const view = new DataView(buf);
  const p = entry.offset;
  if (view.getUint32(p, true) !== 0x04034b50) throw new Error('ZIP 로컬 헤더 손상');
  const nameLen = view.getUint16(p + 26, true);
  const extraLen = view.getUint16(p + 28, true);
  const start = p + 30 + nameLen + extraLen;
  const raw = new Uint8Array(buf, start, entry.compSize);
  if (entry.method === 0) return raw;               // stored
  if (entry.method !== 8) throw new Error(`지원하지 않는 압축 방식(${entry.method})`);
  const ds = new DecompressionStream('deflate-raw'); // browsers·Node 22 공통
  const stream = new Blob([raw]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** container.xml → OPF 경로 */
export function parseContainerXml(xml) {
  const m = xml.match(/full-path="([^"]+)"/);
  if (!m) throw new Error('container.xml에 rootfile 없음');
  return m[1];
}

/** OPF → { title, language, spineHrefs } (manifest id→href를 spine 순서로 해석) */
export function parseOpf(xml) {
  const title = (xml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/) || [])[1]?.trim() || '';
  const language = (xml.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/) || [])[1]?.trim() || '';
  const manifest = new Map();
  for (const m of xml.matchAll(/<item\s[^>]*>/g)) {
    const tag = m[0];
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    const href = (tag.match(/\bhref="([^"]+)"/) || [])[1];
    const type = (tag.match(/media-type="([^"]+)"/) || [])[1] || '';
    if (id && href && /xhtml|html/.test(type)) manifest.set(id, href);
  }
  const spineHrefs = [];
  for (const m of xml.matchAll(/<itemref\s[^>]*idref="([^"]+)"/g)) {
    const href = manifest.get(m[1]);
    if (href) spineHrefs.push(href);
  }
  return { title, language, spineHrefs };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** XHTML → 평문. 루비 독음 제거, 블록 경계는 개행으로. */
export function extractXhtmlText(xhtml) {
  let s = xhtml;
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '');
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<rt[\s\S]*?<\/rt>/gi, '');   // 후리가나 독음
  s = s.replace(/<rp[\s\S]*?<\/rp>/gi, '');   // 루비 괄호 폴백
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code] ?? all;
  });
  return s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** 챕터 제목 추정 — 첫 헤딩, 없으면 첫 줄 앞부분 */
export function guessChapterTitle(xhtml, fallback) {
  const h = xhtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (h) {
    const t = extractXhtmlText(h[1]).replace(/\n/g, ' ').trim();
    if (t) return t.slice(0, 60);
  }
  const first = extractXhtmlText(xhtml).split('\n')[0] || '';
  return first ? first.slice(0, 40) : fallback;
}

/** href 상대 경로를 ZIP 항목 이름으로 해석(OPF 기준 디렉터리 + ../ 처리) */
function resolveHref(opfPath, href) {
  const base = opfPath.split('/').slice(0, -1);
  const parts = [...base, ...decodeURIComponent(href.split('#')[0]).split('/')];
  const out = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}

/**
 * EPUB 파일(ArrayBuffer) → { title, language, chapters: [{ title, text, chars }] }
 * 실패 시 이유가 담긴 Error를 던진다(호출측이 토스트로 노출).
 */
export async function parseEpub(buf) {
  const entries = parseZipDirectory(buf);
  const containerEntry = entries.get('META-INF/container.xml');
  if (!containerEntry) throw new Error('EPUB 형식이 아님(container.xml 없음)');
  const opfPath = parseContainerXml(td(await readZipEntry(buf, containerEntry)));
  const opfEntry = entries.get(opfPath);
  if (!opfEntry) throw new Error('EPUB 목차(OPF)를 찾을 수 없음');
  const { title, language, spineHrefs } = parseOpf(td(await readZipEntry(buf, opfEntry)));
  const chapters = [];
  for (let i = 0; i < spineHrefs.length; i++) {
    const name = resolveHref(opfPath, spineHrefs[i]);
    const entry = entries.get(name);
    if (!entry) continue; // 깨진 참조는 건너뜀
    const xhtml = td(await readZipEntry(buf, entry));
    const text = extractXhtmlText(xhtml);
    if (!text) continue;  // 표지·빈 페이지 제외
    chapters.push({ title: guessChapterTitle(xhtml, `${i + 1}장`), text, chars: text.length });
  }
  if (chapters.length === 0) throw new Error('본문 챕터를 찾지 못함');
  return { title, language, chapters };
}
