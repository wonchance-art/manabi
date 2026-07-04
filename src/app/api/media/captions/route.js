// POST /api/media/captions — 「듣고 읽기」 실험용 자막 트랙 추출.
// body: { videoId, lang }  — lang은 자막 언어 코드(예: 'ja', 'en', 'fr', 'zh').
//
// 시도 체인(Vercel 데이터센터 IP에서 pot/proof-of-origin 강제로 인한 지속 차단 대응):
//   step 1 (transcript): getInfo(WEB) → getTranscript() get_transcript 엔드포인트.
//       pot 불필요 경로지만 DC IP에서 지속 400 확인됨 → 재시도 1회로 축소(시간 절약).
//   step 2 (web): WEB caption_tracks base_url fetch(json3 우선, XML 폴백).
//       WEB timedtext는 pot을 요구해 DC IP에서 실패하는 것으로 관측됨.
//   step 3 (android): getInfo(videoId, { client: 'ANDROID' }) → caption_tracks base_url fetch.
//       ANDROID/iOS 클라이언트 자막 base_url은 pot 없이 열리는 사례가 커뮤니티에 보고됨(가설).
//   step 4 (ios): getInfo(videoId, { client: 'IOS' }) 동일 — ANDROID 실패 시.
//   step 5: 전부 실패 → 404(자막 없음)/409(요청 언어 없음, available 동봉)/502(추출 실패) 안내.
//
// 각 단계 실패는 `[media/captions] step N (label) failed: message`로 로깅해 어느 단계까지
// 갔는지 로그만으로 판독 가능. 성공 응답에는 `source`('transcript'|'web'|'android'|'ios')를
// 붙여 디버깅을 돕는다(클라는 무시 가능).
//
// getInfo 시그니처(youtubei.js@17.2.0, node_modules/dist/src/Innertube.js·types 확인):
//   getInfo(target, options?) / options.client: InnerTubeClient
//   InnerTubeClient = 'IOS'|'WEB'|'MWEB'|'ANDROID'|'ANDROID_VR'|... — 'ANDROID'/'IOS' 유효.
//
// 비공식 라이브러리(youtubei.js) 사용 — 오너 승인. 서버 전용. 전면 try/catch로
// 라이브러리 내부 예외가 500 스택으로 새지 않게 하고, 사용자에겐 한국어 안내만.
//
// 캐시: 라우트 내 메모리 Map(비영속, 키 videoId+lang, 상한 100). 성공 응답만 저장.

import { createClient } from '@supabase/supabase-js';
import { Innertube, Log } from 'youtubei.js';
import {
  parseCaptionData,
  selectCaptionTrack,
  withCaptionFormat,
  normalizeTranscriptSegments,
  matchTranscriptLanguage,
} from '@/lib/server/media';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// youtubei.js 내부 파서 경고([YOUTUBEJS][Text] 등) 소음 억제. 우리 [media/*] 로그는 유지.
Log.setLevel(Log.Level.NONE);

let innertubePromise = null;
function getInnertube() {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({ retrieve_player: false }).catch((e) => {
      innertubePromise = null;
      throw e;
    });
  }
  return innertubePromise;
}

// ── 메모리 캐시 (비영속, LRU-ish 상한 100) ──
const CACHE_MAX = 100;
const cache = new Map(); // `${videoId}:${lang}` → payload
function cacheGet(key) {
  if (!cache.has(key)) return null;
  const val = cache.get(key);
  cache.delete(key); cache.set(key, val); // 최근 사용으로 이동
  return val;
}
function cacheSet(key, val) {
  cache.set(key, val);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

async function requireUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { error: '로그인이 필요합니다.', status: 401 };
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { error: '세션이 만료됐어요. 다시 로그인해주세요.', status: 401 };
  return { user };
}

async function fetchTrack(baseUrl) {
  // json3 우선 — 파싱이 견고. 실패/빈 결과면 원본(XML) 재시도.
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  };
  const attempts = [withCaptionFormat(baseUrl, 'json3'), baseUrl];
  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const text = await res.text();
      const cues = parseCaptionData(text);
      if (cues.length > 0) return cues;
    } catch {
      // 다음 시도
    }
  }
  return [];
}

// ① get_transcript 경로 — 요청 언어로 전환 후 세그먼트를 큐로 정규화.
// 요청 언어가 자막 언어 메뉴에 없으면 [] 반환(폴백/409에 위임). throw는 호출부가 캐치.
async function loadTranscriptCues(info, lang) {
  const transcript = await info.getTranscript(); // 자막 패널 없으면 throw
  const languages = Array.isArray(transcript?.languages) ? transcript.languages : [];

  let selected = transcript;
  if (lang) {
    const match = matchTranscriptLanguage(languages, lang);
    if (!match && languages.length > 0) return { cues: [], kind: '' }; // 요청 언어 없음 → 폴백에 위임
    if (match && match !== transcript.selectedLanguage) {
      selected = await transcript.selectLanguage(match);
    }
  }

  const segments = selected?.transcript?.content?.body?.initial_segments;
  const cues = normalizeTranscriptSegments(segments);
  const selName = String(selected?.selectedLanguage || '').toLowerCase();
  const kind = /auto|자동/.test(selName) ? 'asr' : 'manual';
  return { cues, kind };
}

