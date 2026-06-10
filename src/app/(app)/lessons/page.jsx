import LessonsPage from '@/views/LessonsPage';
import { REF_LANGS } from '@/content/refLangs';

export const metadata = {
  title: '강의 | Anatomy Studio',
  description: '단계별 패턴·표현 강의와 문법·어휘 레퍼런스. JLPT N5→N1, CEFR A1→C2, 프랑스어 A0→C2.',
};

/**
 * 레퍼런스 경량 매니페스트 — 목차·카운트만 클라이언트로 전달.
 * 본문(섹션·예문·단어)은 서버 컴포넌트(/{lang}/grammar·vocab)에만 존재해
 * /lessons 클라이언트 번들을 가볍게 유지한다.
 */
function buildRefManifest() {
  const out = {};
  for (const [name, ref] of Object.entries(REF_LANGS)) {
    out[name] = {
      base: ref.base,
      readKey: ref.readKey,
      blurb: ref.blurb,
      legend: ref.legend,
      levels: ref.LEVEL_META.map(m => ({
        key: m.key,
        label: m.label,
        focus: m.focus,
        chapters: ref.getGrammarChapters(m.key).map(c => ({
          slug: c.slug,
          order: c.order,
          title: c.title,
          topic: c.topic || null,
          summary: c.summary || null,
          duration: c.duration || null,
        })),
        vocabCount: ref.countVocab(m.key),
      })),
    };
  }
  return out;
}

export default function Page() {
  return <LessonsPage refManifest={buildRefManifest()} />;
}
