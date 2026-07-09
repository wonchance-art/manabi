// 🗣️ 월드 스토리 스크립트 빌더 — 독해 글(body)을 포켓몬식 텍스트박스 연쇄로 변환.
//
// 오너 결정: 본편 리더("책") 대신 월드 통합 — narr 문단·ja 라인을 런타임 휴리스틱으로
// "텍스트박스 분량" 청크로 쪼개 순차 재생한다. **원문 데이터(n5_tokyo.js)는 무수정, 소비만.**
//
// 순수 함수만 모았다(React·Phaser 의존 0) — 청크 분할 규칙을 단위 검증 가능하게.

// 문장 종결부호(한/일 공용) 뒤에서 자른다. 종결부호는 앞 문장에 포함해 보존한다.
// (원문 narr은 한국어 서술 — "…멈췄다. 창밖으로…"처럼 마침표로 문장이 끊긴다.)
const SENT_END = /[^。.!?！？]*[。.!?！？]+|[^。.!?！？]+$/g;

/** 문단 → 문장 배열(공백 트리밍, 빈 문장 제거). 종결부호 없는 꼬리도 한 문장으로 취급. */
export function splitSentences(text) {
  if (!text) return [];
  const raw = String(text).match(SENT_END) || [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

// 박스당 목표 글자수(한국어 기준 ~2~3줄). 문장은 절대 중간에서 자르지 않는다 —
// 문장 단위로 그리디하게 담다가 max를 넘기면 새 박스로 넘긴다(단일 문장이 max를 넘어도 보존).
export const NARR_MAX = 60;

/** narr 문단 → 텍스트박스 청크(문장 그리디 패킹, ~NARR_MAX자). */
export function chunkNarr(text, max = NARR_MAX) {
  const sents = splitSentences(text);
  const chunks = [];
  let cur = '';
  for (const s of sents) {
    if (!cur) cur = s;
    else if (cur.length + 1 + s.length <= max) cur += ' ' + s;
    else { chunks.push(cur); cur = s; }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// ja 라인 화자 추정 — ko 앞의 "(직원)"·"(민준)" 태그로 가른다. 태그 없으면 안내방송(sign).
const SPEAKER_TAG = /^\s*\(([^)]+)\)\s*/;

/** ko 문자열 → { speaker, koClean }. speaker: 'officer' | 'player' | 'sign'. */
export function parseSpeaker(ko) {
  const m = String(ko || '').match(SPEAKER_TAG);
  if (!m) return { speaker: 'sign', koClean: String(ko || '').trim() };
  const tag = m[1];
  const koClean = String(ko).slice(m[0].length).trim();
  if (tag.includes('직원')) return { speaker: 'officer', koClean };
  if (tag.includes('민준')) return { speaker: 'player', koClean };
  return { speaker: 'sign', koClean };
}

// 도장(입국 스탬프) 연출 트리거 — 이 낱말이 든 narr 청크에서 가벼운 화면 흔들림 1회.
const STAMP_HINT = /도장|쾅/;

/**
 * 글 → 텍스트박스 스텝 배열.
 * 스텝: { kind:'narr', text, stamp? } | { kind:'speech', speaker, ja, yomi, ko }
 * 순서는 body 순서 그대로(내레이션→대사 교차), narr만 청크 분할한다.
 */
export function buildStoryScript(text) {
  const steps = [];
  for (const b of text?.body || []) {
    if (b.narr != null) {
      const chunks = chunkNarr(b.narr);
      for (const c of chunks) steps.push({ kind: 'narr', text: c, stamp: STAMP_HINT.test(c) });
    } else if (b.ja != null) {
      const { speaker, koClean } = parseSpeaker(b.ko);
      steps.push({ kind: 'speech', speaker, ja: b.ja, yomi: b.yomi || '', ko: koClean });
    }
  }
  return steps;
}
