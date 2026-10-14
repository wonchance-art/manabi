'use client';

// 관리자 정본 문학책 게시(AOZORA-P0-2 · P0-3 · P0-4 「분석 → 검수·편집 → 공개」).
// 「게시」 한 번 → 장들을 비공개로 준비하고 이 화면이 장마다 한 번씩 분석 → 장을 열어 「뜻 확인 필요」(문맥 뜻 제안)를 확정하고
// 단어 경계를 맞춘 뒤 장마다 「검수 완료」 → 「공개」.
// 분석 결과는 장마다 하나라 모든 사용자가 같이 쓰고, 단어 상태만 사람마다 따로 얹힌다 — 사용자는 「분석 전」 장을 보지 않는다.
// 게시 내용은 서버가 리포 빌드 산출물에서만 만든다(/api/admin/literature). 이 화면은 원문을 보내지 않는다.
// 「그림 한 장 읽기」 큐레이션 책(ART-P0-3)도 이 화면을 그대로 쓴다 — api="/api/admin/art-books" kind="art"면 안내 문구와
// 근거 칸만 바뀐다(권리 근거·도서 카드·루비 → 출처·라이선스·원문 링크). 게시 흐름·분석 경로는 같다.
//
// 기대 화면(작품 한 줄):
//   鼻 · 芥川龍之介   N2 상급   퍼블릭 도메인 · 초출 1916 · 작가 1927 사망 · JP·KR·US 검토(claude, 2026-10-14) · 도서 카드
//   미게시 · 2장                                                                         [게시]
//   ── 누른 뒤 ──
//   준비 중 · 분석 1/2 · 이 화면을 닫지 마세요                                            [멈춤]
//   ── 분석이 끝나면 ──
//   검수 0/2 · 장을 열어 「뜻 확인 필요」를 확인해 주세요
//     · 1편 ↗ · 루비 140/145 · 제안 12개 · 확인 3개 남음
//     · 2편 ↗ · 루비 136/138 · 제안 9개 · 확인 끝                 [검수 완료]
//   ── 검수가 끝나면 ──
//   검수 2/2 · 산책에 아직 안 보여요                                                      [공개]
//   ── 공개 뒤 ──
//   공개됨 · 산책 › 함께 읽는 글 · 루비 적용 …
//
// 기대 화면(kind="art", 출처 칸):
//   北斎と広重の風景版画 · 葛飾北斎・歌川広重   N2 상급   ColBase · 정부표준이용규약 2.0 · 8장
//                                                        출처: ColBase(국립문화재기구) · 도쿄 국립박물관 소장 · …
//                                                        원문 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8
//   검수 줄은 루비 없이: · 冨嶽三十六景 神奈川沖浪裏 ↗ · 확인 끝   [검수 완료]
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import Spinner from './Spinner';
import { supabase } from '../lib/supabase';
import { analyzeText } from '../lib/analyzeText';
import { runPreservedReanalysis } from '../lib/reanalysisPreservation';
import { failureMessage, friendlyToastMessage } from '../lib/errorMessage';

const LITERATURE_API = '/api/admin/literature';
const CONFLICT_LABEL = { 'text-differs': '정본과 원문이 다름', 'duplicate-order': '같은 장이 둘', 'unknown-order': '정본에 없는 장' };

async function request(url, init) {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || '요청을 처리하지 못했어요.'), { status: response.status });
  return body;
}
const postTo = (api, action, key) => request(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, key }) });

// 출처별 화면 차이 — 안내·근거 칸·검수 안내·단위. 게시 흐름은 같다.
const KIND = {
  literature: { evidence: '권리 근거', unit: '편', ruby: true, reviewHint: '장을 열어 「뜻 확인 필요」를 확인해 주세요' },
  art: { evidence: '출처·라이선스', unit: '권', ruby: false, reviewHint: '장을 열어 해설과 단어 경계를 확인해 주세요' },
};
const ART_SOURCE_LABEL = { colbase: 'ColBase', aic: '시카고 미술관' };

/** 큐레이션 책 출처 묶음 — 같은 출처·라이선스끼리 장 수를 센다. provenance.chapters: [{order, source, license, sourceUrl, credit}] */
function artSourceGroups(provenance) {
  const groups = new Map();
  for (const item of provenance?.chapters || []) {
    const label = `${ART_SOURCE_LABEL[item.source] || item.source} · ${item.license || '라이선스 확인 필요'}`;
    groups.set(label, (groups.get(label) || 0) + 1);
  }
  return [...groups].map(([label, count]) => `${label} · ${count}장`);
}

