'use client';

import Link from 'next/link';
import Button from './Button';
import { mergeWithPrevious } from '../lib/bookSplit';

/**
 * 책 묶음 초안 패널 — 챕터 목록 확인·경계 병합·제목 수정 후 일괄 등록(분석은 온디맨드).
 *
 * MaterialAddPage에서 **두 자리**에 그린다: EPUB 반입은 EPUB 섹션 바로 아래,
 * 붙여넣기 분할은 텍스트 칸 바로 아래. 정의는 하나이고 위치만 출처를 따른다 —
 * 누른 자리에서 결과가 나와야 하기 때문이다(패널이 한 자리에 고정돼 있으면
 * 텍스트 칸에서 [챕터로 나누기]를 눌렀을 때 결과가 화면 밖 위쪽에 생긴다).
 */
export default function BookDraftPanel({
  draft, setDraft, onRegister, registering, doneCount, onCancel, onDone, chapterRanges = [], readHref = null,
}) {
  if (!draft) return null;
  const isSentences = draft.origin === 'sentences';
  // 이어 적기(#1077 5520128974) — 순번은 책의 다음 순번부터, 제목은 책 것 그대로(잠금)
  const append = draft.append || null;
  const startOrder = append?.startOrder || 1;
  const countLines = (t) => String(t || '').split('\n').filter((l) => l.trim()).length;

  return (
    <div className="card add-form" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 700 }}>
            {append ? `책에 이어 등록 — 지금 ${append.existingCount}과까지` : '책으로 등록'}
          </div>
          <input
            className="form-input"
            style={{ marginTop: 4 }}
            readOnly={!!append}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="책 제목"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>✕ 취소</Button>
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {draft.chapters.map((ch, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, width: 24, textAlign: 'right' }}>{startOrder + i}</span>
            <input
              value={ch.title}
              onChange={(e) => setDraft((d) => {
                const chapters = d.chapters.slice();
                chapters[i] = { ...chapters[i], title: e.target.value };
                return { ...d, chapters };
              })}
              style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {isSentences ? chapterRanges[i] : `${ch.text.length.toLocaleString()}자`}
            </span>
            {i > 0 && (
              <button
                type="button"
                title="앞 챕터와 합치기"
                onClick={() => setDraft((d) => ({ ...d, chapters: mergeWithPrevious(d.chapters, i) }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}
              >⤴ 합치기</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          챕터 {draft.chapters.length}개 ·{' '}
          {isSentences
            ? `총 ${draft.chapters.reduce((n, c) => n + countLines(c.text), 0).toLocaleString()}문장`
            : `총 ${draft.chapters.reduce((n, c) => n + c.text.length, 0).toLocaleString()}자`}
          {' '}· 각 챕터는 열 때 분석돼요
          {draft.privateOnly && (<><br />🔒 개인 소장 자료 — 비공개로 등록됩니다</>)}
        </span>
        {doneCount > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* 오늘 적은 과를 바로 연다 — 열면서 분석된다(등록 시 분석 안 함 원칙 그대로) */}
            {readHref && <Link href={readHref} className="btn btn--primary btn--sm">바로 읽기</Link>}
            <Button size="sm" variant={readHref ? 'secondary' : undefined} onClick={onDone}>자료실에서 책 보기</Button>
          </div>
        ) : (
          <Button size="sm" onClick={onRegister} disabled={registering || !draft.title.trim()}>
            {registering ? '등록 중…' : append ? `이어 등록 (${draft.chapters.length}과)` : `책으로 등록 (${draft.chapters.length}챕터)`}
          </Button>
        )}
      </div>
    </div>
  );
}
