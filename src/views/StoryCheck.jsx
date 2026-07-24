'use client';

// 스토리 모듈 — '이야기로 확인'(챕터 안 독해 파일럿)의 인터랙티브 렌더러.
// ReferenceChapterPage(서버 컴포넌트)는 story(순수 직렬화 데이터)만 props 로 넘기고,
// 채점 상호작용은 이 클라이언트 경계에서 처리한다 — 서버 페이지가 콘텐츠 레지스트리 전체를
// 클라이언트 번들로 끌어오지 않도록(문법 페이지 First Load JS 회귀 방지) 별도 파일로 둔다.
// 채점 규약은 독해 뷰어·월드 오버레이와 같은 단일 원천(ReadingTextView 헬퍼)을 재사용한다.

import { useMemo, useState } from 'react';
import { JaText, refMain, refPron } from './refShared';
import RefSpeak from '../components/RefSpeak';
import { normalizeQuestion, shuffleOrderTiles, gradeOrder, checkFill, splitFill } from './ReadingTextView';

// 화자 색 — 등장 순서대로 두 색을 배정(결정적). 세 번째 화자부터는 순환.
const SPEAKER_COLORS = ['var(--brand, #6c7cff)', 'var(--accent2, #e0729a)', 'var(--accent, #3bb0a0)'];
function buildSpeakerColors(body) {
  const map = {};
  let n = 0;
  for (const b of body || []) {
    if (!refMain(b) || !b.speaker || map[b.speaker]) continue;
    map[b.speaker] = SPEAKER_COLORS[n % SPEAKER_COLORS.length];
    n += 1;
  }
  return map;
}

/** story와 구조화 example dialogue가 공유하는 화자·원어·발음·번역 라인 렌더러 */
export function StoryLines({
  body,
  lang,
  langCode,
  furigana = true,
  translationAlwaysVisible = false,
  compact = false,
}) {
  const [revealed, setRevealed] = useState({});
  const speakerColors = useMemo(() => buildSpeakerColors(body), [body]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: compact ? 0 : 22 }}>
      {(body || []).map((b, i) => {
        const main = refMain(b);
        if (!main) {
          // 내레이션 — 대사와 확실히 구분: 이탤릭·여백, 괘선·카드 없이 은은하게.
          return (
            <p key={i} style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '0.92rem', lineHeight: 1.85, color: 'var(--text-muted)', margin: '10px 2px', letterSpacing: '0.01em' }}>
              {b.narr}
            </p>
          );
        }

        // 같은 화자가 직전 대사와 이어지면 라벨 생략(대본 관행).
        const prev = (body || []).slice(0, i).reverse().find(x => refMain(x));
        const showSpeaker = !!b.speaker && b.speaker !== (prev && prev.speaker);
        const color = (b.speaker && speakerColors[b.speaker]) || 'var(--text-secondary)';
        const open = translationAlwaysVisible || !!revealed[i];
        const pron = refPron(b);

        return (
          <div key={i} style={{ margin: '3px 0' }}>
            {showSpeaker && (
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color, letterSpacing: '0.02em', marginBottom: 1 }}>
                {b.speaker}
              </div>
            )}
            <div style={{ borderLeft: `2px solid ${color}`, paddingLeft: 10 }}>
              <div
                role={translationAlwaysVisible ? undefined : 'button'}
                tabIndex={translationAlwaysVisible ? undefined : 0}
                aria-expanded={translationAlwaysVisible ? undefined : open}
                onClick={translationAlwaysVisible ? undefined : () => setRevealed(p => ({ ...p, [i]: !p[i] }))}
                onKeyDown={translationAlwaysVisible ? undefined : e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setRevealed(p => ({ ...p, [i]: !p[i] })))}
                style={{ cursor: translationAlwaysVisible ? undefined : 'pointer', fontSize: '1.06rem', lineHeight: furigana ? 1.95 : 1.7 }}
              >
                {langCode === 'ja' && furigana && !translationAlwaysVisible
                  ? <JaText ja={main} yomi={pron} fallbackPron={false} />
                  : (
                    <>
                      <span lang={langCode}>{main}</span>
                      {pron && (
                        <span
                          className="fr-example__ipa"
                          style={translationAlwaysVisible ? { display: 'block', marginLeft: 0, marginTop: 1 } : undefined}
                        >
                          {pron}
                        </span>
                      )}
                    </>
                  )}
                <RefSpeak text={main} lang={lang} size="xs" />
              </div>
              {open
                ? <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>{b.ko}</div>
                : <button type="button" onClick={() => setRevealed(p => ({ ...p, [i]: !p[i] }))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 1 }}>뜻 보기 ▾</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * body: 내레이션(narr)은 은은한 이야기 문단(이탤릭), 대사(ja)는 화자 라벨(speaker)이 붙는
 *   드라마 대본 톤 — 같은 화자가 이어지면 라벨을 생략한다. 후리가나 토글 + ko 탭 병기.
 * questions: order(타일 조립)·fill(타이핑)·produce(모범답 토글) — 전부 장면 속 상황 지시형.
 * 챕터 퀴즈와 달리 로컬 확인용이라 채점 이벤트·SRS·통과 게이트를 발행하지 않는다.
 */
