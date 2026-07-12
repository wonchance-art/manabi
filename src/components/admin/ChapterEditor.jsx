'use client';

/**
 * 챕터 편집 오버레이 — 오너가 웹에서 챕터 제목·내용을 직접 수정한다.
 *
 * 바(ChapterEditorBar) 클릭 시에만 dynamic import로 로드된다(챕터 페이지 First Load JS 보호).
 * GET /api/admin/chapter 로 병합 챕터를 불러와 편집하고, POST로 저장, DELETE로 파일 버전 복원.
 *
 * 병합 의미론상 slug·level·order는 항상 원본이 이기므로 편집 대상이 아니다(변경 시 저장 거부).
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../lib/ToastContext';

const TABS = [
  { key: 'basic', label: '기본' },
  { key: 'sections', label: '섹션' },
  { key: 'json', label: '고급(JSON)' },
];

// 섹션 텍스트 인풋 / textarea 필드
const SECTION_TEXT_FIELDS = [
  { key: 'heading', label: '제목(heading)' },
  { key: 'pattern', label: '패턴(pattern)' },
  { key: 'patternKo', label: '패턴 한국어(patternKo)' },
];
const SECTION_AREA_FIELDS = [
  { key: 'body', label: '본문(body)' },
  { key: 'tip', label: '팁(tip)' },
  { key: 'pitfall', label: '함정(pitfall)' },
  { key: 'vsKo', label: '한국어 비교(vsKo)' },
  { key: 'hanja', label: '한자 연결(hanja)' },
];
// 구조가 복잡해 구조 편집기가 다루지 않는 섹션 필드 — 있으면 "고급 JSON에서 편집" 안내
// (quiz는 챕터 렌더 소비자가 없어 목록에서 제외 — 검증 화이트리스트와 동일 집합 유지)
const ADVANCED_SECTION_KEYS = ['table', 'story', 'media', 'gojuon', 'enParallel', 'hanjaBridge'];

// story questions[].id 목록 추출 — 변경 감지용
function storyIds(chapter) {
  const ids = [];
  for (const sec of chapter?.sections || []) {
    for (const q of sec?.story?.questions || []) {
      if (q?.id != null) ids.push(String(q.id));
    }
  }
  return ids.sort();
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  background: 'var(--bg)',
  display: 'flex',
  flexDirection: 'column',
};
const inputStyle = { width: '100%' };
const monoStyle = { fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.6 };

export default function ChapterEditor({ lang, slug, onClose }) {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [baseRef, setBaseRef] = useState(null); // { slug, level, order, storyIds }
  const [tab, setTab] = useState('basic');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── 로드 ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/chapter?lang=${encodeURIComponent(lang)}&slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setLoadError(json.error || '불러오기에 실패했어요.');
        } else {
          setDraft(json.merged);
          setBaseRef({
            slug: json.base.slug,
            level: json.base.level,
            order: json.base.order,
            storyIds: storyIds(json.base),
          });
        }
      } catch {
        if (alive) setLoadError('네트워크 오류로 불러오지 못했어요.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lang, slug]);

  // ── 탭 전환 시 JSON <-> draft 동기화 ──
  function switchTab(next) {
    if (next === tab) return;
    if (next === 'json') {
      setJsonText(JSON.stringify(draft, null, 2));
      setJsonError(null);
      setTab('json');
      return;
    }
    if (tab === 'json') {
      // JSON 탭을 떠날 때 파싱해 draft에 반영 — 실패하면 떠나지 못하게 막는다.
      try {
        const parsed = JSON.parse(jsonText);
        setDraft(parsed);
        setJsonError(null);
      } catch (e) {
        setJsonError('JSON 구문 오류: ' + e.message);
        return;
      }
    }
    setTab(next);
  }

  // ── draft 필드 갱신 헬퍼 ──
  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setSectionField(i, key, value) {
    setDraft((d) => {
      const sections = d.sections.slice();
      sections[i] = { ...sections[i], [key]: value };
      return { ...d, sections };
    });
  }
  function setExample(si, ei, key, value) {
    setDraft((d) => {
      const sections = d.sections.slice();
      const examples = (sections[si].examples || []).slice();
      examples[ei] = { ...examples[ei], [key]: value };
      sections[si] = { ...sections[si], examples };
      return { ...d, sections };
    });
  }
  function mutateExamples(si, fn) {
    setDraft((d) => {
      const sections = d.sections.slice();
      const examples = (sections[si].examples || []).slice();
      const next = fn(examples);
      sections[si] = { ...sections[si], examples: next };
      return { ...d, sections };
    });
  }

  // ── 저장 전 최종 데이터 확정 + 검증 ──
  function resolveData() {
    if (tab === 'json') {
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        return { error: 'JSON 구문 오류: ' + e.message };
      }
      return { data: parsed };
    }
    return { data: draft };
  }

  async function handleSave() {
    const resolved = resolveData();
    if (resolved.error) {
      setJsonError(resolved.error);
      toast(resolved.error, 'error');
      return;
    }
    const data = resolved.data;

    // 불변 필드 변경 거부
    if (
      String(data.slug) !== String(baseRef.slug) ||
      String(data.level) !== String(baseRef.level) ||
      String(data.order) !== String(baseRef.order)
    ) {
      toast('slug·level·order는 바꿀 수 없어요. 원본 값으로 되돌려 주세요.', 'error');
      return;
    }
    // story questions[].id 변경 경고(진도·채점 키) — 확인 후에만 진행
    const nextIds = storyIds(data);
    if (JSON.stringify(nextIds) !== JSON.stringify(baseRef.storyIds)) {
      const ok = window.confirm(
        '스토리 문항 id(questions[].id)가 원본과 달라요. 진도·채점 연동이 끊길 수 있어요. 그래도 저장할까요?'
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, slug, data }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || '저장에 실패했어요.', 'error');
        return;
      }
      toast('저장했어요. 반영 중…', 'success');
      router.refresh();
      onClose();
    } catch {
      toast('네트워크 오류로 저장하지 못했어요.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    if (!window.confirm('이 챕터의 수정본을 삭제하고 파일 버전으로 되돌릴까요?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/chapter', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, slug }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || '복원에 실패했어요.', 'error');
        return;
      }
      toast('파일 버전으로 복원했어요.', 'success');
      router.refresh();
      onClose();
    } catch {
      toast('네트워크 오류로 복원하지 못했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const sections = draft?.sections || [];
  const markupHint = useMemo(
    () => '**굵게**, 문단 구분은 빈 줄(\\n\\n). 요미가나·표·스토리는 고급(JSON) 탭에서.',
    []
  );

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="챕터 편집">
      {/* ── 헤더 ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <strong style={{ fontSize: '0.95rem' }}>챕터 편집</strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {lang} · {slug}
        </span>
        <div className="tab-pills" style={{ marginLeft: 'auto', gap: 6 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-pills__item ${tab === t.key ? 'tab-pills__item--primary' : ''}`}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── 본문(스크롤) ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: 860, width: '100%', margin: '0 auto' }}>
        {loading && <p style={{ color: 'var(--text-muted)' }}>불러오는 중…</p>}
        {loadError && <p style={{ color: 'var(--danger, #e05252)' }}>{loadError}</p>}

        {!loading && !loadError && draft && (
          <>
            {/* ── 기본 탭 ── */}
            {tab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { key: 'title', label: '제목(title)' },
                  { key: 'topic', label: '주제(topic)' },
                  { key: 'titleFr', label: '원어 제목(titleFr)' },
                  { key: 'duration', label: '소요시간(duration)' },
                ].map((f) => (
                  <div className="form-field" key={f.key}>
                    <label className="form-label">{f.label}</label>
                    <input
                      className="form-input"
                      style={inputStyle}
                      value={draft[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="form-field">
                  <label className="form-label">요약(summary)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    style={inputStyle}
                    value={draft.summary ?? ''}
                    onChange={(e) => setField('summary', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ── 섹션 탭 ── */}
            {tab === 'sections' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{markupHint}</p>
                {sections.map((sec, si) => {
                  const advanced = ADVANCED_SECTION_KEYS.filter((k) => sec[k]);
                  return (
                    <section key={si} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>섹션 #{si + 1}</div>

                      {SECTION_TEXT_FIELDS.map((f) => (
                        <div className="form-field" key={f.key}>
                          <label className="form-label">{f.label}</label>
                          <input
                            className="form-input"
                            style={inputStyle}
                            value={sec[f.key] ?? ''}
                            onChange={(e) => setSectionField(si, f.key, e.target.value)}
                          />
                        </div>
                      ))}

                      {SECTION_AREA_FIELDS.map((f) => (
                        // 원본에 없던 필드는 편집기에서 새로 만들지 않는다(값이 있을 때만 노출).
                        sec[f.key] != null && (
                          <div className="form-field" key={f.key}>
                            <label className="form-label">{f.label}</label>
                            <textarea
                              className="form-input"
                              rows={f.key === 'body' ? 6 : 3}
                              style={{ ...inputStyle, ...monoStyle }}
                              value={sec[f.key] ?? ''}
                              onChange={(e) => setSectionField(si, f.key, e.target.value)}
                            />
                          </div>
                        )
                      ))}

                      {/* 예문 배열 */}
                      {Array.isArray(sec.examples) && (
                        <div className="form-field">
                          <label className="form-label">예문(examples)</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {sec.examples.map((ex, ei) => (
                              <div key={ei} className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>#{ei + 1}</span>
                                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                    <button type="button" className="btn btn--ghost btn--sm" disabled={ei === 0}
                                      onClick={() => mutateExamples(si, (arr) => { const a = arr.slice(); [a[ei - 1], a[ei]] = [a[ei], a[ei - 1]]; return a; })}>↑</button>
                                    <button type="button" className="btn btn--ghost btn--sm" disabled={ei === sec.examples.length - 1}
                                      onClick={() => mutateExamples(si, (arr) => { const a = arr.slice(); [a[ei + 1], a[ei]] = [a[ei], a[ei + 1]]; return a; })}>↓</button>
                                    <button type="button" className="btn btn--danger btn--sm"
                                      onClick={() => mutateExamples(si, (arr) => arr.filter((_, k) => k !== ei))}>삭제</button>
                                  </div>
                                </div>
                                {['ja', 'yomi', 'ko', 'note'].map((k) => (
                                  <input
                                    key={k}
                                    className="form-input"
                                    style={{ ...inputStyle, ...(k === 'ja' || k === 'yomi' ? monoStyle : {}) }}
                                    placeholder={k}
                                    value={ex[k] ?? ''}
                                    onChange={(e) => setExample(si, ei, k, e.target.value)}
                                  />
                                ))}
                              </div>
                            ))}
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => mutateExamples(si, (arr) => [...arr, { ja: '', yomi: '', ko: '', note: '' }])}
                            >
                              ＋ 예문 추가
                            </button>
                          </div>
                        </div>
                      )}

                      {advanced.length > 0 && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                          이 섹션의 <strong>{advanced.join(', ')}</strong> 은(는) 고급(JSON) 탭에서 편집하세요.
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {/* ── 고급(JSON) 탭 ── */}
            {tab === 'json' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  챕터 전체 JSON. 저장 시 JSON.parse 검증을 통과해야 하고, slug·level·order 변경은 거부돼요.
                  스토리 문항 id를 바꾸면 경고가 떠요.
                </p>
                {jsonError && <p style={{ color: 'var(--danger, #e05252)', fontSize: '0.8rem' }}>{jsonError}</p>}
                <textarea
                  className="form-input"
                  style={{ ...inputStyle, ...monoStyle, minHeight: '55vh' }}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 하단 액션 ── */}
      <footer
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={handleRestore}
          disabled={busy || saving || loading}
        >
          파일 버전으로 복원
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving || busy}>
            닫기
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleSave}
            disabled={saving || busy || loading || !!loadError}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </footer>
    </div>
  );
}
