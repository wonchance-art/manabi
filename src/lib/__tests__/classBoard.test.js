import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  TEAM_KEY_RE, TEAM_PW_MIN, BOARD_POLL_MS, classChannelName, getTeam, isTeamRoot, isDayNote, todayKey, dayLabel,
  dayNoteTitle, listTeams, listDayNotes, findDayNote, buildDayNoteRow, buildTeamRootRow, patchTeamRoot,
  appendEntryPlan, appendEntryFallbackJson, noteEntries, entryReading, entryMeaning, toPlainText,
} from '../classBoard.js';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

/**
 * 계약: v2-AB R1 수업 판 (#1077 설계 5603827169 §7 R1, 오너 「착수해」 2026-09-09).
 * - 정리본·팀 설정이 reading_materials 행이고 별도 테이블이 없다; 팀 정보는 metadata.team에만
 * - 추가 1건 = 재분석 그 줄만; 재분석 뒤 metadata.team 보존
 * - Broadcast가 끊겨도 판이 15초 안에 최신(폴링 계약)
 * - 정리본 복사가 `단어 — 읽기 — 뜻` 한 줄씩이고 토큰 데이터와 일치
 * - /live·/board는 소유자에게만; /board는 쓰기 0
 * - 암호는 평문 저장·전송·로그 0 — 해시만
 */

const ROOT_META = { language: 'Japanese', team: { key: 'a', name: 'A팀', lang: 'Japanese', bookKey: 'bk_1', bookTotal: 41, pwHash: 'h', pwSalt: 's', pwGen: 1, root: true } };
const NOTE_META = { language: 'Japanese', team: { key: 'a', day: '2026-09-09', chapterId: '12' } };

describe('팀 메타 — metadata.team 하나로 루트·정리본을 가른다', () => {
  it('키 규칙: 소문자·숫자·하이픈 1~16자(`/class/a`), 하이픈 시작 금지', () => {
    for (const ok of ['a', 'ab', 'team-1', 'x'.repeat(16)]) expect(TEAM_KEY_RE.test(ok)).toBe(true);
    for (const bad of ['-a', 'A팀', 'a b', 'x'.repeat(17), '']) expect(TEAM_KEY_RE.test(bad)).toBe(false);
    expect(TEAM_PW_MIN).toBe(6);
  });

  it('루트는 root:true + 설정 필드, 정리본은 day', () => {
    expect(getTeam(ROOT_META)).toMatchObject({ key: 'a', root: true, name: 'A팀', lang: 'Japanese', bookKey: 'bk_1', bookTotal: 41, pwGen: 1 });
    expect(getTeam(NOTE_META)).toEqual({ key: 'a', root: false, day: '2026-09-09', chapterId: '12' });
    expect(getTeam({})).toBeNull();
    expect(getTeam({ team: { key: 'BAD KEY', root: true } })).toBeNull();
    expect(isTeamRoot({ processed_json: { metadata: ROOT_META } })).toBe(true);
    expect(isDayNote({ processed_json: { metadata: NOTE_META } })).toBe(true);
    expect(isDayNote({ processed_json: { metadata: ROOT_META } })).toBe(false);
  });

  it('루트·정리본 행은 reading_materials 모양이고 팀 정보는 metadata.team에만 산다(별도 테이블 0)', () => {
    const root = buildTeamRootRow({ key: 'a', name: 'A팀', lang: 'Japanese', bookKey: 'bk_1', bookTotal: 41, pwHash: 'h', pwSalt: 's', ownerId: 'u1' });
    expect(Object.keys(root).sort()).toEqual(['owner_id', 'processed_json', 'raw_text', 'title', 'visibility']);
    expect(root.visibility).toBe('private');
    expect(root.processed_json.metadata.team).toEqual({ key: 'a', name: 'A팀', lang: 'Japanese', bookKey: 'bk_1', bookTotal: 41, pwHash: 'h', pwSalt: 's', pwGen: 1, root: true });
    expect(JSON.stringify(root)).not.toContain('password');
    expect(() => buildTeamRootRow({ key: 'A팀', name: 'x', pwHash: 'h', pwSalt: 's', ownerId: 'u1' })).toThrow();

    const note = buildDayNoteRow({ team: getTeam(ROOT_META), day: '2026-09-09', ownerId: 'u1', firstLine: ' 道歉 ', chapterId: 12 });
    expect(Object.keys(note).sort()).toEqual(['owner_id', 'processed_json', 'raw_text', 'title', 'visibility']);
    expect(note.title).toBe('[A팀] 2026-09-09 수업');
    expect(note.raw_text).toBe('道歉');
    expect(note.processed_json.status).toBe('pending');
    expect(note.processed_json.metadata.team).toEqual({ key: 'a', day: '2026-09-09', chapterId: '12' });
    expect(note.processed_json.metadata.language).toBe('Japanese');
  });

  it('루트 패치는 키·root를 못 바꾼다(링크 주소 불변) · 암호 변경은 pwGen만 올린다', () => {
    const json = { sequence: [], dictionary: {}, metadata: ROOT_META };
    const next = patchTeamRoot(json, { key: 'zzz', root: false, name: 'B팀', pwHash: 'h2', pwSalt: 's2', pwGen: 2 });
    expect(next.metadata.team).toMatchObject({ key: 'a', root: true, name: 'B팀', pwHash: 'h2', pwSalt: 's2', pwGen: 2, bookKey: 'bk_1' });
    expect(next.sequence).toEqual([]);
  });

  it('내 자료 행에서 팀·정리본을 골라낸다 — 정리본은 최근 날짜가 위, 오늘 것 찾기', () => {
    const rows = [
      { id: 1, owner_id: 'u1', processed_json: { metadata: ROOT_META } },
      { id: 2, title: 'n1', processed_json: { metadata: { team: { key: 'a', day: '2026-09-02' } } } },
      { id: 3, title: 'n2', processed_json: { metadata: NOTE_META } },
      { id: 4, title: 'other', processed_json: { metadata: { book: { key: 'bk_1', order: 1 } } } },
    ];
    expect(listTeams(rows).map((t) => t.id)).toEqual([1]);
    expect(listDayNotes(rows, 'a').map((n) => n.id)).toEqual([3, 2]);
    expect(findDayNote(rows, 'a', '2026-09-09')?.id).toBe(3);
    expect(findDayNote(rows, 'a', '2026-09-10')).toBeNull();
  });

  it('날짜 — 로컬 YYYY-MM-DD · 9/9(화) 표기 · 채널 이름', () => {
    expect(todayKey(new Date(2026, 8, 9, 23, 30))).toBe('2026-09-09');
    expect(dayLabel('2026-09-09')).toBe('9/9(수)');
    expect(dayLabel('2026-01-01')).toBe('1/1(목)');
    expect(dayLabel('x')).toBe('x');
    expect(dayNoteTitle({ name: 'A팀' }, '2026-09-09')).toBe('[A팀] 2026-09-09 수업');
    expect(classChannelName('a')).toBe('class:a');
  });
});