// get_transcript 엔드포인트는 간헐적으로 400을 낸다(YouTube.js 오픈 이슈 #1102 — 재시도 시
// 성공하는 사례 보고, 라이브러리·릴리스에 수정 없음). throw(400 등)는 짧은 백오프로 재시도하고,
// 언어 미스매치 같은 정상적 빈 결과({cues:[]})는 재시도하지 않고 그대로 폴백에 위임한다.
async function loadTranscriptCuesWithRetry(info, lang, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await loadTranscriptCues(info, lang);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const rl = rateLimit(getClientKey(request, auth.user.id), { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return Response.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 요청이에요.' }, { status: 400 });
  }
  const videoId = typeof body?.videoId === 'string' ? body.videoId.trim() : '';
  const lang = typeof body?.lang === 'string' ? body.lang.trim().toLowerCase() : '';
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return Response.json({ error: '영상을 인식하지 못했어요.' }, { status: 400 });
  }

  const cacheKey = `${videoId}:${lang}`;
  const cached = cacheGet(cacheKey);
  if (cached) return Response.json(cached);

  try {
    const yt = await getInnertube();

    let info;
    try {
      info = await yt.getInfo(videoId);
    } catch {
      return Response.json(
        { error: '영상 정보를 불러오지 못했어요. 비공개·삭제된 영상일 수 있어요.' },
        { status: 404 }
      );
    }

    // available은 클라 언어 선택 UI용 — caption_tracks에서 항상 계산(재요청 식별자 code + 라벨 name).
    const tracks = info?.captions?.caption_tracks;
    const trackList = Array.isArray(tracks) ? tracks : [];
    const { track, available } = selectCaptionTrack(trackList, lang);

    // 성공 payload를 캐시에 저장하고 응답한다(공통 종료 경로).
    const finish = (payload) => {
      cacheSet(cacheKey, payload);
      return Response.json(payload);
    };

    // ── step 1: get_transcript (pot 불필요 경로 — DC IP 지속 400이라 재시도 1회로 축소) ──
    try {
      const { cues, kind } = await loadTranscriptCuesWithRetry(info, lang, 1);
      if (cues.length > 0) {
        return finish({ cues, lang: lang || '', kind, available, source: 'transcript' });
      }
    } catch (e) {
      console.error(`[media/captions] step 1 (transcript) failed: ${e?.message}`);
    }

    // ── step 2: WEB caption_tracks base_url fetch ──
    if (track) {
      try {
        const cues = await fetchTrack(track.base_url);
        if (cues.length > 0) {
          return finish({
            cues,
            lang: track.language_code || lang,
            kind: track.kind || 'manual',
            available,
            source: 'web',
          });
        }
        throw new Error('0 cues from base_url');
      } catch (e) {
        console.error(`[media/captions] step 2 (web) failed: ${e?.message}`);
      }
    } else {
      console.error(`[media/captions] step 2 (web) failed: no matching track for lang="${lang}"`);
    }

    // ── step 3·4: ANDROID/iOS 클라이언트 caption base_url fetch (pot 우회 가설) ──
    // WEB과 별개 클라이언트로 getInfo를 다시 호출 → 각자의 caption_tracks에서 요청 언어 선택 후 fetch.
    for (const { step, label, client } of [
      { step: 3, label: 'android', client: 'ANDROID' },
      { step: 4, label: 'ios', client: 'IOS' },
    ]) {
      try {
        const clientInfo = await yt.getInfo(videoId, { client });
        const clientTracks = clientInfo?.captions?.caption_tracks;
        const list = Array.isArray(clientTracks) ? clientTracks : [];
        const sel = selectCaptionTrack(list, lang);
        if (!sel.track) {
          throw new Error(`no matching track for lang="${lang}" (tracks: ${list.length})`);
        }
        const cues = await fetchTrack(sel.track.base_url);
        if (cues.length === 0) throw new Error('0 cues from base_url');
        return finish({
          cues,
          lang: sel.track.language_code || lang,
          kind: sel.track.kind || 'manual',
          // WEB에서 이미 가용 목록을 얻었으면 UI 일관성 위해 유지, 없으면 이 클라이언트 목록 사용.
          available: available.length > 0 ? available : sel.available,
          source: label,
        });
      } catch (e) {
        console.error(`[media/captions] step ${step} (${label}) failed: ${e?.message}`);
      }
    }

    // ── step 5: 전부 실패 → 안내 ──
    if (trackList.length === 0) {
      return Response.json({ error: '이 영상에는 자막이 없어요.' }, { status: 404 });
    }
    if (!track) {
      // 요청 언어 트랙 없음 — 클라가 고르도록 가용 목록 반환
      return Response.json(
        { error: '요청한 언어 자막이 없어요. 아래에서 언어를 골라주세요.', available },
        { status: 409 }
      );
    }
    return Response.json(
      { error: '자막을 가져오지 못했어요.', available },
      { status: 502 }
    );
  } catch (err) {
    console.error('[api/media/captions] error:', err?.message);
    return Response.json(
      { error: '자막을 가져오지 못했어요. 직접 붙여넣기로 학습할 수 있어요.' },
      { status: 502 }
    );
  }
}
