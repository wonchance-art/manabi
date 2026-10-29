// 추천 읽을거리 한 편(/suggestions/[id]) 서버 대역 — e2e 서버(e2e/server-fetch-mock.mjs)가 이 id 하나만 daily_suggestions 행으로 돌려준다.
// 다른 id는 빈 결과(없는 글)다. 본문은 이 저장소에서 지은 합성 글이다(실제 기사 · 방송 원문이 아니다).
export const SUGGESTION_FIXTURE = Object.freeze({
  id: '5f5e2e00-0000-4000-8000-00000000f5f5',
  date: '2026-10-23',
  language: 'Japanese',
  source: 'rss_e2e',
  video_id: 'rss_e2e_reading_1',
  title: '駅前の小さな図書館で、毎朝少しずつ読む',
  channel_name: 'manabi e2e 読みもの',
  thumbnail_url: null,
  level: 'N4',
  transcript: [
    '駅前に小さな図書館があります。朝七時に開くので、会社に行く前に寄る人が多いです。',
    '私は毎朝その図書館で十五分だけ本を読みます。長い時間は読めませんが、毎日続けると一か月で何冊も読めることに気づきました。',
    '図書館の人は、新しい本が入るとすぐに入口の棚に並べてくれます。季節の料理の本や、近くの町を歩く地図の本など、読みやすい本が多いです。',
    '知らない言葉があったら、小さいノートに書いておきます。家に帰ってから辞書で調べて、次の日にもう一度同じページを読みます。',
    'こうして読んだ言葉は、なかなか忘れません。少しずつでも、自分のペースで続けることがいちばん大切だと思います。',
  ].join('\n\n'),
  material_id: null,
});
