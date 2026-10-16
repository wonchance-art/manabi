// 로그인 화면 UX 점검(scripts/ux-audit-auth.mjs)의 순수 부품 — 합성 자료 · 판정 기록 · 보고서. 브라우저 · 서버 없음.
// 합성 자료만 만든다(운영 계정 · DB와 무관). 행 모양은 e2e 합성 백엔드(e2e/fixtures/*.mjs)가 받는 그대로다.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VIEWPORTS } from './ux-audit.mjs';

/** e2e 합성 학습자(material-editing-backend · library-v4-backend의 owner와 같다). */
export const OWNER = '00000000-0000-4000-8000-000000000172';
export const AUTH_VIEWPORT = VIEWPORTS.desktop;
export const SCREENS = Object.freeze(['review', 'library', 'viewer']);

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * 복습 대상 합성 단어 — 모두 한 번 이상 복습한(repetitions 1) 기한 지난 일본어 표현이라 「처음 보는 표현」 카드 없이
 * 앞면 → 뒷면 → 채점 → 다음 카드로 곧장 넘어간다. 뜻이 비어 있으면 줄에서 빠지므로 모두 뜻을 둔다.
 */
export function reviewWords() {
  const base = { language: 'Japanese', ease_factor: 5, repetitions: 1, created_at: '2026-01-01', last_reviewed_at: '2026-01-01' };
  return [
    { ...base, id: uuid(311), word_text: '駅', furigana: 'えき', meaning: '역', interval: 1, next_review_at: '2026-01-02', source_sentence: '駅まで歩いて十分です。' },
    { ...base, id: uuid(312), word_text: '学校', furigana: 'がっこう', meaning: '학교', interval: 3, next_review_at: '2026-01-03' },
    { ...base, id: uuid(313), word_text: '電車', furigana: 'でんしゃ', meaning: '전철', interval: 2, next_review_at: '2026-01-04' },
  ];
}

