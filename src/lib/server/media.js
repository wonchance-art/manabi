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

// ── get_transcript(InnerTube '스크립트 보기') 경로 정규화 ──
//
// youtubei.js@17 의 MediaInfo.getTranscript() → TranscriptInfo 구조(node_modules 실소스 확인):
//   TranscriptInfo.transcript(Transcript)
//     .content(TranscriptSearchPanel)
//       .body(TranscriptSegmentList)
//         .initial_segments : (TranscriptSegment | TranscriptSectionHeader)[]
//   · TranscriptSegment: { type:'TranscriptSegment', start_ms, end_ms(문자열 ms),
//                          snippet(Text: .text/.toString()), start_time_text, target_id }
//   · TranscriptSectionHeader: { type:'TranscriptSectionHeader', start_ms, end_ms, snippet } — 챕터 구분(스킵)
//   · TranscriptInfo.languages : string[] (언어 메뉴 표시명, 예: 'English'/'Japanese'/'日本語')
//   · TranscriptInfo.selectLanguage(language:string) : 표시명 문자열로 언어 전환
// (근거: node_modules/youtubei.js/dist/src/parser/{youtube/TranscriptInfo.js,
//        classes/Transcript.js, classes/TranscriptSearchPanel.js,
//        classes/TranscriptSegmentList.js, classes/TranscriptSegment.js})

function snippetText(snippet) {
  if (snippet == null) return '';
  if (typeof snippet === 'string') return snippet;
  if (typeof snippet.text === 'string') return snippet.text;
  if (typeof snippet.toString === 'function' && snippet.toString !== Object.prototype.toString) {
    const s = snippet.toString();
    if (s && s !== '[object Object]' && s !== 'N/A') return s;
  }
  return '';
}

/**
 * TranscriptInfo의 initial_segments를 표준 큐로 정규화한다(순수 함수).
 * start_ms/end_ms(문자열 ms)를 초로 환산하고, 섹션 헤더·빈 줄은 스킵한다.
 * @param {Array<{type?:string,start_ms?:any,end_ms?:any,snippet?:any}>} segments
 * @returns {{from:number,to:number,text:string}[]}
 */
export function normalizeTranscriptSegments(segments) {
  const list = Array.isArray(segments) ? segments : [];
  const cues = [];
  for (const seg of list) {
    if (!seg || typeof seg !== 'object') continue;
    if (seg.type === 'TranscriptSectionHeader') continue; // 챕터 구분 헤더 스킵
    const text = cleanText(snippetText(seg.snippet));
    if (!text) continue;
    const startMs = Number(seg.start_ms);
    if (!Number.isFinite(startMs)) continue;
    const from = startMs / 1000;
    const endMs = Number(seg.end_ms);
    const to = Number.isFinite(endMs) && endMs >= startMs ? endMs / 1000 : from;
    cues.push({ from, to, text });
  }
  return cues;
}

// BCP-47 코드(예: 'ja')로 만들 수 있는 언어 표시명 후보를 모은다.
// InnerTube 언어 메뉴는 클라이언트 로케일에 따라 영문('Japanese')·자국어('日本語') 등으로
// 오므로 여러 로케일의 표시명 + 원시 코드를 후보로 둔다.
function languageNameCandidates(langCode) {
  const base = String(langCode || '').toLowerCase().split('-')[0].trim();
  if (!base) return [];
  const out = new Set([base]);
  for (const loc of ['en', base, 'ko']) {
    try {
      const name = new Intl.DisplayNames([loc], { type: 'language' }).of(base);
      if (name && name.toLowerCase() !== base) out.add(name.toLowerCase());
    } catch {
      // Intl 미지원 로케일 — 무시
    }
  }
  return [...out];
}

