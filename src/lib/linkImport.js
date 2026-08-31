/**
 * 링크 반입 — URL 판별과 자막 본문 정리 (v2-F R1, #1077 설계 §4).
 *
 * ── 왜 필요한가
 *
 * 반입 입구는 여섯인데(붙여넣기·클립보드·PDF·EPUB·문장 목록·책 묶음) **사용자가 URL을
 * 직접 넣는 문은 없었다**. 자료는 크론이 고른 추천 카드로만 들어온다.
 *
 * ── 수동 붙여넣기가 곁다리가 아닌 이유 (실측 교정)
 *
 * 설계 §0은 「크론이 유튜브 자막을 뽑아 쓰는 검증된 경로가 있다」고 적었지만 실측은
 * 다르다: 크론(`content-sources.js`)은 Qiita·NHK RSS·Dev.to·Wikinews **글**만 가져오고
 * `youtube.js`는 **소비처가 0인 죽은 코드**다. 즉 자동 취득 경로는 운영에서 한 번도
 * 검증된 적이 없고, 그 안이 쓰는 `youtube-transcript`는 문서(§4.3)가 이미 데이터센터
 * IP 차단을 경고한 물건이다.
 *
 * ⇒ 자동 취득은 **되면 좋은 것**으로 두고, 사람이 유튜브에서 복사해 붙여넣는 경로를
 *    1급으로 만든다. 이 모듈이 그 붙여넣기를 본문으로 바꾼다.
 */

/** 이 링크를 다룰 수 있나. 지금은 유튜브만 — 구조는 URL 일반형으로 열어 둔다. */
export function detectLinkKind(url) {
  const raw = String(url || '').trim();
  if (!raw) return 'unsupported';
  let u;
  try {
    u = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return 'unsupported';
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com'
      || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    return 'youtube';
  }
  return 'unsupported';
}

/** 타임코드만 있는 줄인가 — 0:12 · 00:01:02.500 · [00:01:02] */
const CUE_ONLY = /^\[?\d{1,2}:\d{2}(:\d{2})?([.,]\d{1,3})?\]?$/;
/** 줄 안에 박힌 앞머리 타임코드 — "0:12 안녕하세요" */
const CUE_LEAD = /^\[?\d{1,2}:\d{2}(:\d{2})?([.,]\d{1,3})?\]?\s+/;
/** 대괄호 지문 — [음악] [Music] [박수] [applause] */
const BRACKET_NOTE = /\[[^\]]{1,20}\]/g;
/** WebVTT 잔재 */
const VTT_JUNK = /^(WEBVTT|Kind:|Language:|NOTE\b|\d+$)/;

/**
 * 붙여넣은 자막을 본문으로 — 타임코드·지문·중복 줄을 걷어낸다.
 *
 * 유튜브 [스크립트 표시]에서 복사하면 시각과 대사가 **번갈아 줄로** 온다. 그대로 두면
 * 본문의 절반이 숫자가 되고, 형태소 분석기가 그 숫자까지 낱말로 끊는다.
 */
export function stripCueNoise(text) {
  const out = [];
  let prev = null;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    let line = rawLine.replace(BRACKET_NOTE, ' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    if (VTT_JUNK.test(line)) continue;
    if (CUE_ONLY.test(line)) continue;
    line = line.replace(CUE_LEAD, '').trim();
    // 자동 생성 자막은 같은 줄을 두 번씩 흘린다(롤업) — 연속 중복만 지운다.
    if (!line || line === prev) continue;
    out.push(line);
    prev = line;
  }
  return out;
}

/** 자막 줄 묶음 크기 — `extractTranscript`가 쓰는 값과 같아야 한다(정본 일치). */
export const PARAGRAPH_LINES = 8;

/**
 * 자막 줄 → 문단. 8줄씩 한 문단으로 묶는다.
 * `youtube.js extractTranscript`와 **같은 규칙**이라, 자동 취득분과 붙여넣기분의
 * 본문 모양이 갈리지 않는다(같은 영상을 두 경로로 넣어도 같은 자료가 된다).
 */
export function paragraphize(lines, size = PARAGRAPH_LINES) {
  const list = (lines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const n = Math.max(1, size);
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n).join(' '));
  return out.join('\n');
}

/** 붙여넣기 한 방에 — 잡음 제거 후 문단화. */
export function transcriptFromPaste(text, size = PARAGRAPH_LINES) {
  return paragraphize(stripCueNoise(text), size);
}

/** 유튜브 제목에서 군더더기를 덜어 낸다 — 자료 제목으로 쓸 것이라 짧을수록 좋다. */
export function cleanVideoTitle(title) {
  return String(title || '')
    .replace(/[|｜]\s*[^|｜]{0,40}$/, '')     // 꼬리 채널·시리즈 표기
    .replace(/[［\[(【][^）)\]】]{0,30}[】\])）]/g, ' ')  // 말머리 태그
    .replace(/\s+/g, ' ')
    .trim();
}