export default function StoryCheck({ story, slug, lang, langCode, meta }) {
  const [furigana, setFurigana] = useState(true);
  const questions = useMemo(
    () => (story.questions || []).map((q, i) => normalizeQuestion(q, `${slug}-sq${i}`)),
    [story, slug]
  );

  return (
    <div className="fr-story">
      {/* ── 도입 안내 + 후리가나 토글(우상단 최소) ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          이야기를 읽고 장면 속에서 직접 만들어 봐요. 채점은 로컬, 기록은 남기지 않아요.
        </div>
        <button
          type="button" className="chip" aria-pressed={furigana}
          onClick={() => setFurigana(v => !v)}
          title="후리가나 표시 전환"
          style={{ flex: '0 0 auto', fontSize: '0.66rem', padding: '2px 8px', opacity: furigana ? 1 : 0.5 }}
        >
          {furigana ? '가나 ON' : '가나 OFF'}
        </button>
      </div>

      {/* ── 이야기 본문(장면) ── */}
      <StoryLines body={story.body} lang={lang} langCode={langCode} furigana={furigana} />

      {/* ── 확인 문항(조립·타이핑·산출) — 장면 다음에 조용히 이어짐 ── */}
      <ol className="fr-quiz" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {questions.map(q => <StoryQuestion key={q.key} q={q} langCode={langCode} />)}
      </ol>
    </div>
  );
}

