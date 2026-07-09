'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

/** 로컬 날짜 YYYY-MM-DD — StudySessionPage.ymdLocal과 동일 포맷(산출 시드 키 값 일치) */
function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 관심사 4택 — key는 studyMaterials.INTEREST_GROUPS와 반드시 일치(쿠키 study_interest 값).
 * 라벨은 클라 표시용(서버 매핑을 client 번들로 끌어오지 않기 위해 여기 최소 중복).
 */
const INTEREST_OPTIONS = [
  { key: 'daily',  emoji: '🏠', label: '일상·관계', hint: '하루, 가족, 마음' },
  { key: 'travel', emoji: '🧭', label: '여행·모험', hint: '떠남, 날씨, 계절' },
  { key: 'food',   emoji: '🍜', label: '음식·취미', hint: '먹기, 쇼핑, 취미' },
  { key: 'work',   emoji: '📚', label: '일·학교',   hint: '공부, 계획' },
];

/**
 * 공부 모드 콜드스타트 온보딩 — 1화면·설명 최소·실패해도 세션은 나온다.
 * 서버는 coldStart만 판단하고, 표시 여부는 클라의 localStorage 가드(study_onboarded_<lang>)로 결정한다.
 * 온보딩을 건너뛰거나 마치면 children(조립된 StudySessionPage)을 그대로 렌더한다.
 *
 * 흐름: ① 지식 3택(처음/기초/배운적) → [문자 안내] → ② 관심사 4택 → 시작하기.
 *  - '처음' + 문자 트랙(가나·병음) 보유 언어면 ②로 가기 전 문자 안내 단계를 한 번 끼운다(명시적 선택).
 *  - 백필 없음(처음): 가드만 기록하고 리로드 없이 세션 표시.
 *  - 백필 있음(기초/배운적): 건너뛴 레벨 챕터를 user_ref_progress에 upsert 후 reload(재료 재조립).
 *
 * @param {{lang:string, langName:string,
 *   levels:{key:string,label:string,isIntro:boolean,chapterSlugs:string[]}[],
 *   readKey?:string,
 *   scriptTrack?:{slug:string,href:string,kind:'kana'|'pinyin'}|null,
 *   children:React.ReactNode}} props
 */