describe('추가 1건 = 재분석 그 줄만', () => {
  const ts = 9;
  const note = {
    raw_text: '道歉\n\nお邪魔します',
    processed_json: {
      sequence: [`id_0_0_${ts}`, `br_0_end_${ts}`, `br_1_${ts}`, `id_2_0_${ts}`, `id_2_1_${ts}`],
      dictionary: {
        [`id_0_0_${ts}`]: { text: '道歉', furigana: 'dàoqiàn', meaning: '사과하다', pos: '동사' },
        [`br_0_end_${ts}`]: { text: '\n', pos: '개행' }, [`br_1_${ts}`]: { text: '\n', pos: '개행' },
        [`id_2_0_${ts}`]: { text: 'お', pos: '접두사', meaning: '' },
        [`id_2_1_${ts}`]: { text: '邪魔します', furigana: 'じゃまします', meaning: '실례합니다', pos: '동사' },
      },
      failed_indices: [], status: 'completed', metadata: NOTE_META,
    },
  };

  it('새 항목은 새 문단(빈 줄 뒤)이고 분석 대상은 그 줄뿐 · 기존 토큰은 리맵 없이 그대로', () => {
    const plan = appendEntryPlan(note, ' ありがとう ');
    expect(plan.ok).toBe(true);
    expect(plan.newText).toBe('道歉\n\nお邪魔します\n\nありがとう');
    expect(plan.newIdx).toBe(4);
    expect(plan.selected).toEqual([4]);
    expect(plan.baseJson.dictionary[`id_2_1_${ts}`]).toEqual(note.processed_json.dictionary[`id_2_1_${ts}`]);
    expect(plan.baseJson.metadata).toEqual(NOTE_META);
  });

  it('문단 끝 개행(br_n_end_*)은 걷어낸다 — 파이프라인이 재사용 문단마다 새로 만들므로 두면 추가마다 빈 줄이 쌓인다', () => {
    const plan = appendEntryPlan(note, 'x');
    expect(plan.baseJson.sequence).toEqual([`id_0_0_${ts}`, `br_1_${ts}`, `id_2_0_${ts}`, `id_2_1_${ts}`]);
    expect(plan.baseJson.dictionary[`br_0_end_${ts}`]).toBeUndefined();
  });

  it('첫 항목은 빈 원문 없이 곧장 줄 0 · 빈 입력은 거절 · 이전 실패 줄은 함께 재시도', () => {
    expect(appendEntryPlan({ raw_text: '', processed_json: null }, '道歉')).toMatchObject({ ok: true, newText: '道歉', newIdx: 0, selected: [0] });
    expect(appendEntryPlan(note, '   ').ok).toBe(false);
    const withFailed = { ...note, processed_json: { ...note.processed_json, failed_indices: [2] } };
    expect(appendEntryPlan(withFailed, 'x').selected).toEqual([2, 4]);
  });

  it('분석 실패 대체본 — 항목은 미분석 플레이스홀더로 남고 partial, 다음 추가가 재시도할 수 있다', () => {
    const plan = appendEntryPlan(note, 'ありがとう');
    const json = appendEntryFallbackJson(plan, 77);
    expect(json.status).toBe('partial');
    expect(json.failed_indices).toEqual([4]);
    expect(json.sequence.slice(-3)).toEqual(['br_2_end_77', 'br_3_77', 'failed_4_77']);
    expect(json.dictionary.failed_4_77).toMatchObject({ text: 'ありがとう', failed: true, original_line_idx: 4 });
    expect(json.metadata).toEqual(NOTE_META);
    // 그다음 추가는 실패 줄을 다시 분석 대상에 넣는다
    expect(appendEntryPlan({ raw_text: plan.newText, processed_json: json }, '次').selected).toEqual([4, 6]);
  });

  it('원문 저장 큐와 분석은 별도 경로이며, 기존 metadata와 실패 줄만 분석한다', () => {
    const live=read('src/views/ClassLivePage.jsx'), session=read('src/lib/useClassroomSession.js');
    expect(live).toContain('useClassroomSession');
    expect(session).toContain('await appendClassroomEntry(db,row)');
    expect(session).toContain('await runPreservedReanalysis(db,note,controller.signal,analyzeText,{selectedLineIndices:selected,baseJsonOverride:base})');
    expect(session).toContain('const selected=classroomEntries(note).filter(entry=>!entry.analyzed).map(entry=>entry.idx)');
    const runner=read('src/lib/reanalysisPreservation.js');
    expect(runner).toContain('const metadata = { ...original?.metadata, viewerRevision: attempt');
  });
});

