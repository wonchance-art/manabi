// WRITE-STUDY-ENTRY-001 · KO-COMPOSER-001 (#1337, 2026-10-08) — 화면 계약.
// 언어 칩 줄(라디오 그룹)·두 저장 버튼·원본 화면의 글 자료 입구를 실제 마크업으로 고정한다.
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ user: { id: 'owner-1' }, korean: { save: false, isLoading: true, isError: false } }));
// 계정 계약 응답(배포 DB의 learning_language_capabilities)을 상태별로 바꿔 끼운다 — 실제 요청은 하지 않는다.
vi.mock('../../lib/useLearningCapabilities', () => ({ useLearningCapabilities: language => language === 'Korean' ? auth.korean : { save: true, isLoading: false, isError: false } }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push() {} }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('../web/LibraryReaderLink', () => ({ LibraryReturnLink: () => <a href="/materials">← 내 서재</a> }));
vi.mock('../library/useLibraryActivity', () => ({ default: () => {} }));
vi.mock('../materials/PassageSources', () => ({ default: () => null, PassageSourceFocus: () => null }));
vi.mock('../materials/OriginalFileReader', () => ({ default: () => <div className="original-file-fixture" /> }));
vi.mock('../materials/OriginalPositionNotice', () => ({ default: () => null }));
vi.mock('../materials/useOriginalTextPosition', () => ({ default: () => {} }));
vi.mock('../materials/useOriginalReadingPosition', () => ({ default: () => ({ state: { ready: true }, note() {}, selected() { return null; }, accept() { return null; } }) }));

import StudyLanguageChips from '../materials/StudyLanguageChips';
import OriginalMaterialReader from '../materials/OriginalMaterialReader';
import { ComposerSaveActions } from '../materials/MaterialComposer';
import { useStudyLanguages } from '../../lib/useStudyLanguages';
import { composerStudyState, composerRow, newComposerDraft } from '../../lib/materialComposer';

const SUPPORTED = { save: true, review: true, known: true, exclude: true, isLoading: false, isError: false };
const CHECKING = { save: false, isLoading: true, isError: false };
const UNSUPPORTED = { save: false, isLoading: false, isError: false };
const FAILED = { save: false, isLoading: false, isError: true };
function wrap(node, korean = CHECKING) {
  auth.korean = korean;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
function LanguageField(props) {
  const { languages } = useStudyLanguages();
  return <StudyLanguageChips id="composer-language" languages={languages} value="" onChange={() => {}} {...props} />;
}
const material = (draft, extra = {}) => ({ ...composerRow(auth.user.id, { ...newComposerDraft('22222222-2222-4222-8222-222222222222'), ...draft }), id: 77, created_at: '2026-10-08T00:00:00Z', document_json: null, ...extra });
const radios = html => [...html.matchAll(/<button[^>]*role="radio"[^>]*>([^<]*)<\/button>/g)].map(match => match[1]);

describe('언어 칩 줄 — 접힌 칸 밖의 라디오 그룹', () => {
  it('이름 있는 radiogroup, 칩마다 이름, 선택은 aria-checked, 키보드 진입점 하나', () => {
    const html = renderToStaticMarkup(<StudyLanguageChips id="x" languages={['Japanese', 'Chinese', 'English', 'French', 'Korean']} value="English" onChange={() => {}} />);
    expect(html).toMatch(/role="radiogroup"[^>]*aria-labelledby="x-label"/);
    expect(html).toContain('<span id="x-label" class="study-language__label">공부할 언어</span>');
    expect(radios(html)).toEqual(['일본어', '중국어', '영어', '프랑스어', '한국어']);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true" tabindex="0"[^>]*>영어</);
    expect(html).not.toContain('글자를 보고 골랐어요');
  });
  it('짐작으로 고른 칩에만 작은 안내를 붙인다', () => {
    const html = renderToStaticMarkup(<StudyLanguageChips id="x" languages={['Japanese']} value="Japanese" guessed onChange={() => {}} />);
    expect(html).toContain('글자를 보고 골랐어요');
    expect(renderToStaticMarkup(<StudyLanguageChips id="x" languages={['Japanese']} value="" guessed onChange={() => {}} />)).not.toContain('글자를 보고 골랐어요');
  });
  it('44px 조작 영역·줄바꿈·토큰 색(규약)을 CSS가 지킨다', () => {
    const css = readFileSync('src/components/materials/material-composer.css', 'utf8');
    const rule = css.match(/\.study-language__chips \{[^}]*\}/)[0];
    expect(rule).toContain('flex-wrap: wrap');
    expect(css).toMatch(/button\.study-language__chip\[role="radio"\] \{[^}]*min-height: 44px/);
    expect(css.match(/\.study-language[^{]*\{[^}]*\}/g).join('\n')).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});

describe('KO-COMPOSER — 한국어 선택지는 계정 지원 응답을 따른다', () => {
  it('지원 응답이면 「한국어」가 있다', () => {
    expect(radios(wrap(<LanguageField />, SUPPORTED))).toEqual(['일본어', '중국어', '영어', '프랑스어', '한국어']);
  });
  it('확인 중·미지원·확인 실패면 없고 네 언어는 남는다', () => {
    for (const state of [CHECKING, UNSUPPORTED, FAILED]) expect(radios(wrap(<LanguageField />, state))).toEqual(['일본어', '중국어', '영어', '프랑스어']);
  });
  it('원본 화면도 같은 조건 — 한국어 글은 지원 계정에서만 한국어로 짐작해 미리 고른다', () => {
    const body = { body: '오늘은 비가 와서 집에서 책을 읽었어요.' };
    expect(wrap(<OriginalMaterialReader material={material(body)} />, SUPPORTED)).toMatch(/aria-checked="true"[^>]*>한국어</);
    const unsupported = wrap(<OriginalMaterialReader material={material(body)} />, UNSUPPORTED);
    expect(unsupported).not.toContain('>한국어<'); expect(unsupported).not.toContain('aria-checked="true"');
  });
  it('작성 화면·원본 화면·구간 패널이 같은 부품을 쓴다(목록·조건을 따로 두지 않는다)', () => {
    const composer = readFileSync('src/components/materials/MaterialComposer.jsx', 'utf8');
    const original = readFileSync('src/components/materials/OriginalMaterialReader.jsx', 'utf8');
    for (const source of [composer, original]) { expect(source).toMatch(/\{ languages[^}]*\} = useStudyLanguages\(\)/); expect(source).not.toContain('COMPOSER_LANGUAGES.map'); }
    expect(composer).toContain('<StudyLanguageChips'); expect(original).toContain('<StudyLanguageChips');
    expect(composer).not.toContain('composer-options');
    const passage = readFileSync('src/components/materials/PassageStudy.jsx', 'utf8');
    expect(passage).toMatch(/\{ languages: studyChoices \} = useStudyLanguages\(\)/);
    expect(passage).toContain('passageLanguageChoices(studyChoices)');
    expect(passage).toContain('{passageLanguages.map(value =>');
    expect(passage).not.toContain('PASSAGE_LANGUAGES.map');
    // 한국어 구간이 열렸으니(KO-PASSAGE-001) 「한국어는 일부만 고를 수 없다」 안내는 남기지 않는다.
    expect(passage).not.toContain('일부만 골라 공부할 수 없어요');
  });
});

describe('WRITE-STUDY-ENTRY — 두 저장 버튼', () => {
  const draft = newComposerDraft('11111111-1111-4111-8111-111111111111');
  const four = ['Japanese', 'Chinese', 'English', 'French'];
  const render = (value, options = {}) => renderToStaticMarkup(<ComposerSaveActions study={composerStudyState(value, four, options)} editing={!!options.editing} frozen={false} busy={false} intent="" disabled={false} onStudy={() => {}} />);
  it('본문 + 언어 → 「저장만」·「저장하고 공부하기」(주 버튼) 활성', () => {
    const html = render({ ...draft, body: 'Bonjour', language: 'French' });
    expect(html).toMatch(/<button type="submit"[^>]*>저장만<\/button>/);
    expect(html).toMatch(/<button type="button" class="manabi-button"(?![^>]*disabled)[^>]*>저장하고 공부하기<\/button>/);
  });
  it('언어나 본문이 없으면 비활성이고 이유를 보인다', () => {
    const noLanguage = render({ ...draft, body: 'Bonjour' });
    expect(noLanguage).toMatch(/<button type="button" class="manabi-button" disabled=""[^>]*aria-describedby="composer-study-reason"[^>]*>저장하고 공부하기/);
    expect(noLanguage).toContain('<small id="composer-study-reason" class="composer-study-reason">공부할 언어를 골라 주세요</small>');
    expect(render({ ...draft, language: 'French' })).toContain('본문이 있어야 공부할 수 있어요');
  });
  it('수정 모드는 「변경 저장」·「저장하고 공부하기」', () => {
    const html = render({ ...draft, body: 'Bonjour', language: 'French' }, { editing: true });
    expect(html).toContain('>변경 저장</button>'); expect(html).toContain('>저장하고 공부하기</button>');
  });
  it('첨부만 있는 자료·쓰기 노트에는 「저장하고 공부하기」가 없고 기존 「저장」만 남는다', () => {
    for (const html of [render({ ...draft, files: [{ hash: 'a' }] }), render({ ...draft, body: 'Bonjour', language: 'French' }, { note: true })]) {
      expect(html).not.toContain('저장하고 공부하기');
      expect(html).toMatch(/<button type="submit" class="manabi-button"[^>]*>저장<\/button>/);
    }
  });
});

describe('WRITE-STUDY-ENTRY — 원본 화면 분기', () => {
  const owner = auth.user.id;
  const file = { kind: 'pdf', name: 'reading.pdf', size: 10, hash: 'b'.repeat(64) };
  it('글만 있는 자료: 상단 「이 글로 공부하기 ↗」·「일부만 고르기」, 아래 「본문 전체 학습」 details 없음', () => {
    const html = wrap(<OriginalMaterialReader material={material({ body: '今日は雨です。', language: 'Japanese' })} />);
    expect(html).toMatch(/<button class="manabi-button"[^>]*>이 글로 공부하기 ↗<\/button>/);
    expect(html).toContain('>일부만 고르기</button>');
    expect(html).not.toContain('original-study'); expect(html).not.toContain('본문 전체 학습');
    expect(html).not.toContain('학습할 부분 고르기');
    // 언어가 저장돼 있으면 칩을 펼치지 않고 바로 연다.
    expect(html).not.toContain('role="radiogroup"');
    expect(html.indexOf('이 글로 공부하기')).toBeLessThan(html.indexOf('original-writing'));
  });
  it('언어가 없으면 칩 줄을 펼치고 글자로 짐작해 미리 고른다', () => {
    const html = wrap(<OriginalMaterialReader material={material({ body: '今日は雨です。' })} />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(/aria-checked="true"[^>]*>일본어</);
    expect(html).toContain('글자를 보고 골랐어요');
    expect(html).not.toMatch(/disabled=""[^>]*>이 글로 공부하기/);
    const latin = wrap(<OriginalMaterialReader material={material({ body: 'It rained today.' })} />);
    expect(latin).not.toContain('aria-checked="true"');
    expect(latin).toMatch(/disabled=""[^>]*>이 글로 공부하기 ↗/);
  });
  it('첨부 있는 자료는 현행 그대로: 구간 고르기가 대표 입구, 본문이 있으면 아래 「자료 도구 · 본문 전체 학습」 유지', () => {
    const save = composerRow(owner, { ...newComposerDraft('33333333-3333-4333-8333-333333333333'), body: 'Bonjour.', language: 'French' });
    save.processed_json.metadata.composer.assets = [{ ...file, path: `${owner}/33333333-3333-4333-8333-333333333333/${file.hash}.pdf` }];
    const html = wrap(<OriginalMaterialReader material={{ ...save, id: 78, created_at: '2026-10-08T00:00:00Z', document_json: null }} />);
    expect(html).toMatch(/<button class="manabi-button"[^>]*>학습할 부분 고르기<\/button>/);
    expect(html).toContain('<summary>자료 도구 · 본문 전체 학습</summary>');
    expect(html).not.toContain('이 글로 공부하기'); expect(html).not.toContain('일부만 고르기');
  });
});
