// 「듣고 읽기」 실험 기능 — 자막·URL 파싱 유틸
// 자막 파싱은 검증된 zero-dep 패키지 @plussub/srt-vtt-parser에 위임한다.
// (.srt / .vtt 둘 다 지원, from/to는 ms 단위. 손파서를 쓰지 않는다.)
// 이 모듈은 그 위에 (a) YouTube URL 파싱 (b) ms→초 정규화 (c) 타임스탬프
// 없는 붙여넣기 텍스트의 줄 단위 큐화 (d) 현재 재생 위치 → 활성 큐 탐색을 얹는다.
import { parse } from '@plussub/srt-vtt-parser';

/**
 * YouTube URL/ID에서 11자 videoId를 추출한다.
 * 지원: watch?v=, youtu.be/, shorts/, embed/, live/, 그리고 순수 ID.
 * @param {string} input
 * @returns {string|null} videoId 또는 null
 */
export function parseYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  // 이미 순수 11자 ID인 경우
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtu.be' ||
    host.endsWith('.youtube.com');
  if (!isYouTubeHost) return null;

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return isValidId(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get('v');
  if (isValidId(v)) return v;

  // youtube.com/shorts/<id> · /embed/<id> · /live/<id> · /v/<id>
  const segs = url.pathname.split('/').filter(Boolean);
  if (segs.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(segs[0])) {
    return isValidId(segs[1]) ? segs[1] : null;
  }

  return null;
}

function isValidId(id) {
  return !!id && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * .srt / .vtt 원문 문자열을 표준 큐 배열로 파싱한다.
 * @param {string} raw
 * @returns {{start:number, end:number, text:string, timed:true}[]} 초 단위 큐 (빈 텍스트 제외)
 */
export function parseTimedSubtitles(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  let entries = [];
  try {
    ({ entries } = parse(raw));
  } catch {
    return [];
  }
  return (entries || [])
    .map((e) => ({
      start: e.from / 1000,
      end: e.to / 1000,
      text: cleanCueText(e.text),
      timed: true,
    }))
    .filter((c) => c.text.length > 0);
}

/**
 * 타임스탬프 없는 붙여넣기 텍스트 → 줄 단위 큐 (싱크 없음).
 * @param {string} raw
 * @returns {{start:null, end:null, text:string, timed:false}[]}
 */
export function parsePlainTextCues(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text) => ({ start: null, end: null, text, timed: false }));
}

// 자막 태그(<i>, {\an8} 등) 제거 및 멀티라인 정규화
function cleanCueText(text) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]+>/g, '')        // <i>, <b>, <c.color> 등 HTML/VTT 인라인 태그
    .replace(/\{[^}]*\}/g, '')       // {\an8} 등 SSA/ASS 스타일 태그
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * 현재 재생 위치(초)에 해당하는 활성 큐 인덱스를 찾는다.
 * start<=t<end 인 큐 우선, 없으면 t 이전에 시작한 마지막 큐(자막 공백 구간 유지).
 * 타임스탬프 없는 큐 목록이면 항상 -1.
 * @param {{start:number|null, end:number|null}[]} cues
 * @param {number} t 초
 * @returns {number} 인덱스 또는 -1
 */
export function findActiveCueIndex(cues, t) {
  if (!Array.isArray(cues) || cues.length === 0) return -1;
  if (typeof t !== 'number' || Number.isNaN(t)) return -1;
  let active = -1;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (c.start == null) return -1; // 타임리스 모드
    if (t >= c.start && (c.end == null || t < c.end)) return i;
    if (t >= c.start) active = i; // 공백 구간: 직전 큐 유지
    else break; // 큐는 시간순 — 이후는 모두 미래
  }
  return active;
}

// ── 인라인 형태소 탭(LingQ 스타일) — 의존성 0 분할 & 토큰 매칭 ──
//
// 왜 Intl.Segmenter인가: 브라우저·Node에 내장(ECMAScript Intl)이라 번들 비용 0.
// kuromoji/TinySegmenter 등 사전 기반 형태소기는 사전(kuromoji는 ~15MB)을 클라로
// 내려받아야 해 실험 도구엔 과하다 — 즉시성(로드 대기 없음)과 번들을 우선해 Segmenter로
// "단어 경계"만 얻고, 정밀한 형태소·뜻은 탭 시 서버 /api/analyze(kuromoji)로 보강한다.

