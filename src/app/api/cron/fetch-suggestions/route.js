import { createClient } from '@supabase/supabase-js';
import { fetchSuggestions, fetchNHKEasyArticles } from '../../../../lib/youtube.js';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeKey) {
    return Response.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const today = new Date().toISOString().split('T')[0];
  const saved = { Japanese: 0, English: 0, errors: [] };

  // ── 일본어: NHK Web Easy 우선 ──────────────────
  const nhk = await fetchNHKEasyArticles(3);
  let jpVideos = nhk
    ? nhk.map(a => ({ ...a, level: 'N3 중급', source: 'nhk_easy' }))
    : [];

  // NHK 실패 시 YouTube 키워드 검색
  if (jpVideos.length === 0) {
    const yt = await fetchSuggestions(youtubeKey, 3);
    jpVideos = yt.Japanese.map(v => ({ ...v, source: 'youtube' }));
  }

  // ── 영어: YouTube ──────────────────────────────
  const yt = await fetchSuggestions(youtubeKey, 3);
  const enVideos = yt.English.map(v => ({ ...v, source: 'youtube' }));

  // ── Supabase 저장 ──────────────────────────────
  for (const [language, videos] of [['Japanese', jpVideos], ['English', enVideos]]) {
    for (const v of videos) {
      const { error } = await supabase.from('daily_suggestions').upsert({
        date: today,
        language,
        source: v.source,
        video_id: v.videoId,
        title: v.title,
        channel_name: v.channelName,
        thumbnail_url: v.thumbnail,
        transcript: v.transcript,
        level: v.level,
      }, { onConflict: 'date,video_id' });

      if (error) saved.errors.push(`${language}: ${error.message}`);
      else saved[language]++;
    }
  }

  return Response.json({
    date: today,
    japanese: saved.Japanese,
    english: saved.English,
    errors: saved.errors,
  });
}
