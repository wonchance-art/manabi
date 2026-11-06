const CACHE_NAME = 'manabi-vbdd053027c5755a9';

// 설치 때 받는 것은 오프라인 대체 화면 하나와 그 화면이 쓰는 정적 파일뿐이다(SW-PRECACHE-001, 2026-10-23 KST 현장 감사 F7).
// 예전에는 '/' · /home · /vocab · /materials · /auth까지 받아 새 방문자(그리고 배포마다 워커를 새로 까는 재방문자) 한 명이
// 서버 렌더를 5번 더 불렀다('/'는 리디렉트, 나머지 대부분은 no-store 동적 화면). 받아 둔 문서는 network-first라 오프라인일
// 때만 쓰였고, 그때도 새 빌드의 CSS · JS가 캐시에 없어 모양 없는 화면이었다. 들른 화면은 아래 navigate 규칙이 그대로 남긴다.
const OFFLINE_URL = '/offline';
// /offline은 정적 화면(○)이라 서버 렌더가 없다. 그 HTML이 부르는 /_next/static CSS · JS도 함께 받는다 — 없으면 끊긴 채 그린 대체
// 화면이 자기 조각을 못 받아 모양 없이(또는 ChunkLoadError로) 떨어진다. 이름이 내용 해시(immutable)라 방금 받은 첫 화면과 겹치는
// 것은 브라우저 캐시에서 온다. 주소는 속성값 그대로(배포 식별 ?dpl= 같은 질의 포함) 쓴다 — 캐시 대조가 질의까지 본다.
const OFFLINE_ASSET = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

function offlineAssets(html) {
  const urls = new Set();
  for (const m of String(html).matchAll(OFFLINE_ASSET)) {
    const url = m[1].replace(/&amp;/g, '&');
    if (/\.(?:css|js)(?:\?|$)/.test(url)) urls.add(url);
  }
  return [...urls];
}

async function precacheOffline(cache) {
  await cache.add(OFFLINE_URL);
  const response = await cache.match(OFFLINE_URL);
  const html = response ? await response.text() : '';
  await Promise.all(offlineAssets(html).map((asset) => cache.add(asset).catch(() => {})));
}

// 끊긴 채 연 뷰어 문서(OFFLINE-SWEEP-001 P1, 2026-10-24 KST): 서재에서 연 주소는 돌아갈 곳(?returnTo=/materials?restoreY=…)이 붙어
// 들를 때마다 달라 같은 자료의 받아 둔 문서와 질의가 어긋났다 — 끊긴 서재의 「이 기기에 받아 둔 자료」를 눌러도 /offline이 떴다.
// 뷰어 문서는 경로의 자료 id만 서버가 쓰고(제목) 본문은 브라우저가 기기 사본으로 그리므로, 같은 경로의 받아 둔 문서를 질의 없이 찾는다.
// 다른 화면은 질의가 서버 그림을 바꿀 수 있어(서재 목록 조건 등) 그대로 정확히 맞춘다.
const VIEWER_PATH = /^\/viewer\/[^/]+\/?$/;
function viewerDocument(request, url) {
  if (url.origin !== self.location.origin || !VIEWER_PATH.test(url.pathname)) return null;
  return caches.match(request, { ignoreSearch: true });
}

const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|otf|svg|png|jpg|ico|webp)$/;

// 레벨 단어 묶음(LEVEL-LIST-RSC-001, 2026-10-26 KST) — 단어 화면 항목이 문서 · 조각 밖 정적 JSON(/api/level-words/{lang}/{level}?v=판)으로 옮겨 가,
// 받아 둔 문서만으로는 끊긴 채 열면 「다시 시도」였다(전에는 문서에 항목이 들어 있어 그대로 열렸다). 이 주소만 /api/ 건너뛰기의 예외로
// network-first · 성공한 같은 출처 응답만 남기고, 끊기면 남긴 것을 돌려준다. 열쇠는 질의 없는 경로 — 레벨마다 한 칸(배포 판 ?v=가 쌓이지 않는다).
// 공개 묶음이다: 쿠키 · 세션으로 달라지지 않는 정적 응답(middleware matcher 밖, Set-Cookie 없음)이라 계정 경계 규칙과 겹치지 않는다.
const LEVEL_WORDS_PATH = /^\/api\/level-words\/[a-z]+\/[a-z0-9]+$/;
const levelWordsKey = (url) => `${url.origin}${url.pathname}`;

