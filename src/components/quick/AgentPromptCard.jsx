'use client';

/**
 * 에이전트에게 부탁하기(AGENT-LINK-001 0단계 · 오너 「빠른 분석에 복습한 말 최신 공동 디자인 적용」 2026-11-02 KST).
 * 빠른 분석 위에 놓이는 접는 카드 — 새 서버 · 새 연결 없이 프롬프트를 복사해 내 에이전트(ChatGPT · dots · Claude …)에 붙인다.
 *  - 단어 줄 = 오늘 복습한 말(산출 주입 엔진 pickOutputWords 재사용 · 헷갈린 말이 채운 칩으로 앞). 오늘 복습이 없으면 최근 담은 말.
 *    칩은 다시 만난 말 · 직접 쓴 말 · 완독 창과 같은 WordChips — 누르면 단어 카드.
 *  - 단추 셋 = agentPrompt('story' | 'partner' | 'recap') 복사. 복사가 막힌 환경이면 프롬프트를 펼쳐 직접 고르게 한다.
 *  - 접은 상태는 이 기기에만 기억(처음엔 펼침).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/AuthContext';
import { useOutputWords } from '../../lib/useOutputWords';
import { fetchSharedVocabularySummary } from '../../lib/vocabularyLearningShare';
import { agentPrompt } from '../../lib/agentFormat';
import WordChips, { WordChipsLegend } from '../WordChips';
import './agent-prompt.css';

const VocabDetailCard = dynamic(() => import('../../views/VocabDetailCard'), { loading: () => null });

const OPEN_KEY = 'quick_agent_card_open';
export const AGENT_PROMPT_WORDS = 8;
const ACTIONS = Object.freeze([
  ['story', '오늘 단어로 글', '짧은 글을 형식대로 받아요'],
  ['partner', '이 단어로 대화 상대', '대화하며 내가 써 볼 기회'],
  ['recap', '방금 대화 정리', '에이전트와 나눈 대화를 형식대로'],
]);

/** 오늘 복습한 말이 없을 때 — 그 언어의 최근 담은 말(복습 대상인 말만). */
export function recentSavedWords(projections, language, cap = AGENT_PROMPT_WORDS) {
  return (projections || [])
    .filter(p => p?.review?.available === true && p.vocabulary?.word_text && p.vocabulary.language === language)
    .sort((a, b) => (Date.parse(b.vocabulary.created_at) || 0) - (Date.parse(a.vocabulary.created_at) || 0))
    .slice(0, cap)
    .map(p => p.vocabulary.word_text);
}

export default function AgentPromptCard({ language }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(OPEN_KEY) === '0') setOpen(false); } catch { /* 기억 못 하면 펼침 */ }
  }, []);
  const toggle = () => setOpen(prev => {
    try { localStorage.setItem(OPEN_KEY, prev ? '0' : '1'); } catch { /* 기억은 덤 */ }
    return !prev;
  });

  const today = useOutputWords(language, { enabled: open, cap: AGENT_PROMPT_WORDS });
  // 단어 카드 · 「최근 담은 말」 대체에 쓰는 공유 snapshot(배움 · 현황 · 자료실과 같은 키) — 펼쳤을 때만.
  const { data: learning } = useQuery({
    queryKey: ['quick-agent-vocab', user?.id],
    queryFn: () => fetchSharedVocabularySummary(queryClient, user.id),
    enabled: !!user?.id && open,
    staleTime: 1000 * 60 * 5,
  });
  const projectionByWord = useMemo(() => new Map((learning?.projections || []).filter(p => p?.vocabulary?.word_text).map(p => [p.vocabulary.word_text, p])), [learning]);
  const fromToday = today.length > 0;
  const words = useMemo(() => (fromToday ? today.map(w => w.word_text) : recentSavedWords(learning?.projections, language)), [fromToday, today, learning, language]);
  const keys = useMemo(() => new Set(today.filter(w => w.wrong).map(w => w.word_text)), [today]);
  const level = useMemo(() => { try { return localStorage.getItem(`writing_level_${language}`) || ''; } catch { return ''; } }, [language]);

  const [copied, setCopied] = useState(null);
  const [manual, setManual] = useState(null); // 복사가 막혔을 때 직접 고르는 프롬프트
  const manualRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (manual) manualRef.current?.select(); }, [manual]);
  const copy = async kind => {
    const prompt = agentPrompt(kind, { words, level, language });
    try {
      await navigator.clipboard.writeText(prompt);
      setManual(null);
      setCopied(kind);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setManual(prompt);
    }
  };
  const [detail, setDetail] = useState(null);

  return (
    <section className="card agent-card" aria-labelledby="agent-card-title">
      <div className="agent-card__head">
        <h2 id="agent-card-title" className="agent-card__title">에이전트에게 부탁하기</h2>
        <button type="button" className="agent-card__toggle" onClick={toggle} aria-expanded={open} aria-controls="agent-card-body">
          {open ? '접기' : '펼치기'}
        </button>
      </div>
      {open && (
        <div id="agent-card-body" className="agent-card__body">
          <div className="agent-card__words">
            <span className="agent-card__label">{fromToday ? '오늘 복습한 말' : '최근 담은 말'}</span>
            {words.length > 0
              ? <WordChips words={words} keys={keys} keyLabel="헷갈린 말" onWord={w => { const p = projectionByWord.get(w); if (p) setDetail(p); }} />
              : <span className="agent-card__empty">담은 말이 생기면 여기에 떠요</span>}
          </div>
          <WordChipsLegend label="헷갈린 말" show={keys.size > 0} />
          <div className="agent-card__actions">
            {ACTIONS.map(([kind, label, sub]) => (
              <button key={kind} type="button" className="agent-card__action" onClick={() => copy(kind)}
                disabled={kind !== 'recap' && words.length === 0}>
                <b>{label}</b><span>{sub}</span>
                <em aria-live="polite">{copied === kind ? '복사됨 ✓' : '복사'}</em>
              </button>
            ))}
          </div>
          {manual && (
            <div className="agent-card__manual">
              <label htmlFor="agent-card-manual">복사하지 못했어요. 아래 글을 직접 골라 복사해 주세요.</label>
              <textarea id="agent-card-manual" ref={manualRef} readOnly value={manual} rows={6} className="form-input" />
            </div>
          )}
          <p className="agent-card__hint">에이전트가 돌려준 결과를 아래에 붙여 넣으면 형식을 알아보고 해부해요.</p>
        </div>
      )}
      {detail && <VocabDetailCard word={detail.vocabulary} projection={detail} now={new Date()} onClose={() => setDetail(null)} ttsSupported={false} />}
    </section>
  );
}
