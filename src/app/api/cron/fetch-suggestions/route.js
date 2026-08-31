import { createClient } from '@supabase/supabase-js';
import { kstDateString } from '@/lib/growthStats';
import { fetchFromSource } from '../../../../lib/content-sources.js';
import { groupByLanguage, resolveActiveSources, suggestionSourceLabel } from '../../../../lib/suggestionSources.js';

export async function GET(request) {
  // CRON_SECRET 미설정 시 "Bearer undefined" 통과 방지 — fail-closed.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
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

  // KST 날짜 정본 — 이 크론은 15:00 UTC(=KST 자정)에 돌므로 UTC 날짜는 'KST 어제'가 된다
  const today = kstDateString();
  const saved = {};
  const errors = [];

  // is_active로 거르지 **않고** 전부 읽는다. 「그 언어가 DB에 설정돼 있는가」와 「지금 켜져
  // 있는가」는 다른 질문이고, 아래 기본값 보충이 전자를 알아야 하기 때문이다.
  const { data: rows } = await supabase
    .from('content_sources')
    .select('*')
    .order('language')
    .order('created_at');
  const dbSources = rows || [];

  // 편성 결정 두 가지(기본값 언어별 보충·언어 그룹핑)는 순수 함수로 빼서 계약을 걸었다.
  // 둘 다 공급이 ja/en에 갇혀 있던 원인이라, 라우트 안에 두면 회귀를 잡을 수 없다.
  const byLang = groupByLanguage(resolveActiveSources(dbSources));

  // 각 언어별 수집 → 저장
  for (const [language, langSources] of byLang) {
    saved[language] = 0;
    const articles = [];

    for (const src of langSources) {
      const fetched = await fetchFromSource(src, 2);
      articles.push(...fetched);
    }

    for (const a of articles) {
      // 라벨 판정은 순수 함수로 뺐다 — 영상 소스는 videoId가 **실제 유튜브 id**여야 해서
      // 접두사 체인으로 못 가른다(클릭 시점에 그 id로 주소를 만든다).
      const sourceLabel = suggestionSourceLabel(a);
      const { error } = await supabase.from('daily_suggestions').upsert({
        date: today,
        language,
        source: sourceLabel,
        video_id: a.videoId,
        title: a.title,
        channel_name: a.channelName,
        thumbnail_url: a.thumbnail,
        transcript: a.transcript ?? null,   // 영상 소스는 주지 않는다 → NULL(본문 복제 0)
        level: a.level,
      }, { onConflict: 'date,video_id' });

      if (error) errors.push(`${language}: ${error.message}`);
      else saved[language]++;
    }
  }

  // 언어별 집계를 그대로 싣는다(예전의 japanese/english 두 칸 고정에서 확장).
  // japanese/english는 Vercel 로그를 읽던 결을 위해 남긴다.
  return Response.json({
    date: today,
    saved,
    japanese: saved.Japanese ?? 0,
    english: saved.English ?? 0,
    errors,
  });
}
