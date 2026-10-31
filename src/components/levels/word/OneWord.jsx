'use client';
// 한 단어 모드(문서 「한 단어 모드」) — 앞면: 단어 52px 고정 자리 + 「정답 확인 · Space」 하나. 뒷면: 단어는 같은 자리,
// 그 아래 읽기(HSK 병음 성조 색 · JLPT 가나) · 듣기 (레벨 태그 · 상태는 찾기에만 — 오너 2026-10-20 KST), 뜻, 글자 칸, 예문. 네 칸은 화면 아래 고정(앞면에서도 누를 수 있다).
// 보기 탭은 앞면에 무엇을 보일지만 정한다(단어 · 문장 · 뜻 · 소리 · 전체). 훈음(글자 칸)은 뒷면에만.
// 오래된 단어의 반대 방향(뜻 보고 단어 떠올리기)은 뜻 연습 탭이 맡는다(네 영역 체크 — 오너 승인 2026-10-21 KST).
import { CharTiles, CountUp, GradeButtons, Listen, Reading } from './WordParts';
import { Example } from './WordCard';
import { useWordLang } from './wordLang';
import { NEW_PER_DAY_UNLIMITED } from '@/lib/vocabStudy';

export function OneWordCard({ entry: e, view, info, tiles, speak, tone, revealed, onReveal, onWord, openKey, turnKey }) {
  const L = useWordLang();
  const { hw, sub } = L.head(e);
  // 표제어 — 판이 따로 그리면(영어 · 프랑스어: 폭 기준 크기 · 관사 매달기) 그것으로.
  const word = L.Headword ? <L.Headword entry={e} size="one" tone={tone} /> : <span className="lw-one__hw" lang={L.hw} style={{ '--n': [...hw].length }}>{hw}</span>;
  const front = view === 'sentence' ? <p className="lw-one__solo" lang={L.hw}>{e.ex?.text || hw}</p>
      : view === 'meaning' ? <p className="lw-one__solo">{e.meaning}</p>
        : view === 'sound' && speak && !revealed ? <Listen speak={speak} text={e.word} label="단어 듣기" />
          : word;
  // 뒷면에서는 표제어가 늘 같은 자리(앞면이 단어였으면 그대로, 다른 보기였으면 단어로 바뀐다).
  const top = revealed ? word : front;
  return <section className={`lw-one__card${turnKey ? ' is-turning' : ''}`} key={turnKey || e.key} aria-label={`${e.word} 카드`} tabIndex={-1}>
    <div className="lw-one__front">{top}</div>
    {!revealed && <button type="button" className="lw-one__reveal" aria-keyshortcuts="Space"
      onClick={(ev) => { const card = ev.currentTarget.closest('section'); onReveal(); card?.focus({ preventScroll: true }); }}>정답 확인 <span className="lw-one__key">· Space</span></button>}
    {revealed && <div className="lw-one__back">
      <div className="lw-one__meta"><Reading text={sub} word={hw} tone={tone} /><Listen speak={speak} text={e.word} /></div>
      {info.hard ? <div className="lw-one__chips"><span className="lw-chip">자주 틀린 단어 · {info.hard}번</span></div> : null}
      <p className="lw-one__mean">{e.meaning}{L.MeanTag && <L.MeanTag entry={e} tone={tone} />}</p>
      <CharTiles tiles={tiles} word={e.word} />
      {L.Extras && <L.Extras entry={e} />}
      <Example ex={e.ex} word={e.word} speak={speak} onWord={onWord} openKey={openKey} tone={tone} />
    </div>}
  </section>;
}

/**
 * 화면 아래 고정 네 칸 + 한 줄 자리 — 채점 기준 안내 문구는 두지 않는다(오너 2026-10-26 KST 「일부러 없앤 지 오래」).
 * 리스트 모드만 label(지금 채점할 카드의 단어 — 準備)을 그 자리에 둔다. 자리는 늘 잡아 네 칸이 움직이지 않는다.
 * 앞면에서도 바로 누를 수 있다(답을 펼치지 않고 채점 — 오너 결정, 2026-10-21 KST 재확인: 시안 ⑦-2 「확인 전 채점 막기」는 넣지 않는다).
 */
export function GradeBar({ previews, onGrade, disabled, note, label = null, two = false }) {
  return <div className="lw-gradebar"><div className="lw-gradebar__in">
    <p className="lw-gradebar__guide" aria-hidden={!label || undefined}>{label}</p>
    <GradeButtons previews={previews} onGrade={onGrade} disabled={disabled} note={note} two={two} />
  </div></div>;
}

