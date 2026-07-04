// 「듣고 읽기」 실험 — 영상 검색 · 자막(caption track) 처리 순수 유틸.
//
// youtubei.js(Innertube)가 돌려주는 노드/자막 응답을 앱이 쓰는 형태로 정규화한다.
// 라이브러리·네트워크 호출은 라우트가 담당하고, 이 모듈은 "파싱/정규화"만 맡아
// 단위 테스트가 가능하도록 순수 함수로 유지한다.
//
// 자막 트랙 base_url은 (a) &fmt=json3 → JSON3 (b) 기본 XML(<transcript>)
// (c) srv3 XML(<timedtext><p>) 세 형태 중 하나를 돌려준다. 세 형태 모두 파싱한다.
// 정규화 큐 형태: [{ from(초), to(초), text }] — 기존 리스닝 파이프라인과 동일.

// ── HTML 엔티티 디코드 (YouTube XML은 아포스트로피 등을 이중 인코딩하기도 함) ──
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntitiesOnce(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
        try { return String.fromCodePoint(code); } catch { return m; }
      }
      return m;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named != null ? named : m;
  });
}

/** HTML 엔티티를 (이중 인코딩 포함) 완전 디코드한다. */
export function decodeEntities(str) {
  if (str == null) return '';
  let out = String(str);
  for (let i = 0; i < 3; i++) {
    const next = decodeEntitiesOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

// 태그 제거 + 공백 정규화
function cleanText(raw) {
  return decodeEntities(String(raw ?? ''))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── JSON3 (fmt=json3) ──
// { events: [ { tStartMs, dDurationMs, segs: [{ utf8 }] }, ... ] }
function parseJson3(json) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const cues = [];
  for (const ev of events) {
    if (!ev || !Array.isArray(ev.segs)) continue;
    const text = cleanText(ev.segs.map((s) => s?.utf8 ?? '').join(''));
    if (!text) continue; // 개행-only / 빈 이벤트(window 정의 등) 스킵
    const from = Number(ev.tStartMs) / 1000;
    if (!Number.isFinite(from)) continue;
    const durMs = Number(ev.dDurationMs);
    const to = Number.isFinite(durMs) ? from + durMs / 1000 : from;
    cues.push({ from, to, text });
  }
  return cues;
}

// ── 기본 XML: <transcript><text start="" dur="">...</text></transcript> ──
function parseTranscriptXml(xml) {
  const cues = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const start = Number((/\bstart="([^"]*)"/.exec(attrs) || [])[1]);
    const dur = Number((/\bdur="([^"]*)"/.exec(attrs) || [])[1]);
    const text = cleanText(m[2]);
    if (!text || !Number.isFinite(start)) continue;
    cues.push({ from: start, to: Number.isFinite(dur) ? start + dur : start, text });
  }
  return cues;
}

// ── srv3 XML: <timedtext><body><p t="" d=""><s>..</s></p></body></timedtext> (t/d = ms) ──
function parseSrv3Xml(xml) {
  const cues = [];
  const re = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const t = Number((/\bt="([^"]*)"/.exec(attrs) || [])[1]);
    const d = Number((/\bd="([^"]*)"/.exec(attrs) || [])[1]);
    const text = cleanText(m[2]);
    if (!text || !Number.isFinite(t)) continue;
    const from = t / 1000;
    cues.push({ from, to: Number.isFinite(d) ? from + d / 1000 : from, text });
  }
  return cues;
}

/**
 * 자막 트랙 원문(JSON3 문자열/객체 또는 XML)을 표준 큐로 정규화한다.
 * @param {string|object} raw
 * @returns {{from:number,to:number,text:string}[]}
 */
export function parseCaptionData(raw) {
  if (raw == null) return [];
  // 이미 파싱된 JSON3 객체
  if (typeof raw === 'object') return parseJson3(raw);

  const s = String(raw).trim();
  if (!s) return [];

  if (s[0] === '{') {
    try { return parseJson3(JSON.parse(s)); } catch { return []; }
  }
  if (/<transcript[\s>]/.test(s)) return parseTranscriptXml(s);
  if (/<timedtext[\s>]/.test(s) || /<p\b[^>]*\bt=/.test(s)) return parseSrv3Xml(s);
  // 마지막 시도: <text> 형태
  if (/<text\b/.test(s)) return parseTranscriptXml(s);
  return [];
}

/**
 * caption_tracks 배열에서 요청 언어에 가장 맞는 트랙을 고른다.
 * 우선순위: 요청 언어 정확/접두 일치 & 사람이 만든 자막 → 같은 언어 ASR → 없으면 null.
 * @param {{base_url?:string, language_code?:string, kind?:string, name?:any}[]} tracks
 * @param {string} langCode 예: 'ja'
 * @returns {{ track: object|null, available: {code:string,name:string,kind:string}[] }}
 */
