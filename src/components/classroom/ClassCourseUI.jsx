'use client';
import { JaText } from '../../views/refShared';
import './class-course.css';

export const PENDING_TEXT = '아직 입력되지 않았어요';

/** 교재 문장이 아직 없는 자리 — 무엇이 들어올지까지 알려 준다. */
export function CoursePending({ what, total }) {
  return <p className="course-pending" role="note"><b>{PENDING_TEXT}.</b> {what}{total ? ` 0/${total}` : ''} — 교재에서 옮겨 오면 여기에 표시돼요.</p>;
}

/** speak = 페이지에서 한 번 만든 useTTS().speak (버튼마다 음성 목록 구독을 만들지 않는다). */
export function SpeakButton({ text, speak }) {
  if (!text || !speak) return null;
  return <button type="button" className="course-speak" aria-label="일본어 듣기" onClick={() => speak(text, 'Japanese')}>🔊</button>;
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

/** 가리기 — both | hide-ko | hide-ja */
export function HideToggle({ value, onChange, label = '가리기' }) {
  const options = [['both', '모두 보기'], ['hide-ko', '한국어 가리기'], ['hide-ja', '일본어 가리기']];
  return <div className="course-hide" role="group" aria-label={label}>
    {options.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}
  </div>;
}

/** 가려진 칸 — 탭하면 그 줄만 보인다. */
export function Masked({ hidden, onReveal, children, label }) {
  if (!hidden) return children;
  return <button type="button" className="course-masked" onClick={onReveal}>{label} — 탭해서 보기</button>;
}
