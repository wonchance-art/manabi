'use client';

/**
 * 링크 반입 입구 (v2-F R1, #1077 설계 §1) — PDF·EPUB·문장 목록과 같은 층의 네 번째 문.
 *
 * 반입 입구는 여섯인데 **사용자가 URL을 직접 넣는 문은 없었다**(자료는 크론 추천 카드로만
 * 들어온다). 오너 방향 「유튜브 같이 개인이 만든 퀄리티 높은 것들 가져오는 식」의 입구다.
 *
 * ── 붙여넣기가 곁다리가 아니다
 *
 * 자동 취득 경로(`youtube-transcript`)는 운영에서 검증된 적이 없고 문서(§4.3)가 데이터센터
 * IP 차단을 경고한 물건이다. 그래서 422를 **정상 분기**로 받아 붙여넣기 창을 편다 —
 * 실패가 막다른 길이면 기능이 죽는다. 붙여넣은 자막의 타임코드는 같은 순수 함수가 지운다.
 */
import { useState } from 'react';
import Button from './Button';
import { supabase } from '../lib/supabase';
import { detectLinkKind, transcriptFromPaste } from '../lib/linkImport';

/** 유튜브 자막은 길다 — 본문 폼 상한과 같은 결로 끊는다. */
const MAX_CHARS = 50000;

export default function MaterialAddLinkSection({ toast, onReady }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  /** 자동 취득이 실패한 뒤의 상태 — { videoId, title, channel }. null이면 붙여넣기 창을 안 편다. */
  const [manual, setManual] = useState(null);
  const [pasted, setPasted] = useState('');

  const kind = detectLinkKind(url);
  const ready = kind === 'youtube' && !busy;

  function deliver({ title, text, videoId, channel, via }) {
    const body = text.slice(0, MAX_CHARS);
    onReady({
      title: title || '가져온 영상',
      rawText: body,
      source: { kind: 'youtube', url: url.trim(), videoId, channel: channel || '', via },
    });
    setOpen(false);
    setUrl('');
    setManual(null);
    setPasted('');
    return body.length;
  }

  async function handleFetch() {
    if (!ready) return;
    setBusy(true);
    setManual(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast('로그인이 필요해요.', 'error'); return; }
      const res = await fetch('/api/import/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.text) {
        const n = deliver(j);
        toast(`자막 ${n.toLocaleString()}자를 가져왔어요.`, 'success');
        return;
      }
      if (res.status === 422) {
        // 막다른 길이 아니다 — 제목은 이미 받아 뒀으니 붙여넣기만 받으면 이어진다.
        setManual({ videoId: j?.videoId || '', title: j?.title || '', channel: j?.channel || '' });
        return;
      }
      toast(j?.message || '가져오지 못했어요.', 'error');
    } catch {
      toast('가져오지 못했어요 — 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function handlePaste() {
    const text = transcriptFromPaste(pasted);
    if (!text.trim()) { toast('붙여넣은 내용에서 본문을 찾지 못했어요.', 'error'); return; }
    const n = deliver({ ...manual, text, via: 'paste' });
    toast(`${n.toLocaleString()}자를 가져왔어요.`, 'success');
  }

  return (
    <div className="card add-form" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>링크에서 가져오기</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
            유튜브 영상의 자막을 본문으로 가져와요. 남의 자막이라 기본은 비공개예요.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? '닫기' : '링크 넣기'}
        </Button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              /* 320px에서도 [가져오기]와 한 줄에 선다 — 기저를 크게 잡으면 버튼이 혼자
                 아래로 떨어져 실수처럼 보인다(렌더 실측). */
              style={{ flex: '1 1 140px', minWidth: 0 }}
              placeholder="https://youtu.be/..."
              value={url}
              inputMode="url"
              onChange={(e) => { setUrl(e.target.value); setManual(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFetch(); }}
            />
            <Button size="sm" onClick={handleFetch} disabled={!ready}>
              {busy ? '찾는 중…' : '가져오기'}
            </Button>
          </div>
          {url.trim() && kind !== 'youtube' && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '8px 0 0' }}>
              지금은 유튜브 주소만 가져올 수 있어요.
            </p>
          )}

          {manual && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.84rem', margin: 0, lineHeight: 1.6 }}>
                자막을 자동으로 가져오지 못했어요. 유튜브에서 직접 복사하면 그대로 이어갈 수 있어요.
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 8px', lineHeight: 1.6 }}>
                ① 영상 아래 [더보기] → [스크립트 표시] ② 전체 복사 ③ 아래에 붙여넣기
                <br />※ 0:12 같은 타임코드는 자동으로 지워요.
              </p>
              <textarea
                className="form-textarea"
                style={{ minHeight: 120 }}
                placeholder="여기에 붙여넣기"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <div style={{ marginTop: 8 }}>
                <Button size="sm" onClick={handlePaste} disabled={!pasted.trim()}>
                  붙여넣은 내용으로 계속
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