export function selectCaptionTrack(tracks, langCode) {
  const list = Array.isArray(tracks) ? tracks : [];
  const available = list.map((t) => ({
    code: t?.language_code || '',
    name: textOf(t?.name) || t?.language_code || '',
    kind: t?.kind || '',
  }));

  if (list.length === 0) return { track: null, available };

  const want = String(langCode || '').toLowerCase();
  const matches = want
    ? list.filter((t) => {
        const code = String(t?.language_code || '').toLowerCase();
        return code === want || code.split('-')[0] === want;
      })
    : [];

  const pool = matches.length > 0 ? matches : [];
  // 사람 자막(kind 없음) 우선, 그다음 ASR
  const manual = pool.find((t) => t?.kind !== 'asr');
  const asr = pool.find((t) => t?.kind === 'asr');
  const track = manual || asr || null;

  return { track, available };
}

/** base_url에 fmt 파라미터를 붙인다(기존 파라미터 유지). */
export function withCaptionFormat(baseUrl, fmt = 'json3') {
  if (!baseUrl) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  // 이미 fmt가 있으면 교체
  if (/[?&]fmt=/.test(baseUrl)) return baseUrl.replace(/([?&]fmt=)[^&]*/, `$1${fmt}`);
  return `${baseUrl}${sep}fmt=${fmt}`;
}

// ── 검색/채널 영상 노드 정규화 ──

function textOf(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (typeof t.text === 'string') return t.text;
  if (typeof t.toString === 'function' && t.toString !== Object.prototype.toString) {
    const s = t.toString();
    if (s && s !== '[object Object]') return s;
  }
  return '';
}

/** "1:02:03" / "12:34" → 초. 실패 시 null. */
export function durationTextToSeconds(text) {
  const s = textOf(text).trim();
  if (!s) return null;
  const parts = s.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return Number.isFinite(sec) ? sec : null;
}

function bestThumbUrl(thumbs) {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return '';
  // 가장 큰(마지막) 썸네일 우선, url 있는 것만
  const withUrl = thumbs.filter((t) => t && t.url);
  if (withUrl.length === 0) return '';
  return withUrl[withUrl.length - 1].url;
}

/**
 * youtubei.js의 다양한 영상 노드(Video, GridVideo, CompactVideo, LockupView…)를
 * 앱 공통 형태로 정규화한다. 영상이 아니거나 id/제목이 없으면 null.
 * @param {object} node
 * @returns {{videoId,title,channel,durationSec,thumbnailUrl,hasCaptions}|null}
 */
export function normalizeVideoNode(node) {
  if (!node || typeof node !== 'object') return null;

  // LockupView (신형 검색/채널 카드)
  if (node.content_type != null && node.content_id != null) {
    if (node.content_type !== 'VIDEO') return null;
    const meta = node.metadata || null;
    const title = textOf(meta?.title);
    const videoId = node.content_id;
    if (!videoId || !title) return null;
    // 채널명: metadata.metadata(ContentMetadataView) 내부 텍스트에서 최선의 추정
    let channel = '';
    const mmeta = meta?.metadata;
    if (mmeta?.metadata_rows) {
      for (const row of mmeta.metadata_rows) {
        for (const part of row?.metadata_parts || []) {
          const txt = textOf(part?.text);
          if (txt) { channel = txt; break; }
        }
        if (channel) break;
      }
    }
    const img = node.content_image?.image || node.content_image?.primary_thumbnail?.image;
    return {
      videoId,
      title,
      channel,
      durationSec: null, // LockupView는 overlay 안에 있어 신뢰도 낮음 → 생략
      thumbnailUrl: bestThumbUrl(img),
      hasCaptions: null,
    };
  }

  // 클래식 Video / GridVideo / CompactVideo
  const videoId = node.video_id || node.id || null;
  const title = textOf(node.title);
  if (!videoId || !title) return null;

  let durationSec = null;
  if (node.duration && Number.isFinite(node.duration.seconds)) {
    durationSec = node.duration.seconds;
  } else if (node.length_text) {
    durationSec = durationTextToSeconds(node.length_text);
  }

  return {
    videoId,
    title,
    channel: textOf(node.author?.name) || textOf(node.author),
    durationSec,
    thumbnailUrl: bestThumbUrl(node.thumbnails) || (node.best_thumbnail?.url ?? ''),
    hasCaptions: typeof node.has_captions === 'boolean' ? node.has_captions : null,
  };
}

/**
 * 영상 노드 배열을 정규화하고 videoId 중복 제거 후 상한만큼 자른다.
 * @param {object[]} nodes
 * @param {number} limit
 */
export function normalizeVideoList(nodes, limit = 20) {
  const out = [];
  const seen = new Set();
  for (const n of Array.isArray(nodes) ? nodes : []) {
    const v = normalizeVideoNode(n);
    if (!v || seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}
