import { createClient } from '@supabase/supabase-js';
import { fetchFromSource } from '../../../../lib/content-sources.js';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey ? { auth: { persistSession: false } } : {},
  );

  const today = new Date().toISOString().split('T')[0];
  const saved = { Japanese: 0, English: 0, errors: [] };

  // DB에서 활성 소스 조회, 없으면 기본값
  const { data: dbSources = [] } = await supabase
    .from('content_sources')
    .select('*')
    .eq('is_active', true)
    .order('language')
    .order('created_at');

  const activeSources = dbSources.length > 0 ? dbSources : [
    { language: 'Japanese', source_type: 'qiita',   config: { level: 'N2 상급' } },
    { language: 'Japanese', source_type: 'nhk_rss', config: { level: 'N3 중급' } },
    { language: 'English',  source_type: 'devto',   config: { level: 'B1 중급' } },
  ];

  // 언어별 그룹핑
  const byLang = { Japanese: [], English: [] };
  for (const s of activeSources) {
    if (byLang[s.language]) byLang[s.language].push(s);
  }

  // 각 언어별 수집 → 저장
  for (const [language, langSources] of Object.entries(byLang)) {
    const articles = [];

    for (const src of langSources) {
      const fetched = await fetchFromSource(src, 2);
      articles.push(...fetched);
    }

    for (const a of articles) {
      const sourceLabel = a.videoId?.startsWith('qiita_') ? 'qiita'
        : a.videoId?.startsWith('devto_') ? 'devto'
        : a.videoId?.startsWith('nhk_') ? 'nhk'
        : a.videoId?.startsWith('wikinews_') ? 'wikinews'
        : 'wikipedia';
      const { error } = await supabase.from('daily_suggestions').upsert({
        date: today,
        language,
        source: sourceLabel,
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
