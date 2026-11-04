// 공부한 날 = 연속(STREAK-STUDY-PARITY-001, 2026-11-04 KST · 오너 상시 방침 「백엔드 데이터 관련 개선은 알아서」).
// 「공부한 날」 칸(studyDays.studyDayCounts — 답 또는 담은 말)이 켜는 날은 연속(update_streak)에도 남아야 한다.
// 운영 실측(읽기 전용, 10/6 ~ 11/3): 칸에는 켜지고 연속 영수증이 없던 날 7일 — 담기만(단어 목록 덱 239개 · 36 · 51개),
// 한자 탭 답 1, 단어 목록 바퀴 답 48 · 894. 영수증은 FSRS 채점(grade 트리거)과 update_streak 두 길에서만 생기는데,
// 이 경로들은 둘 다 부르지 않았다. 고친 자리: 답 = logReviewEvents 한 곳 · 담기 = 쓰기 지점마다(아래 목록).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

const remote = vi.hoisted(() => ({ inserts: [], record: vi.fn(async () => true) }));
vi.mock('../supabase', () => ({ supabase: {
  rpc: async () => ({ data: { version: 1, enrolled: false, actorId: 'alice' }, error: null }),
  from: table => ({ insert: async rows => { remote.inserts.push({ table, rows }); return { error: null }; } }),
} }));
vi.mock('../streak', () => ({ recordActivity: remote.record }));
import { logReviewEvents } from '../reviewEvents';

const ev = (source, extra = {}) => ({ lang: 'zh', source, item_key: '猫', correct: true, ...extra });
const settle = () => new Promise(resolve => setTimeout(resolve, 5));
const read = f => fs.readFileSync(f, 'utf8');

// 판정 모듈은 쓰기 뒤에 받는다(첫 화면 밖) — 미리 받아 두어 「한 틱 뒤」가 부정 단언에서도 같은 뜻이 되게 한다.
beforeAll(async () => { await import('../weeklyReport'); await import('../streak'); });
beforeEach(() => { remote.inserts.length = 0; remote.record.mockClear(); });

describe('답 — review_events 쓰기 한 곳(logReviewEvents)에서 연속도 남긴다', () => {
  it('칸이 세는 답(한자 · 단어 목록 · 읽기 · 문법 · 작문)은 쓰기 뒤 연속 한 번', async () => {
    for (const source of ['hanzi', 'level', 'reading', 'grammar', 'writing']) {
      remote.record.mockClear();
      await logReviewEvents('alice', [ev(source)], { strict: true });
      await settle();
      expect(remote.record, source).toHaveBeenCalledTimes(1);
      expect(remote.record).toHaveBeenCalledWith('alice');
    }
  });
  it('칸이 세지 않는 답(ui · 사전 · 집중 연습)은 연속을 건드리지 않는다 — 같은 정본(countsAsStudyAnswer)', async () => {
    await logReviewEvents('alice', [ev('ui'), ev('dict'), ev('practice')], { strict: true });
    await settle();
    expect(remote.inserts).toHaveLength(1);
    expect(remote.record).not.toHaveBeenCalled();
  });
  it('어휘(vocab) 답은 여기서 다시 남기지 않는다 — FSRS는 grade 트랜잭션, 예전 채점은 progressStore 몫', async () => {
    await logReviewEvents('alice', [ev('vocab', { detail: { word_id: 'w1' } })], { strict: true });
    await settle();
    expect(remote.record).not.toHaveBeenCalled();
  });
  it('쓰기가 실패하면 연속도 남기지 않는다', async () => {
    const { supabase } = await import('../supabase');
    const from = supabase.from;
    supabase.from = () => ({ insert: async () => ({ error: new Error('down') }) });
    try {
      await expect(logReviewEvents('alice', [ev('hanzi')], { strict: true })).rejects.toThrow('down');
      await settle();
      expect(remote.record).not.toHaveBeenCalled();
    } finally { supabase.from = from; }
  });
});

/**
 * 담기 — 단어를 만드는 클라이언트 쓰기 지점 전부(user_vocabulary upsert · insert, 문맥 저장 saveContext, FSRS 직접 추가).
 * [파일, 그 쓰기가 든 함수의 시작 앵커, 끝 앵커]. 함수 안에 recordActivity가 있어야 한다.
 * 서버(src/app/api · src/lib/server)는 클라이언트 자리가 남긴다. 새 쓰기 지점이 생기면 아래 「목록 밖 쓰기」가 실패한다 — 여기에 넣고 연속을 남긴다.
 */
