// 대화 화면·방 목록의 표시 규칙(CONV-CHAT-001 2차) — 날짜 구분선·목록 시각·마지막 말 미리보기.
// 시각은 KST 고정(CLAUDE.md). 순수 함수만 둔다.
const KST_MS = 9 * 3600e3;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const kst = (ms) => {
  if (ms == null || ms === '') return null;
  const t = typeof ms === 'string' ? Date.parse(ms) : Number(ms);
  return Number.isFinite(t) ? new Date(t + KST_MS) : null;
};

/** 같은 날 묶음 열쇠 — 「2026-10-15」(KST). 시각이 없으면 null. */
export function kstDateKey(ms) {
  const d = kst(ms);
  return d ? d.toISOString().slice(0, 10) : null;
}

/** 대화방 가운데 날짜 구분선 — 「2026년 10월 15일 목요일」(메신저 관례). */
export function chatDateLabel(ms) {
  const d = kst(ms);
  if (!d) return '';
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}

/** 말풍선 옆 시각 — 「오후 3:07」(KST). */
export function clockLabel(ms) {
  const d = kst(ms);
  if (!d) return '';
  const h = d.getUTCHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** 방 목록 시각 — 오늘은 「오후 3:07」, 어제는 「어제」, 그 전은 「10월 12일」, 다른 해는 「2025. 10. 12.」. */
export function roomTimeLabel(ms, nowMs = Date.now()) {
  const d = kst(ms);
  const now = kst(nowMs);
  if (!d || !now) return '';
  const key = kstDateKey(ms);
  if (key === kstDateKey(nowMs)) return clockLabel(ms);
  if (key === kstDateKey(nowMs - 86400e3)) return '어제';
  if (d.getUTCFullYear() === now.getUTCFullYear()) return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
}

export const ROOM_PREVIEW_CHARS = 60;

/**
 * 방 목록 한 줄 미리보기 — 서버가 남긴 마지막 튜터 말(conversation.preview)이 있으면 그것,
 * 없으면(옛 대화) 마지막 내 말, 그것도 없으면 빈 문자열. 길면 자른다.
 */
export function roomPreview({ preview = '', turns = [] } = {}) {
  let text = String(preview || '').trim();
  if (!text) {
    const lastMe = [...(turns || [])].reverse().find((t) => t?.who === 'me' && t.text);
    text = lastMe ? `나: ${lastMe.text}` : '';
  }
  text = text.replace(/\s+/g, ' ');
  return text.length > ROOM_PREVIEW_CHARS ? `${text.slice(0, ROOM_PREVIEW_CHARS)}…` : text;
}

/** 방의 마지막 활동 시각(ms) — 서버가 남긴 lastAt, 없으면(옛 대화) 마지막 턴의 at, 그것도 없으면 만든 시각. */
export function roomLastAt({ lastAt = null, turns = [], createdAt = null } = {}) {
  if (lastAt != null && lastAt !== '' && Number.isFinite(Number(lastAt))) return Number(lastAt);
  const last = [...(turns || [])].reverse().find((t) => t?.at != null && Number.isFinite(Number(t.at)));
  if (last) return Number(last.at);
  const t = Date.parse(createdAt || '');
  return Number.isFinite(t) ? t : null;
}

// 주제 방의 프로필 글자 — 그림 기호 하나(상표·국기 그림 아님). 모르는 주제는 말풍선.
export const ROOM_ICONS = Object.freeze({ '오늘 하루': '☀️', '주말 계획': '📅', '여행': '✈️', '음식': '🍜', '학교·일': '🏫', '취미': '🎨' });

/**
 * 방 목록 — 이 언어의 내 대화를 「한 주제(·자료) = 한 방」으로 접고 최근 활동순, 그 뒤에 아직 안 연 기본 주제.
 * @param {Array<{id, title, topic, language, parentId, createdAt, turns, preview}>} rows 최신순 내 대화
 * @returns {Array<{key, id: string|null, topic, name, icon, preview, lastAt}>}
 */
export function conversationRooms(rows, { language, topics = [] } = {}) {
  const seen = new Map();
  for (const row of rows || []) {
    if (row.language && language && row.language !== language) continue;
    const topic = String(row.topic || row.title || '대화').trim();
    const key = row.parentId ? `material:${row.parentId}` : `topic:${topic}`;
    const lastAt = roomLastAt(row);
    const prev = seen.get(key);
    if (prev && (prev.lastAt || 0) >= (lastAt || 0)) continue;
    seen.set(key, {
      key, id: String(row.id), topic, name: row.parentId ? `${row.title || topic} 대화` : topic,
      icon: row.parentId ? '📖' : ROOM_ICONS[topic] || '💬', preview: roomPreview(row), lastAt,
    });
  }
  const started = [...seen.values()].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  const fresh = topics.filter((t) => !seen.has(`topic:${t}`))
    .map((t) => ({ key: `topic:${t}`, id: null, topic: t, name: t, icon: ROOM_ICONS[t] || '💬', preview: '', lastAt: null }));
  return [...started, ...fresh];
}