// 근거 칸 — 문학책: 권리 근거·도서 카드 / 큐레이션 책: 출처·라이선스·크레딧·장별 원문 링크.
function EvidenceCell({ book, kind }) {
  if (kind === 'art') {
    const chapters = book.provenance?.chapters || [];
    return (
      <td className="admin-table__muted">
        {artSourceGroups(book.provenance).join(' / ')}
        {[...new Set(chapters.map((item) => item.credit).filter(Boolean))].map((credit) => <div key={credit}>{credit}</div>)}
        <div>
          원문
          {chapters.map((item) => (
            <span key={item.order}>
              {' '}<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${item.order}장 원문`}>{item.order}</a>
            </span>
          ))}
        </div>
      </td>
    );
  }
  const { rights } = book;
  return (
    <td className="admin-table__muted">
      {rights.basis === 'public-domain' ? '퍼블릭 도메인' : rights.basis} · 초출 {rights.publishedYear} · 작가 {rights.authorDeathYear} 사망 · {rights.charset}
      {' · '}{rights.reviewedJurisdictions.join('·')} 검토({rights.reviewedBy}, {rights.reviewedAt})
      {' · '}<a href={rights.evidenceUrl} target="_blank" rel="noopener noreferrer">도서 카드</a>
    </td>
  );
}

/** 「게시」 확인창의 근거 한 줄. */
const prepareBasis = (book, kind) => (kind === 'art'
  ? `근거: ${artSourceGroups(book.provenance).join(' / ')} · 카탈로그 원문 대조`
  : `근거: 작가 ${book.rights.authorDeathYear} 사망 · ${book.rights.reviewedJurisdictions.join('·')} 검토`);

const analyzedCount = (book) => book.chapters.filter((chapter) => chapter.material?.status === 'completed').length;

function stageLabel(book, running, kind) {
  if (running) return `준비 중 · 분석 ${running.done}/${running.total} · 이 화면을 닫지 마세요`;
  switch (book.stage) {
    case 'unpublished': return `미게시 · ${book.total}장`;
    case 'preparing': return `준비 중 · 분석 ${analyzedCount(book)}/${book.total} · 멈췄어요`;
    case 'reviewing': return `검수 ${book.chapters.filter((chapter) => chapter.material?.reviewed).length}/${book.total} · ${KIND[kind].reviewHint}`;
    case 'ready': return `검수 ${book.total}/${book.total} · 산책에 아직 안 보여요`;
    case 'released': return '공개됨 · 산책 › 함께 읽는 글';
    default: return '확인 필요';
  }
}

// 장별 검수 줄 — 저자 루비 적용(문학책만) · 검수 제안 수 · 남은 「뜻 확인 필요」 · [검수 완료](남은 확인 0일 때만).
function ChapterReview({ api, queryKey, kind, book, onReview, reviewing }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKey, 'ruby', book.key],
    queryFn: () => request(`${api}?ruby=${encodeURIComponent(book.key)}`),
  });
  if (isLoading) return <p className="admin-table__muted" role="status">검수 상태를 세는 중…</p>;
  if (isError) return <button type="button" className="admin-table__muted" onClick={() => refetch()}>검수 상태를 불러오지 못했어요 · 다시 시도</button>;
  const byOrder = new Map(data.coverage.map((item) => [item.order, item]));
  return (
    <ul className="admin-table__muted" style={{ margin: '4px 0 0', paddingInlineStart: '16px' }}>
      {book.chapters.map((chapter) => {
        const item = byOrder.get(chapter.order) || {};
        const material = chapter.material;
        return (
          <li key={chapter.order}>
            {material ? <Link href={`/viewer/${material.id}`}>{chapter.title} ↗</Link> : chapter.title}
            {KIND[kind].ruby && item.applied != null && ` · 루비 ${item.applied}/${item.rubyLocks}`}
            {item.hints > 0 && ` · 제안 ${item.hints}개`}
            {item.hintsMissed?.length > 0 && ` · 안 붙은 제안 ${item.hintsMissed.length}개(${item.hintsMissed.join('·')} — 장에서 직접 확인)`}
            {item.remaining != null && (item.remaining > 0 ? ` · 확인 ${item.remaining}개 남음` : ' · 확인 끝')}
            {material?.reviewed
              ? ' · 검수 완료 ✅'
              : book.stage === 'reviewing' && material && item.remaining === 0 && (
                <Button size="sm" variant="ghost" disabled={reviewing} onClick={() => onReview(book, chapter)}>검수 완료</Button>
              )}
          </li>
        );
      })}
    </ul>
  );
}

export default function LiteraturePublishPanel({ toast, api = LITERATURE_API, kind = 'literature' }) {
  const queryClient = useQueryClient();
  // 문학책은 기존 캐시 키 그대로, 다른 게시 API는 그 경로로 구분한다(접두 무효화가 서로 섞이지 않게 머리부터 다르게).
  const QUERY_KEY = api === LITERATURE_API ? ['admin-literature'] : ['admin-book-publish', api];
  const post = (action, key) => postTo(api, action, key);
  const [confirm, setConfirm] = useState(null); // { action: 'prepare' | 'release', book }
  const [running, setRunning] = useState(null); // { key, done, total }
  const abortRef = useRef(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: () => request(api) });
  useEffect(() => () => abortRef.current?.abort(), []);

  // 장마다 뷰어와 같은 분석 경로(runPreservedReanalysis — 분석 말미에 저자 루비 잠금)로 한 번씩. 한 번에 한 작품.
  async function analyzeBook(book) {
    const targets = book.chapters.filter((chapter) => chapter.material && chapter.material.status !== 'completed');
    if (targets.length === 0 || abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning({ key: book.key, done: 0, total: targets.length });
    try {
      for (const [index, chapter] of targets.entries()) {
        setRunning({ key: book.key, done: index, total: targets.length });
        const { data: row, error } = await supabase.from('reading_materials').select('*').eq('id', chapter.material.id).single();
        if (error) throw error;
        await runPreservedReanalysis(supabase, row, controller.signal, analyzeText, { fullReset: true });
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }
      toast(`「${book.title}」 모든 장을 분석했어요. 장을 열어 검수해 주세요.`, 'success');
    } catch (error) {
      if (error?.name !== 'AbortError') toast(failureMessage('장을 분석하지 못했어요.', error), 'error');
    } finally {
      abortRef.current = null;
      setRunning(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  }

  const prepare = useMutation({
    mutationFn: (book) => post('prepare', book.key),
    onSuccess: async (_, book) => {
      const fresh = await queryClient.fetchQuery({ queryKey: QUERY_KEY, queryFn: () => request(api) });
      const next = fresh.books.find((item) => item.key === book.key);
      if (next) analyzeBook(next);
    },
    onError: (error) => toast(friendlyToastMessage(error, '책을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'), 'error'),
  });

  const review = useMutation({
    mutationFn: ({ book, chapter }) => request(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'review', key: book.key, order: chapter.order }) }),
    onSuccess: (_, { chapter }) => toast(`${chapter.title} 검수를 마쳤어요.`, 'success'),
    onError: (error) => toast(friendlyToastMessage(error, '검수 완료를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'), 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const release = useMutation({
    mutationFn: (book) => post('release', book.key),
    onSuccess: (_, book) => toast(`「${book.title}」 책을 산책에 공개했어요.`, 'success'),
    onError: (error) => toast(friendlyToastMessage(error, '책을 공개하지 못했어요. 잠시 후 다시 시도해 주세요.'), 'error'),
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
  const busy = !!running || prepare.isPending || review.isPending || release.isPending;
  return (
    <div className="admin-table-wrap">
      {kind === 'art' ? (
        <p className="admin-table__muted" style={{ margin: '0 0 12px' }}>
          「그림 한 장 읽기」 큐레이션 책(리포 <code>src/content/art</code>) — 작품 한 점이 미술관 일본어 해설 한 장이에요. 「게시」를 누르면
          장들을 비공개로 준비하고 이 화면에서 한 번씩 분석해요. 장을 열어 해설과 단어 경계를 확인하고 장마다 「검수 완료」를 누른 뒤
          「공개」하면 산책에 보여요. 해설 원문·라이선스는 카탈로그와 대조해 맞을 때만 게시할 수 있어요.
        </p>
      ) : (
        <p className="admin-table__muted" style={{ margin: '0 0 12px' }}>
          青空文庫 퍼블릭 도메인 원작(리포 <code>src/content/literature/aozora</code>). 「게시」를 누르면 장들을 비공개로 준비하고 이 화면에서
          한 번씩 분석해요. 장을 열어 「뜻 확인 필요」(문맥 뜻 제안)를 확정하고 장마다 「검수 완료」를 누른 뒤 「공개」하면 산책에 보여요.
          분석과 검수 결과는 모든 사용자가 같이 쓰고, 단어 상태만 사람마다 따로예요.
        </p>
      )}
      <div className="admin-table-header"><span>총 {books.length}{KIND[kind].unit}</span></div>
      <table className="admin-table">
        <thead>
          <tr><th>작품</th><th>레벨</th><th>{KIND[kind].evidence}</th><th>단계</th><th>작업</th></tr>
        </thead>
        <tbody>
          {books.map((book) => {
            const runningHere = running?.key === book.key ? running : null;
            const prepared = book.chapters.some((chapter) => chapter.material);
            return (
              <tr key={book.key}>
                <td className="admin-table__title">{book.title} · {book.author}</td>
                <td>{book.level}</td>
                <EvidenceCell book={book} kind={kind} />
                <td>
                  <div role={runningHere ? 'status' : undefined}>{stageLabel(book, runningHere, kind)}</div>
                  {prepared && !['reviewing', 'ready', 'released'].includes(book.stage) && (
                    <div className="admin-table__muted">
                      {book.chapters.map((chapter) => (
                        <span key={chapter.order} style={{ marginRight: '8px' }}>
                          {chapter.material
                            ? <Link href={`/viewer/${chapter.material.id}`}>{chapter.title} {chapter.material.status === 'completed' ? '✅' : '분석 전'}</Link>
                            : `${chapter.title} 준비 전`}
                        </span>
                      ))}
                    </div>
                  )}
                  {book.plan.conflicts.map((conflict) => (
                    <div key={`${conflict.id}-${conflict.reason}`} role="alert" style={{ color: 'var(--warning-text)' }}>
                      ⚠ {conflict.order ?? '?'}장 · {CONFLICT_LABEL[conflict.reason] || conflict.reason} (자료 #{conflict.id})
                    </div>
                  ))}
                  {['reviewing', 'ready', 'released'].includes(book.stage) && (
                    <ChapterReview api={api} queryKey={QUERY_KEY} kind={kind} book={book} reviewing={review.isPending} onReview={(item, chapter) => review.mutate({ book: item, chapter })} />
                  )}
                </td>
                <td>
                  {runningHere && <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>멈춤</Button>}
                  {!runningHere && (book.stage === 'unpublished' || (book.stage === 'preparing' && book.plan.insert.length > 0)) && (
                    <Button size="sm" disabled={!book.publishable || busy} onClick={() => setConfirm({ action: 'prepare', book })}>게시</Button>
                  )}
                  {!runningHere && book.stage === 'preparing' && book.plan.insert.length === 0 && (
                    <Button size="sm" disabled={busy} onClick={() => analyzeBook(book)}>이어서 분석</Button>
                  )}
                  {book.stage === 'ready' && (
                    <Button size="sm" disabled={busy} onClick={() => setConfirm({ action: 'release', book })}>공개</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmModal
        open={!!confirm}
        title={!confirm ? '' : confirm.action === 'prepare'
          ? `「${confirm.book.title}」 책을 준비하고 분석할까요?`
          : `「${confirm.book.title}」 책을 산책에 공개할까요?`}
        message={!confirm ? '' : confirm.action === 'prepare'
          ? `${confirm.book.total}장을 비공개로 넣고 이 화면에서 한 번씩 분석해요. ${prepareBasis(confirm.book, kind)}. 공개 전에는 다른 사용자에게 보이지 않아요.`
          : '모든 장의 검수를 마쳤어요. 공개하면 모든 사용자가 읽을 수 있어요. 분석 결과는 같이 쓰고, 단어 상태는 사람마다 따로예요.'}
        confirmLabel={confirm?.action === 'release' ? '공개' : '게시'}
        variant="primary"
        confirmDisabled={busy}
        onConfirm={() => {
          const { action, book } = confirm;
          setConfirm(null);
          if (action === 'prepare') prepare.mutate(book);
          else release.mutate(book);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