const SAVE_SITES = [
  ['src/views/ViewerPage.jsx', 'async function saveKoreanVocabulary(', 'async function attachReadingContext('],
  ['src/views/ViewerPage.jsx', 'const linked = await attachReadingContext(savedToken);', 'if (gradeAction.current !== action) return;'],
  ['src/views/PdfViewerPage.jsx', 'async function handleSaveWord(', 'function handleDismissWord('],
  ['src/views/QuickPage.jsx', 'async function handleSaveWord(', 'const renderToken ='],
  ['src/views/ReferenceVocabPage.jsx', ".from('user_vocabulary')", "toast?.('단어를 저장하지 못했어요"],
  ['src/views/ReferencePatternIndexPage.jsx', 'async function savePattern(', "toast?.('문형을 저장하지 못했어요"],
  ['src/views/LevelListPage.jsx', "const response = await client.save({ action: 'save'", 'return done(true);'],
  ['src/views/VocabPage.jsx', 'const manualAddMutation = useMutation({', "toast('단어를 추가했어요', 'success');"],
  ['src/views/StudySessionPage.jsx', 'async function saveEncounterWord(', "setEncounterSaveState('saved');"],
  ['src/views/WritingStudioPage.jsx', "await supabase.from('user_vocabulary').upsert([row], VOCAB_UPSERT);", 'setGapAdded('],
  ['src/lib/useVocabData.js', 'const csvImportMutation = useMutation({', 'return imported;'],
  ['src/lib/useLevelWordGrade.js', "import { recordActivity } from './streak';", null],
  ['src/lib/learn/progressStore.js', 'async function recordActivityRemote(', null],
  ['src/components/world/NpcDialog.jsx', 'async function saveMetWord(', '스텝 전환 시'],
  ['src/components/classroom/ClassSaveResume.jsx', "upsert(row,VOCAB_UPSERT)", 'await saveContext('],
  ['src/components/learning/SaveContextButton.jsx', 'async function save(confirm)', 'onSaved?.(result);'],
  ['src/components/notes/NoteVocabulary.jsx', 'async function saveRows(', 'setNotice(`새 단어'],
  ['src/components/VocabRegisterCta.jsx', 'const onClick = async () => {', 'setPending(false);'],
];

describe('담기 — 단어를 만드는 쓰기 지점마다 연속을 남긴다(담은 날 = 공부한 날)', () => {
  it.each(SAVE_SITES)('%s · %s', (file, start, end) => {
    expect(sliceBetween(read(file), start, end)).toContain('recordActivity(');
  });

  it('목록 밖 쓰기 없음 — 클라이언트에서 단어를 만드는 파일은 모두 위 목록에 있다', () => {
    const listed = new Set(SAVE_SITES.map(([file]) => file));
    const writer = /from\(['"]user_vocabulary['"]\)\s*\.(?:upsert|insert)\(|[^.\w]saveContext\(|action: *'save'|controller\.saveVocabulary\(|requestNote\('\/api\/learning\/vocabulary', *\{ *method: *'POST'/;
    const found = [];
    const walk = dir => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) { if (!['__tests__', 'server', 'api'].includes(name)) walk(full); continue; }
        if (!/\.(js|jsx)$/.test(name) || /\.test\.js$/.test(name)) continue;
        const src = read(full).replace(/^\s*(\/\/|\*).*$/gm, ''); // 주석 속 언급은 쓰기가 아니다
        if (writer.test(src)) found.push(full.split(path.sep).join('/'));
      }
    };
    walk('src');
    // 쓰기 엔진 자체(조립 · 전송 · 재전송)는 화면 쓰기 지점이 연속을 남긴다 — 정본 엔진은 순수하게 둔다.
    const ENGINES = new Set(['src/lib/fsrsLearningClient.js', 'src/lib/fsrsOperationOutbox.js', 'src/lib/useFsrsReview.js',
      'src/components/learning/SaveContextButton.jsx']);
    const missing = found.filter(f => !listed.has(f) && !ENGINES.has(f));
    expect(missing).toEqual([]);
  });

  it('공부한 날 칸이 세는 「담은 말」은 user_vocabulary.created_at — 연속 쪽 정의와 같은 재료(새로 담을 때)', () => {
    expect(read('src/lib/studyDays.js')).toContain("for (const row of saved) bump(row?.created_at, 'saved');");
    expect(read('src/lib/reviewEvents.js')).toContain("if (rows.some(row => row.source !== 'vocab' && countsAsStudyAnswer(row))) await recordActivity(userId);");
  });
});
