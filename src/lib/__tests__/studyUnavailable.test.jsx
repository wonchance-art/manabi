// STUDY-UNAVAILABLE-001 · STUDY-OFFLINE-LINE (오너 「결정사안은 권장대로」 2026-10-17 KST) — /study 점검 목업 두 건.
// ① 학습 기록(FSRS snapshot)을 못 읽으면 일반 오류 화면 대신 전용 안내 + [다시 시도] [단어장으로]. 복습 없는 세션은 열지 않는다.
// ② 오프라인 동안만 진행 막대 아래 한 줄. 알림 영역은 늘 두고(sr-only role=status) 보이는 줄은 aria-hidden(A11Y-SWEEP-001).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));
import StudyUnavailable from '../../views/StudyUnavailable';
import { STUDY_OFFLINE_LINE, STUDY_UNAVAILABLE_COPY, isStudyStorageUnavailable } from '../studyUnavailable';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const fsrs = (code, status) => Object.assign(new Error(code), { code, status });

describe('① 학습 기록을 못 읽으면 전용 안내', () => {
  it('판정 — 5xx + fsrs_* 코드만(저장소 · snapshot). 인증 4xx · 다른 오류는 그대로 던진다', () => {
    expect(isStudyStorageUnavailable(fsrs('fsrs_storage_unavailable', 503))).toBe(true);
    expect(isStudyStorageUnavailable(fsrs('fsrs_snapshot_unavailable', 503))).toBe(true);
    expect(isStudyStorageUnavailable(fsrs('fsrs_auth_required', 401))).toBe(false);
    expect(isStudyStorageUnavailable(Object.assign(new Error('boom'), { status: 500 }))).toBe(false);
    expect(isStudyStorageUnavailable(new Error('fsrs_storage_unavailable'))).toBe(false);
    expect(isStudyStorageUnavailable(null)).toBe(false);
  });

  it('페이지: 조립 실패가 그 판정이면 전용 안내, 아니면 다시 던진다(일반 오류 화면)', () => {
    const page = read('src/app/(app)/study/page.jsx');
    const guard = sliceBetween(page, 'let assembled;', '= assembled;');
    expect(guard).toContain('assembled = await assembleStudyMaterials(supabase, user.id, lang, { interestGroup });');
    expect(guard).toContain('if (isStudyStorageUnavailable(error)) return <StudyUnavailable />;');
    expect(guard).toContain('throw error;');
  });

  it('화면: 제목 · 안내 · [다시 시도](서버 조립 다시) · [단어장으로] — 문구는 오너 확정본 그대로', () => {
    expect(STUDY_UNAVAILABLE_COPY).toEqual({ title: '오늘 학습을 불러오지 못했어요',
      body: '학습 기록에 잠시 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', retry: '다시 시도', vocab: '단어장으로' });
    const html = renderToStaticMarkup(<StudyUnavailable />);
    expect(html).toContain('<h1');
    expect(html).toContain('>오늘 학습을 불러오지 못했어요</h1>');
    expect(html).toContain('학습 기록에 잠시 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    expect(html).toMatch(/<button type="button" class="btn btn--primary btn--md">다시 시도<\/button>/);
    expect(html).toContain('<a href="/vocab" class="btn btn--ghost btn--md">단어장으로</a>');
    expect(read('src/views/StudyUnavailable.jsx')).toContain('startTransition(() => router.refresh())');
  });
});

describe('② 오프라인 한 줄', () => {
  const page = read('src/views/StudySessionPage.jsx');
  it('알림 영역은 늘 있고 내용만 오프라인일 때, 보이는 줄은 오프라인일 때만 · aria-hidden', () => {
    expect(STUDY_OFFLINE_LINE).toBe('오프라인 — 답은 이 기기에 보관했다가 연결되면 저장해요');
    expect(page).toContain('<span className="sr-only" role="status">{offline ? STUDY_OFFLINE_LINE : \'\'}</span>');
    expect(page).toContain('{offline && <p className="study-offline-line" aria-hidden="true">{STUDY_OFFLINE_LINE}</p>}');
    // 진행 막대 줄 바로 아래 · 문항 카드 위
    const header = page.indexOf('className="study-progress"'), line = page.indexOf('className="study-offline-line"'), card = page.indexOf('ref={itemRef} className="study-item"');
    expect(header).toBeGreaterThan(0);
    expect(line).toBeGreaterThan(header);
    expect(card).toBeGreaterThan(line);
  });

  it('online · offline 이벤트로 바뀌고, 첫 그림은 온라인(서버와 같은 마크업)', () => {
    const effect = sliceBetween(page, 'const [offline, setOffline] = useState(false);', '}, []);');
    expect(effect).toContain("navigator.onLine === false");
    expect(effect).toContain("window.addEventListener('online', sync); window.addEventListener('offline', sync);");
    expect(effect).toContain("window.removeEventListener('online', sync); window.removeEventListener('offline', sync);");
    expect(read('src/index.css')).toMatch(/\.study-offline-line \{[^}]*color: var\(--text-muted\);/);
  });
});
