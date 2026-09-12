import {TEAM_KEY_RE, getTeam, todayKey} from './classBoard';

// A teacher owns this team; a global role or a reader URL never grants access.
export function canTeachClass(user, root, material = null) {
  const team = getTeam(root?.processed_json?.metadata);
  if (!user?.id || !root?.id || root.owner_id !== user.id || !team?.root) return false;
  if (!material) return true;
  if (material.owner_id !== user.id) return false;
  const meta = material.processed_json?.metadata || {};
  return !!((team.bookKey && meta.book?.key === team.bookKey) || meta.team?.key === team.key);
}

export function classDay(value, fallback = todayKey()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value ? value : fallback;
}

export function startingChapter(team, chapters) {
  return chapters.find(ch => String(ch.id) === String(team?.chapterId)) || chapters[0] || null;
}

export function classWorkspaceHref(id, team, day = todayKey()) {
  if (!TEAM_KEY_RE.test(team || '') || !/^\d+$/.test(String(id))) return null;
  return `/viewer/${id}?${new URLSearchParams({class: team, day: classDay(day), returnTo: `/class/${team}`})}`;
}

export function classSettingsPatch(team, draft, books) {
  const name = String(draft.name || '').trim();
  if (!name || name.length > 80) throw new Error('수업 이름을 80자 이내로 적어 주세요.');
  if (!['Japanese', 'Chinese', 'French', 'English'].includes(draft.lang)) throw new Error('수업 언어를 선택해 주세요.');
  const bookKey = draft.bookKey || null;
  const selected = books.find(book => book.key === bookKey);
  if (bookKey && bookKey !== team.bookKey && !selected) throw new Error('연결할 교재를 다시 선택해 주세요.');
  return {name, lang: draft.lang, bookKey,
    ...(bookKey !== team.bookKey ? {chapterId: null, bookTotal: selected?.count || null} : {})};
}

// A remembered chapter may change while the settings form is open. Keep fields
// the teacher did not touch, but never overwrite another writer's setting.
export function rebaseClassSettings(base, latest, draft) {
  const merged = {...draft};
  for (const field of ['name','lang','bookKey']) {
    const before = base[field] || '', now = latest[field] || '', input = draft[field] || '';
    if (input === before) merged[field] = now;
    else if (now !== before && now !== input) {
      const error = new Error('다른 창에서 수업 설정이 바뀌었어요. 최신 설정을 불러와 다시 확인해 주세요.');
      error.code = '40001'; throw error;
    }
  }
  return merged;
}
