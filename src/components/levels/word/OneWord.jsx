'use client';
// 한 단어 모드(문서 「한 단어 모드」) — 앞면: 문제 면 하나(52px 고정 자리) + 「정답 확인 · Space」 하나. 뒷면: 문제 면 자리는 그대로,
// 그 아래 읽기(HSK 병음 성조 색 · JLPT 가나) · 듣기 (레벨 태그 · 상태는 찾기에만 — 오너 2026-10-20 KST), 뜻, 글자 칸, 예문. 네 칸은 화면 아래 고정(앞면에서도 누를 수 있다).
// 카드 세 종류(CARD-TYPES-001 §2 · 오너 결정 2026-11-01 KST — 보기 탭은 없앴다, A안): 문제 면은 카드 종류가 정한다 —
//   단어 → 뜻(recognition) = 표제어 · 뜻 → 단어(production) = 뜻(표제어와 같은 크기 규칙) · 듣기(listening) = 소리 단추만(예문).
//   답 면: 단어 → 뜻 = 읽기 · 뜻 · 글자 칸 · 예문 / 뜻 → 단어 = 표제어(문제 면 자리) · 읽기 · 글자 칸 · 예문 / 듣기 = 예문(후리가나) · 해석 · 표제어 줄.
//   종류 글씨는 붙이지 않는다. 후리가나는 문제 면에 없고(맨 글자) 답 면 예문에는 늘 있다(Example). 예문은 모든 답 면에.
// 훑어보기(view 'all' — 끝 화면 「전체 훑어보기」)는 채점 없이 펼친 뒷면 그대로.
import { CharTiles, CountUp, GradeButtons, Listen, Reading, WaitChip, WaitText } from './WordParts';
import { Example } from './WordCard';
import { useWordLang } from './wordLang';
import { ListenFace, MeaningFace } from '@/components/cards/CardFaces';
import { NEW_PER_DAY_UNLIMITED } from '@/lib/vocabStudy';

/**
 * kind = 카드 종류('recognition' · 'production' · 'listening' — 없으면 단어 → 뜻). view = 'all'이면 훑어보기(종류와 무관하게 단어 앞면 · 펼친 뒷면).
 * wait = 미리 올린 카드(미리 학습 LEARN-AHEAD-001)의 실제 차례 시각(ms) — 앞면 오른쪽 위에 남은 시간만(「4분 후」 · 시안 ③).
 */
export function OneWordCard({ entry: e, kind = 'recognition', view = 'word', info, tiles, speak, tone, revealed, onReveal, onWord, openKey, turnKey, wait = null }) {
  const L = useWordLang();
  const { hw, sub } = L.head(e);
  const face = view === 'all' ? 'recognition' : kind;
  // 표제어 — 판이 따로 그리면(영어 · 프랑스어: 폭 기준 크기 · 관사 매달기) 그것으로.
  const word = L.Headword ? <L.Headword entry={e} size="one" tone={tone} /> : <span className="lw-one__hw" lang={L.hw} style={{ '--n': [...hw].length }}>{hw}</span>;
  // 문제 면 — 듣기는 답 면에서도 단추가 그 자리에 남는다(다시 듣기). 뜻 → 단어는 답 면에서 표제어로 바뀐다(같은 자리).
  const top = face === 'listening' ? <ListenFace speak={speak} text={e.ex?.text || e.word} />
    : face === 'production' && !revealed ? <MeaningFace meaning={e.meaning} className="lw-one__hw" /> : word;
  const label = face === 'recognition' ? `${e.word} 카드` : '카드';
  const example = <Example ex={e.ex} word={e.word} speak={speak} onWord={onWord} openKey={openKey} tone={tone} />;
  return <section className={`lw-one__card${turnKey ? ' is-turning' : ''}`} key={turnKey || e.key} aria-label={label} tabIndex={-1}>
    <div className="lw-one__front">{top}{wait ? <span className="lw-one__wait"><WaitChip at={wait} /></span> : null}</div>
    {!revealed && <button type="button" className="lw-one__reveal" aria-keyshortcuts="Space"
      onClick={(ev) => { const card = ev.currentTarget.closest('section'); onReveal(); card?.focus({ preventScroll: true }); }}>정답 확인 <span className="lw-one__key">· Space</span></button>}
    {revealed && face === 'listening' && <div className="lw-one__back">
      <div className="lw-ex--answer"><Example ex={e.ex} word={e.word} speak={null} onWord={onWord} openKey={openKey} tone={tone} /></div>
      <div className="lw-one__word">
        <span className="lw-row__word" lang={L.hw}>{hw}</span><Reading text={sub} word={hw} tone={tone} /><span className="lw-card__mean">{e.meaning}</span>
        <Listen speak={speak} text={e.word} label="단어 듣기" />
      </div>
    </div>}
    {revealed && face !== 'listening' && <div className="lw-one__back">
      <div className="lw-one__meta"><Reading text={sub} word={hw} tone={tone} /><Listen speak={speak} text={e.word} /></div>
      {info.hard ? <div className="lw-one__chips"><span className="lw-chip">자주 틀린 단어 · {info.hard}번</span></div> : null}
      {face === 'recognition' && <p className="lw-one__mean">{e.meaning}{L.MeanTag && <L.MeanTag entry={e} tone={tone} />}</p>}
      <CharTiles tiles={tiles} word={e.word} />
      {L.Extras && <L.Extras entry={e} />}
      {example}
    </div>}
  </section>;
}

