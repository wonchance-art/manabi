'use client';
// 한 단어 모드(문서 「한 단어 모드」) — 앞면: 단어 52px 고정 자리 + 「정답 확인 · Space」 하나. 뒷면: 단어는 같은 자리,
// 그 아래 읽기(HSK 병음 성조 색 · JLPT 가나) · 듣기 (레벨 태그 · 상태는 찾기에만 — 오너 2026-10-20 KST), 뜻, 글자 칸, 예문. 네 칸은 화면 아래 고정(앞면에서도 누를 수 있다).
// 보기 탭은 앞면에 무엇을 보일지만 정한다(단어 · 문장 · 뜻 · 소리 · 전체). 훈음(글자 칸)은 뒷면에만.
// 오래된 단어의 반대 방향(뜻 보고 단어 떠올리기)은 뜻 연습 탭이 맡는다(네 영역 체크 — 오너 승인 2026-10-21 KST).
import { CharTiles, GradeButtons, Listen, Reading } from './WordParts';
import { Example } from './WordCard';
import { useWordLang } from './wordLang';

export function OneWordCard({ entry: e, view, info, tiles, speak, tone, revealed, onReveal, onWord, openKey, turnKey }) {
  const L = useWordLang();
  const { hw, sub } = L.head(e);
  const front = view === 'sentence' ? <p className="lw-one__solo" lang={L.hw}>{e.ex?.text || hw}</p>
      : view === 'meaning' ? <p className="lw-one__solo">{e.meaning}</p>
        : view === 'sound' && speak && !revealed ? <Listen speak={speak} text={e.word} label="단어 듣기" />
          : <span className="lw-one__hw" lang={L.hw} style={{ '--n': [...hw].length }}>{hw}</span>;
  // 뒷면에서는 표제어가 늘 같은 자리(앞면이 단어였으면 그대로, 다른 보기였으면 단어로 바뀐다).
  const top = revealed ? <span className="lw-one__hw" lang={L.hw} style={{ '--n': [...hw].length }}>{hw}</span> : front;
  return <section className={`lw-one__card${turnKey ? ' is-turning' : ''}`} key={turnKey || e.key} aria-label={`${e.word} 카드`}>
    <div className="lw-one__front">{top}</div>
    {!revealed && <button type="button" className="lw-one__reveal" onClick={onReveal} aria-keyshortcuts="Space">정답 확인 · Space</button>}
    {revealed && <div className="lw-one__back">
      <div className="lw-one__meta"><Reading text={sub} word={hw} tone={tone} /><Listen speak={speak} text={e.word} /></div>
      {info.hard ? <div className="lw-one__chips"><span className="lw-chip">자주 틀린 단어 · {info.hard}번</span></div> : null}
      <p className="lw-one__mean">{e.meaning}</p>
      <CharTiles tiles={tiles} />
      <Example ex={e.ex} word={e.word} speak={speak} onWord={onWord} openKey={openKey} tone={tone} />
    </div>}
  </section>;
}

/**
 * 화면 아래 고정 네 칸 + 안내 한 줄 — 안내는 뒷면에서만(앞면 「안내 문구 없음」), 자리는 늘 잡아 네 칸이 움직이지 않는다.
 * 리스트 모드는 label(지금 채점할 카드의 단어 — 準備)을 안내 자리에 둔다.
 */
export function GradeBar({ previews, onGrade, disabled, note, guide = true, label = null }) {
  const text = useWordLang().guide;
  return <div className="lw-gradebar"><div className="lw-gradebar__in">
    <p className="lw-gradebar__guide" aria-hidden={(!guide && !label) || undefined}>{label || (guide ? text : null)}</p>
    <GradeButtons previews={previews} onGrade={onGrade} disabled={disabled} note={note} />
  </div></div>;
}

/**
 * 단어 탭 끝 화면(시안 「단어 페이지 손질」 ②) — 단어 자리에 나온다. 「다시」 누른 단어는 같은 줄에 돌아와 이미 다시 본 뒤라 「모른 것만 다시」는 없다.
 * 「N번 채점했어요 · 내일 N개가 돌아와요」 + 이름 붙은 네 칸(누른 횟수) + [소리로 확인할 단어 N개] [HSK n 이어서] [리스트로].
 */
export function OneWordDone({ graded, tomorrow, counts, onNext, onList, nextLabel, soundCount = 0, onSound }) {
  const cells = [[1, 'again', '다시'], [2, 'hard', '어려움'], [3, 'good', '알맞음'], [4, 'easy', '쉬움']];
  return <section className="lw-done" aria-labelledby="lw-done-title">
    <h2 id="lw-done-title" tabIndex={-1}>오늘 이 레벨 끝</h2>
    <p className="lw-done__sum"><b>{graded}</b>번 채점했어요{tomorrow > 0 && <> · 내일 <b>{tomorrow}</b>개가 돌아와요</>}</p>
    <div className="lw-done__counts" aria-label="누른 횟수">
      {cells.map(([n, cls, label]) => <span key={n} className={`lw-done__n lw-grade--${cls}`}><b>{counts[n]}</b><small>{label}</small></span>)}
    </div>
    <div className="lw-done__actions">
      {soundCount > 0 && <button type="button" className="lw-btn lw-btn--primary lw-btn--wide" onClick={onSound}>소리로 확인할 단어 {soundCount}개
        <small>어제까지 본 단어 · 일정에는 반영 안 돼요</small></button>}
      <div className="lw-done__row">
        {onNext && <button type="button" className={`lw-btn${soundCount > 0 ? '' : ' lw-btn--primary'}`} onClick={onNext}>{nextLabel} 이어서</button>}
        <button type="button" className="lw-btn" onClick={onList}>리스트로</button>
      </div>
    </div>
  </section>;
}
