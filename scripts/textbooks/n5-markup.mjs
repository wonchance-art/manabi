// N5 교재 본문의 일본어 조각 렌더 규칙 — 원 N5 도구(tooling/rebuild.py)가 저장소에 없어 운영 판본 8a8c1c1fd452773810abaf8c의
// index.html에서 다시 찾아낸 규칙이다(N5-RENDERER-001 충실도 관문, 2026-11-11 KST). 쪽 틀(426개 article · 과별 추가 필드 19종)은
// 다시 만들지 않는다 — 이 모듈은 「원고 문자열 → 일본어 조각」만 다룬다. 계약: n5-markup.test.js가 8a8c 출력과 바이트 대조한다.
//
// N4 재구현(build-n4-web.mjs)과 다른 점: ⑴ 이웃 글자 검사(「합성어 안 읽기 금지」)가 없다 — 1時半 · 4月20日처럼 키가 이어 붙는다.
// ⑵ 본문 조각은 구 단위 <span class="phrase">로 나뉜다(공백 → 「</span> <span …>」, 、 。 ！ ？ 뒤 → 공백 없는 경계).
// ⑶ 답 · 선택지 · 해설 속 일본어(인라인 틀)는 루비가 없다 — A-2(한자 전부 후리가나)로 가면 이 틀도 바뀐다(화면 변경).
// build-n4-web.mjs는 고치지 않는다(N4 출력 바이트 불변).
import { escapeHtml as e } from './build-n4-web.mjs';

const BREAK = /([ 、。！？])/u;
// 확장(설계 — 8a8c 원고에는 { } 가 0개라 기존 출력과 겹치지 않는다): 과 지도로 못 쓰는 읽기를 원고 문자열에 직접 적는다.
//   예: {一日|ついたち}, {今日|きょう}. 렌더는 <ruby>, sourceIndex · 선택 문장은 rt를 빼므로 바탕 글자만, 가나형은 읽기.
const INLINE = /\{([^{}|]+)\|([^{}|]+)\}/gu;

/** 과 지도(kanji: { 키: 읽기 })로 루비를 씌운다 — 가장 긴 키 우선, 이웃 검사 없음(N5 실측). 인라인 {바탕|읽기}가 먼저다. */
export function n5Ruby(text, kanji = {}) {
  const keys = Object.keys(kanji || {}).filter(k => k && typeof kanji[k] === 'string' && kanji[k]).sort((a, b) => b.length - a.length || a.localeCompare(b));
  const plain = source => {
    let html = '';
    for (let i = 0; i < source.length;) {
      const key = keys.find(k => source.startsWith(k, i));
      if (key) { html += `<ruby>${e(key)}<rt>${e(kanji[key])}</rt></ruby>`; i += key.length; }
      else { const ch = String.fromCodePoint(source.codePointAt(i)); html += e(ch); i += ch.length; }
    }
    return html;
  };
  let html = '', last = 0;
  for (const m of String(text ?? '').matchAll(INLINE)) {
    html += plain(String(text).slice(last, m.index)) + `<ruby>${e(m[1])}<rt>${e(m[2])}</rt></ruby>`;
    last = m.index + m[0].length;
  }
  return html + plain(String(text ?? '').slice(last));
}

/** 본문 틀(대화 · 문형 예문 · 단어 · 쓰기 예시): 구 단위 span + 루비. */
export function n5Phrase(text, kanji = {}) {
  const chunks = String(text ?? '').split(' ').map(chunk => chunk.split(/(?<=[、。！？])(?=.)/u).map(s => `<span class="phrase">${n5Ruby(s, kanji)}</span>`).join(''));
  return `<span lang="ja">${chunks.join(' ')}</span>`;
}

/** 인라인 틀(답 · 선택지 일부): 일본어 덩어리마다 span, 공백 · 、 。 ！ ？는 밖에. 8a8c는 루비 없음. */
export function n5Inline(text) {
  return String(text ?? '').split(BREAK).map(part => !part ? '' : BREAK.test(part) && part.length === 1 ? part : `<span lang="ja">${e(part)}</span>`).join('');
}

/**
 * 가나형 — 「표기 외 동일」 계약의 비교 기준. 인라인 {바탕|읽기}와 과 지도 키(가장 긴 것 우선)를 읽기로 바꾼다.
 * 지도에 없는 한자는 그대로 남는다(그런 한자가 있으면 계약이 「읽기 없는 한자」로 따로 잡는다).
 */
export function kanaForm(text, kanji = {}) {
  const withInline = String(text ?? '').replace(INLINE, (_, _base, reading) => reading);
  const keys = Object.keys(kanji || {}).filter(k => k && kanji[k]).sort((a, b) => b.length - a.length || a.localeCompare(b));
  let out = '';
  for (let i = 0; i < withInline.length;) {
    const key = keys.find(k => withInline.startsWith(k, i));
    if (key) { out += kanji[key]; i += key.length; } else { const ch = String.fromCodePoint(withInline.codePointAt(i)); out += ch; i += ch.length; }
  }
  return out;
}

/** 인라인 표기를 지운 바탕 글자 — sourceIndex · 선택 문장 · 답 비교에 쓰이는 형태(루비 rt 제거와 같은 결과). */
export const baseText = text => String(text ?? '').replace(INLINE, (_, base) => base);
