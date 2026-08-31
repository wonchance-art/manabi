'use client';

/**
 * 문법 패턴 본문 탐지 — 커널 인덱스와 스캔 (v2-G R1, #1077 설계 §2).
 *
 * ── 상환하는 부채
 *
 * 아키 문서가 이음새 부채로 적어 둔 것: **챕터 → 자료(뷰어) 역방향 없음**. [자세히]는
 * 뷰어→챕터 단방향이라, 챕터에서 배운 문법이 본문에서 다시 만나지지 않았다. 정본
 * 문형은 중국어만 484개(415개가 챕터 slug 보유)인데 읽는 글과 한 번도 마주치지 않는다.
 *
 * ── 핵심 난점: 문형은 정규식이 아니다
 *
 * 데이터가 `"A 是 B"`·`"주어 + 很 + 형용사"`처럼 **슬롯이 섞인 표기**라 그대로는 못 찾는다.
 * 그래서 슬롯(A/B·주어·형용사…)을 버리고 **고정 형태소(kernel)** 만 남긴다 — 把·被·
 * 越来越·除了 같은 표지어. 본문 토큰의 표층형과 대조해 **후보**만 잡는다(단정 아님).
 *
 * ── 오탐을 막는 두 겹
 *
 * ① 한 글자 커널은 기본적으로 버린다. 的·了·是·在은 거의 모든 문장에 있어서 밑줄이
 *    글 전체에 깔린다 — 표지가 아니라 배경이 된다. 다만 把·被·越처럼 한 글자로도
 *    구문을 특정하는 것들이 있어 그것만 `STRONG_SINGLE_KERNELS`로 되살린다.
 *    '제외 목록'이 아니라 '허용 목록'으로 뒤집은 이유는 **새 커널이 조용한 쪽으로
 *    떨어지게** 하기 위해서다(모르는 것이 소음이 되면 토글을 끄게 된다).
 * ② 토큰 경계로만 맞춘다. 문자 부분일치면 觉得의 得, 因为의 为가 걸린다 — 분석기가
 *    한 낱말로 끊어 준 자리에서만 표지로 친다.
 *
 * LLM은 한 번도 부르지 않고(1단 스캔), 새로 적재하는 기록도 없다.
 */

/** 한 표지가 이어 붙을 수 있는 최대 토큰 수 — 성어(4자)까지 닿게. */
export const MAX_SPAN = 4;

/**
 * 한 글자로도 구문을 특정하는 표지 — 이것만 한 글자 커널로 허용한다.
 * 把(처치)·被/让/叫/使/令(피동·사역)·越(점층)·连(포괄)·除(예외)·比(비교)·
 * 得(정도보어)·着/过(상)·替/朝/趁/凭/据(개사)·并/宁(어기).
 */
export const STRONG_SINGLE_KERNELS = new Set([
  '把', '被', '让', '叫', '使', '令', '连', '越', '除', '比',
  '得', '着', '过', '替', '朝', '趁', '凭', '据', '并', '宁',
]);

/**
 * 두 글자 이상이라도 표지로 치지 않는 것 — 문형의 표지이기 전에 그냥 흔한 낱말이라
 * 밑줄이 정보를 주지 않는다. 짧게 유지한다(길이 규칙이 이미 대부분을 거른다).
 */
export const LOW_SIGNAL_KERNELS = new Set([
  // 그냥 흔한 낱말
  '没有', '什么', '一个', '时候', '可以', '知道', '这个', '那个', '东西', '觉得',
  // 시간 명사 — 문형 표기에 자주 등장하지만 표지하는 건 '언제'지 구조가 아니다
  // (렌더 실측에서 "今天我在图书馆…"의 今天이 밑줄을 받아 잡았다)
  '今天', '明天', '昨天', '现在', '上午', '下午', '中午', '晚上', '星期',
  // 인사·상투 표현 — 통째 관용구라 문법을 가리키지 않는다
  '再见', '谢谢', '请问', '好吗', '对吗', '是吗',
]);

/** 표기에서 고정 형태소만 — 슬롯(A/B·주어·형용사)과 기호는 한자가 아니라 저절로 빠진다. */
export function kernelsOf(patternText) {
  return String(patternText || '').match(/[一-鿿]+/g) || [];
}

/** 이 커널을 표지로 쓸 수 있나(위 두 겹). */
export function isUsableKernel(kernel) {
  const k = String(kernel || '');
  if (!k || LOW_SIGNAL_KERNELS.has(k)) return false;
  return [...k].length >= 2 || STRONG_SINGLE_KERNELS.has(k);
}

/**
 * 문형 세트 → 커널 인덱스.
 *
 * @param {Array<{level: string, mod: object}>} sets 레벨별 문형 모듈
 * @param {{base?: string, validSlugs?: Set<string>}} [opts]
 *   base: 챕터 주소 앞머리('/chinese'). validSlugs: 정본 챕터 slug —
 *   주면 목록에 없는 `ch`는 **링크를 만들지 않는다**(환각·오타 차단).
 * @returns {Map<string, Array<object>>} 커널 → 패턴들(입력 순서 그대로 — 결정성)
 */
