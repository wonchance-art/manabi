import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { fetchYoutubeChannel } from '../server/youtubeChannel';
import { fetchYoutubeCc, isCreativeCommonsLicense } from '../server/youtubeShareable';
import {
  MAX_CAPTION_PROBES, YOUTUBE_KEY_NAMES, YT_API_BASE, YT_DAILY_UNIT_CAP, YT_UNIT_COST, createLedger, listableProbe, normalizeVideo,
  reportYoutubeFailure, scrubKey, ytApi, youtubeApiKey,
} from '../server/youtubeDataApi';
import { DEFAULT_SOURCES } from '../suggestionSources';

/**
 * 계약(YT-API-001 · 2026-11-08 KST, 오너 b안): 영상 수집은 공식 YouTube Data API v3로만 한다.
 *  ① 키(YOUTUBE_DATA_API_KEY)가 없으면 네트워크 0 · 0건 · 로그 한 줄(fail-closed, 오류 아님)
 *  ② 카드는 전부 목록만(transcript 키 없음 · source youtube_ondemand) — 본문은 클릭 때 /api/import/link
 *  ③ 그 언어 자막 · 임베드 판정(정본 isListable) · CC는 status.license로 재확인 · captions.list(50단위)는 소스당 상한
 *  ④ 비공식 클라이언트(youtubei.js)를 수집 경로에서 부르지 않는다 · 키를 로그/오류에 싣지 않는다
 * 응답 모양은 공식 문서 예시 구조(channels · playlistItems · search · videos · captions).
 */

const KEY = 'test-key-not-real';
/** 테스트마다 새 하루 장부 · 기록 가짜(모듈 공용 장부를 건드리지 않는다). */
const fresh = () => ({ ledger: createLedger(), recordError: async () => 'recorded' });
function fakeApi(handlers) {
  const calls = [];
  const fetchFn = async (url) => {
    const u = new URL(url);
    const endpoint = u.pathname.split('/').pop();
    calls.push({ endpoint, params: Object.fromEntries(u.searchParams) });
    const body = handlers[endpoint]?.(Object.fromEntries(u.searchParams));
    if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
    if (body?.__status) return { ok: false, status: body.__status, json: async () => body.json || {} };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchFn, calls };
}
const video = (id, { title = `T ${id}`, channelTitle = 'Uploader', caption = 'true', embeddable = true, license = 'youtube', lang = 'en' } = {}) => ({
  id,
  snippet: { title, channelTitle, defaultAudioLanguage: lang, thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } } },
  contentDetails: { caption },
  status: { embeddable, license },
});

describe('YT-API-001 ① 키가 없으면 fail-closed', () => {
  it('키 없음 → 네트워크 0 · 0건 · 로그 한 줄(채널 · CC 둘 다)', async () => {
    const { fetchFn, calls } = fakeApi({});
    const logs = [];
    const log = (...a) => logs.push(a.join(' '));
    expect(await fetchYoutubeChannel(2, { handle: '@VOALearningEnglish', langCode: 'en' }, { ...fresh(), apiKey: null, fetch: fetchFn, log })).toEqual([]);
    expect(await fetchYoutubeCc(2, { query: 'english lesson', langCode: 'en' }, { ...fresh(), apiKey: null, fetch: fetchFn, log })).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(logs).toHaveLength(2);
    for (const l of logs) expect(l).toMatch(/YouTube API 키 없음/);
  });

  it('키 이름 우선순위 YOUTUBE_DATA_API_KEY → YOUTUBE_API_KEY(오너가 3월에 등록해 둔 같은 Data API 키) · 빈 값은 없음과 같다', () => {
    expect(YOUTUBE_KEY_NAMES).toEqual(['YOUTUBE_DATA_API_KEY', 'YOUTUBE_API_KEY']);
    expect(youtubeApiKey({ YOUTUBE_DATA_API_KEY: ' abc ', YOUTUBE_API_KEY: 'old' })).toBe('abc');
    expect(youtubeApiKey({ YOUTUBE_API_KEY: ' old ' })).toBe('old');
    expect(youtubeApiKey({ YOUTUBE_DATA_API_KEY: '  ', YOUTUBE_API_KEY: 'old' })).toBe('old');
    expect(youtubeApiKey({ YOUTUBE_DATA_API_KEY: '' })).toBeNull();
    expect(youtubeApiKey({})).toBeNull();
  });
});

