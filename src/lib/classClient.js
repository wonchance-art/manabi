'use client';

/**
 * 학생 쪽 팀 클라이언트(v2-AB R2 상세 5604199672 §3) — 해제 토큰·목록 캐시·대기 담기(localStorage)와
 * 세 라우트 호출, 그리고 「받아서 사본으로」(sharedStore). 순수 판정은 classBoard로.
 *
 *   class_unlock:<key>  { token, exp, pwGen, name }   기기당 한 번 입력 · 30일
 *   class_index:<key>   { fetchedAt, index }           오프라인 목록용
 *   class_pending_save  { team, materialId, token… }   로그인 뒤 복제본에서 담는다
 */
import { getSharedCopy, putSharedCopy } from './sharedStore';

export const TOKEN_HEADER = 'x-class-token';
const unlockKey = (key) => `class_unlock:${key}`;
const indexKey = (key) => `class_index:${key}`;
const bannerKey = (key) => `class_banner_off:${key}`;
export const PENDING_KEY = 'class_pending_save';
/** 대기 담기 보관 기한 — 사본 TTL과 같다. */
export const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readJson(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 사생활 모드 등 */ } }
function remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

export function readUnlock(key, now = Date.now()) {
  const u = readJson(unlockKey(key));
  if (!u?.token || !Number.isFinite(u.exp) || u.exp <= now) return null;
  return u;
}
export function writeUnlock(key, data) { writeJson(unlockKey(key), data); }
export function clearUnlock(key) { remove(unlockKey(key)); }

export function readIndexCache(key) { return readJson(indexKey(key)); }
export function writeIndexCache(key, index) { writeJson(indexKey(key), { fetchedAt: Date.now(), index }); }

export function isBannerOff(key) { return !!readJson(bannerKey(key)); }
export function setBannerOff(key) { writeJson(bannerKey(key), true); }

export function readPendingSave(now = Date.now()) {
  const p = readJson(PENDING_KEY);
  if (!p || !Number.isFinite(p.at) || now - p.at > PENDING_TTL_MS) return null;
  return p;
}
export function writePendingSave(p) { writeJson(PENDING_KEY, { ...p, at: Date.now() }); }
export function clearPendingSave() { remove(PENDING_KEY); }

class ClassApiError extends Error {
  constructor(status, code) { super(code || `HTTP ${status}`); this.status = status; this.code = code; }
}

async function call(path, { method = 'GET', token = null, body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers[TOKEN_HEADER] = token;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ClassApiError(res.status, data?.error);
  return data;
}

/** 암호 → 토큰·목록. 실패는 {status} 있는 에러(404 틀림/없음 · 429 · 503 미설정). */
export async function unlockTeam(key, pw) {
  const data = await call(`/api/class/${encodeURIComponent(key)}/unlock`, { method: 'POST', body: { pw } });
  writeUnlock(key, { token: data.token, exp: data.exp, pwGen: data.pwGen, name: data.index?.team?.name || key });
  writeIndexCache(key, data.index);
  return data;
}

export async function fetchTeamIndex(key, token) {
  const index = await call(`/api/class/${encodeURIComponent(key)}`, { token });
  writeIndexCache(key, index);
  return index;
}

export async function fetchTeamMaterial(key, token, id) {
  return call(`/api/class/${encodeURIComponent(key)}/material/${encodeURIComponent(id)}`, { token });
}

/** 순수 — 사본을 다시 받아야 하는가(없음·원본이 더 새것). */
export function copyIsStale(copy, entry) {
  if (!copy) return true;
  if (!entry?.updatedAt || !copy.updatedAt) return false;
  return String(entry.updatedAt) > String(copy.updatedAt);
}

/** 받아서 사본으로 — 있으면 그대로(네트워크 0), 없거나 낡았으면 토큰으로 받아 저장. */
export async function ensureSharedCopy(key, token, entry) {
  const existing = await getSharedCopy(entry.id);
  if (existing && !copyIsStale(existing, entry)) return existing;
  const payload = await fetchTeamMaterial(key, token, entry.id);
  const copy = { id: payload.id, team: key, updatedAt: payload.updatedAt || null, material: payload };
  await putSharedCopy(copy);
  return { ...copy, savedAt: Date.now() };
}

/** Local re-entry suggestions only. Server access is always revalidated by the team page. */
export function recentClassVisits() {
  const visits=[];
  try {
    for(let i=0;i<localStorage.length;i++){
      const storageKey=localStorage.key(i);
      if(!storageKey?.startsWith('class_index:')) continue;
      const key=storageKey.slice('class_index:'.length);
      if(!/^[a-z0-9][a-z0-9-]{0,15}$/.test(key)||!readUnlock(key))continue;
      const cache=readIndexCache(key);
      if(cache?.index?.team?.key===key)visits.push({key,name:cache.index.team.name,lang:cache.index.team.lang,at:cache.fetchedAt});
    }
  }catch{return [];}
  return visits.sort((a,b)=>b.at-a.at).slice(0,6);
}
export function forgetClassVisit(key) { remove(indexKey(key));clearUnlock(key); }
