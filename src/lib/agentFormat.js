/**
 * 에이전트 출력 형식 계약(AGENT-LINK-001 0단계 · 설계 docs/design/agent-link.md §3 · 오너 「0단계 진행해」 2026-11-02 KST).
 * 개인 에이전트(ChatGPT · dots · Claude …)가 돌려줄 글 · 대화의 모양 — manabi가 추가 처리 없이 해석 · 저장할 수 있게.
 * 프롬프트 묶음(agentPrompt)이 이 모양을 요구하고, 붙여넣기 들여오기(parseAgentText)가 이 모양을 먼저 알아본다.
 * 모양이 아니면 일반 글로 받는다(실패가 아니다 — 아무 텍스트나 붙여도 빠른 분석은 그대로 된다). 순수 모듈.
 *
 *   # 제목: 주말 약속 (N4)
 *   @level: N4
 *   @target: 約束, 予定, 映画
 *   ---
 *   A: 週末、何か予定ある？
 *   B: 映画を見る約束があるんだ。
 *   ---
 *   @notes: 約束 = 약속 · 予定 = 예정
 */

export const AGENT_FORMAT_VERSION = 1;
const SEP = /^\s*-{3,}\s*$/;
const HEAD = /^\s*#\s*제목\s*[:：]\s*(.+?)\s*$/;
const META = /^\s*@(level|target|notes)\s*[:：]\s*(.*?)\s*$/i;
// 화자 줄: 「이름: 문장」 — 이름은 짧은 한 덩어리(A · B · 나 · Tutor · 田中). URL(https:)이나 시각(10:30)은 화자가 아니다.
const SPEAKER = /^\s*([^\s:：/]{1,12})\s*[:：]\s+(.+)$/u;

const splitList = v => String(v || '').split(/[,，、·]/).map(s => s.trim()).filter(Boolean);

/**
 * 붙여넣은 텍스트 → { recognized, title, level, targets, kind, lines, body, notes }.
 * recognized = 형식 계약의 제목 줄과 본문 구분선이 있다. kind = 화자 줄이 본문의 절반 이상이면 'conversation', 아니면 'text'.
 * body = 분석에 넘길 본문(화자 이름을 뗀 문장들, 줄 단위) — 빠른 분석 · 자료 저장이 그대로 쓴다.
 */
export function parseAgentText(raw) {
  const text = String(raw ?? '').replace(/\r\n?/g, '\n');
  const all = text.split('\n');
  let title = '', level = '', targets = [], notes = '';
  const seps = all.map((l, i) => (SEP.test(l) ? i : -1)).filter(i => i >= 0);
  const head = seps.length ? all.slice(0, seps[0]) : [];
  for (const line of head) {
    const h = HEAD.exec(line);
    if (h) { title = h[1]; continue; }
    const m = META.exec(line);
    if (m) {
      const key = m[1].toLowerCase();
      if (key === 'level') level = m[2];
      else if (key === 'target') targets = splitList(m[2]);
      else notes = m[2];
    }
  }
  const recognized = !!title && seps.length >= 1;
  const bodyLines = recognized ? all.slice(seps[0] + 1, seps.length >= 2 ? seps[1] : all.length) : all;
  if (recognized && seps.length >= 2) {
    for (const line of all.slice(seps[1] + 1)) {
      const m = META.exec(line);
      if (m && m[1].toLowerCase() === 'notes') notes = m[2];
    }
  }
  const nonEmpty = bodyLines.map(l => l.trim()).filter(Boolean).filter(l => !META.test(l));
  const lines = nonEmpty.map(l => {
    const m = SPEAKER.exec(l);
    return m && !/^\d+$/.test(m[1]) ? { speaker: m[1], text: m[2].trim() } : { speaker: null, text: l };
  });
  const spoken = lines.filter(l => l.speaker).length;
  const kind = lines.length > 0 && spoken * 2 >= lines.length ? 'conversation' : 'text';
  return {
    version: AGENT_FORMAT_VERSION,
    recognized,
    title: title.slice(0, 120),
    level: level.slice(0, 20),
    targets: targets.slice(0, 30),
    kind,
    lines,
    body: lines.map(l => l.text).join('\n'),
    notes: notes.slice(0, 500),
  };
}

/** 형식 계약을 설명하는 프롬프트 꼬리 — 세 프롬프트가 같은 꼬리를 쓴다(모양이 하나여야 들여오기가 하나다). */
export function agentFormatSpec() {
  return [
    '결과는 아래 형식 그대로, 다른 설명 없이 주세요.',
    '# 제목: (짧은 제목)',
    '@level: (수준)',
    '@target: (쓴 목표 단어, 쉼표로)',
    '---',
    '(본문 — 대화면 한 줄에 「이름: 문장」)',
    '---',
    '@notes: (어려운 말 뜻, 선택)',
  ].join('\n');
}

const LANG_KO = { Japanese: '일본어', Chinese: '중국어', English: '영어', French: '프랑스어' };

/**
 * 프롬프트 묶음(설계 §5) — manabi가 단어 · 수준을 채워 복사한다(사용자는 에이전트에 붙여넣기만).
 * kind: 'story'(오늘 단어로 글) · 'partner'(이 단어로 대화 상대) · 'recap'(방금 대화 정리).
 * 말투 규약(망각 예보와 같음): 죄책감 · 「밀림」 · 「실패」 같은 말을 쓰지 않는다 — 프롬프트 문장에도 넣지 않는다.
 */
export function agentPrompt(kind, { words = [], level = '', language = 'Japanese' } = {}) {
  const lang = LANG_KO[language] || language;
  const list = words.slice(0, 12).join(', ');
  const lv = level ? `${level} 수준 ` : '';
  const body = {
    story: `아래 단어를 모두 자연스럽게 써서 ${lv}${lang} 짧은 글(5~8문장)을 써 주세요.\n단어: ${list}`,
    partner: `${lang}로 대화 상대가 되어 주세요. 아래 단어를 대화 속에서 자연스럽게 쓰고, 제가 쓸 기회도 주세요. ${lv ? `${lv}에 맞춰 주세요. ` : ''}대화가 끝나면 제가 「정리해 줘」라고 할게요.\n단어: ${list}`,
    recap: `방금 우리 대화를 정리해 주세요. 대화 줄은 그대로 두고, 제가 틀린 문장이 있으면 @notes에 고친 문장을 적어 주세요.`,
  }[kind];
  if (!body) throw new Error(`unknown agent prompt: ${kind}`);
  return `${body}\n\n${agentFormatSpec()}`;
}
