/**
 * 팀 해제 토큰·암호 검증 — 서버 순수 부품 (v2-AB R2, #1077 설계 5603827169 §6 · 상세 5604199672 §3).
 *
 *   토큰 = base64url({t: 팀 키, g: pwGen, e: 만료 ms}) + '.' + HMAC-SHA256(SHARE_LINK_SECRET)
 *   · 서명이라 위조 불가, 암호화는 아니다(팀 키·세대·만료만 실린다 — 비밀 아님)
 *   · pwGen이 루트의 현재 세대와 다르면 무효 → 암호 변경 = 기존 토큰 전부 무효(계약)
 *   · 만료 30일(설계 §0)
 *
 * 비교는 전부 timingSafeEqual(aiRelay 선례). SHARE_LINK_SECRET은 Vercel env — 오너 수동(하드리밋).
 * 없으면 라우트가 503으로 닫힌다(fail-closed).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { hashPassword } from '../classPassword';

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TOKEN_HEADER = 'x-class-token';
/** 없는 팀에도 같은 시간을 쓰기 위한 더미 솔트 — 존재 여부가 응답 시간으로 새지 않게. */
const DUMMY_SALT = '00000000000000000000000000000000';

export function secretOf(env = process.env) {
  const s = env?.SHARE_LINK_SECRET;
  return typeof s === 'string' && s.length >= 16 ? s : null;
}

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function signToken({ team, gen, exp }, secret) {
  if (!secret) throw new Error('secret required');
  const payload = Buffer.from(JSON.stringify({ t: team, g: Number(gen) || 0, e: Number(exp) })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** @returns {{ok:true, team:string, gen:number, exp:number}|{ok:false, reason:string}} */
export function verifyToken(token, secret, { now = Date.now() } = {}) {
  if (!secret) return { ok: false, reason: 'no-secret' };
  if (typeof token !== 'string' || token.length > 512) return { ok: false, reason: 'malformed' };
  const dot = token.indexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(payload, secret))) return { ok: false, reason: 'bad-signature' };
  let body;
  try { body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { ok: false, reason: 'malformed' }; }
  if (typeof body?.t !== 'string' || !Number.isFinite(body?.e)) return { ok: false, reason: 'malformed' };
  if (body.e <= now) return { ok: false, reason: 'expired' };
  return { ok: true, team: body.t, gen: Number(body.g) || 0, exp: body.e };
}

/** 암호 검증 — 해시 비교만. 팀이 없어도 같은 비용을 치른다(더미 해시). */
export async function verifyPassword(candidate, team) {
  const salt = team?.pwSalt || DUMMY_SALT;
  const hash = await hashPassword(String(candidate ?? ''), salt);
  if (!team?.pwHash || !team?.pwSalt) return false;
  return safeEqual(hash, team.pwHash);
}
