/**
 * 수업 판 — 순수 부품 (v2-AB R1, #1077 설계 5603827169 §3·§5 · 오너 확정 2026-09-09).
 *
 * 구조 한 줄: 「수업 정리본 = 그날의 자료 행 하나, 팀 설정 = 루트 자료 하나」. 새 테이블 0 —
 * 팀·정리본 정보는 전부 `reading_materials.processed_json.metadata.team`에만 산다.
 *
 *   팀 루트 자료   metadata.team = { key, name, lang, bookKey, bookTotal, chapterId, pwHash, pwSalt, pwGen, root: true }
 *   그날 정리본    metadata.team = { key, day, chapterId }   · raw_text = 항목마다 한 문단(빈 줄 구분)
 *
 * 항목을 문단(빈 줄)으로 가르는 이유: 분석 파이프라인(analyzeText)이 문단 단위로 재사용/재분석을
 * 가르므로, 한 항목 = 한 문단이어야 「추가 1건 = 재분석 그 줄만」 계약이 성립한다.
 */

/** 팀 키 — URL 조각. 소문자·숫자·하이픈 1~16자, 하이픈으로 시작하지 않는다(`/class/a`). 생성 후 불변. */
export const TEAM_KEY_RE = /^[a-z0-9][a-z0-9-]{0,15}$/;
/** 암호 최소 길이(설계 §0 숫자). */
export const TEAM_PW_MIN = 6;
/** 태블릿 판 폴링 간격 — Broadcast가 끊겨도 이 안에 최신(계약 R1 ③). */
export const BOARD_POLL_MS = 15_000;
/** Broadcast 채널 이름 — 판은 이 채널의 신호를 「다시 읽어라」로만 쓴다(내용은 RLS 조회가 정본). */
export const classChannelName = (key) => `class:${key}`;

const isTeamKey = (v) => typeof v === 'string' && TEAM_KEY_RE.test(v);

/** metadata에서 팀 정보 추출(형식 검증) — 아니면 null. 루트·정리본 공용. */
export function getTeam(metadata) {
  const t = metadata?.team;
  if (!t || typeof t !== 'object' || !isTeamKey(t.key)) return null;
  const out = { key: t.key };
  if (t.root === true) {
    out.root = true;
    out.name = typeof t.name === 'string' && t.name.trim() ? t.name.trim() : t.key;
    out.lang = typeof t.lang === 'string' && t.lang ? t.lang : 'Japanese';
    out.bookKey = typeof t.bookKey === 'string' && t.bookKey ? t.bookKey : null;
    out.bookTotal = Number.isFinite(Number(t.bookTotal)) && Number(t.bookTotal) > 0 ? Number(t.bookTotal) : null;
    out.chapterId = t.chapterId != null && String(t.chapterId) ? String(t.chapterId) : null;
    out.pwHash = typeof t.pwHash === 'string' ? t.pwHash : null;
    out.pwSalt = typeof t.pwSalt === 'string' ? t.pwSalt : null;
    out.pwGen = Number.isFinite(Number(t.pwGen)) ? Number(t.pwGen) : 0;
  } else {
    out.root = false;
    out.day = typeof t.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.day) ? t.day : null;
    out.chapterId = t.chapterId != null && String(t.chapterId) ? String(t.chapterId) : null;
  }
  return out;
}

/** 팀 루트 자료인가 — 자료실 목록에서 숨기는 판정(설정 행이 자료로 보이면 안 된다). */
export function isTeamRoot(material) {
  return getTeam(material?.processed_json?.metadata)?.root === true;
}

/** 그날 정리본인가. */
export function isDayNote(material) {
  const t = getTeam(material?.processed_json?.metadata);
  return !!t && !t.root && !!t.day;
}