// Next 앱 라우터의 화면 조각(RSC) 요청 — 화면 이동 · 미리 받기가 ?_rsc= 주소와 RSC: 1 머리로 보낸다.
function isRscRequest(request, url) {
  return url.searchParams.has('_rsc') || request.headers?.get?.('RSC') === '1';
}

function isCacheableNavigationResponse(response) {
  if (!response.ok || response.redirected || response.type !== 'basic') return false;
  try {
    return new URL(response.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // 실패해도 설치 자체는 성공시킴
      precacheOffline(cache).catch(err => console.warn('[sw] precache failed:', OFFLINE_URL, err?.message))
    )
  );
  self.skipWaiting();
});

// 캐시 이름 · 옮겨 담기(LAUNCH-META-001 SW 이름, 2026-11-06 KST 오너 「버그 먼저」 경유): 이름 앞부분을 옛 프로젝트 이름(anatomy-studio-v)에서
// manabi-v로 바꿨다. 이름은 배포마다 바뀌고(scripts/update-sw-version.mjs 내용 해시) 새 워커는 활성화 때 다른 이름의 캐시를 지운다 —
// 예전에는 그때 끊긴 채 열던 뷰어 문서(OFFLINE-SWEEP-001)도 함께 사라져, 배포 · 이름 바꿈 뒤 첫 오프라인에서 받아 둔 자료가 /offline으로 떨어졌다.
// 이제 지우기 전에 우리 캐시(새 · 옛 접두)에서 뷰어 문서(화면 조각 RSC 제외)와 그 문서가 부르는 /_next/static CSS · JS, 글꼴(/_next/static/media)을 새 캐시로 옮긴다.
// 새 캐시에 같은 열쇠가 이미 있으면(새로 받은 것) 두지 않는다. 옮기다 실패해도 지우기는 한다(예전과 같은 결과 — 화면을 막지 않는다).
// 본문(자료 · 단어장)은 CacheStorage가 아니라 IndexedDB(anatomy-offline-cache — 이름 유지)라 이 일과 무관하다.
const CACHE_PREFIXES = ['manabi-v', 'anatomy-studio-v'];
const ownCache = (name) => CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));
// 중국어 독립 글꼴 시트(/_fonts/… — 이름이 본문 해시라 바뀌지 않는다)도 함께 옮긴다(VIEWER-FONT-SPLIT-001 — 뷰어가 첫 그림 뒤에 붙이는 시트라
// 받아 둔 뷰어 문서의 HTML에 주소가 없다. 옮기지 않으면 배포 뒤 첫 오프라인에서 중국어가 시스템 글꼴로 떨어진다).
const FONT_ASSET = /^\/(?:_next\/static\/media|_fonts)\//;

async function carryOver(current, oldName) {
  const old = await caches.open(oldName);
  const keep = async (request) => {
    if (await current.match(request)) return;
    const cached = await old.match(request);
    if (cached) await current.put(request, cached);
  };
  for (const request of await old.keys()) {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) continue;
    if (FONT_ASSET.test(url.pathname)) { await keep(request); continue; }
    // 문서만 옮긴다 — 화면 조각(RSC)은 그 빌드의 라우터 몫이라 새 빌드에 넘기지 않는다.
    if (!VIEWER_PATH.test(url.pathname) || isRscRequest(request, url) || await current.match(request)) continue;
    const cached = await old.match(request);
    if (!cached) continue;
    const html = await cached.clone().text();
    await current.put(request, cached);
    for (const asset of offlineAssets(html)) await keep(new URL(asset, self.location.origin).href);
  }
}

