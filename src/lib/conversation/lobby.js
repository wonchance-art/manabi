// 모두의 대화방(CONV-LOBBY-001) — 학습 언어마다 하나인 사용자끼리의 방. 표·접근 규칙은
// supabase/migrations/20261015090000_conversation_lobby.sql(쓴 사람 고정·300자·10초 5건·3명 신고 시 가림).
// 화면은 튜터 대화방과 같은 껍데기(conversation.css)를 쓰고, 여기에는 읽기·쓰기·지우기·신고와 순수 규칙만 둔다.
import { rateGate } from '../world/chat';
import { clockLabel, kstDateKey } from './chatView';

export const LOBBY_TABLE = 'conversation_lobby_messages';
export const LOBBY_MAX_CHARS = 300;
export const LOBBY_PAGE = 100;
export const LOBBY_SEND_LIMIT = 5;
export const LOBBY_SEND_WINDOW_MS = 10000;
export const LOBBY_PATH = '/conversation/lobby';

export const lobbyHref = (language) => `${LOBBY_PATH}?lang=${encodeURIComponent(language)}`;
export const lobbyKey = (language) => ['conversation-lobby', language];

/** 보낼 말 다듬기 — 앞뒤 공백을 걷고, 줄바꿈은 두 줄까지만, 300자에서 자른다. 비면 null. */
export function cleanLobbyText(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return null;
  return text.length > LOBBY_MAX_CHARS ? text.slice(0, LOBBY_MAX_CHARS) : text;
}

/** 화면 쪽 도배 막기(서버도 같은 기준으로 거절한다) — 월드 채팅의 슬라이딩 윈도우를 그대로 쓴다. */
export const lobbyRateGate = (recent, now) => rateGate(recent, now, LOBBY_SEND_LIMIT, LOBBY_SEND_WINDOW_MS);

/** 행 → 화면 말. 음소거한 사람의 말은 뺀다(내 말은 빼지 않는다). */
export function lobbyMessages(rows, { me = null, isMuted = () => false } = {}) {
  return (rows || [])
    .filter((row) => row && row.body && (row.user_id === me || !isMuted(row.user_id)))
    .map((row) => ({
      id: String(row.id),
      userId: row.user_id,
      name: String(row.author?.display_name || '').trim() || '학습자',
      text: row.body,
      at: Date.parse(row.created_at) || null,
      mine: row.user_id === me,
      hidden: !!row.hidden_at,
    }))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
}

/**
 * 메신저식 묶음 — 같은 사람이 같은 분에 연달아 쓴 말은 한 묶음이다. 이름·프로필은 묶음 첫 말에만,
 * 시각은 묶음 마지막 말 옆에만 둔다. 날이 바뀌면 가운데 구분선(dateSep)을 단다.
 */
export function lobbyThread(messages) {
  const list = messages || [];
  return list.map((m, i) => {
    const prev = list[i - 1];
    const next = list[i + 1];
    const day = kstDateKey(m.at);
    const time = clockLabel(m.at);
    const same = (o) => o && o.userId === m.userId && kstDateKey(o.at) === day && clockLabel(o.at) === time;
    return {
      ...m,
      dateSep: !!day && day !== (prev ? kstDateKey(prev.at) : null),
      first: !same(prev),
      last: !same(next),
      time,
    };
  });
}

/**
 * 표가 아직 운영에 없다(docs/sql/conversation-lobby.sql을 #1337로 적용하기 전) — 화면은 오류 대신 「곧 열려요」로 물러선다.
 * PostgREST: PGRST205(스키마 캐시에 표 없음)·PGRST200(관계 없음) / Postgres: 42P01(표 없음).
 */
export function isLobbyMissing(error) {
  const code = String(error?.code || '');
  if (code === 'PGRST205' || code === 'PGRST200' || code === '42P01') return true;
  return /conversation_lobby_(messages|reports)/.test(String(error?.message || '')) && /(does not exist|schema cache)/.test(String(error?.message || ''));
}
export const LOBBY_SOON_TEXT = '모두의 대화방은 곧 열려요. 준비가 끝나면 여기서 바로 이야기할 수 있어요.';

/** 거절 → 화면 문구. */
export function lobbyErrorText(error) {
  if (/lobby_rate_limited/.test(error?.message || '')) return '조금 천천히 보내 주세요. 잠시 뒤 다시 보낼 수 있어요.';
  if (isLobbyMissing(error)) return LOBBY_SOON_TEXT;
  return '보내지 못했어요. 쓰던 말은 입력창에 남겨 두었어요.';
}

// 작성자 이름은 profiles에서 따로 읽는다 — 대화방 표는 profiles를 참조하지 않는다(FK가 profiles에 내부 트리거를 붙이면
// FSRS 보호 계약 activity_profile_hash가 어긋나 학습 조회가 멈춘다, 2026-10-16 KST 운영 사고).
const SELECT = 'id,language,user_id,body,created_at,hidden_at';

export async function fetchLobby(client, language, { limit = LOBBY_PAGE } = {}) {
  const { data, error } = await client.from(LOBBY_TABLE).select(SELECT)
    .eq('language', language).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = data || [];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data: people } = await client.from('profiles').select('id,display_name').in('id', ids);
  const names = new Map((people || []).map((p) => [p.id, p.display_name]));
  return rows.map((r) => ({ ...r, author: { display_name: names.get(r.user_id) || '' } }));
}

export async function postLobby(client, { language, text }) {
  const body = cleanLobbyText(text);
  if (!body) return null;
  const { error } = await client.from(LOBBY_TABLE).insert({ language, body });
  if (error) throw error;
  return body;
}

export async function deleteLobby(client, id) {
  const { error } = await client.from(LOBBY_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function reportLobby(client, id) {
  const { error } = await client.from('conversation_lobby_reports').insert({ message_id: id });
  if (error && error.code !== '23505') throw error; // 이미 신고함 = 성공
}

/** 새 말·지운 말 실시간 알림 — 바뀌면 다시 읽는다(행을 직접 끼우지 않아 접근 규칙·가림이 그대로 맞는다). */
export function subscribeLobby(client, language, onChange) {
  if (!client?.channel) return () => {};
  const channel = client.channel(`conversation-lobby-${language}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: LOBBY_TABLE }, onChange)
    .subscribe();
  return () => { try { client.removeChannel(channel); } catch { /* 이미 닫힘 */ } };
}