/** 로컬 날짜 키 `YYYY-MM-DD` — 수업은 오너의 로컬 시간대에서 열린다. */
export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** `2026-09-09` → `9/9(화)`. 형식이 아니면 그대로. */
export function dayLabel(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return String(day || '');
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[2])}/${Number(m[3])}(${WEEKDAYS[date.getDay()]})`;
}

/** 정리본 제목 — `[A팀] 2026-09-09 수업`. */
export function dayNoteTitle(team, day) {
  return `[${team?.name || team?.key || '팀'}] ${day} 수업`;
}

/** 팀 루트 자료 제목. */
export function teamRootTitle(team) {
  return `[${team?.name || team?.key || '팀'}] 팀 설정`;
}

/** 내 자료 행들에서 팀 루트 목록(팀 키 순). */
export function listTeams(materials) {
  const out = [];
  for (const m of materials || []) {
    const t = getTeam(m?.processed_json?.metadata);
    if (t?.root) out.push({ ...t, id: m.id, owner_id: m.owner_id, material: m });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** 팀의 정리본 목록 — 날짜 내림차순(오늘이 맨 위). */
export function listDayNotes(materials, teamKey) {
  const out = [];
  for (const m of materials || []) {
    const t = getTeam(m?.processed_json?.metadata);
    if (t && !t.root && t.key === teamKey && t.day) out.push({ id: m.id, title: m.title, day: t.day, chapterId: t.chapterId, material: m });
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/** 그날 정리본 찾기. */
export function findDayNote(materials, teamKey, day) {
  return listDayNotes(materials, teamKey).find((n) => n.day === day)?.material || null;
}

/**
 * 새 정리본 행 — 첫 항목과 함께 태어난다(빈 원문 자료를 만들지 않는다). 분석은 호출측이
 * 파이프라인(runPreservedReanalysis, selected=[0])으로 돌린다.
 */
export function buildDayNoteRow({ team, day, ownerId, firstLine, chapterId = null }) {
  const line = String(firstLine || '').trim();
  return {
    title: dayNoteTitle(team, day),
    raw_text: line,
    processed_json: {
      sequence: [], dictionary: {}, last_idx: -1, status: 'pending', failed_indices: [],
      metadata: {
        language: team?.lang || 'Japanese',
        team: { key: team.key, day, ...(chapterId ? { chapterId: String(chapterId) } : {}) },
        updated_at: new Date().toISOString(),
      },
    },
    visibility: 'private',
    owner_id: ownerId,
  };
}

/** 팀 루트 자료 행(신규). 암호는 **해시·솔트만** 받는다 — 평문은 이 모듈에 들어오지 않는다. */
export function buildTeamRootRow({ key, name, lang, bookKey = null, bookTotal = null, pwHash, pwSalt, ownerId }) {
  if (!isTeamKey(key)) throw new Error('팀 키는 소문자·숫자·하이픈 1~16자예요.');
  const team = {
    key, name: String(name || '').trim() || key, lang: lang || 'Japanese',
    ...(bookKey ? { bookKey } : {}),
    ...(Number(bookTotal) > 0 ? { bookTotal: Number(bookTotal) } : {}),
    pwHash, pwSalt, pwGen: 1, root: true,
  };
  return {
    title: teamRootTitle(team),
    raw_text: `${team.name} 수업 팀 설정`,
    processed_json: {
      sequence: [], dictionary: {}, last_idx: -1, status: 'idle', failed_indices: [],
      metadata: { language: team.lang, team, updated_at: new Date().toISOString() },
    },
    visibility: 'private',
    owner_id: ownerId,
  };
}

/** 루트 metadata에 팀 필드를 덮어쓴 새 processed_json — 키·root는 바꿀 수 없다. */
export function patchTeamRoot(processedJson, patch) {
  const prev = processedJson?.metadata?.team || {};
  const next = { ...prev, ...patch, key: prev.key, root: true };
  return {
    ...(processedJson || { sequence: [], dictionary: {}, last_idx: -1, status: 'idle', failed_indices: [] }),
    metadata: { ...(processedJson?.metadata || {}), language: next.lang || processedJson?.metadata?.language, team: next, updated_at: new Date().toISOString() },
  };
}

/**
 * 항목 추가 계획 — 새 항목을 **새 문단**으로 붙이고 그 줄만 분석 대상으로 낸다.
 * 기존 토큰은 줄 번호가 밀리지 않으므로 리맵이 필요 없다(뒤에 붙이기만 한다).
 * 문단 끝 개행 토큰(`br_{n}_end_*`)은 파이프라인이 재사용 문단마다 새로 만들므로 여기서 걷어낸다 —
 * 걷어내지 않으면 추가할 때마다 하나씩 쌓여 빈 줄이 늘어난다(파이프라인 재사용 경로의 성질).
 * 이전에 실패한 줄이 있으면 함께 재시도한다.
 */
export function appendEntryPlan(material, line) {
  const entry = String(line || '').trim();
  if (!entry) return { ok: false, reason: '빈 항목' };
  const oldText = String(material?.raw_text ?? '');
  const newText = oldText.trim() ? `${oldText}\n\n${entry}` : entry;
  const newIdx = newText.split('\n').length - 1;
  const json = material?.processed_json || { sequence: [], dictionary: {}, failed_indices: [] };
  const sequence = (json.sequence || []).filter((id) => !/^br_\d+_end_/.test(id));
  const dictionary = {};
  for (const id of sequence) dictionary[id] = json.dictionary?.[id];
  const failed = (json.failed_indices || []).filter((i) => Number.isInteger(i) && i < newIdx);
  return {
    ok: true,
    newText,
    newIdx,
    baseJson: { ...json, sequence, dictionary, failed_indices: failed },
    selected: [...new Set([...failed, newIdx])].sort((a, b) => a - b),
  };
}

/**
 * 분석이 실패했을 때의 대체 저장본 — 항목은 뜻 없이 들어가고(`failed_` 플레이스홀더), 다음 추가가
 * 재시도한다(설계 §8 「넘기면 그 줄만 뜻 없이 들어가고 재분석이 채운다」).
 */
export function appendEntryFallbackJson(plan, timestamp = Date.now()) {
  const base = plan.baseJson;
  const lines = plan.newText.split('\n');
  const sequence = [...base.sequence];
  const dictionary = { ...base.dictionary };
  const lastOld = plan.newIdx - 2; // 새 문단 앞 빈 줄(newIdx-1)과 그 앞 줄
  if (lastOld >= 0) {
    const endId = `br_${lastOld}_end_${timestamp}`;
    sequence.push(endId); dictionary[endId] = { text: '\n', pos: '개행' };
    const blankId = `br_${plan.newIdx - 1}_${timestamp}`;
    sequence.push(blankId); dictionary[blankId] = { text: '\n', pos: '개행' };
  }
  const failedId = `failed_${plan.newIdx}_${timestamp}`;
  sequence.push(failedId);
  dictionary[failedId] = { text: lines[plan.newIdx], pos: '미분석', failed: true, original_line_idx: plan.newIdx };
  const failed_indices = [...new Set([...(base.failed_indices || []), plan.newIdx])].sort((a, b) => a - b);
  return { ...base, sequence, dictionary, failed_indices, status: 'partial' };
}

const SKIP_POS = new Set(['기호', '개행', '미분석']);

/** 항목(줄)별 토큰 묶음 — 정리본·판·평문 내보내기가 같은 것을 읽는다. */
export function noteEntries(material) {
  const json = material?.processed_json || {};
  const lang = json.metadata?.language || 'Japanese';
  const byLine = new Map();
  for (const id of json.sequence || []) {
    const m = /^(?:id|failed)_(\d+)_/.exec(id);
    if (!m) continue;
    const t = json.dictionary?.[id];
    if (!t || t.pos === '개행') continue;
    const idx = Number(m[1]);
    if (!byLine.has(idx)) byLine.set(idx, []);
    byLine.get(idx).push(t);
  }
  const out = [];
  String(material?.raw_text || '').split('\n').forEach((raw, idx) => {
    const text = raw.trim();
    if (!text) return;
    const tokens = byLine.get(idx) || [];
    const analyzed = tokens.length > 0 && !tokens.some((t) => t.failed);
    out.push({ idx, text, tokens, analyzed, reading: analyzed ? entryReading(tokens, lang, text) : '', meaning: analyzed ? entryMeaning(tokens) : '' });
  });
  return out;
}

/** 읽기 — 일본어는 토큰 읽기(가나는 표면)를 이어 붙이고, 중국어는 병음을 띄어 잇는다. 표면과 같으면 빈 문자열. */
export function entryReading(tokens, lang, text) {
  const content = tokens.filter((t) => t?.text && !SKIP_POS.has(t.pos));
  if (content.length === 0) return '';
  if (lang === 'Chinese') return content.map((t) => t.furigana || '').filter(Boolean).join(' ');
  if (lang === 'Japanese') {
    if (!content.some((t) => t.furigana)) return '';
    const reading = content.map((t) => t.furigana || t.text).join('');
    return reading === text ? '' : reading;
  }
  return content.length === 1 ? (content[0].furigana || '') : '';
}

/** 뜻 — 내용 토큰의 뜻을 「·」로 잇는다. 하나면 그 뜻. */
export function entryMeaning(tokens) {
  const meanings = tokens
    .filter((t) => t?.meaning && !SKIP_POS.has(t.pos))
    .map((t) => String(t.meaning).trim())
    .filter(Boolean);
  return [...new Set(meanings)].join(' · ');
}

/** 카톡용 평문 — 제목 한 줄 뒤 `단어 — 읽기 — 뜻` 한 줄씩(없는 칸은 건너뛴다). */
export function toPlainText(material) {
  const lines = noteEntries(material).map((e) => [e.text, e.reading, e.meaning].filter(Boolean).join(' — '));
  return [material?.title || '', '', ...lines].join('\n').trim();
}
