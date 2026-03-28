import { createClient } from '@supabase/supabase-js';
import { fetchNHKEasyArticles } from '../../../../lib/youtube.js';
import { fetchEnglishArticles, fetchJapaneseArticles } from '../../../../lib/content-sources.js';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const today = new Date().toISOString().split('T')[0];
  const saved = { Japanese: 0, English: 0, errors: [] };

  // ── 일본어: NHK Web Easy → 실패 시 일본어 Wikipedia ──────────
  let jpArticles = await fetchNHKEasyArticles(3);
  if (!jpArticles || jpArticles.length === 0) {
    jpArticles = await fetchJapaneseArticles(3);
  }

  // ── 영어: Simple English Wikipedia ───────────────────────────
  const enArticles = await fetchEnglishArticles(3);

  // ── Supabase 저장 ──────────────────────────────────────────────
  for (const [language, articles] of [['Japanese', jpArticles], ['English', enArticles]]) {
    for (const a of (articles || [])) {
      const { error } = await supabase.from('daily_suggestions').upsert({
        date: today,
        language,
        source: a.videoId?.startsWith('wiki_') ? 'wikipedia' : 'nhk_easy',
        video_id: a.videoId,
        title: a.title,
        channel_name: a.channelName,
        thumbnail_url: a.thumbnail,
        transcript: a.transcript,
        level: a.level,
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
