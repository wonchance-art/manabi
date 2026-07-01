'use client';
import { useState, useRef, useEffect } from 'react';
import { kanaList, acceptedRomaji, SET_LABELS, ALL_SETS } from '../lib/gojuon';
import { toRomaji } from '../lib/kanaRomaji';
import Button from './Button';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function KanaTest({ kind, slug, storageKey }) {
  const [sets, setSets] = useState(['basic']);
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null); // null | 'ok' | 'no'
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [streak, setStreak] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  const toggleSet = s => setSets(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const begin = list => {
    if (!list.length) return;
    setDeck(shuffle(list));
    setIdx(0); setInput(''); setResult(null); setRight(0); setWrong([]); setStreak(0);
    setDone(false); setStarted(true);
  };
  const start = () => begin(kanaList(kind, ALL_SETS.filter(s => sets.includes(s))));
  const retryWrong = () => begin(wrong);

  const current = deck[idx];

  useEffect(() => { if (started && !done) inputRef.current?.focus(); }, [idx, started, done]);

  const finish = finalRight => {
    setDone(true);
    const total = deck.length;
    const passed = total > 0 && finalRight / total >= 0.8;
    if (slug && storageKey && typeof window !== 'undefined') {
      try {
        const cur = JSON.parse(localStorage.getItem(storageKey) || '{}');
        cur[slug] = { right: finalRight, total, passed, at: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(cur));
      } catch { /* ignore */ }
    }
  };

  const advance = nextRight => {
    if (idx + 1 >= deck.length) finish(nextRight);
    else { setIdx(i => i + 1); setInput(''); setResult(null); }
  };

  const submit = () => {
    if (!current || result) return;
    const ans = input.trim().toLowerCase().replace(/\s+/g, '');
    if (!ans) return;
    const ok = acceptedRomaji(current).has(ans);
    if (ok) { setResult('ok'); setRight(r => r + 1); setStreak(s => s + 1); }
    else { setResult('no'); setStreak(0); setWrong(w => w.includes(current) ? w : [...w, current]); }
  };

  // 정답이면 자동으로 다음 (오답은 정답 확인 후 직접 넘김)
  useEffect(() => {
    if (result !== 'ok' || done) return;
    const t = setTimeout(() => advance(right), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const onKeyDown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (result === 'no') advance(right);
    else if (!result) submit();
  };

  // ── 시작 전: 범위 선택 ──
  if (!started) {
    const count = kanaList(kind, ALL_SETS.filter(s => sets.includes(s))).length;
    return (
      <div className="card kana-test">
        <h2 className="kana-test__title">카나 → 로마자 테스트</h2>
        <p className="kana-test__lead">글자를 보고 <strong>발음(로마자)</strong>을 입력하세요. 발음을 알아야 풀 수 있어요.</p>
        <div className="chip-group" style={{ justifyContent: 'center', margin: '14px 0' }}>
          {ALL_SETS.map(s => (
            <button key={s} type="button" className={`chip ${sets.includes(s) ? 'chip--active' : ''}`} onClick={() => toggleSet(s)}>
              {SET_LABELS[s]}
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Button onClick={start} disabled={count === 0}>{count}자 테스트 시작 →</Button>
        </div>
      </div>
    );
  }

  // ── 완료 ──
  if (done) {
    const total = deck.length;
    const pct = total ? Math.round((right / total) * 100) : 0;
    const passed = pct >= 80;
    return (
      <div className="card kana-test kana-test--done">
        <h2 className="kana-test__title">{passed ? '합격! 🎉' : '조금 더 연습해요'}</h2>
        <div className="kana-test__score">
          <span className={`kana-test__pct ${passed ? 'is-ok' : 'is-no'}`}>{pct}%</span>
          <span className="kana-test__frac">{right} / {total}</span>
        </div>

        {wrong.length > 0 && (
          <div className="kana-test__wrong">
            <p className="kana-test__wrong-title">틀린 글자 {wrong.length}개 — 다시 익혀요</p>
            <div className="kana-test__wrong-list">
              {wrong.map(k => (
                <span key={k} className="kana-test__wrong-item">
                  <b lang="ja">{k}</b> {toRomaji(k)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="kana-test__done-actions">
          {wrong.length > 0 && <Button onClick={retryWrong}>틀린 것만 다시 ({wrong.length}) →</Button>}
          <Button variant="secondary" onClick={start}>전체 다시</Button>
          <Button variant="ghost" onClick={() => setStarted(false)}>범위 고르기</Button>
        </div>
      </div>
    );
  }

  // ── 진행 중 ──
  return (
    <div className="card kana-test">
      <div className="kana-test__bar">
        <span>{idx + 1} / {deck.length}</span>
        <span>{streak >= 2 ? `🔥 연속 ${streak}` : `맞은 개수 ${right}`}</span>
      </div>

      <div className="kana-test__prompt" lang="ja">{current}</div>

      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="로마자 입력 (예: ka)"
        className={`search-input kana-test__input${result === 'ok' ? ' is-correct' : result === 'no' ? ' is-wrong' : ''}`}
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck="false"
        disabled={result === 'ok'}
      />

      {result === 'ok' && <p className="kana-test__feedback is-ok">정답!</p>}
      {result === 'no' && (
        <p className="kana-test__feedback is-no">
          정답: <strong>{toRomaji(current)}</strong>
        </p>
      )}

      <div style={{ textAlign: 'center', marginTop: 14, minHeight: 38 }}>
        {result === 'no'
          ? <Button onClick={() => advance(right)}>{idx + 1 >= deck.length ? '결과 보기 →' : '다음 →'}</Button>
          : result === 'ok'
            ? null
            : <Button onClick={submit} disabled={!input.trim()}>확인</Button>}
      </div>
    </div>
  );
}
