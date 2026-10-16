-- youtube-sources.sql 되돌리기 (2026-10-16)
begin;
-- ① 추가한 영상 소스 행 삭제(이 파일이 넣은 이름만)
delete from content_sources
where source_type in ('youtube_channel', 'youtube_cc')
  and name in ('YouTube · VOA Learning English', 'YouTube · Comprehensible Japanese', 'YouTube · Onomappu',
               'YouTube CC BY · 日本語 学習', 'YouTube CC BY · english lesson');
-- ② 끈 중복 행 다시 켜기 — 같은 설정의 쌍둥이가 있는 꺼진 행(적용 전에는 꺼진 행이 0이었다)
update content_sources c set is_active = true
where not c.is_active
  and exists (
    select 1 from content_sources o
    where o.id <> c.id and o.language = c.language and o.source_type = c.source_type and o.config = c.config
  );
commit;