/**
 * 단어 탭 끝 화면(9판 ⑤ · 오너 2026-10-19 KST 「문구 최대한 자제, 결과 숫자는 칸으로 강조」 · 「학습」 · 「계속 진행」) — 단어 자리에 나온다.
 * 큰 두 칸(학습 · 내일) + 이름 붙은 네 칸(누른 횟수) + [소리로 확인할 단어 N개](손질 ②) [계속 진행](다음 레벨) [리스트로].
 * 「다시」 누른 단어는 같은 줄에 돌아와 이미 다시 본 뒤라 「모른 것만 다시」는 없다.
 * 하루 새 단어(시안 ⑧ · 오너 2026-10-21 KST 「같은 수, 더 단추」) — more가 있으면 오늘 몫에서 멈춘 것: 제목 「오늘 새 단어 N개 끝」 +
 * [새 단어 N개 더] [전체 훑어보기](다음 레벨도 같은 하루 몫이라 「계속 진행」 대신 · 「리스트로」는 바로 위 모드 칸과 같은 일이라 뺀다) +
 * 회색 한 줄 대가(시안 ⑪ · 오너 2026-10-22 KST 검토 — 단추는 모두 한 줄 48px, 설명은 단추 밖). 채점 없이 들어온 날은 칸을 그리지 않는다.
 */
export function NewDayTitle({ started }) {
  return started > 0 ? `오늘 새 단어 ${started}개 끝` : '오늘 복습 끝';
}
export function MoreNewButton({ more, onMore, primary = false }) {
  return <button type="button" className={`lw-btn${primary ? ' lw-btn--primary' : ''}`} onClick={onMore}>새 단어 {more}개 더</button>;
}
/** 분량(학습 옵션)에서 멈춘 뒤 남은 오늘 단어를 다음 분량만큼 — 「새 단어 N개 더」(하루 몫 뒤)와 다른 칸(rest)이다. */
export function ContinueButton({ count, onContinue, primary = false }) {
  return <button type="button" className={`lw-btn${primary ? ' lw-btn--primary' : ''}`} onClick={onContinue}>이어서 {count}개</button>;
}
/** 「더」의 대가 — 단추 안이 아니라 아래 회색 한 줄(시안 ⑪ · 단추는 모두 한 줄 48px). */
export function MoreNewNote({ perDay }) {
  // 「제한 없음」(9999)은 숫자로 쓰지 않는다.
  return <p className="lw-done__note">{perDay > 0 && perDay < NEW_PER_DAY_UNLIMITED ? `하루 ${perDay}개를 넘기면 내일 복습이 그만큼 늘어요` : '새 단어를 더 하면 내일 복습이 그만큼 늘어요'}</p>;
}
export function OneWordDone({ graded, tomorrow, counts, onNext, onList, nextLabel, soundCount = 0, onSound, more = 0, perDay = 0, started = 0, onMore, onBrowse,
  cont = 0, onContinue, two = false }) {
  // 2단 평가면 누른 칸 둘(다시 · 알맞음)만 — 이번 세션에 어려움 · 쉬움을 누른 적이 있으면(도중에 바꿈) 넷 다 보인다.
  const all = [[1, 'again', '다시'], [2, 'hard', '어려움'], [3, 'good', '알맞음'], [4, 'easy', '쉬움']];
  const pair = two && !(counts?.[2] > 0) && !(counts?.[4] > 0);
  const cells = pair ? all.filter(([n]) => n === 1 || n === 3) : all;
  // 분량에서 멈춤(cont — 남은 오늘 단어)이 하루 몫에서 멈춤(more)보다 먼저다: 남은 단어가 오늘 할 일이고, 몫 뒤 새 단어는 그다음이다.
  const paused = cont > 0;
  const capped = !paused && more > 0;
  return <section className="lw-done" aria-labelledby="lw-done-title">
    <h2 id="lw-done-title" tabIndex={-1}>{paused ? '이번 분량 끝' : capped ? <NewDayTitle started={started} /> : '오늘 이 레벨 끝'}</h2>
    {graded > 0 ? <>
      <div className="lw-done__big">
        <span className="lw-done__n"><b><CountUp n={graded} /></b><small>학습</small></span>
        <span className="lw-done__n"><b><CountUp n={tomorrow} /></b><small>내일</small></span>
      </div>
      <div className={`lw-done__counts${pair ? ' lw-done__counts--two' : ''}`} aria-label="누른 횟수">
        {cells.map(([n, cls, label]) => <span key={n} className={`lw-done__n lw-grade--${cls}`}><b><CountUp n={counts[n]} /></b><small>{label}</small></span>)}
      </div>
    </> : <p className="lw-done__sum">지금 복습할 단어가 없어요</p>}
    <div className="lw-done__actions">
      {soundCount > 0 && <button type="button" className="lw-btn lw-btn--primary" onClick={onSound}>소리로 확인할 단어 {soundCount}개</button>}
      <div className="lw-done__row">
        {paused ? <>
          <ContinueButton count={cont} onContinue={onContinue} primary={soundCount === 0} />
          {onList && <button type="button" className="lw-btn" onClick={onList}>리스트로</button>}
        </> : capped ? <>
          <MoreNewButton more={more} onMore={onMore} primary={soundCount === 0} />
          <button type="button" className="lw-btn" onClick={onBrowse}>전체 훑어보기</button>
        </> : <>
          {onNext && <button type="button" className={`lw-btn${soundCount > 0 ? '' : ' lw-btn--primary'}`} onClick={onNext}
            aria-label={nextLabel ? `계속 진행 · ${nextLabel}` : undefined}>계속 진행</button>}
          {onList && <button type="button" className="lw-btn" onClick={onList}>리스트로</button>}
        </>}
      </div>
      {capped && <MoreNewNote perDay={perDay} />}
    </div>
  </section>;
}
