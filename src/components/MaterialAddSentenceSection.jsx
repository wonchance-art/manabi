'use client';

import { useEffect, useState } from 'react';
import Button from './Button';
import { LEVELS } from '../lib/constants';
import {
  splitLinesIntoChapters, clampLinesPerChapter, sentenceListStats,
  DEFAULT_LINES_PER_CHAPTER, LINES_PER_REQUEST_CAP,
} from '../lib/bookSplit';

// 언어별 기본 난이도 — 본문 폼과 같은 짝(중복 신설이 아니라 같은 표를 여기서도 쓴다).
const LANGS = [
  ['Japanese', '일본어', 'N3 중급'],
  ['English', '영어', 'B1 중급'],
  ['Chinese', '중국어', 'H3 중급'],
];

/**
 * 문장 목록 반입(오너 지시 2026-08-25) — PDF·EPUB와 같은 층의 세 번째 입구.
 *
 * 어휘 교재의 예문집처럼 **한 줄에 한 문장**씩 나열된 자료는 본문 폼의 글자 수 분할로는
 * 다룰 수 없다(bookSplit.js §문장 목록 반입: 한 덩어리로 뭉쳐 100줄 캡에 잘린다).
 * 그래서 본문 폼에 붙여넣은 뒤 반응하는 배너가 아니라, **처음부터 과 단위를 정하는
 * 독립 입구**로 둔다 — 제목·언어·난이도·과당 문장 수를 한 화면에서 정하고 바로 나눈다.
 *
 * 개인 소장 교재라 저작권 상태를 알 수 없으므로 호출측이 비공개로 고정한다(EPUB과 동일).
 */
export default function MaterialAddSentenceSection({ toast, onReady, seedText, onSeedConsumed }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('Chinese');
  const [level, setLevel] = useState('H3 중급');
  const [perChapter, setPerChapter] = useState(String(DEFAULT_LINES_PER_CHAPTER));
  const [text, setText] = useState('');

  // 본문 폼에서 넘겨준 문장 목록 — 다시 붙여넣게 하지 않는다(1회성).
  useEffect(() => {
    if (!seedText) return;
    setText(seedText);
    setOpen(true);
    onSeedConsumed?.();
  }, [seedText]);

  const stats = sentenceListStats(text);
  const per = clampLinesPerChapter(perChapter);
  const chapterCount = stats.lines > 0 ? Math.ceil(stats.lines / per) : 0;
  const perClamped = String(per) !== String(perChapter).trim();

  function handleSplit() {
    const chapters = splitLinesIntoChapters(text, { linesPerChapter: per });
    if (chapters.length === 0) { toast('문장을 붙여넣어 주세요.', 'info'); return; }
    onReady({ bookTitle: title.trim() || '제목 없는 교재', language, level, chapters });
    setText('');
    setTitle('');
    setOpen(false);
  }

  return (
    <div className="card add-form" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>문장 목록으로 만들기</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
            교재 예문집처럼 한 줄에 한 문장씩 나열된 자료를 과 단위로 나눠 담아요.
            반입한 자료는 비공개로 고정돼요.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '문장 붙여넣기'}
        </Button>
      </div>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-field" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sentence-book-title">교재 이름</label>
            <input
              id="sentence-book-title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: HSK5 문장 320"
            />
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label className="form-label">학습 언어</label>
            <div className="toggle-group">
              {LANGS.map(([key, label, defaultLevel]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={language === key}
                  onClick={() => { setLanguage(key); setLevel(defaultLevel); }}
                  className={`toggle-btn ${language === key ? 'toggle-btn--primary' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label className="form-label">권장 학습 난이도</label>
            <div className="level-group">
              {LEVELS[language].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`level-btn ${level === lvl ? 'level-btn--active' : ''}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="sentence-per-chapter">한 과에 넣을 문장 수</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                id="sentence-per-chapter"
                type="number"
                min={1}
                max={LINES_PER_REQUEST_CAP}
                value={perChapter}
                onChange={(e) => setPerChapter(e.target.value)}
                style={{
                  width: 72, padding: '6px 8px', fontSize: '0.9rem', textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  border: '1px solid var(--border, var(--text-muted))', borderRadius: 'var(--radius-sm, 6px)',
                }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                문장씩
                {chapterCount > 0 && <> → <strong style={{ color: 'var(--text-primary)' }}>{chapterCount}과</strong></>}
              </span>
              {perClamped && (
                <span style={{ fontSize: '0.76rem', color: 'var(--warning)' }}>
                  {per}으로 맞췄어요 — 한 과가 {LINES_PER_REQUEST_CAP}문장을 넘으면 분석이 잘려요
                </span>
              )}
            </div>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }} htmlFor="sentence-text">문장 (한 줄에 하나)</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    const t = await navigator.clipboard.readText();
                    if (t?.trim()) { setText(t); toast('클립보드에서 붙여넣었어요', 'success'); }
                    else toast('클립보드가 비어있어요', 'info');
                  } catch {
                    toast('브라우저에서 클립보드 접근을 허용해 주세요', 'warning');
                  }
                }}
              >
                클립보드 붙여넣기
              </Button>
            </div>
            <textarea
              id="sentence-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'엑셀에서 원문 열을 복사해 그대로 붙여넣으세요.\n我们应该保护环境。\n他的汉语水平提高得很快。'}
              className="form-textarea"
              style={{ minHeight: 160 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {stats.lines > 0
                ? `${stats.lines.toLocaleString()}문장 · 평균 ${Math.round(stats.avgLen)}자 · ${chapterCount}과`
                : '문장을 붙여넣으면 과 수를 계산해요'}
            </span>
            <Button size="sm" onClick={handleSplit} disabled={stats.lines === 0}>
              {chapterCount > 0 ? `${chapterCount}과로 나누기` : '과로 나누기'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