export default function StudyOnboarding({ lang, langName, levels = [], readKey = null, scriptTrack = null, children }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState('loading'); // 'loading'|'q1'|'chars'|'q2'|'session'
  const [knowledge, setKnowledge] = useState(null); // 'fresh'|'basics'|'learned'
  const [startKey, setStartKey] = useState(null);
  const [interest, setInterest] = useState(null);
  const [busy, setBusy] = useState(false);

  // 마운트 시 가드 확인 — 이미 온보딩했으면 세션 바로 렌더(서버는 coldStart만 판단).
  useEffect(() => {
    let onboarded = false;
    try { onboarded = !!localStorage.getItem(`study_onboarded_${lang}`); } catch {}
    setPhase(onboarded ? 'session' : 'q1');
  }, [lang]);

  const regular = levels.filter(l => !l.isIntro);

  // 시작 레벨보다 앞선 레벨(인트로 포함)의 전체 챕터 slug — 건너뛰기 백필 대상.
  function levelsBefore(key) {
    const idx = levels.findIndex(l => l.key === key);
    if (idx <= 0) return [];
    return levels.slice(0, idx).flatMap(l => l.chapterSlugs);
  }

  // 이 기기에서 이미 문자 트랙(가나/병음) 챕터를 통과했는지 — 통과했으면 문자 안내를 건너뛴다.
  // KanaTest·RefPatternCheck과 같은 localStorage 맵(`${readKey}_check`)을 읽는다(교차기기는 coldStart가 담당).
  function scriptLocallyPassed() {
    if (!scriptTrack?.slug || !readKey || typeof window === 'undefined') return false;
    try {
      const map = JSON.parse(localStorage.getItem(`${readKey}_check`) || '{}');
      return !!map[scriptTrack.slug]?.passed;
    } catch { return false; }
  }

  function chooseFresh() {
    setKnowledge('fresh');
    setStartKey(regular[0]?.key || null);
    // 문자 트랙이 있고 아직 통과 기록이 없으면 문자 안내 단계로(명시적 선택). 없으면(EN/FR·기통과) 바로 관심사로.
    setPhase(scriptTrack && !scriptLocallyPassed() ? 'chars' : 'q2');
  }
  function chooseBasics() { setKnowledge('basics'); setStartKey((regular[1] || regular[0])?.key || null); setPhase('q2'); }
  function chooseLevel(key) { setKnowledge('learned'); setStartKey(key); setPhase('q2'); }

  const scriptNoun = scriptTrack?.kind === 'pinyin' ? '병음' : '가나';

  async function handleStart() {
    if (!interest || busy) return;
    setBusy(true);

    // 관심사 — 쿠키(1년) + localStorage 백업. 실패는 무해.
    try {
      document.cookie = `study_interest=${interest}; path=/; max-age=${60 * 60 * 24 * 365}`;
      localStorage.setItem(`study_interest_${lang}`, interest);
    } catch {}
    // 산출 시드 — 첫 세션에 작문(격일 산출) 문항이 바로 나오지 않게 오늘 날짜를 심는다.
    try { localStorage.setItem(`study_last_produce_${lang}`, ymdLocal(new Date())); } catch {}

    const skipSlugs = knowledge === 'fresh' ? [] : levelsBefore(startKey);

    if (skipSlugs.length && user?.id) {
      // 건너뛴 레벨 챕터 백필 — read/passed만 true, check_right/check_total은 NULL(온보딩 스킵 표식).
      const rows = skipSlugs.map(slug => ({ user_id: user.id, lang, slug, read: true, passed: true }));
      let ok = false;
      try {
        const { error } = await supabase
          .from('user_ref_progress')
          .upsert(rows, { onConflict: 'user_id,lang,slug' });
        ok = !error;
      } catch {}
      if (ok) {
        // 성공 시에만 가드 기록(실패 시 다음 방문에 재시도) → 재료 재조립 위해 리로드.
        try { localStorage.setItem(`study_onboarded_${lang}`, '1'); } catch {}
        window.location.reload();
        return;
      }
      // 백필 실패 — 가드 미기록, 조용히 세션으로 진행(리로드 없음).
      setPhase('session');
      return;
    }

    // 백필 없음(처음) — 가드 기록 후 리로드 없이 바로 세션.
    try { localStorage.setItem(`study_onboarded_${lang}`, '1'); } catch {}
    setPhase('session');
  }

  if (phase === 'session') return children;
  if (phase === 'loading') return null;

  const cardStyle = (active) => ({
    display: 'block', width: '100%', textAlign: 'left',
    padding: '16px 18px', borderRadius: 'var(--radius-lg)',
    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--bg-secondary)' : 'var(--bg-primary)',
    cursor: 'pointer',
  });

  return (
    <div className="page-container" style={{ maxWidth: 560, paddingTop: 40 }}>
      {/* ── ① 지식 ── */}
      {phase === 'q1' && (
        <>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 6 }}>
            {langName}, 얼마나 알고 있나요?
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 22 }}>
            딱 맞는 지점에서 시작하도록 두 가지만 물어볼게요.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" style={cardStyle(false)} onClick={chooseFresh}>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>처음이에요</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>완전 처음부터 차근차근</span>
            </button>

            <button type="button" style={cardStyle(false)} onClick={chooseBasics}>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>기초는 알아요</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>인사·기본 문형은 익숙해요</span>
            </button>

            <button
              type="button"
              style={cardStyle(knowledge === 'learned')}
              onClick={() => setKnowledge('learned')}
            >
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>배운 적 있어요</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>시작할 레벨을 골라볼게요</span>
            </button>

            {knowledge === 'learned' && (
              <div className="chip-group" style={{ marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                {regular.map(l => (
                  <button
                    key={l.key}
                    type="button"
                    className={`chip ${startKey === l.key ? 'chip--active' : ''}`}
                    onClick={() => chooseLevel(l.key)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 문자 안내 (완전 처음 + 가나/병음 트랙) ── */}
      {phase === 'chars' && scriptTrack && (
        <>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 6 }}>
            {langName}는 {scriptNoun}부터예요
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 22 }}>
            {scriptNoun}를 먼저 익히면 이후 학습이 훨씬 수월해요. 오늘 문단에는 발음이 함께 달리지만,
            {' '}{scriptNoun}를 읽을 수 있으면 훨씬 빨리 늘어요.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href={scriptTrack.href} style={{ ...cardStyle(false), textDecoration: 'none', color: 'inherit' }}>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>{scriptNoun} 배우러 가기 →</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>표를 보고 따라 쓰고, 발음으로 바로 확인해요</span>
            </Link>

            <button type="button" style={cardStyle(false)} onClick={() => setPhase('q2')}>
              <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>이미 읽을 수 있어요 — 바로 시작</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{scriptNoun}는 익숙해요. 세션을 시작할게요</span>
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 12 }}>
            <button type="button" className="study-textlink" onClick={() => setPhase('q1')}>
              ← 이전 질문
            </button>
          </p>
        </>
      )}

      {/* ── ② 관심사 ── */}
      {phase === 'q2' && (
        <>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 6 }}>
            어떤 이야기가 좋아요?
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 22 }}>
            고른 취향으로 오늘의 문단을 자주 골라줄게요.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {INTEREST_OPTIONS.map(o => (
              <button
                key={o.key}
                type="button"
                style={{ ...cardStyle(interest === o.key), textAlign: 'center' }}
                onClick={() => setInterest(o.key)}
              >
                <span style={{ display: 'block', fontSize: '1.5rem', marginBottom: 4 }} aria-hidden="true">{o.emoji}</span>
                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, marginBottom: 2 }}>{o.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.hint}</span>
              </button>
            ))}
          </div>

          <Button onClick={handleStart} disabled={!interest || busy} style={{ width: '100%', marginTop: 22 }}>
            {busy ? '준비 중…' : '시작하기 →'}
          </Button>
          <p style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              type="button"
              className="study-textlink"
              onClick={() => setPhase('q1')}
              disabled={busy}
            >
              ← 이전 질문
            </button>
          </p>
        </>
      )}
    </div>
  );
}
