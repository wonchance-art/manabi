// 레벨별 단어 · 문형 · 한자 목록 라우트 공용(서버) — /{japanese,chinese}/{vocab,bunkei}/{레벨}과 /chinese/hanzi/{레벨}이 같은 조립을 쓴다.
import { notFound } from 'next/navigation';
import { levelListData } from '@/lib/levelListData';
import { LEVEL_KIND_LABEL as KIND_LABEL, LEVEL_LIST_LANGS, levelKinds, levelLabel } from '@/lib/levelList';

// View = 그 라우트의 화면. 단어는 새 단어 페이지(오너 확정 2026-10-19 KST)를 각 라우트가 넘긴다 — HSK = LevelWordPage, JLPT = JlptWordPage.
// 일본어 라우트가 중국어 화면 부품을 불러오지 않게(간체 글꼴 범위 · fontScope 계약).
// 문형 · 한자 목록(LevelListPage)도 그 라우트가 넘긴다 — 여기서 기본값으로 부르면 서버 모듈의 클라이언트 참조라 쓰지 않는 단어 라우트의
// 첫 JS(LevelListPage + 딸린 모듈)와 level-list.css까지 실렸다(JS-CRIT-001 2026-10-25 KST 빌드 실측).
export function levelListRoute(lang, kind, View) {
  const conf = LEVEL_LIST_LANGS[lang];
  return {
    generateStaticParams: () => conf.levels.filter(key => levelKinds(lang, key).includes(kind)).map(key => ({ level: key.toLowerCase() })),
    async generateMetadata({ params }) {
      const { level } = await params;
      const key = String(level || '').toUpperCase();
      if (!conf.levels.includes(key) || !levelKinds(lang, key).includes(kind)) return {};
      const title = `${levelLabel(key)} ${KIND_LABEL[kind]} | ${conf.name}`;
      const description = kind === 'hanzi'
        ? `${conf.name} ${levelLabel(key)} 한자 — 글자만 보고 읽어 보고, 모르는 글자는 바로 체크`
        : lang === 'chinese' && kind === 'vocab'
          ? `${conf.name} ${levelLabel(key)} 단어 — 한 단어씩 네 칸으로 채점하고, HSK 1–9 전체에서 찾기`
        : lang === 'japanese' && kind === 'vocab'
          ? `${conf.name} ${levelLabel(key)} 단어 — 한 단어씩 네 칸으로 채점하고, JLPT N5–N1 전체에서 찾기`
          : `${conf.name} ${levelLabel(key)} ${KIND_LABEL[kind]} 목록 — 뜻 · 예문 · 듣기, 단어는 바로 복습에 저장`;
      return { title, description, alternates: { canonical: `/${lang}/${kind}/${key.toLowerCase()}` }, openGraph: { title, description } };
    },
    async Page({ params }) {
      const { level } = await params;
      const data = await levelListData(lang, kind, level);
      if (!data) notFound();
      return <View {...data} />;
    },
  };
}