/**
 * 화면 아래 고정 네 칸 + 한 줄 자리 — 채점 기준 안내 문구는 두지 않는다(오너 2026-10-26 KST 「일부러 없앤 지 오래」).
 * 리스트 모드만 label(지금 채점할 카드의 단어 — 準備)을 그 자리에 둔다. 자리는 늘 잡아 네 칸이 움직이지 않는다.
 * 앞면에서도 바로 누를 수 있다(답을 펼치지 않고 채점 — 오너 결정, 2026-10-21 KST 재확인: 시안 ⑦-2 「확인 전 채점 막기」는 넣지 않는다).
 */
export function GradeBar({ previews, onGrade, disabled, note, label = null }) {
  return <div className="lw-gradebar"><div className="lw-gradebar__in">
    <p className="lw-gradebar__guide" aria-hidden={!label || undefined}>{label}</p>
    <GradeButtons previews={previews} onGrade={onGrade} disabled={disabled} note={note} />
  </div></div>;
}

/**
 * 끝 화면(9판 ⑤ · 오너 2026-10-19 KST 「문구 최대한 자제, 결과 숫자는 칸으로 강조」 · 「학습」 · 「계속 진행」) — 카드 자리에 나온다.
 * 큰 두 칸(학습 · 내일) + 이름 붙은 네 칸(누른 횟수) + [계속 진행](다음 레벨) [리스트로] [전체 훑어보기].
 * 「다시」 누른 단어는 같은 줄에 돌아와 이미 다시 본 뒤라 「모른 것만 다시」는 없다.
 * 「전체 훑어보기」(채점 없음)는 보기 탭을 없애면서(CARD-TYPES-001 A안 · 오너 2026-11-01 KST) 이 화면 단추로 옮겼다. 연습 탭이 쓰던
 * 「소리로 확인할 단어 N개」는 듣기 카드가 맡아 뺐다.
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
/** 「더」의 대가 — 단추 안이 아니라 아래 회색 한 줄(시안 ⑪ · 단추는 모두 한 줄 48px). */
export function MoreNewNote({ perDay }) {
  // 「제한 없음」(9999)은 숫자로 쓰지 않는다.
  return <p className="lw-done__note">{perDay > 0 && perDay < NEW_PER_DAY_UNLIMITED ? `하루 ${perDay}개를 넘기면 내일 복습이 그만큼 늘어요` : '새 단어를 더 하면 내일 복습이 그만큼 늘어요'}</p>;
}
export function OneWordDone({ graded, tomorrow, counts, onNext, onList, nextLabel, more = 0, perDay = 0, started = 0, onMore, onBrowse }) {
  const cells = [[1, 'again', '다시'], [2, 'hard', '어려움'], [3, 'good', '알맞음'], [4, 'easy', '쉬움']];
  const capped = more > 0;
  const browse = onBrowse && <button type="button" className="lw-btn" onClick={onBrowse}>전체 훑어보기</button>;
  return <section className="lw-done" aria-labelledby="lw-done-title">
    <h2 id="lw-done-title" tabIndex={-1}>{capped ? <NewDayTitle started={started} /> : '오늘 이 레벨 끝'}</h2>
    {graded > 0 ? <>
      <div className="lw-done__big">
        <span className="lw-done__n"><b><CountUp n={graded} /></b><small>학습</small></span>
        <span className="lw-done__n"><b><CountUp n={tomorrow} /></b><small>내일</small></span>
      </div>
      <div className="lw-done__counts" aria-label="누른 횟수">
        {cells.map(([n, cls, label]) => <span key={n} className={`lw-done__n lw-grade--${cls}`}><b><CountUp n={counts[n]} /></b><small>{label}</small></span>)}
      </div>
    </> : <p className="lw-done__sum">지금 복습할 단어가 없어요</p>}
    <div className="lw-done__actions">
      <div className="lw-done__row">
        {capped ? <>
          <MoreNewButton more={more} onMore={onMore} primary />
          {browse}
        </> : <>
          {onNext && <button type="button" className="lw-btn lw-btn--primary" onClick={onNext}
            aria-label={nextLabel ? `계속 진행 · ${nextLabel}` : undefined}>계속 진행</button>}
          {onList && <button type="button" className="lw-btn" onClick={onList}>리스트로</button>}
          {browse}
        </>}
      </div>
      {capped && <MoreNewNote perDay={perDay} />}
    </div>
  </section>;
}

/**
 * 한 단어 대기 화면(LEVEL-WAIT-001 · 오너 승인 2026-11-01 KST 시안 ③) — 기다리는 카드만 남았고 가장 빠른 카드도 아직 채점할 수 없을 때(60초 창 밖),
 * 잠긴 카드를 앞당겨 띄우지 않는다(Anki 학습 카드 대기 화면). 남은 시간은 1초마다 줄고, 시간이 되면 화면이 카드를 띄운다(nextAt 타이머).
 * 네 칸 · 기다리는 카드 수는 그리지 않는다(오너 2026-11-01 KST — 잠긴 카드는 보이지 않는다). at = 가장 빠른 카드의 차례 시각.
 */
export function OneWordWait({ at, onList }) {
  return <section className="lw-wait" aria-labelledby="lw-wait-title">
    <p className="lw-wait__t" id="lw-wait-title" role="timer">
      <WaitText at={at}>{(amount) => (amount ? <>다음 카드는 <b>{amount}</b> 후에 와요</> : '다음 카드가 곧 와요')}</WaitText>
    </p>
    {onList && <button type="button" className="lw-btn" onClick={onList}>리스트로</button>}
  </section>;
}
