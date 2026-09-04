'use client';

import { useRef, useState } from 'react';
import { langFromBcp47 } from '../lib/constants';
import Button from './Button';
import { parseEpub } from '../lib/epub';

const MAX_CHARS = 50000; // MaterialAddPage 본문 상한과 동일 — 초과 반입은 여기서 막는다

/**
 * EPUB 반입 — 개인 소장 전자책에서 챕터를 골라 본문 텍스트로 가져온다.
 * 파싱은 전부 클라이언트(무업로드·무의존)·원본 파일은 보관하지 않는다(텍스트만 반입).
 * 개인 소장물은 저작권 상태를 알 수 없으므로 호출측(MaterialAddPage)이 비공개로 고정한다.
 */
export default function MaterialAddEpubSection({ toast, onReady, onBookReady, open = true }) {
  const inputRef = useRef(null);
  const [book, setBook] = useState(null);        // { fileName, title, language, chapters }
  const [selected, setSelected] = useState(() => new Set());
  const [parsing, setParsing] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    if (typeof DecompressionStream === 'undefined') {
      toast('이 브라우저는 EPUB 해제를 지원하지 않아요. 최신 브라우저에서 시도해 주세요.', 'error');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseEpub(await file.arrayBuffer());
      setBook({ fileName: file.name, ...parsed });
      setSelected(new Set());
    } catch (err) {
      toast(`EPUB을 읽지 못했어요 — ${err?.message || '알 수 없는 형식'}`, 'error');
      setBook(null);
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function toggle(i) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  const picked = book ? [...selected].sort((a, b) => a - b).map((i) => book.chapters[i]) : [];
  const totalChars = picked.reduce((n, c) => n + c.chars, 0);
  const over = totalChars > MAX_CHARS;

  // 책 전체를 챕터별 자료로 묶어 반입(P1) — 챕터당 50k 캡은 호출측(bookSplit 재분할)이 지킨다
  function importWholeBook() {
    if (!book || book.chapters.length === 0) return;
    onBookReady?.({
      bookTitle: book.title || book.fileName.replace(/\.epub$/i, ''),
      language: langFromBcp47(book.language),
      chapters: book.chapters.map((ch) => ({ title: ch.title, text: ch.text })),
    });
    setBook(null);
    setSelected(new Set());
  }

  function importPicked() {
    if (!book || picked.length === 0 || over) return;
    const text = picked.map((c) => c.text).join('\n\n');
    const chapterLabel = picked.length === 1
      ? picked[0].title
      : `${picked[0].title} 외 ${picked.length - 1}`;
    onReady({
      title: `${book.title || book.fileName.replace(/\.epub$/i, '')} — ${chapterLabel}`,
      rawText: text,
      // 위 `importWholeBook`과 **같은 매퍼** — 예전엔 이쪽만 중국어가 빠져 있었다.
      language: langFromBcp47(book.language),
    });
    setBook(null);
    setSelected(new Set());
  }

  // 아코디언(자료 추가 정돈 R2) — 접혀 있으면 안 그린다. 고른 챕터 상태는 접었다 펴도 남는다.
  if (!open) return null;

  return (
    <div className="add-entry__body">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <p className="add-entry__desc" style={{ margin: 0, flex: '1 1 240px' }}>
          소장한 전자책의 챕터를 골라 본문만 가져와요. 파일은 이 기기에서만 읽고 저장하지 않으며, 반입한 자료는 비공개로 고정돼요.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".epub,application/epub+zip"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={parsing}>
          {parsing ? '읽는 중…' : 'EPUB 선택'}
        </Button>
      </div>

      {book && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
            {book.title || book.fileName}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.78rem' }}>
              챕터 {book.chapters.length}개{book.language ? ` · ${book.language}` : ''}
            </span>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {book.chapters.map((ch, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--radius-md)', background: selected.has(i) ? 'var(--primary-glow)' : 'var(--bg-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{ch.chars.toLocaleString()}자</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10 }}>
            <span style={{ fontSize: '0.78rem', color: over ? 'var(--danger)' : 'var(--text-muted)' }}>
              선택 {picked.length}개 · {totalChars.toLocaleString()}/{MAX_CHARS.toLocaleString()}자
              {over && ' — 한 번에 가져오기엔 길어요. 챕터를 나눠 반입해 주세요.'}
            </span>
            <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {onBookReady && (
                <Button size="sm" variant="secondary" onClick={importWholeBook}>
                  책 전체를 챕터별로
                </Button>
              )}
              <Button size="sm" onClick={importPicked} disabled={picked.length === 0 || over}>
                선택 챕터 가져오기
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
