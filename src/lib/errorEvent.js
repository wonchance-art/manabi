// 운영 오류 기록 한 건의 모양(ERROR-OBSERVE-001) — 브라우저(reportError) · 서버 수신 경로(/api/client-error) · 서버 오류(instrumentation)가
// 같은 정리를 지난다. 저장하는 칸은 여기 FIELDS뿐이다: 종류 · 메시지 · 스택 앞부분 · 오류 ID(digest) · 경로(쿼리 없음) · 배포 판 ·
// 브라우저 계열. IP · 요청 본문 · 입력 글 · 토큰 · 계정 ID는 싣지 않는다 — 메시지 · 스택 안의 주소 쿼리, 이메일, 토큰 모양, UUID, 긴 숫자,
// 공백 · 비ASCII가 든 따옴표 조각(사용자가 입력한 글이 오류 원문에 끼는 자리 — 예: JSON.parse 조각)은 지운다. 길이는 모두 자른다.
// 화면에는 아무것도 그리지 않는다(원문은 기록 전용 — WALL-001).

export const LIMITS = Object.freeze({ message: 500, stack: 1000, stackLines: 6, route: 200, body: 4096 });
export const FIELDS = Object.freeze(['kind', 'message', 'stack', 'digest', 'route', 'release']);
const KIND = /^[a-z][a-z0-9_.-]{0,47}$/;
const DIGEST = /^[A-Za-z0-9@:_-]{1,64}$/;
const RELEASE = /^[a-z0-9]{3,40}$/;

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
// 주소의 쿼리 · 조각(?…, #…)을 뗀다 — 절대 주소와 경로 모양 둘 다. (뒤돌아보기 정규식은 쓰지 않는다 — 옛 Safari가 구문 오류로 조각째 못 읽는다.)
// 스택 프레임의 줄:열(…/page.js?dpl=…:1:2345)은 쿼리 뒤에 붙어 있어도 남긴다.
const URL_TAIL = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#'"`()<>]*)[?#][^\s'"`()<>]*?(:\d+(?::\d+)?)?(?=[\s'"`()<>]|$)/gi;
const PATH_TAIL = /(^|[\s('"`=])(\/[^\s?#'"`()<>]*)[?#][^\s'"`()<>]*?(:\d+(?::\d+)?)?(?=[\s'"`()<>]|$)/g;
const JWT = /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const SB_KEY = /\bsb_(?:secret|publishable)_[\w-]+/g;
const BEARER = /\bBearer\s+[^\s'"]+/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
const LONG_NUMBER = /\d{6,}/g;
// 따옴표 조각: 공백 · 비ASCII가 들었거나 40자를 넘으면 사용자 글일 수 있다 — 내용만 지운다(식별자 모양의 짧은 이름은 남긴다).
const QUOTED = /(["'`])([^"'`\n]{1,400})\1/g;
const userish = (s) => s.length > 40 || /\s/.test(s) || /[^\x20-\x7e]/.test(s);

/** 오류 원문 → 기록해도 되는 글. 줄바꿈은 keepLines일 때만 남긴다. */
export function scrubText(value, max, { keepLines = false, numbers = true } = {}) {
  if (value == null) return '';
  // 정규식 일을 묶어 두려고 먼저 넉넉히 자른다(아주 긴 원문 — 예: 응답 본문을 통째로 품은 메시지).
  let text = String(value).slice(0, max * 4).replace(CONTROL, ' ');
  text = text
    .replace(JWT, '[token]')
    .replace(SB_KEY, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(URL_TAIL, '$1$2')
    .replace(PATH_TAIL, '$1$2$3')
    .replace(EMAIL, '[email]')
    .replace(UUID, '[id]')
    .replace(LONG_TOKEN, '[token]')
    .replace(QUOTED, (all, q, inner) => (userish(inner) ? `${q}…${q}` : all));
  if (numbers) text = text.replace(LONG_NUMBER, '[n]');
  text = keepLines
    ? text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
    : text.replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
}

/** 스택 앞부분 — 첫 줄(메시지 반복)은 빼고 프레임 몇 줄만, 출처(origin)는 떼고 경로만. */
export function scrubStack(stack) {
  if (!stack) return null;
  const lines = String(stack).slice(0, LIMITS.stack * 8).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const frames = lines.filter((line) => /^at\s|@/.test(line)).slice(0, LIMITS.stackLines);
  const kept = (frames.length ? frames : lines.slice(1, 1 + LIMITS.stackLines))
    .map((line) => line.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^/\s)]+/gi, ''));
  // 줄 · 열 번호는 남긴다(압축 번들의 열 번호는 6자리를 넘는다) — 긴 숫자 지우기는 메시지에만.
  const out = scrubText(kept.join('\n'), LIMITS.stack, { keepLines: true, numbers: false });
  return out || null;
}

const SEGMENT_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[A-Za-z0-9_-]{21,})$/i;

/** 경로만(쿼리 · 조각 · 출처 없음). ID 모양 · 비ASCII · 인코딩된 칸(검색어 · 단어 등 사용자 글일 수 있음)은 자리표로 바꾼다. */
export function sanitizeRoute(value) {
  if (typeof value !== 'string' || !value) return null;
  let path = value.trim();
  const scheme = path.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i);
  if (scheme) path = path.slice(scheme[0].length) || '/';
  path = path.split(/[?#]/)[0];
  if (!path.startsWith('/')) return null;
  const segments = path.split('/').map((segment) => {
    if (!segment) return segment;
    if (/^\[[\w.]+\]$/.test(segment) || /^\(\w[\w-]*\)$/.test(segment)) return segment; // 라우트 틀([id] · (app))은 그대로
    if (SEGMENT_ID.test(segment)) return ':id';
    if (/%|[^\x21-\x7e]/.test(segment) || segment.length > 40) return ':x';
    return segment;
  });
  const out = segments.join('/').slice(0, LIMITS.route);
  return out || '/';
}

/** User-Agent → 브라우저 계열 하나(판 · 기기 · 운영체제 판은 남기지 않는다). */
export function browserFamily(ua) {
  if (typeof ua !== 'string' || !ua) return null;
  if (/bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python|node-fetch|undici/i.test(ua)) return 'bot';
  const family = /Edg\//.test(ua) ? 'edge'
    : /SamsungBrowser/.test(ua) ? 'samsung'
    : /OPR\/|Opera/.test(ua) ? 'opera'
    : /Firefox\/|FxiOS/.test(ua) ? 'firefox'
    : /Chrome\/|CriOS/.test(ua) ? 'chrome'
    : /Safari\//.test(ua) ? 'safari'
    : 'other';
  return /Mobi|Android|iPhone|iPad/.test(ua) ? `${family}-mobile` : family;
}

const errorText = (error) => {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message) return `${error.name && error.name !== 'Error' ? `${error.name}: ` : ''}${error.message}`;
  try { return String(error); } catch { return ''; }
};

/**
 * 오류 기록 한 건을 만든다. 칸은 FIELDS뿐 — 그 밖의 입력은 무엇이든 버린다. 종류 · 메시지가 없으면 null.
 * @param {{kind: string, error?: unknown, message?: string, stack?: string, digest?: string, route?: string, release?: string}} input
 */
export function buildErrorEvent(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const kind = typeof input.kind === 'string' && KIND.test(input.kind) ? input.kind : null;
  const message = scrubText(input.error !== undefined ? errorText(input.error) : input.message, LIMITS.message);
  if (!kind || !message) return null;
  const rawStack = input.error !== undefined ? input.error?.stack : input.stack;
  const digestValue = input.digest ?? input.error?.digest;
  const digest = typeof digestValue === 'string' && DIGEST.test(digestValue) ? digestValue : null;
  const release = typeof input.release === 'string' && RELEASE.test(input.release) ? input.release : null;
  return { kind, message, stack: scrubStack(rawStack), digest, route: sanitizeRoute(input.route), release };
}

// 브라우저가 보내는 「다른 길로 갔다」 신호(오류가 아니다) — 종류마다 메시지는 정해진 사유 코드 하나뿐이다(자유 글 · 스택 · 오류 ID 없음).
// study.paragraph_fallback: /study 오늘의 문단 생성이 실패해 기본 세션 문항으로 이어 갔다(STUDY-PARA-OBSERVE-001, 2026-11-08 KST).
//   status_NNN = 응답 상태 · no_paragraph = 200인데 문단 없음 · too_few_items = 채점 문항 3개 미만 · timeout = 20초 초과 ·
//   network = 요청 자체 실패 · map_error = 문단을 문항으로 바꾸다 실패.
export const CLIENT_SIGNALS = Object.freeze({
  'study.paragraph_fallback': /^(?:status_[1-5]\d\d|no_paragraph|too_few_items|timeout|network|map_error)$/,
});

/** 수신 경로용 — 받은 JSON에서 FIELDS만 꺼내 다시 정리한다(브라우저가 정리했더라도 믿지 않는다). 모양이 틀리면 null. */
export function parseClientErrorBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const pick = (name) => (typeof body[name] === 'string' ? body[name] : undefined);
  if (!pick('kind') || !pick('message')) return null;
  if (Object.hasOwn(CLIENT_SIGNALS, pick('kind'))) {
    if (!CLIENT_SIGNALS[pick('kind')].test(pick('message'))) return null;
    return buildErrorEvent({ kind: pick('kind'), message: pick('message'), route: pick('route'), release: pick('release') });
  }
  if (!pick('kind').startsWith('boundary.') && !pick('kind').startsWith('window.')) return null; // 서버 종류(server.*)는 브라우저가 못 쓴다
  return buildErrorEvent({ kind: pick('kind'), message: pick('message'), stack: pick('stack'), digest: pick('digest'), route: pick('route'), release: pick('release') });
}

/** 한 화면 안 중복 판정 열쇠. */
export const errorEventKey = (event) => [event.kind, event.message, event.route, event.digest].join('|');