async function pruneCaches() {
  const stale = (await caches.keys()).filter((key) => key !== CACHE_NAME);
  const own = stale.filter(ownCache);
  if (own.length) {
    try {
      const current = await caches.open(CACHE_NAME);
      for (const name of own) await carryOver(current, name).catch(() => {});
    } catch {
      // 옮기기 실패가 정리(지우기)를 막지 않는다.
    }
  }
  await Promise.all(stale.map((key) => caches.delete(key)));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    pruneCaches(),
    // 탐색 미리 받기(PWA-SHELL-001 ⑤): 워커가 깨어나는 동안 문서 요청을 먼저 보낸다 — 앱을 열 때 워커 기동 시간만큼 첫 응답이 늦던 것.
    self.registration.navigationPreload?.enable().catch(() => {}),
  ]));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API, and Supabase requests
  if (request.method !== 'GET') return;
  // Admin documents (including archived textbooks and RSC responses) must always
  // reach the current authentication gate, never a previous account's offline cache.
  if (url.origin === self.location.origin && /^\/admin(?:\/|$)/.test(url.pathname)) return;
  if (url.origin === self.location.origin && LEVEL_WORDS_PATH.test(url.pathname)) {
    const key = levelWordsKey(url);
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (isCacheableNavigationResponse(response)) {
            const clone = response.clone();
            try {
              await caches.open(CACHE_NAME).then((cache) => cache.put(key, clone));
            } catch {
              // 저장 실패가 정상 응답을 가리지 않는다.
            }
          }
          return response;
        })
        .catch(() => caches.match(key).then((cached) => cached || Response.error()))
    );
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('supabase')) return;
  if (url.hostname.includes('googleapis')) return;

  // Static assets: cache-first
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    // 미리 받은 응답이 있으면 그것을 쓴다(없거나 실패면 직접 받기) — 캐시 · 오프라인 규칙은 그대로.
    const network = Promise.resolve(event.preloadResponse)
      .then((preloaded) => preloaded || fetch(request));
    event.respondWith(
      network
        .then(async (response) => {
          if (isCacheableNavigationResponse(response)) {
            const clone = response.clone();
            try {
              await caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            } catch {
              // Cache quota/storage failures must not replace a valid network response.
            }
          }
          return response;
        })
        .catch(() => caches.match(request)
          .then((cached) => cached || viewerDocument(request, url))
          .then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // 화면 조각(RSC): network-first — 캐시 먼저(SWR)로 주면 서버가 새로 그린 화면(서재 목록 · 진도) 대신 지난번 조각이 먼저 나갔다
  // (390 실측: 캐시에 심은 표식 조각이 그대로 반환). 성공한 같은 출처 응답만 오프라인용으로 남기고, 끊기면 남은 조각 · 없으면 실패를
  // 돌려준다 — 실패면 라우터가 문서 이동으로 바꿔 위 navigate 규칙(캐시 · /offline)을 탄다.
  if (url.origin === self.location.origin && isRscRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (isCacheableNavigationResponse(response)) {
            const clone = response.clone();
            try {
              await caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            } catch {
              // 저장 실패가 정상 응답을 가리지 않는다.
            }
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Other requests: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetching = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || fetching;
    })
  );
});

// ── 웹 푸시 (기획 v4 §4.2) ──
// 서버(Vercel Cron)가 보내는 페이로드: { title, body, url }. url 기본 '/study?src=push'.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // JSON이 아니면(텍스트만) 무해하게 본문으로만 처리
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'manabi';
  const body = payload.body || '';
  const url = payload.url || '/study?src=push';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url },
    })
  );
});

// 알림 클릭 → 열려 있는 탭이 있으면 포커스, 없으면 새 창으로 학습 화면 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/study?src=push';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
