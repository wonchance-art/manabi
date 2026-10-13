import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { friendlyError, friendlyToastMessage, isUserFacingMessage, UNKNOWN_ERROR_MESSAGE } from '../errorMessage';
import { toKoreanError, AUTH_FALLBACK_MESSAGE } from '../authErrors';

// WALL-STATES-001 항목 1(화면 벽 상태 재고 2026-10-13): 오류 원문(영어 포함)이 학습자에게 그대로 보이던 80여 곳.
// 원칙은 WALL-001(오류 화면이 error.message를 그리지 않음)과 같다 — 원문은 콘솔로만, 화면에는 정해 둔 한국어.
//
// 계약은 두 겹이다.
//  ⑴ 매핑 함수의 행동: 모르는 오류는 원문 대신 고정 문구, 우리 API의 한국어 안내는 그대로.
//  ⑵ 소스 정적 검사: 클라이언트 코드가 오류 객체의 .message(·서버 JSON의 error 문자열)를 화면으로 직접 보내지 않는다.
//     .message가 나오는 자리는 「안전한 모양」(콘솔·비교·패턴 검사·표 조회·매핑 함수 인자·Error 재포장)이거나
//     아래 허용 목록이어야 한다. 새 코드가 원문을 화면에 붙이면 여기서 걸린다 — 고치는 길은 friendlyToastMessage(err, 폴백).

const ROOT = join(process.cwd(), 'src');
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(p, out); }
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
};

// 서버 코드(학습자 화면이 아님)와 매핑·기록 모듈 자신은 검사 밖이다.
const EXEMPT_PATH = [
  /^app\/api\//, /^lib\/server\//, /(^|\/)server\.js$/,
  /^lib\/errorMessage\.js$/, /^lib\/authErrors\.js$/, /^lib\/reportError\.js$/,
];

// 원문이 화면에 가도 되는 좁은 예외 — 파일과 그 줄의 고유 조각, 이유.
// 관리자 진단 도구는 원문 자체가 목적이다(학습자 화면이 아니다). 나머지는 화면에 가지 않는 분류용 지역 변수.
const ALLOWLIST = [
  { file: 'components/admin/LlmBenchPanel.jsx', snippet: 'error: e.message', reason: '관리자 LLM 벤치 — 모델별 실패 원문이 진단 결과다' },
  { file: 'components/admin/LlmBenchPanel.jsx', snippet: 'setError(e.message)', reason: '관리자 LLM 벤치 — 목록 실패 원문이 진단 결과다' },
  { file: 'components/admin/InlineEditForm.jsx', snippet: "'JSON 구문 오류: ' + e.message", reason: '관리자 JSON 편집 — 구문 오류 위치(SyntaxError)가 고칠 단서다' },
  { file: 'app/(app)/admin/metrics/page.jsx', snippet: 'rpcError.message', reason: '관리자 지표 — RPC 실패 원문이 진단 결과다' },
  { file: 'lib/studyGroups.js', snippet: "const msg = String(error?.message || '')", reason: '분류용 지역 변수 — 아래 정규식으로 한국어 안내를 고른다' },
  { file: 'lib/libraryOperations.js', snippet: "const message=error?.message||''", reason: '분류용 지역 변수 — 코드표로 한국어 안내를 고른다' },
  { file: 'lib/originalReadingPosition.js', snippet: "errorCode=error?.message||error?.code||''", reason: '내부 오류 코드 기록 — 화면 문구는 코드표가 고른다' },
  { file: 'lib/aozoraRuby.js', snippet: 'skipped: error.message', reason: '저자 루비 잠금 진단값 — analyzeText가 콘솔로만 남긴다' },
  { file: 'components/world/overworldPageRenderer.js', snippet: 'message: error?.message ?? String(error)', reason: '월드 렌더러 진단 기록(onError 콜백) — 화면 문구가 아니다' },
];

