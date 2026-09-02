import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_SENTENCE_MAX, VOCAB_UPSERT, buildVocabRow, normalizeWordText } from '../vocabIO';

/**
 * 계약: 단어 저장 페이로드 수렴 (오너 "ㄱ", 2026-09-01).
 *
 * ── 실측이 규모를 두 배로 고쳤다
 *
 * 이 건은 H R3에서 「`user_vocabulary` upsert **6곳**」으로 적립됐는데, 전수하니
 * **쓰기 경로가 11개**였다. 손으로 센 숫자를 그대로 믿을 뻔했다.
 *
 * ── 진짜 버그는 하나였다
 *
 * `PdfViewerPage`·`QuickPage`가 `word_text`에 **surface(활용형)** 를 넣고 `ViewerPage`는
 * **base(기본형)** 를 넣었다. `onConflict: 'user_id,word_text'`는 키가 다르면 못 막으므로,
 * 같은 단어를 두 문으로 담으면 **행이 둘로 갈리고 복습이 두 번 온다**. 화면은 멀쩡해
 * 보인다 — 뷰어의 저장 판정이 surface·base 두 집합을 다 보기 때문이다.
 *
 * `normalizeWordText` 규약은 **이미 있었고 7개 토큰 경로 중 2곳만** 쓰고 있었다.
 * 없던 건 규약이 아니라 **그걸 강제하는 조립 지점**이다.
 *
 * ── 범위
 *
 * 수렴 대상은 **분석된 토큰을 담는 7경로**다. 참조 덱·문형 색인·CSV 가져오기·수동 추가는
 * `word_text`가 애초에 사전 표제어라 surface/base가 갈릴 여지가 없고 페이로드 모양도
 * 달라(어원·한자·덱 라벨) 이 라운드 밖으로 뒀다 — 적립.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석을 뺀 코드만 — 「손조립 금지」 검사가 **설명 주석**에 걸리면 안 된다. */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** 토큰을 담는 경로 전수 — 여기 없는 파일이 새로 담기 시작하면 아래 검사가 안 돈다. */
const TOKEN_SAVE_SITES = [
  'src/views/ViewerPage.jsx',
  'src/views/PdfViewerPage.jsx',
  'src/views/QuickPage.jsx',
  'src/views/StudySessionPage.jsx',
  'src/components/world/NpcDialog.jsx',
  'src/lib/learn/progressStore.js',
  'src/views/WritingStudioPage.jsx', // U R2 — 못 쓴 말 담기
];

describe('정본 조립기 — word_text가 갈리지 않는다', () => {
  it('기본형이 있으면 기본형을 담는다 — 이게 갈려서 행이 둘로 나뉘었다', () => {
    const r = buildVocabRow({ userId: 'u', surface: '食べた', base: '食べる', language: 'Japanese' });
    expect(r.word_text, 'surface를 담으면 자료 뷰어가 담은 행과 갈린다').toBe('食べる');
  });

  it('기본형이 없으면 surface로 폴백한다 — 분석기가 base를 안 주는 언어가 있다', () => {
    expect(buildVocabRow({ userId: 'u', surface: 'apple' }).word_text).toBe('apple');
    expect(normalizeWordText({ surface: 'apple' })).toBe('apple');
  });

  it('base_form은 항상 채운다 — 비면 다른 문에서 "안 담긴 것"으로 보인다', () => {
    // 뷰어의 저장 판정이 surface·base 두 집합을 다 본다. base_form이 비면 그 단어가
    // 활용형으로 등장했을 때 저장 표시가 안 뜬다.
    expect(buildVocabRow({ userId: 'u', surface: 'apple' }).base_form).toBe('apple');
    expect(buildVocabRow({ userId: 'u', surface: '食べた', base: '食べる' }).base_form).toBe('食べる');
  });

  it('next_review_at을 항상 싣는다 — 컬럼 기본값을 확인할 수 없는 테이블이다', () => {
    // `ignoreDuplicates`라 갱신이 없으므로 **삽입 때만** 쓰인다. 항상 실으면 기본값이
    // 무엇이든 결과가 같아, 확인 못 하는 것에 의존하지 않게 된다.
    expect(buildVocabRow({ userId: 'u', surface: 'x', now: () => 'T' }).next_review_at).toBe('T');
  });

  it('출처는 있을 때만 키가 생긴다 — null로 덮으면 먼저 담긴 출처가 지워진다', () => {
    const bare = buildVocabRow({ userId: 'u', surface: 'x' });
    expect('source_sentence' in bare).toBe(false);
    expect('source_material_id' in bare).toBe(false);
    expect('source_ref' in bare).toBe(false);
    const rich = buildVocabRow({ userId: 'u', surface: 'x', sourceSentence: '문장', sourceMaterialId: 7, sourceRef: 'deck' });
    expect(rich.source_sentence).toBe('문장');
    expect(rich.source_material_id).toBe(7);
    expect(rich.source_ref).toBe('deck');
  });

  it('출처 문장에 상한이 있다 — 세 곳이 각자 slice(0, 200)을 적고 있었다', () => {
    const long = buildVocabRow({ userId: 'u', surface: 'x', sourceSentence: 'あ'.repeat(500) });
    expect(long.source_sentence).toHaveLength(SOURCE_SENTENCE_MAX);
  });

  it('빈 값이 undefined로 새지 않는다 — 컬럼에 undefined를 보내면 키가 통째로 빠진다', () => {
    const r = buildVocabRow({ userId: 'u', surface: 'x' });
    expect(r.meaning).toBe('');
    expect(r.pos).toBe('');
    expect(r.furigana).toBe('');
    expect(r.language, '언어 미지정 폴백').toBe('Japanese');
  });
});