/**
 * 텍스트를 Intl.Segmenter(granularity 'word')로 분할한다(순수·부작용 없음).
 * @param {string} text
 * @param {string} [locale] BCP-47 코드(예: 'ja'). 미지정/미지원이면 로케일 없이 시도.
 * @returns {{text:string,start:number,isWord:boolean}[]|null}
 *   세그먼트 배열. Intl.Segmenter 미지원 환경이면 null(호출부가 통짜 텍스트로 폴백).
 */
export function segmentWords(text, locale) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const Seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? Intl.Segmenter : null;
  if (!Seg) return null; // 미지원 브라우저 → 폴백 신호
  let segmenter;
  try {
    segmenter = new Seg(locale || undefined, { granularity: 'word' });
  } catch {
    try { segmenter = new Seg(undefined, { granularity: 'word' }); }
    catch { return null; }
  }
  const out = [];
  for (const s of segmenter.segment(text)) {
    out.push({ text: s.segment, start: s.index, isWord: !!s.isWordLike });
  }
  return out;
}

/**
 * 탭한 세그먼트(cueText 내 시작 오프셋 segStart, 표면형 segText)에 대응하는
 * analyze 토큰을 찾는다(순수 함수). Intl.Segmenter의 단어 경계와 kuromoji/영어
 * 토크나이저의 형태소 경계는 다를 수 있으므로:
 *   1) 각 토큰 text를 cueText에서 순서대로 위치를 찾아 오프셋 맵을 만들고,
 *   2) segStart가 속한 토큰을 반환(세그먼트가 토큰 중간에서 시작해도 그 토큰).
 *   3) 오프셋으로 못 찾으면(공백/정규화 불일치) segText를 포함하는(또는 포함되는) 토큰으로 폴백.
 *   4) 그래도 없으면 null.
 * @param {{text?:string}[]} tokens analyze 결과 토큰(sequence 순서 유지)
 * @param {string} cueText 원문 큐 텍스트(세그먼트 오프셋의 기준)
 * @param {number} segStart cueText 내 세그먼트 시작 오프셋
 * @param {string} segText 세그먼트 표면형
 * @returns {object|null} 매칭 토큰 또는 null
 */
export function matchTokenAt(tokens, cueText, segStart, segText) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  const text = typeof cueText === 'string' ? cueText : '';

  // 1) 토큰 표면형을 cueText에서 순차 탐색 → 실제 오프셋 스팬(공백 차이에 견고).
  let cursor = 0;
  const spans = tokens.map((t) => {
    const tt = String(t?.text ?? '');
    if (!tt) return { token: t, start: -1, end: -1 };
    const idx = text.indexOf(tt, cursor);
    if (idx === -1) return { token: t, start: -1, end: -1 };
    cursor = idx + tt.length;
    return { token: t, start: idx, end: idx + tt.length };
  });

  // 2) segStart가 속한(start<=segStart<end) 토큰
  if (typeof segStart === 'number' && segStart >= 0) {
    for (const s of spans) {
      if (s.start >= 0 && segStart >= s.start && segStart < s.end) return s.token;
    }
  }

  // 3) 폴백 — segText 포함 관계
  const seg = String(segText ?? '').trim();
  if (seg) {
    for (const s of spans) {
      const tt = String(s.token?.text ?? '');
      if (tt && (tt.includes(seg) || seg.includes(tt))) return s.token;
    }
  }
  return null;
}

/**
 * 32비트 FNV-1a 해시(문자열) — videoId 없는(직접 입력) 번역 캐시 키에 쓴다.
 * @param {string} str
 * @returns {string} 8자리 16진수
 */
export function hashText(str) {
  let h = 0x811c9dc5;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * 초 → mm:ss (또는 h:mm:ss) 표기.
 * @param {number|null} sec
 * @returns {string}
 */
export function formatCueTime(sec) {
  if (sec == null || typeof sec !== 'number' || Number.isNaN(sec) || sec < 0) return '';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
