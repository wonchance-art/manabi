'use client';

import { useState } from 'react';
import Link from 'next/link';
import RefSpeak from '../components/RefSpeak';
import { JaText } from './refShared';
import { stripInlineReadings } from '../lib/studyParagraph';

/** 날짜 포맷 — YYYY.M.D (ko) */
function fmtDate(at) {
  if (!at) return '';
  try { return new Date(at).toLocaleDateString('ko-KR'); } catch { return ''; }
}

/** 성장 요약 타일 하나 */
function StatTile({ value, label, sub }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 0, padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

/**
 * 지난 문단 카드 하나 — 접혀 있으면 첫 문장 미리보기, 펼치면 어시스트 없는 재독 뷰.
 * 재독은 pron(요미가나) 없이 원문만 — 예전엔 어려웠던 문장이 술술 읽히는지 확인.
 */
function ParagraphCard({ entry, langCode, lang }) {
  const [open, setOpen] = useState(false);
  const [showKo, setShowKo] = useState(false);
  const sentences = entry.paragraph.sentences || [];
  const firstText = stripInlineReadings(sentences[0]?.text || '');
  // 요미가나 없이 원문만 (JaText에 yomi 미전달 → 루비 없음). 저장된 오염 문단은 인라인 독음 정화 후 렌더.
  const renderMain = text =>
    langCode === 'ja' ? <JaText ja={stripInlineReadings(text)} /> : <>{text}</>;

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmtDate(entry.at)}</span>
          {entry.episode >= 2 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{entry.episode}화</span>
          )}
          {entry.theme && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>{entry.theme}</span>
          )}
          {entry.level && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{entry.level}</span>
          )}
          <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {open ? '접기 ▴' : '펼치기 ▾'}
          </span>
        </div>
        {!open && (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} lang={langCode}>
            {firstText}
          </div>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sentences.map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: '1.05rem', lineHeight: 1.9 }} lang={langCode}>
                  {renderMain(s.text)}
                  <RefSpeak text={s.text} lang={lang} size="xs" />
                </div>
                {showKo && s.ko && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 2 }}>{s.ko}</div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowKo(v => !v)}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 12, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            {showKo ? '번역 접기 ▴' : '번역 보기 ▾'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 다시 읽기 서재 — 성장 요약 3타일 + 지난 문단 재독 목록.
 * 재독은 어시스트(요미가나) 없이 원문만 보여 성장을 체감하게 한다.
 */
export default function StudyLibraryPage({
  paragraphs = [], summary = {}, lang, langCode, langName, flag, languages = [], signedOut = false,
}) {
  if (signedOut) {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>다시 읽기 서재</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          로그인하면 그동안 읽은 이야기를 다시 읽고, 성장을 확인할 수 있어요.
        </p>
        <Link href="/auth" className="btn btn--primary btn--md">로그인 →</Link>
      </div>
    );
  }

  const { knownCount = 0, passedChapters = 0, weekSessions = 0 } = summary;

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 16px' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, flex: 1 }}>{flag} 다시 읽기 서재</h1>
        <Link href={`/study?lang=${lang}`} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
          오늘 학습 →
        </Link>
      </div>

      {/* 성장 요약 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <StatTile value={knownCount} label="아는 단어" sub="일주일 넘게 기억한 단어" />
        <StatTile value={passedChapters} label="통과 챕터" />
        <StatTile value={weekSessions} label="이번 주 세션" />
      </div>

      {/* 문단 목록 */}
      {paragraphs.length === 0 ? (
        <div className="card" style={{ padding: '22px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            아직 다시 읽을 이야기가 없어요. <Link href={`/study?lang=${lang}`} style={{ textDecoration: 'underline' }}>오늘 학습</Link>에서 첫 문단을 읽어보세요.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paragraphs.map(entry => (
            <ParagraphCard key={entry.id} entry={entry} langCode={langCode} lang={lang} />
          ))}
        </div>
      )}

      {/* 언어 전환 */}
      {languages.length > 1 && (
        <div className="chip-group" style={{ marginTop: 22, justifyContent: 'center' }}>
          {languages.map(l => (
            l.key === lang
              ? <span key={l.key} className="chip chip--active">{l.flag} {l.name}</span>
              : <a key={l.key} href={`/study/library?lang=${l.key}`} className="chip">{l.flag} {l.name}</a>
          ))}
        </div>
      )}
    </div>
  );
}
