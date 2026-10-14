// 레벨별 단어 · 문형 목록 라우트 공용(서버) — /{japanese,chinese}/{vocab,bunkei}/{레벨} 네 페이지가 같은 조립을 쓴다.
import { notFound } from 'next/navigation';
import LevelListPage from '@/views/LevelListPage';
import { levelListData } from '@/lib/levelListData';
import { LEVEL_LIST_LANGS, levelLabel } from '@/lib/levelList';

const KIND_LABEL = { vocab: '단어', bunkei: '문형' };

export function levelListRoute(lang, kind) {
  const conf = LEVEL_LIST_LANGS[lang];
  return {
    generateStaticParams: () => conf.levels.map(key => ({ level: key.toLowerCase() })),
    async generateMetadata({ params }) {
      const { level } = await params;
      const key = String(level || '').toUpperCase();
      if (!conf.levels.includes(key)) return {};
      const title = `${levelLabel(key)} ${KIND_LABEL[kind]} | ${conf.name}`;
      const description = `${conf.name} ${levelLabel(key)} ${KIND_LABEL[kind]} 목록 — 뜻 · 예문 · 듣기, 단어는 바로 복습에 저장`;
      return { title, description, alternates: { canonical: `/${lang}/${kind}/${key.toLowerCase()}` }, openGraph: { title, description } };
    },
    async Page({ params }) {
      const { level } = await params;
      const data = await levelListData(lang, kind, level);
      if (!data) notFound();
      return <LevelListPage {...data} />;
    },
  };
}
