'use client';
// 한 단어 모드(문서 「한 단어 모드」) — 앞면: 단어 52px 고정 자리 + 「정답 확인 · Space」 하나. 뒷면: 단어는 같은 자리,
// 그 아래 읽기(HSK 병음 성조 색 · JLPT 가나) · 듣기 · 레벨 태그, 뜻, 글자 칸, 예문. 네 칸은 화면 아래 고정(앞면에서도 누를 수 있다).
// 보기 탭은 앞면에 무엇을 보일지만 정한다(단어 · 문장 · 뜻 · 소리). 오래된 단어는 뜻을 앞에(반대 방향).
import { CharTiles, GradeButtons, LevelTag, Listen, Reading, StatusPill } from './WordParts';
import { Example } from './WordCard';
import { useWordLang } from './wordLang';

export function OneWordCard({ entry: e, level, view, info, tiles, speak, tone, revealed, onReveal, onWord, openKey, turnKey, onSave, saving, pop }) {
  const L = useWordLang();
  const { hw, sub } = L.head(e);
  const old = info.old != null;
  const front = old ? <p className="lw-one__solo"><span className="lw-reverse__label">{info.old}일 만에 · 뜻 보고 단어 떠올리기</span><br />{e.meaning}</p>
    : view === 'sentence' ? <p className="lw-one__solo" lang={L.hw}>{e.ex?.text || hw}</p>
      : view === 'meaning' ? <p className="lw-one__solo">{e.meaning}</p>
        : view === 'sound' && speak && !revealed ? <Listen speak={speak} text={e.word} label="단어 듣기" />
          : <span className="lw-one__hw" lang={L.hw} style={{ '--n': [...hw].length }}>{hw}</span>;
  // 뒷면에서는 표제어가 늘 같은 자리(앞면이 단어였으면 그대로, 다른 보기였으면 단어로 바뀐다).
  const top = revealed ? <span className="lw-one__hw" lang={L.hw} style={{ '--n': [...hw].length }}>{hw}</span> : front;
  return <section className={`lw-one__card${turnKey ? ' is-turning' : ''}`} key={turnKey || e.key} aria-label={`${e.word} 카드`}>
    <div className="lw-one__front">{top}</div>
    {!revealed && <button type="button" className="lw-one__reveal" onClick={onReveal} aria-keyshortcuts="Space">정답 확인 · Space</button>}
    {revealed && <div className="lw-one__back">
      <div className="lw-one__meta"><Reading text={sub} word={hw} tone={tone} /><Listen speak={speak} text={e.word} /><LevelTag level={level} />
        <StatusPill status={info.status} onSave={onSave} busy={saving} pop={pop} /></div>
      {info.hard ? <div className="lw-one__chips"><span className="lw-chip">자주 틀린 단어 · {info.hard}번</span></div> : null}
      <p className="lw-one__mean">{e.meaning}</p>
      <CharTiles tiles={tiles} />
      <Example ex={e.ex} word={e.word} speak={speak} onWord={onWord} openKey={openKey} tone={tone} />
    </div>}
  </section>;
}

/** 화면 아래 고정 네 칸 + 안내 한 줄 — 안내는 뒷면에서만(앞면 「안내 문구 없음」), 자리는 늘 잡아 네 칸이 움직이지 않는다. */
export function GradeBar({ previews, onGrade, disabled, note, guide = true }) {
  const text = useWordLang().guide;
  return <div className="lw-gradebar"><div className="lw-gradebar__in">
    <p className="lw-gradebar__guide" aria-hidden={!guide || undefined}>{guide ? text : null}</p>
    <GradeButtons previews={previews} onGrade={onGrade} disabled={disabled} note={note} />
  </div></div>;
}

/** 끝 화면 — 「오늘 이 범위 끝」 + 큰 칸 둘(학습 · 내일) + 네 색 칸(누른 횟수, 숫자만) + [계속 진행] [리스트로]. */
export function OneWordDone({ graded, tomorrow, counts, onNext, onList, nextLabel }) {
  return <section className="lw-done" aria-labelledby="lw-done-title">
    <h2 id="lw-done-title" tabIndex={-1}>오늘 이 범위 끝</h2>
    <div className="lw-done__big">
      <div><b>{graded}</b><span>학습</span></div>
      <div><b>{tomorrow}</b><span>내일</span></div>
    </div>
    <div className="lw-done__counts" aria-label="누른 횟수">
      <span className="lw-grade--again" aria-label={`다시 ${counts[1]}번`}>{counts[1]}</span>
      <span className="lw-grade--hard" aria-label={`어려움 ${counts[2]}번`}>{counts[2]}</span>
      <span className="lw-grade--good" aria-label={`알맞음 ${counts[3]}번`}>{counts[3]}</span>
      <span className="lw-grade--easy" aria-label={`쉬움 ${counts[4]}번`}>{counts[4]}</span>
    </div>
    <div className="lw-done__actions">
      {onNext && <button type="button" className="lw-btn lw-btn--primary" onClick={onNext} aria-label={nextLabel ? `계속 진행 — ${nextLabel}` : '계속 진행'}>계속 진행</button>}
      <button type="button" className="lw-btn" onClick={onList}>리스트로</button>
    </div>
  </section>;
}