// 표시명 정규화: 소문자 + 괄호/자동생성 표기 제거 + 공백 정리.
function normalizeLangLabel(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/auto-?generated|자동\s*생성/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * TranscriptInfo.languages(표시명 배열)에서 요청 BCP-47 코드에 맞는 표시명을 찾는다.
 * selectLanguage()에 그대로 넘길 수 있는 원본 표시명 문자열을 돌려준다. 없으면 null.
 * @param {string[]} languages 표시명 배열(예: ['English','Japanese','日本語 (자동 생성)'])
 * @param {string} langCode 예: 'ja' / 'ja-JP'
 * @returns {string|null}
 */
export function matchTranscriptLanguage(languages, langCode) {
  const list = Array.isArray(languages) ? languages.filter((x) => typeof x === 'string') : [];
  if (list.length === 0) return null;
  const cands = languageNameCandidates(langCode);
  if (cands.length === 0) return null;

  // 1) 정확 일치(정규화 기준)
  for (const lang of list) {
    if (cands.includes(normalizeLangLabel(lang))) return lang;
  }
  // 2) 부분 포함(후보/라벨 3자 이상일 때만 — 오탐 방지)
  for (const lang of list) {
    const n = normalizeLangLabel(lang);
    for (const c of cands) {
      if (c.length >= 3 && (n.includes(c) || c.includes(n))) return lang;
    }
  }
  return null;
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

// ── 학습 언어 → InnerTube 세션 언어/지역 매핑 ──
//
// youtubei.js 세션 옵션 SessionOptions는 lang?/location? 을 받는다
// (node_modules/youtubei.js/dist/src/core/Session.d.ts:111-119 —
//  `lang?: string`(언어), `location?: string`(지오로케이션=gl)).
// 학습 언어별 인스턴스에 lang/location을 심어 검색·자막 응답을 그 언어권으로
// 편향시킨다. location은 임의 국가 코드 문자열을 받는다(소스 타입: string).
//   · zh는 대만(TW) — 유튜브가 정상 운영되는 번체 중국어권. 중국(CN)은
//     유튜브 접근 제한으로 검색 결과가 빈약해 편향 효과가 약하다(판단 근거).
const LANG_SESSION = {
  ja: { lang: 'ja', location: 'JP' },
  en: { lang: 'en', location: 'US' },
  fr: { lang: 'fr', location: 'FR' },
  zh: { lang: 'zh', location: 'TW' },
};

// REF_LANGS 키(클라 LANG_OPTIONS.key와 동일) → BCP-47 기본 코드
const LANG_KEY_TO_CODE = {
  Japanese: 'ja', English: 'en', French: 'fr', Chinese: 'zh',
};

/**
 * 클라가 보낸 lang(REF_LANGS 키 'Japanese' 또는 코드 'ja'/'ja-JP')을
 * { code, session }으로 해석한다.
 *   · code:    정규화된 기본 코드('ja'). 매핑 밖이면 소문자 기본코드 그대로(뱃지용).
 *   · session: { lang, location } 또는 지원 밖이면 null(기본 세션 사용).
 * @param {string} input
 * @returns {{ code: string, session: {lang:string,location:string}|null }}
 */
export function resolveSearchLang(input) {
  const raw = String(input || '').trim();
  if (!raw) return { code: '', session: null };
  const code = LANG_KEY_TO_CODE[raw] || raw.toLowerCase().split('-')[0];
  return { code, session: LANG_SESSION[code] || null };
}

/**
 * getBasicInfo 응답에서 caption_tracks의 언어 코드(기본코드) 목록을 뽑는다.
 * 중복 제거. 자막 없으면 빈 배열.
 * @param {object} info youtubei.js VideoInfo
 * @returns {string[]} 예: ['ja','en']
 */
export function extractCaptionLangs(info) {
  const tracks = info?.captions?.caption_tracks;
  if (!Array.isArray(tracks)) return [];
  const out = [];
  const seen = new Set();
  for (const t of tracks) {
    const code = String(t?.language_code || '').toLowerCase().split('-')[0];
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
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
