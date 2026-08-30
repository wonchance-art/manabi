'use client';

/**
 * 버전 배지 (v2-J R1, #1077 — 오너 발안·확정 2026-08-27, 목업 §2 그대로).
 * 관리자 · ?v=1 · localStorage.debug_version 중 하나일 때만 GNB에 뜬다(계약 2).
 * 번들 SHA(빌드 시점 인라인) ↔ /api/version SHA(요청 시점)를 맞대어 구버전을 경고한다.
 * 판정은 lib/versionBadge(순수), 여기는 게이트·조회·표시만.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { buildVersionView, shouldShowVersionBadge } from '../lib/versionBadge';
import { clearAppShellCaches, readCacheNames, shortenCacheName } from '../lib/swCache';

export default function VersionBadge() {
  const { isAdmin } = useAuth();
  // 노출 판정은 마운트 후에만 — search·localStorage는 서버에 없다(하이드레이션 불일치 방지).
  const [show, setShow] = useState(false);
  const [serverSha, setServerSha] = useState(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cacheNames, setCacheNames] = useState(null);   // v2-J R2 — SW 캐시 진단
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let debugFlag = null;
    try { debugFlag = localStorage.getItem('debug_version'); } catch { /* 사생활 모드 */ }
    setShow(shouldShowVersionBadge({ isAdmin, search: window.location.search, debugFlag }));
  }, [isAdmin]);

  // 서버 최신 버전 조회 — 마운트 1회뿐(계약 6: 폴링 금지). 실패는 조용히(진단
  // 도구가 화면을 깨뜨리면 안 된다) — 비교 없이 SHA만 보여주는 상태로 남는다.
  useEffect(() => {
    if (!show) return undefined;
    let alive = true;
    fetch('/api/version', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.sha) setServerSha(d.sha); })
      .catch(() => {});
    return () => { alive = false; };
  }, [show]);

  // 캐시명은 패널을 펼 때만 읽는다 — 배지만 떠 있을 때 CacheStorage를 건드릴 이유가 없다.
  useEffect(() => {
    if (!open || cacheNames !== null) return undefined;
    let alive = true;
    readCacheNames().then((names) => { if (alive) setCacheNames(names); });
    return () => { alive = false; };
  }, [open, cacheNames]);

  if (!show) return null;

  const view = buildVersionView({
    buildSha: process.env.NEXT_PUBLIC_BUILD_SHA,
    buildRef: process.env.NEXT_PUBLIC_BUILD_REF,
    buildAt: process.env.NEXT_PUBLIC_BUILD_AT,
    serverSha,
  });
  const stale = view.status === 'stale';

  // 앱 껍데기 캐시만 비운다 — IndexedDB(오프라인 자료·단어장)는 건드리지 않는다.
  async function clearCachesAndReload() {
    if (clearing) return;
    setClearing(true);
    await clearAppShellCaches();
    window.location.reload();
  }

  async function copySha() {
    try {
      await navigator.clipboard.writeText(view.sha);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* 클립보드 거부 — 조용히 */ }
  }

  return (
    <div className="version-badge">
      <button
        type="button"
        className={`version-badge__btn${stale ? ' version-badge__btn--stale' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={stale ? `구버전을 보고 있어요 — 최신 ${view.serverSha}` : `빌드 ${view.sha}`}
      >
        <span aria-hidden="true">{stale ? '⚠' : 'v'}</span>
        <span className="version-badge__sha">{view.sha}</span>
      </button>

      {open && (
        <div className="version-badge__panel" role="dialog" aria-label="배포 버전">
          {stale && (
            <p className="version-badge__warn">
              옛 번들을 보고 있어요 — 최신 <b>{view.serverSha}</b>
            </p>
          )}
          <dl className="version-badge__rows">
            <dt>커밋</dt>
            <dd>
              <code>{view.sha}</code>
              <button type="button" className="version-badge__copy" onClick={copySha}>
                {copied ? '복사됨' : '복사'}
              </button>
            </dd>
            <dt>브랜치</dt>
            <dd><code>{view.ref}</code></dd>
            {view.builtAt && (
              <>
                <dt>빌드</dt>
                {/* 시각 표기는 KST 고정(규약) — 상대 표기를 함께 둔다 */}
                <dd>{view.builtAt}{view.relative ? ` · ${view.relative}` : ''}</dd>
              </>
            )}
            <dt>SW캐시</dt>
            <dd>
              {cacheNames === null ? '읽는 중…'
                : cacheNames.length === 0 ? '없음'
                  : <code title={cacheNames.join(', ')}>{shortenCacheName(cacheNames[0])}</code>}
              {cacheNames?.length > 1 && <span> 외 {cacheNames.length - 1}</span>}
            </dd>
          </dl>
          <button
            type="button"
            className="version-badge__reload"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
          {/* 옛 번들이 서빙될 때의 자가 수리(v2-J R2) — 앱 껍데기 캐시만 비운다.
              학습 데이터(IndexedDB)는 그대로라 오프라인 자료·단어장이 남는다. */}
          <button
            type="button"
            className="version-badge__reload version-badge__reload--danger"
            onClick={clearCachesAndReload}
            disabled={clearing}
          >
            {clearing ? '비우는 중…' : '캐시 비우고 새로고침'}
          </button>
          <p className="version-badge__hint">학습 데이터는 지우지 않아요</p>
        </div>
      )}
    </div>
  );
}
