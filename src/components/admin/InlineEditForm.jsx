'use client';

/**
 * 인라인 편집 폼 — 연필 클릭 시에만 dynamic import되는 무거운 조각(챕터 페이지 First Load JS에서 제외).
 *
 * 흐름: 편집 시작 → merged 챕터 GET → path로 현재 값 해석 → 폼 표시 → 저장 직전 최신 merged를
 * 다시 GET → 복제에 path 패치 → POST(전체 data, 기존 API 그대로) → 성공 시 router.refresh().
 *
 * 캐시를 두지 않는다(Codex 검수 반영) — 복원(DELETE)·다른 탭 저장 뒤에도 항상 서버의 최신
 * merged를 기준으로 패치하므로, 지워진 수정본이 오래된 스냅숏을 타고 부활할 수 없다.
 * 관리자 전용 소량 JSON GET이라 연필 클릭마다 재조회해도 비용이 무시할 수준.
 *
 * 값은 절대 부모(RSC)에서 props로 내려받지 않는다 — 여기서 fetch한 merged에서만 읽는다.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../lib/ToastContext';
import { CHAPTER_FIELD_LABELS } from '../../lib/chapterEditorModel';

async function fetchMerged(lang, slug) {
  const res = await fetch(
    `/api/admin/chapter?lang=${encodeURIComponent(lang)}&slug=${encodeURIComponent(slug)}`, { cache: 'no-store' }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || '불러오기에 실패했어요.');
  return json;
}
// ── 경로 규약 해석 ──
// title|topic|titleFr|summary
// sections.{i}.{heading|pattern|patternKo|tip|pitfall|vsKo|vsEn|hanja|etym}
// sections.{i}.body.p{j}                      — body를 \n\n로 split한 j번째 문단
// sections.{i}.examples.{j}                   — example 객체(kind='example')
// sections.{i}.{table|story|media}            — 블록(kind='json')
const splitBody = (body) => String(body ?? '').split(/\n\n/);

function locate(path) {
  const parts = path.split('.');
  if (parts[0] !== 'sections') return { kind: 'chapterField', key: parts[0] };
  const i = Number(parts[1]);
  const rest = parts.slice(2);
  if (rest[0] === 'body' && /^p\d+$/.test(rest[1] || '')) {
    return { kind: 'bodyPara', i, j: Number(rest[1].slice(1)) };
  }
  if (rest[0] === 'examples') return { kind: 'exampleNode', i, j: Number(rest[1]) };
  return { kind: 'sectionField', i, key: rest[0] };
}

function readScalar(chapter, path) {
  const loc = locate(path);
  if (loc.kind === 'chapterField') return chapter[loc.key];
  if (loc.kind === 'sectionField') return chapter.sections?.[loc.i]?.[loc.key];
  if (loc.kind === 'bodyPara') return splitBody(chapter.sections?.[loc.i]?.body)[loc.j];
  return undefined;
}
function readNode(chapter, path) {
  const loc = locate(path);
  if (loc.kind === 'exampleNode') return chapter.sections?.[loc.i]?.examples?.[loc.j];
  if (loc.kind === 'sectionField') return chapter.sections?.[loc.i]?.[loc.key];
  return undefined;
}
function patch(chapter, path, value) {
  const loc = locate(path);
  if (loc.kind === 'chapterField') { chapter[loc.key] = value; return; }
  const sec = chapter.sections[loc.i];
  if (loc.kind === 'sectionField') { sec[loc.key] = value; return; }
  if (loc.kind === 'exampleNode') { sec.examples[loc.j] = value; return; }
  if (loc.kind === 'bodyPara') {
    const paras = splitBody(sec.body);
    paras[loc.j] = value;
    sec.body = paras.join('\n\n');
  }
}

// 편집 시작 시 merged에서 폼 초기값 해석
function readInitial(chapter, path, kind) {
  if (kind === 'text' && path.includes(',')) {
    const out = {};
    for (const p of path.split(',')) out[p] = readScalar(chapter, p) ?? '';
    return out;
  }
  if (kind === 'example') return { ...(readNode(chapter, path) || {}) };
  if (kind === 'json') return JSON.stringify(readNode(chapter, path) ?? null, null, 2);
  return readScalar(chapter, path) ?? '';
}

// ── 자동 높이 textarea ──
function AutoTextarea({ value, onChange, mono, minHeight, autoFocus }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="form-input admin-edit__area"
      style={{
        width: '100%',
        resize: 'vertical',
        ...(mono ? { fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.6 } : {}),
        ...(minHeight ? { minHeight } : {}),
      }}
      value={value}
      spellCheck={!mono}
      autoFocus={autoFocus}
      aria-label="편집할 내용"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function InlineEditForm({ lang, slug, path, kind, onDone, onCancel }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const initialValue = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchMerged(lang, slug)
      .then(({ merged }) => {
        if (!alive) return;
        const initial = readInitial(merged, path, kind);
        initialValue.current = initial;
        setValue(initial);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [lang, slug, path, kind]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // 저장 직전 최신 merged 재조회 — 복원·다른 편집 이후에도 항상 서버 상태 기준으로 패치
      const { merged, updatedAt } = await fetchMerged(lang, slug);
      if (JSON.stringify(readInitial(merged, path, kind)) !== JSON.stringify(initialValue.current)) {
        setError('이 부분이 다른 편집에서 변경됐어요. 입력을 복사해 두고 닫은 뒤, 최신 내용을 확인해 주세요.');
        setSaving(false);
        return;
      }
      const clone = structuredClone(merged);

      if (kind === 'json') {
        let parsed;
        try {
          parsed = JSON.parse(value);
        } catch (e) {
          setError('JSON 구문 오류: ' + e.message);
          setSaving(false);
          return;
        }
        patch(clone, path, parsed);
      } else if (kind === 'text' && path.includes(',')) {
        for (const p of path.split(',')) patch(clone, p, value[p] ?? '');
      } else {
        patch(clone, path, value);
      }

      const res = await fetch('/api/admin/chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, slug, data: clone, expectedUpdatedAt: updatedAt }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || '저장에 실패했어요.');
        setSaving(false);
        return;
      }
      toast('저장했어요. 반영 중…', 'success');
      router.refresh();
      onDone();
    } catch {
      setError('네트워크 오류로 저장하지 못했어요.');
      setSaving(false);
    }
  }

  if (loading) {
    return <span className="admin-edit__loading">불러오는 중…</span>;
  }
  if (value == null && error) {
    return (
      <div className="admin-edit__form">
        <p className="admin-edit__error" role="alert">{error}</p>
        <div className="admin-edit__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>닫기</button>
        </div>
      </div>
    );
  }

  const multiText = kind === 'text' && path.includes(',');

  return (
    <div className="admin-edit__form">
      {kind === 'text' && !multiText && (
        <>
          <AutoTextarea value={value} onChange={setValue} autoFocus />
          <p className="admin-edit__hint">
            <code>**굵게**</code> · 문단 구분은 빈 줄(<code>⏎⏎</code>)
          </p>
        </>
      )}

      {multiText && (
        <div className="admin-edit__fields">
          {path.split(',').map((p) => (
            <label key={p} className="admin-edit__field">
              <span className="admin-edit__field-label">{CHAPTER_FIELD_LABELS[p.split('.').pop()] || p.split('.').pop()}</span>
              <input
                className="form-input"
                value={value[p] ?? ''}
                onChange={(e) => setValue({ ...value, [p]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}

      {kind === 'example' && (
        <div className="admin-edit__fields">
          {Object.keys(value).filter((k) => typeof value[k] === 'string' && k !== 'id').map((k) => (
            <label key={k} className="admin-edit__field">
              <span className="admin-edit__field-label">{CHAPTER_FIELD_LABELS[k] || k}</span>
              <input
                className="form-input"
                value={value[k] ?? ''}
                onChange={(e) => setValue({ ...value, [k]: e.target.value })}
              />
            </label>
          ))}
          <p className="admin-edit__hint">예문과 해석을 수정해요. 출처 정보는 그대로 유지됩니다.</p>
        </div>
      )}

      {kind === 'json' && (
        <>
          <AutoTextarea value={value} onChange={setValue} mono minHeight="30vh" autoFocus />
          <p className="admin-edit__hint">이 블록의 JSON. 구조(키·배열 모양)를 유지하세요.</p>
        </>
      )}

      {error && <p className="admin-edit__error" role="alert">{error}</p>}

      <div className="admin-edit__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={saving}>
          취소
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}
