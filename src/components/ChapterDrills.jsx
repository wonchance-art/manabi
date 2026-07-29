'use client';

import { useMemo, useState } from 'react';
import RefSpeak from './RefSpeak';
import { normalizeExerciseAnswer } from './ExerciseEnginePrototype';

/** 딕테 채점 — 구두점·아포스트로피 변형에는 관대, 철자·악상에는 엄격 */
function dictNormalize(s) {
  return normalizeExerciseAnswer(String(s ?? '').replace(/[’]/g, "'"))
    .replace(/[.,!?…«»"”“:;—–-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(input, answer, accepts, loose) {
  const norm = loose ? dictNormalize : normalizeExerciseAnswer;
  const target = norm(input);
  return [answer, ...(accepts ?? [])].some((a) => norm(a) === target);
}

function OrderDrill({ drill, onResult, done }) {
  const tokens = useMemo(() => {
    const parts = drill.sentence.split(/\s+/);
    // 결정적 셔플(문장 기반) — 렌더마다 흔들리지 않게
    const arr = parts.map((w, i) => [w, (i * 2654435761) % 1013]);
    arr.sort((a, b) => (a[1] - b[1]) || a[0].localeCompare(b[0]));
    return arr.map(([w]) => w);
  }, [drill.sentence]);
  const [picked, setPicked] = useState([]);
  const built = picked.join(' ');
  const complete = picked.length === tokens.length;
  const correct = complete && normalizeExerciseAnswer(built) === normalizeExerciseAnswer(drill.sentence);
  return (
    <div>
      {drill.prompt && <p style={{ fontSize: '0.88rem', marginBottom: 6 }}>{drill.prompt}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {tokens.map((w, i) => {
          const used = picked.includes(`${w}#${i}`);
          return (
            <button key={i} type="button" disabled={used || done}
              onClick={() => setPicked((p) => [...p, `${w}#${i}`])}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: used ? 'var(--bg-muted)' : 'var(--bg-secondary)', opacity: used ? 0.4 : 1 }}>
              {w}
            </button>
          );
        })}
      </div>
      <p style={{ minHeight: 22, fontStyle: 'italic', fontSize: '0.92rem' }}>{picked.map((t) => t.split('#')[0]).join(' ')}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn--sm" disabled={done} onClick={() => setPicked([])}>다시</button>
        <button type="button" className="btn btn--sm" disabled={!complete || done}
          onClick={() => onResult(normalizeExerciseAnswer(picked.map((t) => t.split('#')[0]).join(' ')) === normalizeExerciseAnswer(drill.sentence))}>
          확인
        </button>
      </div>
    </div>
  );
}

function InputDrill({ drill, lang, onResult, done, dictation }) {
  const [value, setValue] = useState('');
  return (
    <div>
      {dictation ? (
        <p style={{ fontSize: '0.88rem', marginBottom: 6 }}>
          {drill.prompt || '재생을 누르고, 들리는 문장을 그대로 입력해 보세요.'}{' '}
          <RefSpeak text={drill.sentence} lang={lang} />
        </p>
      ) : (
        <p style={{ fontSize: '0.95rem', marginBottom: 6 }}>{drill.prompt}{drill.hint && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> · 힌트: {drill.hint}</span>}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={value} disabled={done} onChange={(e) => setValue(e.target.value)}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
          placeholder={dictation ? '들리는 대로…' : '정답 입력'} lang={dictation ? undefined : 'fr'} />
        <button type="button" className="btn btn--sm" disabled={done || !value.trim()}
          onClick={() => onResult(matches(value, dictation ? drill.sentence : drill.answer, drill.accepts, dictation))}>
          확인
        </button>
      </div>
    </div>
  );
}

function ChoiceDrill({ drill, onResult, done }) {
  return (
    <div>
      <p style={{ fontSize: '0.95rem', marginBottom: 8 }}>{drill.prompt}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {drill.choices.map((c, i) => (
          <button key={i} type="button" disabled={done} onClick={() => onResult(c === drill.answer)}
            style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 변형 드릴(RFC learning-path v1) — 새 문장으로 연습 후 관문 퀴즈(RefPatternCheck)로 가는 전 단계.
 * 채점은 로컬 표시 전용(SRS 연결은 관문 퀴즈가 담당 — v2에서 통합).
 */
export default function ChapterDrills({ lang, drills, title, intro }) {
  const [results, setResults] = useState({});
  const answered = Object.keys(results).length;
  const right = Object.values(results).filter(Boolean).length;
  const record = (id) => (ok) => setResults((r) => (id in r ? r : { ...r, [id]: ok }));
  return (
    <section className="card fr-section">
      <h2 className="fr-section__heading">{title ?? '변형 드릴 — 새 문장으로 손 풀기'}</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
        {intro ?? '이 챕터의 뼈를 처음 보는 문장에 적용해 보세요. 다 풀면 아래 패턴 체크로 마무리해요.'}
      </p>
      <ol style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingLeft: 20, margin: 0 }}>
        {drills.map((d) => {
          const done = d.id in results;
          const ok = results[d.id];
          return (
            <li key={d.id}>
              {d.sourceLabel && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>복습 · {d.sourceLabel}</p>
              )}
              {d.type === 'choice' && <ChoiceDrill drill={d} done={done} onResult={record(d.id)} />}
              {d.type === 'fill' && <InputDrill drill={d} lang={lang} done={done} onResult={record(d.id)} />}
              {d.type === 'dictation' && <InputDrill drill={d} lang={lang} done={done} onResult={record(d.id)} dictation />}
              {d.type === 'order' && <OrderDrill drill={d} done={done} onResult={record(d.id)} />}
              {done && (
                <p style={{ fontSize: '0.82rem', marginTop: 6, color: ok ? 'var(--accent, #2d6a4f)' : 'var(--text-muted)' }}>
                  {ok ? '정답이에요!' : `아쉬워요 — 정답: ${d.type === 'fill' ? d.answer : d.sentence ?? d.answer}`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {answered === drills.length && (
        <p style={{ marginTop: 14, fontWeight: 600, fontSize: '0.9rem' }}>
          {drills.length}문항 중 {right}개 정답 — {right === drills.length ? '완벽해요!' : '틀린 문항은 위 문형 설명을 다시 보고 와요.'}
        </p>
      )}
    </section>
  );
}