describe('YT-API-001 ② 채널 수집 — 목록만', () => {
  const api = () => fakeApi({
    channels: (p) => (p.forHandle === '@innerFrench'
      ? { items: [{ snippet: { title: 'innerFrench' }, contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] } : { items: [] }),
    playlistItems: () => ({ items: ['vid00000001', 'vid00000002', 'vid00000003'].map((videoId) => ({ contentDetails: { videoId } })) }),
    videos: () => ({ items: [video('vid00000001', { lang: 'fr' }), video('vid00000002', { lang: 'fr', caption: 'false' }), video('vid00000003', { lang: 'fr', embeddable: false })] }),
  });

  it('그 언어 자막 · 임베드 가능만 카드로, channelName은 채널 자신의 제목, transcript 키 없음', async () => {
    const { fetchFn, calls } = api();
    const out = await fetchYoutubeChannel(2, { handle: '@innerFrench', langCode: 'fr', level: 'B1 중급' }, { ...fresh(), apiKey: KEY, fetch: fetchFn, log: () => {} });
    expect(out.map((a) => a.videoId)).toEqual(['vid00000001']);   // 자막 없음 · 임베드 불가는 뺀다
    expect(out[0]).toMatchObject({ channelName: 'innerFrench', source: 'youtube_ondemand', level: 'B1 중급' });
    expect('transcript' in out[0]).toBe(false);
    expect(calls.map((c) => c.endpoint)).toEqual(['channels', 'playlistItems', 'videos']);   // 3단위
    for (const c of calls) expect(c.params.key).toBe(KEY);
  });

  it('퍼블릭 도메인 설정(VOA)이어도 본문을 담지 않는다 — 공식 API는 남의 자막 본문을 못 받는다', async () => {
    const { fetchFn } = api();
    const out = await fetchYoutubeChannel(2, { handle: '@innerFrench', langCode: 'fr', license: 'public-domain' }, { ...fresh(), apiKey: KEY, fetch: fetchFn, log: () => {} });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('youtube_ondemand');
    expect('transcript' in out[0]).toBe(false);
  });

  it('핸들을 못 찾거나 API가 실패하면 0건 · 오류 문구에 키가 없다', async () => {
    const logs = [];
    const { fetchFn } = api();
    expect(await fetchYoutubeChannel(2, { handle: '@nobody', langCode: 'fr' }, { ...fresh(), apiKey: KEY, fetch: fetchFn, log: (m) => logs.push(m) })).toEqual([]);
    const quota = fakeApi({ channels: () => ({ __status: 403, json: { error: { errors: [{ reason: 'quotaExceeded' }] } } }) });
    expect(await fetchYoutubeChannel(2, { handle: '@innerFrench', langCode: 'fr' }, { ...fresh(), apiKey: KEY, fetch: quota.fetchFn, log: (m) => logs.push(m) })).toEqual([]);
    expect(logs.join('\n')).toMatch(/youtube_api_channels_403_quotaExceeded/);
    expect(logs.join('\n')).not.toContain(KEY);
  });
});

describe('YT-API-001 ③ 판정 — CC 재확인 · 자막 언어', () => {
  it('CC 검색: 검색 필터를 걸고, status.license가 creativeCommon인 것만 통과', async () => {
    const { fetchFn, calls } = fakeApi({
      search: () => ({ items: ['cc1', 'std1', 'cc2'].map((videoId) => ({ id: { videoId } })) }),
      videos: () => ({ items: [video('cc1', { license: 'creativeCommon' }), video('std1', { license: 'youtube' }), video('cc2', { license: 'creativeCommon' })] }),
    });
    const out = await fetchYoutubeCc(2, { query: 'english lesson', langCode: 'en', level: 'B1 중급' }, { ...fresh(), apiKey: KEY, fetch: fetchFn, log: () => {} });
    expect(out.map((a) => a.videoId)).toEqual(['cc1', 'cc2']);
    for (const a of out) { expect(a.source).toBe('youtube_ondemand'); expect('transcript' in a).toBe(false); }
    const search = calls.find((c) => c.endpoint === 'search').params;
    expect(search).toMatchObject({ videoLicense: 'creativeCommon', videoCaption: 'closedCaption', videoEmbeddable: 'true', relevanceLanguage: 'en', type: 'video' });
    expect(isCreativeCommonsLicense('creativeCommon')).toBe(true);
    expect(isCreativeCommonsLicense('youtube')).toBe(false);
    expect(isCreativeCommonsLicense(null)).toBe(false);
  });

  it('오디오 언어가 다르거나 없으면 captions.list로 트랙 언어를 확인하고, 그 확인은 소스당 상한이 있다', async () => {
    const { fetchFn, calls } = fakeApi({ captions: (p) => ({ items: p.videoId === 'ja-track' ? [{ snippet: { language: 'ja' } }] : [{ snippet: { language: 'en' } }] }) });
    const opts = { key: KEY, fetch: fetchFn };
    const budget = { left: 2 };
    expect(await listableProbe(normalizeVideo(video('ja-track', { lang: null })), 'ja', opts, budget)).toMatchObject({ captionLangs: ['ja'] });
    expect(await listableProbe(normalizeVideo(video('en-only', { lang: 'en' })), 'ja', opts, budget)).toMatchObject({ captionLangs: ['en'] });
    expect(await listableProbe(normalizeVideo(video('over-budget', { lang: null })), 'ja', opts, budget)).toMatchObject({ captionLangs: [] });
    expect(calls.filter((c) => c.endpoint === 'captions')).toHaveLength(2);
    expect(MAX_CAPTION_PROBES).toBe(0);    // 하루 약 311단위 안에는 captions.list(50) 자리가 없다 — 쿼터 메모(docs/design/youtube-data-api-20261108.md)
    // 오디오 언어가 같으면 captions.list를 부르지 않는다(0단위)
    expect(await listableProbe(normalizeVideo(video('same', { lang: 'ja-JP' })), 'ja', opts, { left: 0 })).toMatchObject({ captionLangs: ['ja'] });
    // 자막이 아예 없으면 거절
    expect(await listableProbe(normalizeVideo(video('none', { caption: 'false' })), 'ja', opts, { left: 5 })).toMatchObject({ captionLangs: [] });
  });
});

describe('YT-API-001 ⑤ 키 거절 · 하루 상한 — 0건으로 끝나고 크론을 깨지 않는다', () => {
  const ok = { channels: () => ({ items: [{ snippet: { title: 'C' }, contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] }),
    playlistItems: () => ({ items: [{ contentDetails: { videoId: 'v1' } }] }), videos: () => ({ items: [video('v1', { lang: 'en' })] }),
    search: () => ({ items: [{ id: { videoId: 'v1' } }] }) };

  for (const [status, reason] of [[400, 'keyInvalid'], [403, 'forbidden'], [403, 'quotaExceeded'], [403, 'ipRefererBlocked']]) {
    it(`${status} ${reason}: 0건 · 그날 나머지 호출은 보내지 않음 · 오류 기록 하루 한 줄(키 흔적 없음)`, async () => {
      const deps = fresh();
      const records = [];
      deps.recordError = async (ev) => { records.push(ev); return 'recorded'; };
      const bad = fakeApi({ channels: () => ({ __status: status, json: { error: { message: `API key ${KEY} AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE1234 not valid`, errors: [{ reason }] } } }) });
      const logs = [];
      const log = (m) => logs.push(m);
      expect(await fetchYoutubeChannel(2, { handle: '@a', langCode: 'en' }, { ...deps, apiKey: KEY, fetch: bad.fetchFn, log })).toEqual([]);
      expect(await fetchYoutubeChannel(2, { handle: '@b', langCode: 'en' }, { ...deps, apiKey: KEY, fetch: bad.fetchFn, log })).toEqual([]);
      expect(await fetchYoutubeCc(2, { query: 'q', langCode: 'en' }, { ...deps, apiKey: KEY, fetch: bad.fetchFn, log })).toEqual([]);
      expect(bad.calls).toHaveLength(1);                                    // 첫 거절 뒤로는 보내지 않는다
      expect(records).toHaveLength(1);                                      // 하루 한 줄
      expect(records[0]).toMatchObject({ source: 'server', kind: 'server.youtube-collect', route: '/api/cron/fetch-suggestions' });
      expect(records[0].message).toBe(`youtube_api_channels_${status}_${reason}`);
      const all = JSON.stringify(records) + logs.join('\n');
      expect(all).not.toContain(KEY);
      expect(all).not.toMatch(/AIza/);
    });
  }

  it('기록 실패 · 기록 함수 throw도 삼킨다(크론은 0건으로 계속)', async () => {
    const bad = fakeApi({ channels: () => ({ __status: 403, json: { error: { errors: [{ reason: 'forbidden' }] } } }) });
    const deps = { ledger: createLedger(), recordError: async () => { throw new Error('db down'); } };
    await expect(fetchYoutubeChannel(2, { handle: '@a', langCode: 'en' }, { ...deps, apiKey: KEY, fetch: bad.fetchFn, log: () => {} })).resolves.toEqual([]);
  });

  it('하루 상한: 기본 소스 구성의 하루 비용은 상한 안이고, 상한을 넘을 호출은 보내지 않는다', async () => {
    const yt = DEFAULT_SOURCES.filter((s) => s.source_type.startsWith('youtube_'));
    const daily = yt.reduce((n, s) => n + (s.source_type === 'youtube_channel'
      ? YT_UNIT_COST.channels + YT_UNIT_COST.playlistItems + YT_UNIT_COST.videos
      : YT_UNIT_COST.search + YT_UNIT_COST.videos), 0);
    expect(daily).toBeLessThanOrEqual(YT_DAILY_UNIT_CAP);
    expect(YT_DAILY_UNIT_CAP).toBeLessThanOrEqual(320);                   // 설계 메모 약 311 + 채널 해석 4 + 여유
    // 실제로 기본 소스를 하루 돌린다 — 모든 호출이 상한 안, 같은 날 두 번째 바퀴는 상한에 걸려 보내지 않는다
    const deps = fresh();
    const api = fakeApi(ok);
    const runAll = async () => {
      for (const s of yt) {
        const fn = s.source_type === 'youtube_channel' ? fetchYoutubeChannel : fetchYoutubeCc;
        await fn(2, s.config, { ...deps, apiKey: KEY, fetch: api.fetchFn, log: () => {} });
      }
    };
    await runAll();
    const spent = api.calls.reduce((n, c) => n + YT_UNIT_COST[c.endpoint], 0);
    expect(spent).toBe(daily);
    expect(deps.ledger.used).toBe(daily);
    const before = api.calls.length;
    await runAll();
    const second = api.calls.slice(before).reduce((n, c) => n + YT_UNIT_COST[c.endpoint], 0);
    expect(spent + second).toBeLessThanOrEqual(YT_DAILY_UNIT_CAP);
    // 상한 걸림은 오류 기록 대상이 아니다
    expect(await reportYoutubeFailure(new Error('youtube_quota_cap_search'), { ledger: createLedger(), record: async () => 'recorded' })).toBe('skipped');
  });

  it('날짜(KST)가 바뀌면 장부 · 차단이 새로 시작한다', async () => {
    const ledger = createLedger();
    const bad = fakeApi({ videos: () => ({ __status: 403, json: { error: { errors: [{ reason: 'quotaExceeded' }] } } }) });
    const day1 = Date.parse('2026-11-08T15:00:00Z'); // 11/9 00:00 KST
    await expect(ytApi('videos', { id: 'x' }, { key: KEY, fetch: bad.fetchFn, ledger, now: day1 })).rejects.toThrow(/403_quotaExceeded/);
    await expect(ytApi('videos', { id: 'x' }, { key: KEY, fetch: bad.fetchFn, ledger, now: day1 + 3600e3 })).rejects.toThrow(/blocked/);
    const good = fakeApi(ok);
    await expect(ytApi('videos', { id: 'x' }, { key: KEY, fetch: good.fetchFn, ledger, now: day1 + 86400e3 })).resolves.toBeTruthy();
    expect(ledger.used).toBe(1);
  });

  it('scrubKey — 키 값 그대로 · AIza 모양을 지운다', () => {
    expect(scrubKey(`x ${KEY} y AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345 z`, KEY)).toBe('x [key] y [key] z');
  });
});

describe('YT-API-001 ④ 배선', () => {
  const src = (f) => fs.readFileSync(f, 'utf8');
  it('수집 경로가 비공식 클라이언트를 부르지 않는다', () => {
    for (const f of ['src/lib/server/youtubeChannel.js', 'src/lib/server/youtubeShareable.js', 'src/lib/server/youtubeDataApi.js']) {
      const code = src(f).split('\n').filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join('\n');
      expect(code, f).not.toMatch(/youtubei\.js|Innertube|getBasicInfo/);
    }
    expect(YT_API_BASE).toBe('https://www.googleapis.com/youtube/v3');
  });
  it('키는 서버 전용 이름이고 브라우저 노출 이름(NEXT_PUBLIC_)이 아니다', () => {
    expect(src('src/lib/server/youtubeDataApi.js')).toMatch(/YOUTUBE_DATA_API_KEY/);
    expect(src('src/lib/server/youtubeDataApi.js')).toMatch(/YOUTUBE_API_KEY/);
    expect(src('src/lib/server/youtubeDataApi.js')).not.toMatch(/NEXT_PUBLIC_YOUTUBE/);
  });
});
