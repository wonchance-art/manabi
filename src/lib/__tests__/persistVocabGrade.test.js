import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { persistVocabGrade } from '../fsrs.js';

// 계약: 구조 정리 C — 흩어져 각자 유지되던 중복의 수렴.
// ① 어휘 FSRS 채점 저장은 persistVocabGrade 한 곳(4중복이던 페이로드 조립의 정본)
// ② KST 주 시작은 growthStats 한 곳(로컬 재구현 2벌 제거)
// ③ srs.js(죽은 코드)는 부활 금지 ④ 규약 통일(문형 저장 조회 청크·PDF 프롬프트 정본)

describe('persistVocabGrade — 채점 저장 정본', () => {
  const makeClient = (error = null) => {
    const eq = vi.fn().mockResolvedValue({ error });
    const update = vi.fn(() => ({ eq }));
    return { client: { from: vi.fn(() => ({ update })) }, update, eq };
  };

  it('nextStats + last_reviewed_at를 user_vocabulary에 UPDATE한다(snake_case 계약)', async () => {
    const { client, update, eq } = makeClient();
    const stats = { interval: 3, ease_factor: 5.1, repetitions: 2, next_review_at: '2026-08-23T00:00:00.000Z' };
    await persistVocabGrade(client, 'w-1', stats, '2026-08-20T00:00:00.000Z');
    expect(client.from).toHaveBeenCalledWith('user_vocabulary');
    expect(update).toHaveBeenCalledWith({ ...stats, last_reviewed_at: '2026-08-20T00:00:00.000Z' });
    expect(eq).toHaveBeenCalledWith('id', 'w-1');
  });

  it('DB 오류는 throw — 호출자가 실패를 표면화할 수 있어야 한다', async () => {
    const { client } = makeClient(new Error('offline'));
    await expect(persistVocabGrade(client, 'w-1', { interval: 1 })).rejects.toThrow('offline');
  });
});

describe('배선 계약 — 중복 부활 금지', () => {
  const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

  it('4곳 전부 정본을 쓴다 — 원시 update 페이로드 조립 부활 금지', () => {
    const sites = [
      'src/lib/useVocabData.js',
      'src/lib/useInlineReview.js',
      'src/lib/learn/progressStore.js',
      'src/components/world/QuestReview.jsx',
    ];
    for (const f of sites) {
      const src = read(f);
      expect(src, f).toContain('persistVocabGrade');
      expect(src, `${f}에 원시 페이로드 조립 부활`).not.toMatch(/update\(\{ \.\.\.nextStats, last_reviewed_at/);
    }
    // 기존 테스트·호출 계약용 이름은 정본의 별칭으로 유지
    expect(read('src/components/world/QuestReview.jsx'))
      .toContain('export const persistQuestReviewGrade = persistVocabGrade;');
  });

  it('죽은 코드 srs.js는 삭제됐고 부활 금지(SRS는 fsrs.js 단일)', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/srs.js'))).toBe(false);
  });

  it('KST 주 시작 로컬 재구현 2벌이 growthStats 정본으로 수렴했다', () => {
    for (const f of ['src/views/StudySessionPage.jsx', 'src/lib/studyMaterials.js']) {
      expect(read(f), f).not.toMatch(/function kstWeekStart/);
    }
    expect(read('src/lib/studyMaterials.js')).toMatch(/import \{[^}]*kstWeekStartMs[^}]*\} from '[^']*growthStats'/);
    // StudySessionPage의 주간 회고는 W 후속 ②에서 주 경계 계산 자체를 주간 리포트 정본에 넘겼다
    // (fetchWeeklyReportRows가 안에서 kstWeekStartMs를 쓴다) — 로컬 경계 계산 0.
    const session = read('src/views/StudySessionPage.jsx');
    expect(session).toContain("from '../lib/weeklyReportRows'");
    expect(session).not.toMatch(/kstWeekStart(Iso|Ms)\(/);
  });

  it('규약 통일 — 문형 저장 조회는 어휘와 같은 청크 정본, PDF 번역 프롬프트는 뷰어와 같은 정본', () => {
    const pattern = read('src/views/ReferencePatternIndexPage.jsx');
    expect(pattern).toContain('fetchSavedWordSet(supabase, user.id,');
    const pdf = read('src/views/PdfViewerPage.jsx');
    expect(pdf).toContain('callGemini(buildContextPrompt(text, langName))');
    expect(pdf).not.toContain('내용 이해를 돕는 배경 설명'); // 하드코딩 사본 부활 금지
  });
});