describe('정리본 항목·평문', () => {
  const ts = 1;
  const note = {
    title: '[A팀] 2026-09-09 수업',
    raw_text: '道歉\n\nお邪魔します\n\n未分析',
    processed_json: {
      sequence: [`id_0_0_${ts}`, `br_0_${ts}`, `br_1_${ts}`, `id_2_0_${ts}`, `id_2_1_${ts}`, `br_2_${ts}`, `br_3_${ts}`, `failed_4_${ts}`],
      dictionary: {
        [`id_0_0_${ts}`]: { text: '道歉', furigana: 'dào qiàn', meaning: '사과하다', pos: '동사' },
        [`br_0_${ts}`]: { text: '\n', pos: '개행' }, [`br_1_${ts}`]: { text: '\n', pos: '개행' },
        [`id_2_0_${ts}`]: { text: 'お', pos: '접두사', meaning: '' },
        [`id_2_1_${ts}`]: { text: '邪魔します', furigana: 'じゃまします', meaning: '실례합니다', pos: '동사' },
        [`br_2_${ts}`]: { text: '\n', pos: '개행' }, [`br_3_${ts}`]: { text: '\n', pos: '개행' },
        [`failed_4_${ts}`]: { text: '未分析', pos: '미분석', failed: true, original_line_idx: 4 },
      },
      failed_indices: [4], status: 'partial', metadata: NOTE_META,
    },
  };

  it('항목 = 원문 줄 + 그 줄 토큰. 읽기는 가나를 이어 붙이고(표면과 같으면 생략), 뜻은 내용 토큰을 「·」로', () => {
    const entries = noteEntries(note);
    expect(entries.map((e) => e.text)).toEqual(['道歉', 'お邪魔します', '未分析']);
    expect(entries[0]).toMatchObject({ analyzed: true, reading: 'dào qiàn', meaning: '사과하다' });
    expect(entries[1]).toMatchObject({ analyzed: true, reading: 'おじゃまします', meaning: '실례합니다' });
    expect(entries[2]).toMatchObject({ analyzed: false, reading: '', meaning: '' });
    expect(entryReading([{ text: 'ありがとう', pos: '감동사' }], 'Japanese', 'ありがとう')).toBe('');
    expect(entryReading([{ text: '你好', furigana: 'nǐ hǎo' }, { text: '吗', furigana: 'ma' }], 'Chinese', '你好吗')).toBe('nǐ hǎo ma');
    expect(entryMeaning([{ text: '。', pos: '기호', meaning: '마침표' }, { text: 'a', meaning: '뜻' }, { text: 'b', meaning: '뜻' }])).toBe('뜻');
  });

  it('평문은 제목 한 줄 뒤 `단어 — 읽기 — 뜻` 한 줄씩 — 토큰 데이터와 일치, 없는 칸은 건너뛴다', () => {
    expect(toPlainText(note)).toBe(['[A팀] 2026-09-09 수업', '', '道歉 — dào qiàn — 사과하다', 'お邪魔します — おじゃまします — 실례합니다', '未分析'].join('\n'));
  });
});