describe('정본 옵션 — 이미 있는 기억을 덮지 않는다', () => {
  it('ignoreDuplicates가 켜져 있다', () => {
    expect(VOCAB_UPSERT.ignoreDuplicates).toBe(true);
    expect(VOCAB_UPSERT.onConflict).toBe('user_id,word_text');
  });

  it('얼어 있다 — 호출부가 실수로 고치면 다른 경로까지 같이 바뀐다', () => {
    expect(Object.isFrozen(VOCAB_UPSERT)).toBe(true);
  });
});

describe('배선 — 토큰 저장 7경로가 정본을 탄다', () => {
  it('여섯 파일이 모두 조립기를 쓴다', () => {
    for (const f of TOKEN_SAVE_SITES) {
      expect(read(f), `${f}: 정본 조립기 미사용`).toContain('buildVocabRow(');
    }
  });

  it('행을 손으로 조립하는 자리가 없다', () => {
    // 이 검사가 이 라운드의 본체다. 새 저장 자리가 손으로 적히면 여기서 잡힌다.
    for (const f of TOKEN_SAVE_SITES) {
      expect(codeOf(read(f)), `${f}: word_text 손조립 부활`).not.toMatch(/word_text:\s/);
    }
  });

  it('옵션도 손으로 적지 않는다', () => {
    for (const f of TOKEN_SAVE_SITES) {
      expect(codeOf(read(f)), `${f}: 옵션 손조립`).not.toContain("onConflict: 'user_id,word_text'");
      expect(read(f), `${f}: 정본 옵션 미사용`).toContain('VOCAB_UPSERT');
    }
  });

  it('세션 신규어 기록이 insert가 아니라 upsert다 — 중복이 조용한 실패였다', () => {
    const src = read('src/lib/learn/progressStore.js');
    expect(src).toContain('.upsert([row], VOCAB_UPSERT)');
    expect(codeOf(src), 'insert 부활').not.toMatch(/\.insert\(\[row\]\)/);
  });

  it('폴백이 word_text를 벗기지 않는다 — 단어 없는 행을 넣으려 하고 있었다', () => {
    // 주석은 「base_form 없이 폴백」인데 구조분해가 word_text까지 벗겼다. 늘 조용히 실패.
    const src = read('src/lib/learn/progressStore.js');
    expect(codeOf(src)).not.toMatch(/const \{ word_text, base_form, \.\.\.fallback \}/);
    expect(src).toContain('const { base_form: _dropped, ...fallback } = row;');
  });
});

describe('범위 — 이 라운드 밖은 밖이라고 적는다', () => {
  it('참조·수동·CSV 경로는 건드리지 않았다', () => {
    // 이들은 word_text가 애초에 사전 표제어라 surface/base가 갈릴 여지가 없고,
    // 페이로드도 다르다(어원·한자·덱 라벨). 같이 뭉치면 그 정보가 정본에서 새어 나간다.
    for (const f of ['src/views/ReferenceVocabPage.jsx', 'src/views/VocabPage.jsx']) {
      expect(read(f), `${f}: 범위 밖인데 수렴됨`).not.toContain('buildVocabRow');
    }
  });
});
