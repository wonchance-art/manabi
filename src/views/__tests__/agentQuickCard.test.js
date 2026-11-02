import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { agentPromptLevel, recentSavedWords } from '../../components/quick/AgentPromptCard.jsx';

/* 빠른 분석 에이전트 0단계(AGENT-LINK-001 · 오너 「빠른 분석에 복습한 말 최신 공동 디자인 적용」 2026-11-02 KST). */
const read = f => fs.readFileSync(f, 'utf8');
const card = read('src/components/quick/AgentPromptCard.jsx');
const quick = read('src/views/QuickPage.jsx');

describe('에이전트에게 부탁하기 카드', () => {
  it('단어 줄 = 오늘 복습한 말(산출 주입 엔진 재사용) · 공용 칩 · 헷갈린 말이 채운 칩', () => {
    expect(card).toContain('const today = useOutputWords(language, { enabled: open, cap: AGENT_PROMPT_WORDS });');
    expect(card).toContain('<WordChips words={words} keys={keys} keyLabel="헷갈린 말"');
    expect(card).toContain("const keys = useMemo(() => new Set(today.filter(w => w.wrong).map(w => w.word_text)), [today]);");
    expect(read('src/lib/outputWords.js')).toContain('({ v, wrong }) => ({ id: v.id, word_text: v.word_text, meaning: v.meaning ?? null, wrong })');
  });
  it('프롬프트 셋은 형식 계약 모듈(agentPrompt) 그대로 복사 · 막히면 직접 고르기', () => {
    expect(card).toContain("['story', '오늘 단어로 글'");
    expect(card).toContain("['partner', '이 단어로 대화 상대'");
    expect(card).toContain("['recap', '방금 대화 정리'");
    expect(card).toContain('const prompt = agentPrompt(kind, { words, level, language });');
    expect(card).toContain('await navigator.clipboard.writeText(prompt);');
    expect(card).toContain('복사하지 못했어요. 아래 글을 직접 골라 복사해 주세요.');
  });
  it('접기는 이 기기에만 기억 · 펼쳤을 때만 조회', () => {
    expect(card).toContain("const OPEN_KEY = 'quick_agent_card_open';");
    expect(card).toContain('enabled: !!user?.id && open,');
    expect(card).toContain('aria-expanded={open}');
  });
  it('오늘 복습이 없으면 그 언어의 최근 담은 말(복습 대상만)', () => {
    const p = (w, language, created, available = true) => ({ review: { available }, vocabulary: { word_text: w, language, created_at: created } });
    const projections = [p('古', 'Japanese', '2026-10-01'), p('新', 'Japanese', '2026-11-01'), p('中', 'Chinese', '2026-11-02'), p('既', 'Japanese', '2026-11-02', false)];
    expect(recentSavedWords(projections, 'Japanese')).toEqual(['新', '古']);
    expect(recentSavedWords(null, 'Japanese')).toEqual([]);
  });
});

describe('디자인 손질(오너 「권장대로 진행해」 2026-11-02 KST — 목업 「빠른 분석 디자인 손질」)', () => {
  const css = read('src/components/quick/agent-prompt.css');
  it('① 본업(입력 · 결과)이 먼저, 에이전트 카드는 그 아래', () => {
    expect(quick.indexOf('<AgentPromptCard language={language} />')).toBeGreaterThan(quick.indexOf('placeholder="분석할 텍스트를 붙여넣으세요"'));
    expect(quick.indexOf('<AgentPromptCard language={language} />')).toBeGreaterThan(quick.indexOf('{resultLines && ('));
  });
  it('② 단추 셋 → 한 목록 세 줄 · 오른쪽 단추 모양 「복사」(이름 있는 단추)', () => {
    expect(card).toContain('<ul className="agent-card__actions">');
    expect(card).toContain('aria-label={`${label} 프롬프트 복사`}');
    expect(css).toMatch(/\.agent-card__copy\{min-height:36px;/);
  });
  it('③ 범례는 머리 줄 안 · ④ 설명은 제목 바로 아래', () => {
    expect(sliceBetween(card, '<div className="agent-card__label">', '</div>')).toContain('<WordChipsLegend label="헷갈린 말"');
    expect(card.indexOf('agent-card__sub')).toBeLessThan(card.indexOf('agent-card__words'));
  });
  it('⑤ 화자 칸은 테두리 없는 옅은 바탕 · ⑥ 결과 머리 두 줄', () => {
    const who = sliceBetween(css, '.agent-line__who{', '}');
    expect(who).not.toContain('border:');
    expect(who).toContain('background:var(--bg-secondary)');
    expect(quick).toContain('<span className="agent-format__top">');
  });
});

describe('프롬프트 수준 — 작문 수준 → 목표 수준(같은 언어) → 없음', () => {
  const store = map => ({ getItem: k => map[k] ?? null });
  it('작문 화면에서 고른 수준이 먼저', () => {
    expect(agentPromptLevel('Japanese', { goal_lang: 'Japanese', goal_level: 'N2' }, store({ writing_level_Japanese: 'N4' }))).toBe('N4');
  });
  it('없으면 같은 언어의 목표 수준, 다른 언어 목표는 쓰지 않음', () => {
    expect(agentPromptLevel('Japanese', { goal_lang: 'Japanese', goal_level: 'N2' }, store({}))).toBe('N2');
    expect(agentPromptLevel('Chinese', { goal_lang: 'Japanese', goal_level: 'N2' }, store({}))).toBe('');
    expect(agentPromptLevel('Japanese', null, null)).toBe('');
    expect(agentPromptLevel('Japanese', null, { getItem: () => { throw new Error('blocked'); } })).toBe('');
  });
});

describe('붙인 결과 — 형식을 알아보면 본문만 해부', () => {
  it('형식이면 본문 · 화자 칸 · 목표 단어 밑줄 · 뜻 메모(보여만), 아니면 지금 그대로', () => {
    expect(quick).toContain('const source = agent.recognized ? agent.body : text;');
    expect(quick).toContain('<span className="agent-format__chip">에이전트 형식</span>');
    expect(quick).toContain("agentInfo?.targets.has(token.text) || agentInfo?.targets.has(token.base_form) ? ' is-target' : ''");
    expect(quick).toContain('{lineRes.speaker && <span className="agent-line__who" lang="und">{lineRes.speaker}</span>}');
    expect(quick).toContain('{agentInfo?.notes && <p className="agent-notes"><b>뜻 메모</b> {agentInfo.notes}</p>}');
  });
  it('자료로 저장 — 본문과 제목만 넘김(뜻 메모 저장 안 함) · 추가 화면이 제목을 채움', () => {
    expect(quick).toContain('? { text: agentInfo.body, language, title: agentInfo.title }');
    expect(read('src/views/MaterialAddPage.jsx')).toContain("if (typeof draft?.title === 'string' && draft.title.trim()) setTitle(draft.title.trim().slice(0, 120));");
  });
});
