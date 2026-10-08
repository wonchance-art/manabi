'use client';
import { JaText, alignFurigana } from '../../views/refShared';
import './class-course.css';

export const PENDING_TEXT = '아직 입력되지 않았어요';

/** 교재 문장이 아직 없는 자리 — 무엇이 들어올지까지 알려 준다. */
export function CoursePending({ what, total }) {
  return <p className="course-pending" role="note"><b>{PENDING_TEXT}.</b> {what}{total ? ` 0/${total}` : ''} — 교재에서 옮겨 오면 여기에 표시돼요.</p>;
}

/**
 * 문장 한 줄 — 어절(br) 사이에서만 줄이 바뀐다. 후리가나 덩어리 사이 아무 데서나 꺾여
 * 「す。」만 다음 줄로 떨어지던 것을 막는다(오너 지적 2026-10-08). 줄 길이는 CSS가 고르게(balance).
 */
export function JaLine({ ja, yomi, br }) {
  const segs = (yomi && alignFurigana(ja, yomi)) || [{ text: ja }];
  const cuts = new Set(br || []);
  const phrases = [[]];
  let pos = 0;
  for (const sg of segs) {
    if (sg.rt) {
      if (pos > 0 && cuts.has(pos) && phrases[phrases.length - 1].length) phrases.push([]);
      phrases[phrases.length - 1].push(sg);
    } else {
      let from = 0;
      for (let i = 0; i < sg.text.length; i += 1) {
        if (cuts.has(pos + i) && (i > from || phrases[phrases.length - 1].length)) {
          if (i > from) phrases[phrases.length - 1].push({ text: sg.text.slice(from, i) });
          phrases.push([]);
          from = i;
        }
      }
      phrases[phrases.length - 1].push({ text: sg.text.slice(from) });
    }
    pos += sg.text.length;
  }
  return <span lang="ja" className="ja-ruby jl">{phrases.filter((p) => p.length).map((p, i) => <span key={i} className="jl__p">
    {p.map((sg, k) => (sg.rt ? <ruby key={k}>{sg.text}<span className="rt-an">{sg.rt}</span></ruby> : <span key={k}>{sg.text}</span>))}
  </span>)}</span>;
}

export function Ja({ ja, yomi }) {
  return yomi ? <JaText ja={ja} yomi={yomi} fallbackPron={false} /> : <span lang="ja">{ja}</span>;
}

/** **굵게** → 형광펜 강조(교재 화면과 같은 표시). */
export function Hi({ text }) {
  return String(text || '').split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <strong key={i} className="course-hl">{p}</strong> : p));
}

/** 교재 원문을 고친 예문 — 원문은 취소선(지우지 않고 보여 준다). 시험·연습의 모범답은 고친 문장. */
export function TextbookOriginal({ text }) {
  if (!text) return null;
  return <div className="course-fix-orig"><span className="course-tag">교재 원문</span><del lang="ja">{text}</del></div>;
}

export function FixNote({ note }) {
  if (!note) return null;
  return <p className="course-fix-note"><b>✏️ 피드백</b> {note}</p>;
}

/** 가리기 — 「뜻」(한국어)·「음」(일본어) 각각 켜고 끄기. 눌린 쪽이 가려진다. */
export function HideToggle({ hide, onToggle }) {
  return <div className="course-hide" role="group" aria-label="가리기">
    <button type="button" aria-pressed={hide.ko} aria-label="뜻 가리기" title="뜻 가리기" onClick={() => onToggle('ko')}>뜻</button>
    <button type="button" aria-pressed={hide.ja} aria-label="음 가리기" title="음 가리기" onClick={() => onToggle('ja')}>음</button>
  </div>;
}

/** 가려진 칸 — 탭하면 그 줄만 보인다. */
export function Masked({ hidden, onReveal, children, label }) {
  if (!hidden) return children;
  return <button type="button" className="course-masked" onClick={onReveal}>{label} — 탭해서 보기</button>;
}