/** 서재 목록 합성 자료(개인 · 메모형) — library-management.e2e의 seed와 같은 모양, 제목 · 언어만 다양하게. */
export function libraryRows(owner = OWNER) {
  const items = [
    ['駅前の朝 — 짧은 수필', 'Japanese'], ['Le petit déjeuner à Paris', 'French'], ['北京胡同散步', 'Chinese'],
    ['A Walk in Kyoto', 'English'], ['일본어 회화 메모', 'Japanese'],
  ];
  return items.map(([title, language], i) => ({
    id: 95001 + i, owner_id: owner, visibility: 'private', title, raw_text: `${title} — 합성 본문입니다.`,
    processed_json: { status: 'note', metadata: { language, composer: { version: 1, assets: [] } } },
    created_at: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00Z`,
  }));
}

const PUNCT = /^[。、！？]$/u;
/** 뷰어 합성 자료(분석 완료) — viewer-word-card.e2e의 build()와 같은 sequence · dictionary 모양. */
export function viewerMaterial(owner = OWNER) {
  const lines = [
    [['猫', 'ねこ', '고양이', '명사'], ['が', '', '이/가', '조사'], ['駅', 'えき', '역', '명사'], ['で', '', '에서', '조사'],
      ['待って', 'まって', '기다리고', '동사'], ['います', '', '있습니다', '보조동사'], ['。', '', '', '기호']],
    [['電車', 'でんしゃ', '전철', '명사'], ['は', '', '은/는', '조사'], ['もうすぐ', '', '이제 곧', '부사'],
      ['来ます', 'きます', '옵니다', '동사'], ['。', '', '', '기호']],
  ];
  const sequence = [], dictionary = {};
  lines.forEach((words, line) => {
    words.forEach(([text, furigana, meaning, pos], i) => {
      const id = `id_${line}_${i}`; sequence.push(id);
      dictionary[id] = { text, base_form: text, furigana, meaning, pos };
    });
    if (line < lines.length - 1) {
      const id = `id_${line}_${words.length}`; sequence.push(id);
      dictionary[id] = { text: '\n', base_form: '', furigana: '', meaning: '', pos: '개행' };
    }
  });
  const texts = lines.map(words => words.map(([text]) => text).join(''));
  const headwords = new Set(Object.values(dictionary).filter(w => w.pos !== '개행' && !PUNCT.test(w.text)).map(w => w.base_form));
  return {
    id: 94201, user_id: owner, title: '역에서 기다리는 고양이', raw_text: texts.join('\n'), source_type: 'text', created_at: '2026-10-15T09:00:00Z',
    processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence, dictionary },
    headwords: [...headwords],
  };
}

/** 판정 기록 — 하나가 실패해도 다음 판정 · 캡처를 계속한다(보고서가 PASS/FAIL을 모두 보여 준다). */
export function createRecorder() {
  const results = [];
  return {
    results,
    check(screen, label, ok, detail = '') {
      const row = { screen, label, verdict: ok ? 'PASS' : 'FAIL', detail: String(detail ?? '') };
      results.push(row);
      return !!ok;
    },
    /** 판정 전에 화면이 준비되지 않은 경우(대기 실패 · 예외) — 그 화면의 나머지는 확인하지 못했다고 남긴다. */
    error(screen, label, error) {
      results.push({ screen, label, verdict: 'FAIL', detail: `중단: ${String(error?.message || error).split('\n')[0]}` });
    },
  };
}

export function verdictCounts(results) {
  const pass = results.filter(r => r.verdict === 'PASS').length;
  return { pass, fail: results.length - pass, total: results.length };
}

/** 사람이 읽는 한 줄씩 — 터미널 출력용. */
export function verdictLines(results) {
  return results.map(r => `${r.verdict === 'PASS' ? 'PASS' : 'FAIL'}  [${r.screen}] ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
}

export function markdown({ stamp, baseURL, viewport = AUTH_VIEWPORT, results, shots = [], flags = [], rows = [] }) {
  const { pass, fail } = verdictCounts(results);
  const lines = [`# 로그인 화면 UX 점검 — ${stamp} KST`, '',
    `서버 ${baseURL} · 합성 로그인(e2e 합성 백엔드) · ${viewport.width}×${viewport.height} · 판정 PASS ${pass} · FAIL ${fail}`, '',
    '| 판정 | 화면 | 확인한 것 | 근거 |', '|:-:|---|---|---|'];
  for (const r of results) lines.push(`| ${r.verdict} | ${r.screen} | ${r.label} | ${r.detail.replace(/\|/g, '\\|')} |`);
  const failed = [...new Set((rows || []).flatMap(r => r.failedResponses || []))];
  lines.push('', '## 5xx 응답(합성 백엔드가 받지 않아 실제 next 서버로 간 요청 포함)', '', ...(failed.length ? failed.map(f => `- \`${f}\``) : ['- 없음']));
  lines.push('', '## 캡처', '', ...(shots.length ? shots.map(s => `- \`${s.name}\` — ${s.note}`) : ['- 없음']));
  lines.push('', '## 기계 플래그(ux-audit 측정과 같은 기준 — 판단 전 후보)', '', ...(flags.length ? flags.map(f => `- **${f.kind}** ${f.at} — ${f.detail}`) : ['- 없음']));
  lines.push('', '## 이 점검으로도 보이지 않는 것', '', '- 실계정 데이터의 양 · 모양(합성 단어 3개 · 자료 5개 · 짧은 뷰어 자료)',
    '- FSRS 활성 계정의 복습 화면(FsrsReviewSession — 합성 백엔드는 비활성 FSRS 계약만 준다)', '- 학습 세션(/study) · 대화 진행', '');
  return lines.join('\n');
}

/**
 * `.next`가 e2e 공개 값(https://e2e.supabase.co)으로 빌드됐는가 — NEXT_PUBLIC_*는 빌드 때 번들에 인라인되므로
 * 다른 값으로 만든 빌드에서는 합성 로그인이 조용히 실패한다(e2e/README.md · #869 오판 선례).
 */
export async function builtForE2E(nextDir, supabaseURL = 'https://e2e.supabase.co') {
  let names;
  try { names = await readdir(join(nextDir, 'static', 'chunks'), { recursive: true }); } catch { return false; }
  for (const name of names) {
    if (!name.endsWith('.js')) continue;
    try { if ((await readFile(join(nextDir, 'static', 'chunks', name), 'utf8')).includes(supabaseURL)) return true; } catch { /* 디렉터리 */ }
  }
  return false;
}
