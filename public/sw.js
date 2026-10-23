const CACHE_NAME = 'anatomy-studio-v66d00609f1e7703d';

// 설치 때 받는 것은 오프라인 대체 화면 하나와 그 화면이 쓰는 정적 파일뿐이다(SW-PRECACHE-001, 2026-10-23 KST 현장 감사 F7).
// 예전에는 '/' · /home · /vocab · /materials · /auth까지 받아 새 방문자(그리고 배포마다 워커를 새로 까는 재방문자) 한 명이
// 서버 렌더를 5번 더 불렀다('/'는 리디렉트, 나머지 대부분은 no-store 동적 화면). 받아 둔 문서는 network-first라 오프라인일
// 때만 쓰였고, 그때도 새 빌드의 CSS · JS가 캐시에 없어 모양 없는 화면이었다. 들른 화면은 아래 navigate 규칙이 그대로 남긴다.
const OFFLINE_URL = '/offline';
// /offline은 정적 화면(○)이라 서버 렌더가 없다. 그 HTML이 부르는 /_next/static 파일은 이름이 내용 해시(immutable)라 방금 받은
// 첫 화면과 겹치는 것은 브라우저 캐시에서 온다.
const OFFLINE_ASSET = /\/_next\/static\/[^"'\s<>]+\.(?:css|js)/g;

async function precacheOffline(cache) {
  await cache.add(OFFLINE_URL);
  const response = await cache.match(OFFLINE_URL);
  const html = response ? await response.text() : '';
  const assets = [...new Set(html.match(OFFLINE_ASSET) || [])];
  await Promise.all(assets.map((asset) => cache.add(asset).catch(() => {})));
}

const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|otf|svg|png|jpg|ico|webp)$/;

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

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ),
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
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
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
