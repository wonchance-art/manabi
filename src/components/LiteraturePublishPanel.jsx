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
// 일괄 게시·분석(AOZORA-P1-1 설계 §4.1, 오너 「권장대로」 2026-10-14 KST) — 표 위 한 줄:
//   준비 안 된 8편                                                       [8편 모두 게시·분석]
//   ── 누른 뒤(확인 창은 한 번 — 작품 목록) ──
//   일괄 진행 3/8 · 「坊っちゃん」 분석 12/34 · 이 화면을 닫지 마세요         [멈춤]
//   멈췄다가 다시 누르면 남은 작품·남은 장부터. 검수·공개는 지금처럼 작품마다(사람 확인 지점).
//
// 표지(오너 「게시 누르는 창에도 표지」 2026-10-15 KST) — 서재와 같은 LiteratureCover를 그대로:
//   표 한 줄:   [표지 30×42] 鼻 · 芥川龍之介 …
//   게시·공개 확인 창: [표지 60×84] 위에 안내 문장 / 일괄 확인 창: 대상 작품 표지를 반 크기로 한 줄에
//   「그림 한 장 읽기」(kind="art")는 정본 표지가 없어 그대로.
//
// 분석 이어하기·묶음 검수·쪼개진 낱말(AOZORA-P1-10, 오너 「ㄱㄱ … 고유명사 … 형태소로 나눠버리는 상황 빈번함」 2026-10-15 KST):
//   화면을 열 때 모든 장을 준비했는데 분석이 멈춘 작품이 있으면 한 번 자동으로 잇는다(일괄 진행 줄 · [멈춤] 그대로):
//     토스트 「멈춘 분석 2편을 이어요」 → 일괄 진행 1/2 · 「吾輩は猫である」 분석 3/40 · 이 화면을 닫지 마세요   [멈춤]
//   검수 줄 — 쪼개진 저자 루비 낱말(빌드의 「한 단어로 묶기」로도 못 묶은 자리)을 장마다 보이고, 묶음 검수는 깨끗한 장만:
//     [12장 검수 완료]      ← 「확인 끝」 · 쪼개진 낱말 없음 · 검수 전인 장이 2장 이상일 때. 확인 창 한 번(장 목록)
//     · 一 ↗ · 루비 140/145 · 확인 끝 · 쪼개진 낱말 2곳(苦沙弥·迷亭 — 뷰어에서 묶기)   [검수 완료] → 확인 창(그대로 둘지)
//     · 二 ↗ · 루비 136/138 · 확인 끝                                                  [검수 완료]
//
// 분석 실패 건너뛰기(AOZORA-P1-13, 오너 「권장대로」 2026-10-16 KST) — 한 장이 실패해도 다음 장을 잇고 끝에 한 번 알린다:
//   토스트 「3편을 준비·분석했어요. 2장은 건너뛰었어요(こころ 上 三·こころ 中 七 — 분석하지 못했어요). 다시 열면 그 장부터 이어요.」
//   연달아 3장 실패면 「연달아 3장을 분석하지 못해 멈췄어요 — …」(할당량·네트워크 같은 공통 원인 — 남은 장을 헛되이 돌리지 않는다)
//
// 영어 정본(LIT-SRC-EN-1, Standard Ebooks) — 같은 표에 섞인다. 권리 근거 칸은 같은 모양, 링크만 판 페이지, 루비 없는 장은 루비 칸을 감춘다:
//   Alice’s Adventures in Wonderland · Lewis Carroll   B1 중급   퍼블릭 도메인 · 초출 1865 · 작가 1898 사망 · Standard Ebooks · CC0-1.0
//                                                                · GB·US·KR 검토(claude, 2026-10-16) · Standard Ebooks 판      [게시]
//   표지는 아직 없다(영어 표지 시리즈는 목업 합의 뒤).
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
import { literatureBatchTargets, literatureResumeTargets } from '../lib/literaturePublish';
import { literatureWork } from '../lib/literatureCanonical';
import LiteratureCover from './books/LiteratureCover';
import { standardEbooksWork } from '../lib/standardEbooksCanonical';
import FirstEditionCover from './books/FirstEditionCover';
import CanonicalCover from './books/CanonicalCover';
import { wikisourceWork } from '../lib/wikisourceCanonical';

const LITERATURE_API = '/api/admin/literature';
const FAILURE_STOP = 3; // 연달아 이만큼 실패하면 공통 원인(할당량·네트워크)으로 보고 멈춘다
const CONFIRM_LABEL = { release: '공개', batch: '모두 게시·분석', review: '그대로 검수 완료', reviewMany: '모두 검수 완료' };
const CONFLICT_LABEL = { 'text-differs': '정본과 원문이 다름', 'duplicate-order': '같은 장이 둘', 'unknown-order': '정본에 없는 장' };

