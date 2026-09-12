'use client';

/**
 * 수업 판 실시간(v2-AB R1) — Supabase Broadcast 채널 하나(`class:<key>`).
 *
 * 신호는 「다시 읽어라」일 뿐이다: 판은 payload 내용을 그리지 않고 RLS 조회로 정리본을 다시 읽는다.
 * 그래서 채널이 공개형이어도 남이 보낸 가짜 신호가 화면에 글자를 넣을 수 없다. Broadcast가
 * 끊기면 판의 15초 폴링(BOARD_POLL_MS)이 대신한다 — 판은 멈추지 않는다.
 * 월드(net.js)와 달리 presence·private 채널을 쓰지 않는다(테이블 퍼블리케이션·RLS 정책 0 = 스키마 0).
 */
import { getSupabase } from './supabase';
import { classChannelName } from './classBoard';

export const CLASS_EVENT = 'entry';

/**
 * @param {string} key 팀 키
 * @param {{ onEntry?: (payload: object) => void }} handlers
 * @returns {{ send: (payload: object) => Promise<void>, close: () => void }}
 */
export function openClassChannel(key, { onEntry, onStatus } = {}) {
  let closed = false;
  const ready = getSupabase().then((client) => {
    if (closed) return null;
    const ch = client.channel(classChannelName(key), { config: { broadcast: { self: false } } });
    if (onEntry) ch.on('broadcast', { event: CLASS_EVENT }, ({ payload }) => { if (!closed) onEntry(payload || {}); });
    ch.subscribe(status => { if (!closed) onStatus?.(status); });
    return ch;
  }).catch(() => { if (!closed) onStatus?.('CHANNEL_ERROR'); return null; });
  return {
    async send(payload) {
      try {
        const ch = await ready;
        if (!ch || closed) return;
        await ch.send({ type: 'broadcast', event: CLASS_EVENT, payload: { ...payload, at: Date.now() } });
      } catch { /* 신호 실패는 폴링이 메운다 */ }
    },
    close() {
      closed = true;
      ready.then((ch) => { try { ch?.unsubscribe(); } catch { /* ignore */ } });
    },
  };
}
