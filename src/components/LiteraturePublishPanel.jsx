'use client';

// 관리자 정본 문학책 게시(AOZORA-P0-2) — 권리 근거를 보고 「게시」 → 장마다 열어 1회 분석 → 루비 적용률 확인.
// 게시 내용은 서버가 리포 빌드 산출물에서만 만든다(/api/admin/literature). 이 화면은 원문을 받지도 보내지도 않는다.
//
// 기대 화면(작품 한 줄):
//   鼻 · 芥川龍之介   N2 상급   퍼블릭 도메인 · 초출 1916 · 작가 1927 사망 · JP·KR·US 검토(claude, 2026-10-14) · 도서 카드
//   미게시 · 2장                                                                            [게시]
//   ── 게시 뒤 ──
//   게시 2/2 · 분석 1/2   1편 ✅  2편 분석 전 ↗                                              [루비 적용률]
//   루비 적용 1편 140/145 · 2편 분석 전
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import Spinner from './Spinner';
import { friendlyToastMessage } from '../lib/errorMessage';

const API = '/api/admin/literature';
const QUERY_KEY = ['admin-literature'];
const CONFLICT_LABEL = { 'text-differs': '정본과 원문이 다름', 'duplicate-order': '같은 장이 둘', 'unknown-order': '정본에 없는 장' };

async function request(url, init) {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || '요청을 처리하지 못했어요.'), { status: response.status });
  return body;
}

function publishLabel(book) {
  const published = book.chapters.filter((chapter) => chapter.material).length;
  const analyzed = book.chapters.filter((chapter) => chapter.material?.status === 'completed').length;
  if (book.plan.state === 'conflict') return `확인 필요 · 게시 ${published}/${book.total}`;
  if (published === 0) return `미게시 · ${book.total}장`;
  return `게시 ${published}/${book.total} · 분석 ${analyzed}/${book.total}`;
}

function RubyCoverage({ bookKey, chapters }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...QUERY_KEY, 'ruby', bookKey],
    queryFn: () => request(`${API}?ruby=${encodeURIComponent(bookKey)}`),
  });
  if (isLoading) return <span className="admin-table__muted">루비 적용률 세는 중…</span>;
  if (isError) return <button type="button" className="admin-table__muted" onClick={() => refetch()}>루비 적용률을 불러오지 못했어요 · 다시 시도</button>;
  const titleOf = new Map(chapters.map((chapter) => [chapter.order, chapter.title]));
  return (
    <span className="admin-table__muted">
      루비 적용 {data.coverage.map((item) => `${titleOf.get(item.order)} ${item.applied == null ? '분석 전' : `${item.applied}/${item.rubyLocks}`}`).join(' · ')}
    </span>
  );
}

export default function LiteraturePublishPanel({ toast }) {
  const queryClient = useQueryClient();
  const [confirmBook, setConfirmBook] = useState(null);
  const [rubyOpen, setRubyOpen] = useState(() => new Set());
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: () => request(API) });

  const publish = useMutation({
    mutationFn: (key) => request(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish', key }) }),
    onSuccess: (result) => {
      toast(result.inserted.length ? `${result.inserted.length}장을 공개 자료로 게시했어요. 장마다 열어 분석해 주세요.` : '이미 모든 장이 게시돼 있어요.', 'success');
    },
    onError: (error) => toast(friendlyToastMessage(error, '책을 게시하지 못했어요. 잠시 후 다시 시도해 주세요.'), 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  if (isLoading) return <Spinner message="정본 책 불러오는 중…" />;
  if (isError) {
    return (
      <div className="card" role="alert" style={{ padding: '20px' }}>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)' }}>정본 책 목록을 불러오지 못했어요.</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>다시 시도</Button>
      </div>
    );
  }

  const books = data?.books || [];
  return (
    <div className="admin-table-wrap">
      <p className="admin-table__muted" style={{ margin: '0 0 12px' }}>
        青空文庫 퍼블릭 도메인 원작(리포 <code>src/content/literature/aozora</code>). 게시하면 장마다 공개 자료가 생기고, 장을 열어
        「이 챕터 분석하기」로 한 번 분석하면 저자 루비가 독음에 걸려요. 권리 근거를 확인한 뒤 게시하세요.
      </p>
      <div className="admin-table-header"><span>총 {books.length}편</span></div>
      <table className="admin-table">
        <thead>
          <tr><th>작품</th><th>레벨</th><th>권리 근거</th><th>게시·분석</th><th>작업</th></tr>
        </thead>
        <tbody>
          {books.map((book) => {
            const { rights } = book;
            const published = book.chapters.some((chapter) => chapter.material);
            return (
              <tr key={book.key}>
                <td className="admin-table__title">{book.title} · {book.author}</td>
                <td>{book.level}</td>
                <td className="admin-table__muted">
                  {rights.basis === 'public-domain' ? '퍼블릭 도메인' : rights.basis} · 초출 {rights.publishedYear} · 작가 {rights.authorDeathYear} 사망 · {rights.charset}
                  {' · '}{rights.reviewedJurisdictions.join('·')} 검토({rights.reviewedBy}, {rights.reviewedAt})
                  {' · '}<a href={rights.evidenceUrl} target="_blank" rel="noopener noreferrer">도서 카드</a>
                </td>
                <td>
                  <div>{publishLabel(book)}</div>
                  {published && (
                    <div className="admin-table__muted">
                      {book.chapters.map((chapter) => (
                        <span key={chapter.order} style={{ marginRight: '8px' }}>
                          {chapter.material
                            ? <Link href={`/viewer/${chapter.material.id}`}>{chapter.title} {chapter.material.status === 'completed' ? '✅' : '분석 전 ↗'}</Link>
                            : `${chapter.title} 미게시`}
                        </span>
                      ))}
                    </div>
                  )}
                  {book.plan.conflicts.map((conflict) => (
                    <div key={`${conflict.id}-${conflict.reason}`} role="alert" style={{ color: 'var(--warning-text)' }}>
                      ⚠ {conflict.order ?? '?'}장 · {CONFLICT_LABEL[conflict.reason] || conflict.reason} (자료 #{conflict.id})
                    </div>
                  ))}
                  {rubyOpen.has(book.key) && <div><RubyCoverage bookKey={book.key} chapters={book.chapters} /></div>}
                </td>
                <td>
                  {book.plan.insert.length > 0 && book.plan.state !== 'conflict' && (
                    <Button size="sm" disabled={!book.publishable || publish.isPending} onClick={() => setConfirmBook(book)}>
                      {published ? '남은 장 게시' : '게시'}
                    </Button>
                  )}
                  {published && (
                    <Button size="sm" variant="ghost" onClick={() => setRubyOpen((prev) => new Set(prev).add(book.key))}>루비 적용률</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmModal
        open={!!confirmBook}
        title={confirmBook ? `「${confirmBook.title}」 책을 공개 자료로 게시할까요?` : ''}
        message={confirmBook ? `${confirmBook.plan.insert.length}장이 모든 사용자에게 공개돼요. 근거: 작가 ${confirmBook.rights.authorDeathYear} 사망 · ${confirmBook.rights.reviewedJurisdictions.join('·')} 검토. 게시 뒤 장마다 열어 분석해 주세요.` : ''}
        confirmLabel="게시"
        confirmDisabled={publish.isPending}
        onConfirm={() => { const key = confirmBook.key; setConfirmBook(null); publish.mutate(key); }}
        onCancel={() => setConfirmBook(null)}
      />
    </div>
  );
}
