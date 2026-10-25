// 레벨별 단어 · 문형 · 한자 목록 라우트 공용(서버) — /{japanese,chinese}/{vocab,bunkei}/{레벨}과 /chinese/hanzi/{레벨}이 같은 조립을 쓴다.
import { notFound } from 'next/navigation';
import { levelListData } from '@/lib/levelListData';
import { levelWordsUrl } from '@/lib/levelWordsPayload';
import LevelWordsPreload from '@/components/levels/LevelWordsPreload';
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
      if (kind !== 'vocab') return <View {...data} />;
      // 단어 화면(LEVEL-LIST-RSC-001 · src/lib/levelWordsPayload.js) — 항목은 조각 밖 정적 묶음으로. 조각에 실으면 N3 207 KB · H7 542 KB(gz)라
      // 책장 타일 미리 받기가 0.6–0.9 MB였다. 화면은 붙은 뒤에야 항목을 그리므로 첫 그림은 같다. preload는 요소로 건다 — 문서 머리에서 JS와
      // 나란히 받고, 미리 받기(조각만 풀고 그리지 않는다)에서는 받지 않는다(ReactDOM.preload는 조각의 힌트 줄이라 풀 때 바로 받는다).
      // 앱 안 이동에서는 걸지 않는다(LevelWordsPreload — 누를 때 시작한 받기와 겹쳐 두 번 받던 것).
      const wordsUrl = levelWordsUrl(lang, data.levelKey);
      return <><LevelWordsPreload href={wordsUrl} />
        <View lang={data.lang} kind={data.kind} levelKey={data.levelKey} wordsUrl={wordsUrl} /></>;
    },
  };
}
