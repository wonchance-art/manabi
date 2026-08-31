/**
 * 링크 반입 — 유튜브 자막 취득 (v2-F R1, #1077 설계 §3).
 *
 * ── 자동 취득은 "되면 좋은 것"이다 (실측 교정)
 *
 * 설계 §0은 크론이 유튜브 자막을 뽑아 쓰는 **검증된 경로**가 있다고 적었으나 실측은
 * 다르다: 크론(`content-sources.js`)은 Qiita·NHK·Dev.to·Wikinews **글**만 가져오고
 * `youtube.js`는 소비처가 0인 죽은 코드다. 그 안이 쓰는 `youtube-transcript`는 문서
 * (§4.3)가 이미 데이터센터 IP 차단을 경고한 물건이라, 서버리스에서 성공률을 장담할 수
 * 없다.
 *
 * 그래서 이 라우트는 **실패를 정상 분기로 설계한다**: 422 `no_transcript`를 돌려주고
 * 화면은 붙여넣기 창을 편다. 실패가 막다른 길이면 기능이 죽는다(설계 §1 목업).
 *
 * 제목·채널은 **oEmbed**(공개·키 불필요)로 따로 받는다 — 자막이 실패해도 제목은 채워
 * 주므로 붙여넣기 경로에서도 폼이 비지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { parseYouTubeId } from '@/lib/listenSubtitles';
import { detectLinkKind, cleanVideoTitle, paragraphize, stripCueNoise } from '@/lib/linkImport';
import { normalizeSupadataSegments } from '@/lib/server/media';

export const dynamic = 'force-dynamic';

/** 사용자별 레이트 리밋 — /api/study-paragraph 선례와 같은 모양(인스턴스 메모리). */
const rateLimitMap = new Map();
const RATE_LIMIT = 10;               // 분당·사용자 (설계 §3)
const WINDOW_MS = 60 * 1000;

function isRateLimited(key) {
  const now = Date.now();
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) if (now - v.start > WINDOW_MS) rateLimitMap.delete(k);
  }
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

/** 서버리스 벽시계 한도 안에서 끊는다 — 넘기면 사용자를 붙여넣기로 보낸다(설계 §8). */
const STEP_TIMEOUT_MS = 6000;

function withTimeout(promise, ms = STEP_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((resolve) => { setTimeout(() => resolve(null), ms); }),
  ]).catch(() => null);
}

/** 제목·채널 — 공개 oEmbed(키 불필요). 실패해도 반입은 계속된다. */
async function fetchOEmbed(videoId) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    { headers: { 'User-Agent': 'AnatomyStudio/1.0 (language-learning)' }, cache: 'no-store' },
  );
  if (!res.ok) return null;
  const j = await res.json();
  return { title: cleanVideoTitle(j?.title), channel: String(j?.author_name || '').trim() };
}

/** ① youtube-transcript — 미검증 경로. 막히면 조용히 다음으로. */
async function viaTranscript(videoId, langCode) {
  const { YoutubeTranscript } = await import('youtube-transcript');
  const items = await YoutubeTranscript.fetchTranscript(videoId, langCode ? { lang: langCode } : undefined);
  if (!items?.length) return null;
  // 잡음 제거는 붙여넣기 경로와 **같은 순수 함수**를 탄다 — 두 경로의 본문이 갈리지 않게.
  const lines = stripCueNoise(items.map((t) => t.text).join('\n'));
  return lines.length ? paragraphize(lines) : null;
}

/** ② Supadata — 키가 있을 때만. 정규화는 기보유 순수 함수(media.js). */
async function viaSupadata(videoId, langCode) {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({ videoId });
  if (langCode) params.set('lang', langCode);
  const res = await fetch(`https://api.supadata.ai/v1/youtube/transcript?${params}`, {
    headers: { 'x-api-key': key }, cache: 'no-store',
  });
  if (!res.ok) return null;
  const j = await res.json();
  const cues = normalizeSupadataSegments(j?.content);
  if (!cues.length) return null;
  const lines = stripCueNoise(cues.map((c) => c.text).join('\n'));
  return lines.length ? paragraphize(lines) : null;
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return Response.json({ error: 'unauth', message: '로그인이 필요해요.' }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return Response.json({ error: 'unauth', message: '세션이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
  if (isRateLimited(`u:${user.id}`)) {
    return Response.json({ error: 'rate_limited', message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }

  let body = {};
  try { body = await request.json(); } catch { /* 빈 본문 → 아래 판별에서 400 */ }
  const url = typeof body?.url === 'string' ? body.url.slice(0, 2000) : '';
  const langCode = typeof body?.langCode === 'string' ? body.langCode.slice(0, 8) : '';

  if (detectLinkKind(url) !== 'youtube') {
    return Response.json({ error: 'unsupported_url', message: '지금은 유튜브 주소만 가져올 수 있어요.' }, { status: 400 });
  }
  const videoId = parseYouTubeId(url);
  if (!videoId) {
    return Response.json({ error: 'unsupported_url', message: '영상 주소를 알아보지 못했어요.' }, { status: 400 });
  }

  const meta = (await withTimeout(fetchOEmbed(videoId))) || {};

  let text = await withTimeout(viaTranscript(videoId, langCode));
  let via = text ? 'transcript' : null;
  if (!text) {
    text = await withTimeout(viaSupadata(videoId, langCode));
    via = text ? 'supadata' : null;
  }

  if (!text) {
    // 정상 분기 — 화면은 이 신호로 붙여넣기 창을 편다(막다른 길 아님).
    return Response.json({
      error: 'no_transcript', videoId,
      title: meta.title || '', channel: meta.channel || '',
      message: '자막을 자동으로 가져오지 못했어요.',
    }, { status: 422 });
  }

  return Response.json({
    kind: 'youtube', videoId, via,
    title: meta.title || '', channel: meta.channel || '',
    text, chars: text.length,
  });
}
