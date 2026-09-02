import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { MATERIAL_DIRECTION, isWriteMaterial, LANG_NAME_KO } from '../constants';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const add = read('src/views/MaterialAddPage.jsx');
const list = read('src/views/MaterialsPage.jsx');
const sql = read('supabase/migrations/20260902130000_material_direction.sql');

/**
 * 계약: U R3 내 노트(쓰기 자료) — #1077 5503520174 R3.
 * 노트는 reading_materials의 행이다(별도 테이블 금지 — 노션화 방어선) · direction='write'는 분석 큐에
 * 들어가지 않는다 · 기존 자료(read)의 동작은 한 줄도 안 바뀐다 · 자료실 탭 수 불변 · 자동 번역 진입점 0.
 */
describe('내 노트 — 방향 축 (constants·migration)', () => {
  it('정본 상수 하나 — read/write. language=Korean을 4종 상수에 더하지 않았다(오너 결정)', () => {
    expect(MATERIAL_DIRECTION).toEqual({ READ: 'read', WRITE: 'write' });
    expect(isWriteMaterial({ direction: 'write' })).toBe(true);
    expect(isWriteMaterial({ direction: 'read' })).toBe(false);
    expect(isWriteMaterial(null)).toBe(false);
    expect(Object.keys(LANG_NAME_KO)).toEqual(['Japanese', 'English', 'French', 'Chinese']);
  });

  it('마이그레이션 — 컬럼 1개(기본 read·CHECK), 별도 테이블 없음, 코드로만(적용은 오너)', () => {
    expect(sql).toMatch(/ALTER TABLE reading_materials\s+ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'read'/);
    expect(sql).toContain("CHECK (direction IN ('read', 'write'))");
    expect(sql).not.toMatch(/CREATE TABLE/i);
    expect(sql).toContain('운영 DB 적용은 오너 수동');
  });
});

describe('추가 화면 (MaterialAddPage)', () => {
  it('「내 노트」 갈래 — 저장 흐름은 하나(같은 insert), direction=write·비공개 고정, 목표어를 그대로 선언', () => {
    expect(add).toContain("const [direction, setDirection] = useState(MATERIAL_DIRECTION.READ);");
    expect(add).toContain('const isNote = direction === MATERIAL_DIRECTION.WRITE;');
    expect(add).toContain('...(isNote ? { direction: MATERIAL_DIRECTION.WRITE } : {}),');
    expect(add).toContain("visibility: (pdfSource || epubSource || isNote) ? 'private' : visibility,");
    expect(add.match(/\.from\('reading_materials'\)\s*\.insert\(\[materialRow\]\)/g)).toHaveLength(1);
    // 학습 언어 토글은 그대로(4종 밖 'Korean' 없음)
    expect(add).not.toContain("'Korean'");
    expect(add).toContain('내 노트');
  });

  it("direction=write는 분석 큐에 들어가지 않는다 — status 'note'로 저장하고 runBackgroundAnalysis를 호출하지 않는다", () => {
    expect(add).toContain(`status: isNote ? 'note' : "analyzing"`);
    const after = sliceBetween(add, 'if (isNote) {', "setStatus('저장 완료. 백그라운드 분석을 시작합니다...');");
    expect(after).not.toContain('runBackgroundAnalysis(');
    expect(after).toContain('setCompletedId(data[0].id);');
    expect(after).toContain('return;');
    // 읽기 자료 경로는 그대로
    expect(add).toContain('runBackgroundAnalysis(data[0].id, rawText, controller.signal);');
  });

  it('자동 번역 진입점이 없다(번역기화 방어선)', () => {
    expect(add).not.toMatch(/번역하기|translate\(/i);
  });
});

describe('자료실 (MaterialsPage)', () => {
  it('노트는 「내 자료」 안에 함께 보인다 — 탭은 둘 그대로, 노트 배지 하나, 분석 상태 배지는 달리지 않는다', () => {
    expect(list.match(/className=\{`tab-pills__item /g)).toHaveLength(2);
    expect(list).toContain("const isNote = isWriteMaterial(m) || m.processed_json?.status === 'note';");
    expect(list).toContain("const status = isNote ? 'note' : (m.processed_json?.status || 'idle');");
    expect(list).toContain('✍ 내 노트');
    const labels = sliceBetween(list, 'const STATUS_LABEL = {', '};');
    expect(labels).not.toContain('note'); // 'note'는 라벨 없음 → 배지 없음
  });

  it('direction 컬럼 미적용 환경 폴백 — 컬럼 없이 같은 조회를 한 번 더(기존 자료 동작 불변)', () => {
    expect(list).toContain("const MATERIAL_LIST_COLS = 'id, title, created_at, visibility, owner_id, processed_json, source_pdf_id, page_start, page_end';");
    expect(list).toContain('.select(withDirection ? `${MATERIAL_LIST_COLS}, direction` : MATERIAL_LIST_COLS)');
    expect(list).toContain('if (/column|schema|direction/i.test(error.message || \'\')) {');
    expect(list).toContain('fetchMaterialsWithoutDirection({ tab, userId, langFilter, levelFilter, searchQuery })');
  });
});
