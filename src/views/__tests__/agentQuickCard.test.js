import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { recentSavedWords } from '../../components/quick/AgentPromptCard.jsx';

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