describe('판·입력판·허브 배선 계약', () => {
  const hub = read('src/views/ClassHubPage.jsx');
  const live = read('src/views/ClassLivePage.jsx');
  const board = read('src/views/ClassBoardPage.jsx');
  const queries = read('src/lib/classTeamQueries.js');

  it('세 화면·조회 모듈이 만지는 테이블은 reading_materials뿐(별도 테이블 0)', () => {
    for (const src of [hub, live, board, queries]) {
      const tables = [...src.matchAll(/\.from\('([^']+)'\)/g)].map((m) => m[1]);
      expect(new Set(tables).size <= 1 && (tables.length === 0 || tables[0] === 'reading_materials')).toBe(true);
    }
  });

  it('/live·/board는 소유자(root.owner_id === user.id)에게만 열린다 · 오너 뷰는 API 라우트를 쓰지 않는다', () => {
    for (const src of [live, board]) {
      expect(src).toMatch(/if\s*\([^)]*root\.data\.owner_id\s*!==\s*user\.id\)\s*return/);
      expect(src).not.toContain("fetch('/api/class");
    }
  });

  it('/board는 쓰기 0 — insert·update·delete·rpc·재분석 호출이 없다', () => {
    for (const bad of ['.insert(', '.update(', '.delete(', '.rpc(', 'runPreservedReanalysis', 'replaceViewerAnalysis']) {
      expect(board, `board에 ${bad}`).not.toContain(bad);
    }
  });

  it('Broadcast는 갱신 신호만, 실패 보완으로 15초 폴링을 유지한다', () => {
    expect(BOARD_POLL_MS).toBe(15_000);
    expect(board).toMatch(/refetchInterval:\s*BOARD_POLL_MS/);
    expect(board).toMatch(/openClassChannel\(team\.key,\{onEntry:\(\)=>\{refetch\(\);refreshRoot\(\);\}/);
    // 신호는 「다시 읽어라」일 뿐 — payload를 그리지 않는다
    expect(board).not.toMatch(/payload\.(text|line|entry)/);
  });

  it('암호는 브라우저에서 해시해 metadata.team.pwHash/pwSalt로만 — 평문이 행에 실리지 않는다', () => {
    expect(hub).toContain('const pwHash = await hashPassword(draft.password, pwSalt);');
    const create = sliceBetween(hub, 'async function handleCreate(e)', '\n  }\n');
    const rowArgs = sliceBetween(create, 'buildTeamRootRow({', '});');
    expect(rowArgs).toContain('pwHash, pwSalt, ownerId: user.id,');
    expect(rowArgs).not.toContain('password');
    // 행 삽입에 평문이 실리지 않는다 — insert 인자는 row 하나
    expect(create).toContain(".from('reading_materials').insert(row)");
    // 변경은 pwGen을 올린다(기존 해제 토큰 전부 무효)
    expect(hub).toContain('pwGen: (pwTarget.pwGen || 0) + 1');
    // 생성·변경 직후 한 번만 보여 준다
    expect(hub).toContain('암호는 지금만 보여요');
  });

  it('대표 뜻으로 노트 복사 · 항목별 기기 보관 후 서버 직렬 저장', () => {
    expect(live).toContain('navigator.clipboard.writeText(classroomPlainText(session.note))');
    const session=read('src/lib/useClassroomSession.js');
    expect(session.indexOf('await putClassOperation(row);')).toBeLessThan(session.indexOf("setStoreError(''); await refreshQueue(); void pump();"));
    expect(session).toContain('sending.current = true');
    expect(session).toContain("row.status === 'error'");
  });

  it('루트 행은 자료실 목록에서 숨고, 관리자 내비에 수업 링크가 있다', () => {
    expect(read('src/views/MaterialsPage.jsx')).toContain('!isTeamRoot(material)');
    expect(read('src/components/Layout.jsx')).toContain('href="/class"');
  });
});