/** 스토리 문항 1개 — 로컬 채점(order/fill)·모범답 토글(produce). 게이트·이벤트 없음. */
function StoryQuestion({ q, langCode }) {
  const [picks, setPicks] = useState([]);        // order 조립 타일 인덱스(탭 순서)
  const [input, setInput] = useState('');        // fill 입력
  const [result, setResult] = useState(null);    // { ok, tries }
  const [produceInput, setProduceInput] = useState('');
  const [shown, setShown] = useState(false);     // produce 모범답 공개
  const tiles = useMemo(
    () => (q.qtype === 'order' ? shuffleOrderTiles(q.tiles, q.answerTiles, q.id || q.key) : []),
    [q]
  );

  const label =
    q.qtype === 'order' ? '문장 만들기'
    : q.qtype === 'fill' ? '빈칸 채우기'
    : q.qtype === 'produce' ? '문장 만들기 (모범답 확인)'
    : q.qtype === 'error' ? '콘텐츠 오류' : '문항';

  function tapTile(idx, inAssembled) {
    if (result?.ok) return;
    setPicks(cur => (inAssembled ? cur.filter(x => x !== idx) : [...cur, idx]));
  }
  function confirmOrder() {
    if (result?.ok || picks.length !== tiles.length) return;
    const ok = gradeOrder(picks.map(i => tiles[i]), q.answerTiles);
    setResult({ ok, tries: (result?.tries || 0) + 1 });
  }
  function submitFill() {
    if (result?.ok) return;
    const ok = checkFill(input, q.fillAnswer, q.accept);
    setResult({ ok, tries: (result?.tries || 0) + 1 });
  }

  return (
    <li className="fr-quiz__item">
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>

      {q.qtype === 'order' ? (() => {
        const assembled = picks.map(i => tiles[i]);
        const remaining = tiles.map((t, i) => i).filter(i => !picks.includes(i));
        const full = picks.length === tiles.length;
        return (
          <>
            <div className="fr-quiz__prompt" style={{ marginBottom: 8 }}>{q.prompt}</div>
            {/* 조립 행 — 줄바꿈 없이 한 줄 고정 + 가로 스크롤(좁은 화면에서도 옆으로 밀어 봄). */}
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, minHeight: 44, alignItems: 'center', padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm, 8px)', marginBottom: 8, background: 'var(--surface-2, rgba(127,127,127,0.06))', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
              {assembled.length === 0
                ? <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>아래 타일을 순서대로 탭하세요</span>
                : picks.map((idx, pos) => (
                    <button key={`${idx}-${pos}`} type="button" lang="ja" disabled={result?.ok} className="chip" onClick={() => tapTile(idx, true)} style={{ fontSize: '1rem', flex: '0 0 auto', whiteSpace: 'nowrap', padding: '6px 12px' }}>
                      {tiles[idx]}
                    </button>
                  ))}
            </div>
            {!result?.ok && (
              <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, marginBottom: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', padding: '2px 0' }}>
                {remaining.map(idx => (
                  <button key={idx} type="button" lang="ja" className="chip" onClick={() => tapTile(idx, false)} style={{ fontSize: '1rem', flex: '0 0 auto', whiteSpace: 'nowrap', padding: '6px 12px' }}>
                    {tiles[idx]}
                  </button>
                ))}
              </div>
            )}
            {!result?.ok && (
              <button type="button" className="btn btn--primary btn--sm" disabled={!full} onClick={confirmOrder}>확정</button>
            )}
          </>
        );
      })() : q.qtype === 'fill' ? (() => {
        const { before, after } = splitFill(q.ja);
        return (
          <>
            <div className="fr-quiz__prompt" style={{ marginBottom: 8 }}>{q.prompt}</div>
            <div lang="ja" style={{ fontSize: '1.05rem', lineHeight: 2, marginBottom: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
              <span>{before}</span>
              {result?.ok
                ? <span style={{ fontWeight: 700, color: 'var(--accent, #6c7cff)', margin: '0 2px' }}>{q.fillAnswer}</span>
                : <input type="text" lang="ja" value={input} inputMode="text"
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitFill(); } }}
                    aria-label="빈칸에 들어갈 말"
                    style={{ width: '6em', textAlign: 'center', fontSize: '1rem', padding: '2px 6px', margin: '0 2px', border: '1px solid var(--border)', borderRadius: 6 }} />}
              <span>{after}</span>
            </div>
            {!result?.ok && <button type="button" className="btn btn--primary btn--sm" onClick={submitFill}>제출</button>}
          </>
        );
      })() : q.qtype === 'produce' ? (
        <>
          <div className="fr-quiz__prompt" style={{ marginBottom: 6 }}>{q.prompt}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            직접 써 보거나 건너뛸 수 있어요. 채점하지 않아요.
          </div>
          {!shown ? (
            <>
              <textarea lang="ja" value={produceInput} rows={2}
                onChange={e => setProduceInput(e.target.value)}
                placeholder="여기에 일본어로 써 보세요(선택)"
                style={{ width: '100%', fontSize: '1rem', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setShown(true)}>모범답 보기</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {produceInput.trim() && (
                <div style={{ fontSize: '0.9rem' }} lang="ja">
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>내가 쓴 문장</span>
                  {produceInput}
                </div>
              )}
              {(q.model || []).length > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>모범답</span>
                  {q.model.map((m, mi) => <div key={mi} lang="ja" style={{ fontSize: '1rem', marginBottom: 2 }}>· {m}</div>)}
                </div>
              )}
              {q.guide && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{q.guide}</div>}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: '0.86rem', color: 'var(--danger)', lineHeight: 1.6 }}>
          ⚠ 이 문항은 콘텐츠 형식 오류로 표시할 수 없어요.
        </div>
      )}

      {result && !result.ok && (q.qtype === 'order' || q.qtype === 'fill') && (
        <div className="fr-quiz__answer" style={{ color: 'var(--danger)' }}>
          × 다시 — {q.why || '이야기를 다시 읽고 재도전하세요.'} (시도 {result.tries}회)
        </div>
      )}
      {result?.ok && (
        <div className="fr-quiz__answer">
          ○ {q.why || '정답입니다.'}{result.tries > 1 ? ` (${result.tries}회 시도)` : ''}
          {q.qtype === 'order' && q.ko && (
            <div style={{ marginTop: 4 }}>
              <span lang="ja" style={{ fontWeight: 700 }}>{(q.answerTiles || []).join('')}</span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{q.ko}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