const MAPPERS = '(?:friendlyError|friendlyToastMessage|toKoreanError|isUserFacingMessage|classroomError)';
// 오류 객체의 .message — err·error·e·cause·ex, …Err·…Error 이름, 그리고 x.error.message(쿼리·응답 오류).
const ERROR_MESSAGE = /(?:\b(?:err|error|e|cause|ex|exc)|\b[a-z]\w*(?:Err|Error)|\b[\w$]+(?:\??\.[\w$]+)*?\??\.error)\??\.message\b/g;
// 화면으로 가는 함수 — 토스트와 상태 설정 함수(set…).
const SINK = /\b(?:toast|set[A-Z]\w*)\??\.?\(/g;
// 서버 JSON의 오류 문자열을 그대로 쓰는 모양(json.error, result.error, j.message …).
const SERVER_TEXT = /\b(?:json|j|data|result|body|payload|res|response)\??\.(?:error|message)\b(?!\??\.)/g;

const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

function isSafe(before, after) {
  // ① 콘솔 기록 — 닫히지 않은 console.*( 안
  const consoleAt = before.search(/console\.\w+\((?![\s\S]*console\.\w+\()/);
  if (consoleAt >= 0) {
    const inner = before.slice(consoleAt);
    if ((inner.match(/\(/g) || []).length > (inner.match(/\)/g) || []).length) return true;
  }
  // ② 비교
  if (/^\s*(?:===|!==|==|!=)/.test(after) || /(?:===|!==|==|!=)\s*$/.test(before)) return true;
  // ③ 패턴 검사·분류
  if (/(?:\.test|\.match|\.search|\.includes|\.startsWith|\.endsWith)\(\s*(?:String\(|\(|`[^`]*\$\{)?\s*$/.test(before)) return true;
  if (/^\??\.(?:includes|startsWith|endsWith|match|toLowerCase)\(/.test(after)) return true;
  if (/^\s*\|\|\s*''\s*\)\s*\.(?:toLowerCase|includes|match)\(/.test(after)) return true;
  // ④ 코드표 조회
  if (/\[\s*$/.test(before) && /^\s*\]/.test(after)) return true;
  // ⑤ 매핑 함수 인자, Error 재포장(표시는 다시 매핑 함수를 지난다)
  if (new RegExp(`\\b${MAPPERS}\\(\\s*$`).test(before)) return true;
  if (/\b(?:new\s+)?Error\(\s*(?:`[^`]*\$\{\s*)?$/.test(before)) return true;
  return false;
}

function argsOf(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return [open + 1, i];
  }
  return [open + 1, text.length];
}

function scanRawErrorExposure() {
  const found = [];
  for (const path of walk(ROOT)) {
    const file = relative(ROOT, path).split('\\').join('/');
    if (EXEMPT_PATH.some(re => re.test(file))) continue;
    const text = stripComments(readFileSync(path, 'utf8'));
    const lines = text.split('\n');
    const rawLines = readFileSync(path, 'utf8').split('\n');
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    const locate = (i) => {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= i) lo = mid; else hi = mid - 1; }
      return lo;
    };
    const report = (i, len, kind) => {
      const n = locate(i);
      const line = lines[n];
      const col = i - starts[n];
      const before = line.slice(0, col);
      const after = line.slice(col + len);
      if (isSafe(before, after)) return;
      if (ALLOWLIST.some(a => a.file === file && rawLines[n].includes(a.snippet))) return;
      found.push(`${file}:${n + 1} [${kind}] ${line.slice(Math.max(0, col - 60), col + len + 60).trim()}`);
    };
    for (const m of text.matchAll(ERROR_MESSAGE)) report(m.index, m[0].length, 'message');
    for (const s of text.matchAll(SINK)) {
      const [a, b] = argsOf(text, s.index + s[0].length - 1);
      const args = text.slice(a, b);
      for (const m of args.matchAll(SERVER_TEXT)) report(a + m.index, m[0].length, 'server-text');
    }
  }
  return [...new Set(found)];
}

describe('WALL-STATES-001 ⑴ 매핑 함수 — 모르는 오류는 원문 대신 고정 문구', () => {
  it.each([
    'duplicate key value violates unique constraint "user_vocab_pkey"',
    'TypeError: Cannot read properties of undefined (reading \'id\')',
    'new row violates check constraint',
    'Gemini 응답 JSON 파싱 실패: Unexpected end',
    'API 요청 실패 (HTTP 500)',
    '데이터 조회 실패: user_vocabulary, reading_progress',
    '서버에 AI 키가 설정되지 않았어요 (GEMINI_API_KEY 또는 GROQ_API_KEY).',
    'x'.repeat(250),
  ])('%j는 화면에 원문을 내지 않는다', (raw) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const message = friendlyToastMessage(new Error(raw));
    expect(message).not.toContain(raw.slice(0, 20));
    expect(isUserFacingMessage(message)).toBe(true);
    warn.mockRestore();
  });

  it('모르는 영어 오류는 고정 문구를 쓰고 원문은 콘솔·technical로만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = friendlyError(new Error('Something exploded in a worker'));
    expect(result.message).toBe(UNKNOWN_ERROR_MESSAGE);
    expect(result.technical).toBe('Something exploded in a worker');
    expect(warn).toHaveBeenCalledWith(expect.any(String), 'Something exploded in a worker');
    warn.mockRestore();
  });

  it('화면이 준 한국어 폴백이 고정 문구보다 앞선다(패턴 매칭은 그보다 앞선다)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(friendlyToastMessage(new Error('boom'), '교재를 불러오지 못했어요.')).toBe('교재를 불러오지 못했어요.');
    expect(friendlyToastMessage(new Error('Failed to fetch'), '교재를 불러오지 못했어요.')).toMatch(/인터넷 연결을 확인해 주세요/);
    expect(friendlyToastMessage(null, '교재를 불러오지 못했어요.')).toBe('교재를 불러오지 못했어요.');
    warn.mockRestore();
  });

  it.each([
    '한 번에 1~50과로 나눠 주세요.',
    '원본이 변경됐어요. 최신 원본에서 구간을 다시 골라 주세요.',
    'PDF 쪽수를 확인해 주세요.',
    '선택한 필기를 Gemini로 보내는 인식을 눌러 주세요.',
  ])('우리 API·화면의 한국어 안내 %j는 그대로 보인다', (message) => {
    expect(friendlyToastMessage(new Error(message))).toBe(message);
  });

  it('로그인 오류 번역도 모르는 원문을 내지 않는다(로그인 화면의 기존 폴백 문구)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(toKoreanError('Database error saving new user')).toBe(AUTH_FALLBACK_MESSAGE);
    expect(toKoreanError(undefined)).toBe(AUTH_FALLBACK_MESSAGE);
    expect(toKoreanError('이미 처리 중인 요청이에요.')).toBe('이미 처리 중인 요청이에요.');
    warn.mockRestore();
  });
});

describe('WALL-STATES-001 ⑵ 소스 — 오류 원문을 화면에 직접 붙이지 않는다', () => {
  it('클라이언트 코드의 .message·서버 오류 문자열은 매핑 함수를 지나거나 허용 목록에 있다', () => {
    expect(scanRawErrorExposure()).toEqual([]);
  });

  it('허용 목록은 좁고, 모든 항목이 지금도 실제 줄을 가리킨다(죽은 예외 금지)', () => {
    expect(ALLOWLIST.length).toBeLessThanOrEqual(10);
    for (const a of ALLOWLIST) {
      expect(a.reason, a.file).toBeTruthy();
      expect(readFileSync(join(ROOT, a.file), 'utf8'), `${a.file} — ${a.snippet}`).toContain(a.snippet);
    }
  });

  it('검사기는 실제로 원문 노출을 잡는다(공허 통과 방지)', () => {
    const cases = [
      ["toast('삭제 실패: ' + err.message, 'error');", false],
      ['setError(cause.message);', false],
      ['{query.error.message}', false],
      ["toast(j?.message || '가져오지 못했어요.', 'error');", false],
      ["console.warn('[x]', err.message);", true],
      ["if (/column/.test(error.message || '')) {", true],
      ["toast('삭제 실패: ' + friendlyToastMessage(err), 'error');", true],
      ["if (error?.message === 'EDIT_CONFLICT') return x;", true],
    ];
    for (const [line, safe] of cases) {
      const hits = [...line.matchAll(ERROR_MESSAGE)].map(m => isSafe(line.slice(0, m.index), line.slice(m.index + m[0].length)));
      const sinkHits = [...line.matchAll(SINK)].flatMap(s => {
        const [a, b] = argsOf(line, s.index + s[0].length - 1);
        return [...line.slice(a, b).matchAll(SERVER_TEXT)].map(m => isSafe(line.slice(0, a + m.index), line.slice(a + m.index + m[0].length)));
      });
      const allSafe = [...hits, ...sinkHits].every(Boolean);
      expect(allSafe, line).toBe(safe);
    }
  });
});
