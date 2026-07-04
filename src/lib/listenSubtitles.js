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