/** 정본 표지 — 서재 카드와 같은 그림을 배율만 줄여서(60×84 기준). 정본 대조표에 없는 책(그림 책)은 그리지 않는다. */
export function BookCover({ bookKey, scale = 1 }) {
  const work = literatureWork(bookKey);
  const english = work ? null : standardEbooksWork(bookKey); // 영어 정본 — 빅토리아 천 장정(LIT-SRC-EN-1)
  const world = work || english ? null : wikisourceWork(bookKey); // 중국어·프랑스어 정본 — 초판 장정(LIT-SRC-WS-1)
  if (!work?.display && !english?.display && !world?.display) return null;
  return (
    <span style={{ display: 'inline-block', width: 60 * scale, height: 84 * scale, overflow: 'hidden', verticalAlign: 'middle', flex: 'none' }}>
      <span style={{ display: 'block', width: 60, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        {work ? <LiteratureCover work={work} /> : english ? <CanonicalCover work={english} /> : <FirstEditionCover work={world} />}
      </span>
    </span>
  );
}

async function request(url, init) {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || '요청을 처리하지 못했어요.'), { status: response.status });
  return body;
}
const postTo = (api, action, key, extra = {}) => request(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, key, ...extra }) });

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
              {' '}<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${item.order}장 원문(새 창)`}>{item.order}</a>
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
      {' · '}<a href={rights.evidenceUrl} target="_blank" rel="noopener noreferrer">{rights.evidenceLabel || '도서 카드'}</a>
    </td>
  );
}

/** 확인 창 문장 — 게시·일괄·공개·쪼개진 낱말을 둔 검수·묶음 검수. */
function confirmTextOf(confirm, kind) {
  switch (confirm?.action) {
    case 'batch': return `${confirm.books.map((book) => `${book.title}(${book.total}장)`).join(' · ')}. 모두 비공개로 넣고 이 화면에서 한 장씩 분석해요. 근거는 표의 「${KIND[kind].evidence}」 칸과 같아요. 검수와 공개는 작품마다 따로 해요.`;
    case 'prepare': return `${confirm.book.total}장을 비공개로 넣고 이 화면에서 한 번씩 분석해요. ${prepareBasis(confirm.book, kind)}. 공개 전에는 다른 사용자에게 보이지 않아요.`;
    case 'release': return '모든 장의 검수를 마쳤어요. 공개하면 모든 사용자가 읽을 수 있어요. 분석 결과는 같이 쓰고, 단어 상태는 사람마다 따로예요.';
    case 'review': return `분석이 저자 루비 낱말 ${confirm.item.boundary}곳을 둘 이상으로 나눴어요(${confirm.item.boundaryWords.join('·')}). 이름이나 한 낱말이면 장을 열어 「한 단어로 묶기」로 고쳐 주세요. 그대로 두어도 되는 자리라면 검수 완료로 표시해요.`;
    case 'reviewMany': return `${confirm.chapters.map((chapter) => chapter.title).join(' · ')}. 「뜻 확인 필요」가 없고 쪼개진 저자 루비 낱말도 없는 장이에요. 한 번에 검수 완료로 표시해요.`;
    default: return '';
  }
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
    case 'exposed': return '⚠ 검수 전 공개 · 자료 관리에서 비공개로 돌린 뒤 분석·검수해 주세요';
    default: return '확인 필요';
  }
}

// 장별 검수 줄 — 저자 루비 적용(문학책만) · 검수 제안 수 · 남은 「뜻 확인 필요」 · 쪼개진 루비 낱말 · [검수 완료](남은 확인 0일 때만).
// 맨 위 [N장 검수 완료]는 확인 끝이고 쪼개진 낱말도 없는 검수 전 장만 묶는다(서버가 장마다 다시 판정한다).
function ChapterReview({ api, queryKey, kind, book, onReview, onReviewMany, reviewing }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKey, 'ruby', book.key],
    queryFn: () => request(`${api}?ruby=${encodeURIComponent(book.key)}`),
  });
  if (isLoading) return <p className="admin-table__muted" role="status">검수 상태를 세는 중…</p>;
  if (isError) return <button type="button" className="admin-table__muted" onClick={() => refetch()}>검수 상태를 불러오지 못했어요 · 다시 시도</button>;
  const byOrder = new Map(data.coverage.map((item) => [item.order, item]));
  const clean = book.stage === 'reviewing' ? book.chapters.filter((chapter) => {
    const item = byOrder.get(chapter.order);
    return chapter.material && !chapter.material.reviewed && item?.remaining === 0 && item?.boundary === 0;
  }) : [];
  return (
    <>
      {clean.length > 1 && (
        <Button size="sm" variant="ghost" disabled={reviewing} onClick={() => onReviewMany(book, clean)}>{clean.length}장 검수 완료</Button>
      )}
    <ul className="admin-table__muted" style={{ margin: '4px 0 0', paddingInlineStart: '16px' }}>
      {book.chapters.map((chapter) => {
        const item = byOrder.get(chapter.order) || {};
        const material = chapter.material;
        return (
          <li key={chapter.order}>
            {material ? <Link href={`/viewer/${material.id}`}>{chapter.title} ↗</Link> : chapter.title}
            {KIND[kind].ruby && item.applied != null && item.rubyLocks > 0 && ` · 루비 ${item.applied}/${item.rubyLocks}`}
            {item.hints > 0 && ` · 제안 ${item.hints}개`}
            {item.hintsMissed?.length > 0 && ` · 안 붙은 제안 ${item.hintsMissed.length}개(${item.hintsMissed.join('·')} — 장에서 직접 확인)`}
            {item.remaining != null && (item.remaining > 0 ? ` · 확인 ${item.remaining}개 남음` : ' · 확인 끝')}
            {item.boundary > 0 && (
              <span style={{ color: 'var(--warning-text)' }}>{` · 쪼개진 낱말 ${item.boundary}곳(${item.boundaryWords.join('·')} — 뷰어에서 묶기)`}</span>
            )}
            {material?.reviewed
              ? ' · 검수 완료 ✅'
              : book.stage === 'reviewing' && material && item.remaining === 0 && (
                <Button size="sm" variant="ghost" disabled={reviewing} onClick={() => onReview(book, chapter, item)}>검수 완료</Button>
              )}
          </li>
        );
      })}
    </ul>
    </>
  );
}

export default function LiteraturePublishPanel({ toast, api = LITERATURE_API, kind = 'literature' }) {
  const queryClient = useQueryClient();
  // 문학책은 기존 캐시 키 그대로, 다른 게시 API는 그 경로로 구분한다(접두 무효화가 서로 섞이지 않게 머리부터 다르게).
  const QUERY_KEY = api === LITERATURE_API ? ['admin-literature'] : ['admin-book-publish', api];
  const post = (action, key) => postTo(api, action, key);
  const [confirm, setConfirm] = useState(null); // { action: 'prepare' | 'release' | 'batch' | 'review' | 'reviewMany', book, … }
  const [running, setRunning] = useState(null); // { key, done, total }
  const [batch, setBatch] = useState(null); // { titles, index } — 일괄 게시·분석 진행
  const abortRef = useRef(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: () => request(api) });
  useEffect(() => () => abortRef.current?.abort(), []);
  // 분석 이어하기 — 화면을 열고 처음 목록을 받았을 때 한 번만(멈춤을 누른 뒤 다시 돌지 않게).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!data?.books || resumedRef.current) return;
    resumedRef.current = true;
    const stopped = literatureResumeTargets(data.books);
    if (stopped.length === 0) return;
    toast(`멈춘 분석 ${stopped.length}${KIND[kind].unit}을 이어요.`, 'info');
    runBatch(stopped);
    // runBatch는 렌더마다 새로 만들어지지만 한 번만 부르므로 의존성에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // 장마다 뷰어와 같은 분석 경로(runPreservedReanalysis — 분석 말미에 저자 루비 잠금)로 한 번씩.
  // 한 장이 실패해도 건너뛰고 다음 장을 잇는다(AOZORA-P1-13 — 621장 일괄에서 한 장 때문에 전체가 멈추지 않게). 실패한 장은
  // 분석 전으로 남아 다음 이어하기에서 다시 시도된다. 연달아 FAILURE_STOP장 실패하면 장 문제가 아니라 할당량·네트워크 같은
  // 공통 원인으로 보고 멈춘다(남은 장을 헛되이 돌리지 않게). → 실패한 장 [{title, message}]
  async function analyzeChapters(book, controller) {
    const targets = book.chapters.filter((chapter) => chapter.material && chapter.material.status !== 'completed');
    // 준비 뒤 정본 빌드가 늘린 칸(단어 경계 미리 묶기·검수 힌트)을 분석 전 장에 먼저 맞춘다(AOZORA-P1-12 — prepare는 멱등).
    if (targets.length) await post('prepare', book.key);
    const failed = [];
    let streak = 0;
    for (const [index, chapter] of targets.entries()) {
      setRunning({ key: book.key, done: index, total: targets.length });
      try {
        const { data: row, error } = await supabase.from('reading_materials').select('*').eq('id', chapter.material.id).single();
        if (error) throw error;
        await runPreservedReanalysis(supabase, row, controller.signal, analyzeText, { fullReset: true });
        streak = 0;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        failed.push({ title: chapter.title, message: friendlyToastMessage(error, '분석하지 못했어요.') });
        streak += 1;
        if (streak >= FAILURE_STOP) throw Object.assign(new Error(`연달아 ${streak}장을 분석하지 못해 멈췄어요 — ${failed.at(-1).message}`), { failed });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
    return failed;
  }

  /** 건너뛴 장 안내 — 앞 3장 이름과 첫 이유. */
  const failedNote = (failed) => `${failed.length}장은 건너뛰었어요(${failed.slice(0, 3).map((item) => item.title).join('·')}${failed.length > 3 ? ' …' : ''} — ${failed[0].message}). 다시 열면 그 장부터 이어요.`;

  // 한 작품 — 「게시」 뒤·「이어서 분석」.
  async function analyzeBook(book) {
    if (book.chapters.every((chapter) => !chapter.material || chapter.material.status === 'completed') || abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const failed = await analyzeChapters(book, controller);
      if (failed.length) toast(`「${book.title}」 ${failedNote(failed)}`, 'error');
      else toast(`「${book.title}」 모든 장을 분석했어요. 장을 열어 검수해 주세요.`, 'success');
    } catch (error) {
      if (error?.name !== 'AbortError') toast(failureMessage('장을 분석하지 못했어요.', error), 'error');
    } finally {
      abortRef.current = null;
      setRunning(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  }

  // 일괄 — 준비 안 된 작품을 차례로 준비(prepare)·분석한다. 작품마다 최신 상태를 다시 읽어, 멈췄다 다시 누르면 남은 장부터 잇는다.
  // 검수·공개는 하지 않는다(사람 확인 지점 — 작품마다 그대로).
  async function runBatch(books) {
    if (abortRef.current || books.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const titles = books.map((book) => book.title);
    let done = 0;
    const failed = [];
    try {
      for (const [index, target] of books.entries()) {
        if (controller.signal.aborted) break;
        setBatch({ titles, index });
        const find = async () => (await queryClient.fetchQuery({ queryKey: QUERY_KEY, queryFn: () => request(api) })).books.find((item) => item.key === target.key);
        let book = await find();
        if (!book || literatureBatchTargets([book]).length === 0) continue;
        if (book.plan.insert.length > 0) {
          await post('prepare', book.key);
          book = await find();
        }
        if (!book || book.plan.conflicts.length > 0) continue;
        failed.push(...(await analyzeChapters(book, controller)).map((item) => ({ ...item, title: `${book.title} ${item.title}` })));
        done += 1;
      }
      if (!controller.signal.aborted) {
        toast(failed.length ? `${done}편을 준비·분석했어요. ${failedNote(failed)}` : `${done}편을 준비·분석했어요. 작품마다 장을 열어 검수해 주세요.`,
          failed.length ? 'error' : 'success');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast(failureMessage('일괄 게시·분석을 마치지 못했어요. 다시 누르면 남은 장부터 이어요.', error), 'error');
    } finally {
      abortRef.current = null;
      setRunning(null);
      setBatch(null);
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
    mutationFn: ({ book, chapter, acceptBoundaries = false }) => post('review', book.key, { order: chapter.order, acceptBoundaries }),
    onSuccess: (_, { chapter }) => toast(`${chapter.title} 검수를 마쳤어요.`, 'success'),
    onError: (error) => toast(friendlyToastMessage(error, '검수 완료를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'), 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // 묶음 검수 — 서버가 장마다 다시 판정하고, 넘긴 장은 이유와 함께 돌려준다(부분 성공).
  const reviewMany = useMutation({
    mutationFn: ({ book, chapters }) => post('reviewMany', book.key, { orders: chapters.map((chapter) => chapter.order) }),
    onSuccess: ({ reviewed = [], skipped = [] }) => toast(skipped.length
      ? `${reviewed.length}장 검수를 마쳤어요. ${skipped.length}장은 넘겼어요 — ${skipped[0].error}`
      : `${reviewed.length}장 검수를 마쳤어요.`, skipped.length ? 'info' : 'success'),
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
  const busy = !!running || !!batch || prepare.isPending || review.isPending || reviewMany.isPending || release.isPending;
  const pending = literatureBatchTargets(books);
  // 확인 창 본문 — 정본 문학책의 게시·일괄·공개 확인이면 대상 작품 표지(한 권은 실제 크기, 일괄은 반 크기 줄)를 문장 위에.
  const confirmText = confirmTextOf(confirm, kind);
  const confirmMessage = !confirm || kind !== 'literature' || !['prepare', 'batch', 'release'].includes(confirm.action) ? confirmText : (
    <>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
        {(confirm.action === 'batch' ? confirm.books : [confirm.book]).map((book) => (
          <BookCover key={book.key} bookKey={book.key} scale={confirm.action === 'batch' ? 0.5 : 1} />
        ))}
      </span>
      {confirmText}
    </>
  );

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
          青空文庫·Standard Ebooks 퍼블릭 도메인 원작(리포 <code>src/content/literature</code>). 「게시」를 누르면 장들을 비공개로 준비하고 이 화면에서
          한 번씩 분석해요. 장을 열어 「뜻 확인 필요」(문맥 뜻 제안)를 확정하고 장마다 「검수 완료」를 누른 뒤 「공개」하면 산책에 보여요.
          분석과 검수 결과는 모든 사용자가 같이 쓰고, 단어 상태만 사람마다 따로예요.
        </p>
      )}
      <div className="admin-table-header">
        <span>총 {books.length}{KIND[kind].unit}</span>
        {batch ? (
          <span role="status">
            일괄 진행 {batch.index + 1}/{batch.titles.length} · 「{batch.titles[batch.index]}」
            {running ? ` 분석 ${running.done}/${running.total}` : ' 준비 중'} · 이 화면을 닫지 마세요{' '}
            <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>멈춤</Button>
          </span>
        ) : pending.length > 1 && (
          <span>
            준비 안 된 {pending.length}{KIND[kind].unit}{' '}
            <Button size="sm" disabled={busy} onClick={() => setConfirm({ action: 'batch', books: pending })}>{pending.length}{KIND[kind].unit} 모두 게시·분석</Button>
          </span>
        )}
      </div>
      <table className="admin-table">
        <thead>
          <tr><th>작품</th><th>레벨</th><th>{KIND[kind].evidence}</th><th>단계</th><th>작업</th></tr>
        </thead>
        <tbody>
          {books.map((book) => {
            const runningHere = running?.key === book.key && !batch ? running : null;
            const prepared = book.chapters.some((chapter) => chapter.material);
            return (
              <tr key={book.key}>
                <td className="admin-table__title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {kind === 'literature' && <BookCover bookKey={book.key} scale={0.5} />}
                    <span>{book.title} · {book.author}</span>
                  </span>
                </td>
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
                    <ChapterReview
                      api={api} queryKey={QUERY_KEY} kind={kind} book={book} reviewing={review.isPending || reviewMany.isPending}
                      onReview={(item, chapter, coverage) => (coverage.boundary > 0
                        ? setConfirm({ action: 'review', book: item, chapter, item: coverage })
                        : review.mutate({ book: item, chapter }))}
                      onReviewMany={(item, chapters) => setConfirm({ action: 'reviewMany', book: item, chapters })}
                    />
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
        title={!confirm ? '' : confirm.action === 'review'
          ? `${confirm.chapter.title} — 쪼개진 낱말을 그대로 두고 검수 완료할까요?`
          : confirm.action === 'reviewMany'
            ? `「${confirm.book.title}」 ${confirm.chapters.length}장을 검수 완료로 표시할까요?`
            : confirm.action === 'batch'
          ? `${confirm.books.length}${KIND[kind].unit}을 차례로 준비하고 분석할까요?`
          : confirm.action === 'prepare'
            ? `「${confirm.book.title}」 책을 준비하고 분석할까요?`
            : `「${confirm.book.title}」 책을 산책에 공개할까요?`}
        message={confirmMessage}
        confirmLabel={CONFIRM_LABEL[confirm?.action] || '게시'}
        variant="primary"
        confirmDisabled={busy}
        onConfirm={() => {
          const { action, book, books: targets, chapter, chapters } = confirm;
          setConfirm(null);
          if (action === 'review') review.mutate({ book, chapter, acceptBoundaries: true });
          else if (action === 'reviewMany') reviewMany.mutate({ book, chapters });
          else if (action === 'batch') runBatch(targets);
          else if (action === 'prepare') prepare.mutate(book);
          else release.mutate(book);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