export function buildKernelIndex(sets, { base = '', validSlugs } = {}) {
  const index = new Map();
  let seq = 0;
  for (const { level, mod } of sets || []) {
    const data = mod?.default || mod;
    for (const theme of data?.themes || []) {
      for (const item of theme?.items || []) {
        if (!item?.pattern) continue;
        const ch = item.ch && (!validSlugs || validSlugs.has(item.ch)) ? item.ch : null;
        const entry = {
          id: `${level}-${seq += 1}`,
          level: data.level || level,
          theme: theme.name || '',
          pattern: item.pattern,
          conn: item.conn || '',
          ko: item.ko || '',
          ex: item.ex || null,
          ex2: item.ex2 || null,
          note: item.note || '',
          ch,
          href: ch ? `${base}/grammar/${ch}` : null,
        };
        for (const kernel of kernelsOf(item.pattern)) {
          if (!isUsableKernel(kernel)) continue;
          if (!index.has(kernel)) index.set(kernel, []);
          const bucket = index.get(kernel);
          // 같은 패턴이 같은 커널로 두 번 들어오지 않게(표기에 커널이 반복될 수 있다)
          if (!bucket.some((p) => p.id === entry.id)) bucket.push(entry);
        }
      }
    }
  }
  return index;
}

/** 표지로 볼 수 있는 토큰인가 — 한자가 없으면 문장부호·개행·로마자다. */
function isScannable(token) {
  return !!token?.text && /[一-鿿]/.test(token.text);
}

/**
 * 본문 토큰에서 표지 후보를 찾는다 — 겹치지 않는 **최장 일치**, O(토큰수 × MAX_SPAN).
 *
 * @param {Array<{id: string, text: string, pos?: string}>} tokens 본문 순서 그대로
 * @param {Map<string, Array<object>>} index buildKernelIndex 산출
 * @param {{maxSpan?: number}} [opts]
 * @returns {{hits: Array<object>, byToken: Map<string, object>}}
 *   hits: [{ kernel, tokenIds, patterns }] — 본문 순서. byToken: 토큰 id → 그 hit.
 */
export function scanTokens(tokens, index, { maxSpan = MAX_SPAN } = {}) {
  const hits = [];
  const byToken = new Map();
  if (!Array.isArray(tokens) || !index || typeof index.get !== 'function') return { hits, byToken };

  const span = Math.max(1, Math.min(maxSpan, MAX_SPAN));
  for (let i = 0; i < tokens.length; i += 1) {
    if (!isScannable(tokens[i])) continue;
    // 긴 표지부터 — 越来越를 越 하나로 끊어 버리면 정작 그 구문을 놓친다.
    for (let w = span; w >= 1; w -= 1) {
      if (i + w > tokens.length) continue;
      const slice = tokens.slice(i, i + w);
      if (!slice.every(isScannable)) continue;
      const kernel = slice.map((t) => t.text).join('');
      const patterns = index.get(kernel);
      if (!patterns || patterns.length === 0) continue;
      const hit = { kernel, tokenIds: slice.map((t) => t.id), patterns };
      hits.push(hit);
      for (const id of hit.tokenIds) byToken.set(id, hit);
      i += w - 1;                       // 겹치지 않게 표지 끝까지 건너뛴다
      break;
    }
  }
  return { hits, byToken };
}

/* ── 지연 로드 — 토글이 켜졌을 때만 (refVocabIndex 관례) ───────────────────────
   문형 정본은 중국어만 304KB다. 기본 꺼짐인 기능 때문에 모든 독자가 그 값을
   치를 이유가 없다. 언어는 승인 범위(중국어)만 — 일본어 852패턴은 활용형이라
   커널 추출 난도가 달라 R3으로 분리한다(설계 §4). */

let zhSetsPromise = null;

export function loadPatternIndex(language, { validSlugs } = {}) {
  if (language !== 'Chinese') return Promise.resolve(null);
  // 무거운 건 콘텐츠 import뿐이라 그것만 캐시한다. 인덱스 조립은 484패턴이라 공짜이고,
  // 인자를 캐시에 가두면 첫 호출의 validSlugs가 영원히 이기는 함정이 된다.
  zhSetsPromise ||= Promise.all([
    import('../content/chinese/bunkei/h1').then((m) => ({ level: 'H1', mod: m })),
    import('../content/chinese/bunkei/h2').then((m) => ({ level: 'H2', mod: m })),
    import('../content/chinese/bunkei/h3').then((m) => ({ level: 'H3', mod: m })),
    import('../content/chinese/bunkei/h4').then((m) => ({ level: 'H4', mod: m })),
    import('../content/chinese/bunkei/h5').then((m) => ({ level: 'H5', mod: m })),
    import('../content/chinese/bunkei/h6').then((m) => ({ level: 'H6', mod: m })),
  ]);
  return zhSetsPromise.then((sets) => buildKernelIndex(sets, { base: '/chinese', validSlugs }));
}
