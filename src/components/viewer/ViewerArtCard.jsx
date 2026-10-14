'use client';
// 「그림 한 장 읽기」 큐레이션 책 장의 작품 정보 카드(ART-P0-3, 목업 2026-10-14 KST 오너 합의) — 본문 위, 출처 줄과 함께.
//
//   [그림]  (캡션: image.credit — 미술관이 요청한 캡션, 작게)
//   冨嶽三十六景 神奈川沖浪裏 · 후가쿠 36경 — 가나가와 앞바다 파도 아래
//   가쓰시카 호쿠사이(1760–1849) · 1830/33 · 에도 시대 · 가로로 긴 오반 크기 니시키에
//   소장  도쿄 국립박물관 ↗ · 시카고 미술관 ↗
//   그림 속 장소  도쿄만 · 후지산
//   찾아볼 것  ① … ② … ③ …
//   ▸ 작가 소개
//   출처: <credit> · <license> · 원문 ↗        ← 본문 바로 위 한 줄(유튜브·PDF·아오조라와 같은 viewer-attribution 문법)
//
// 값은 useArtBookChapter(카탈로그 해시 대조를 통과한 장)에서만 온다 — 자료 metadata를 직접 읽지 않는다(가짜 크레딧 차단).
// 화면 문구는 vt(뷰어 화면 언어, viewerMessages.js)로, 작품·장소 이름과 해설 크레딧은 학습 내용이라 그대로 둔다.
import { Fragment, useState } from 'react';
import Link from 'next/link';
import './art-card.css';

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
/** 가나·한자가 섞인 원문 표기(「江戸時代・安政4年(1857)」)는 일본어로 읽힌다 — 「c. 1830/33」 같은 출처 표기는 그대로. */
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;
/** 미술관 캡션(라틴 문자만)이면 영어로 읽힌다 — 한글·한자가 섞이면 lang을 붙이지 않는다. */
const LATIN_ONLY = /^[\u0020-\u024f\u1e00-\u1eff\u2010-\u201f]+$/;
const httpsUrl = (value) => (typeof value === 'string' && value.startsWith('https://') ? value : '');
const placeName = (place) => place?.name?.ko || place?.name?.native || '';
const studiesMapHref = (pin) => `/studies/japan/map?pin=${encodeURIComponent(pin)}`;

/**
 * @param {object} p
 * @param {null | {card: object, credit: {credit: string, license: string|null, sourceUrl: string}}} p.chapter verifiedArtChapter 결과
 * @param {(text: string, values?: object) => string} p.vt 뷰어 화면 문구 번역(ViewerPage의 vt)
 */
export default function ViewerArtCard({ chapter, vt }) {
  const [failedImage, setFailedImage] = useState('');
  const card = chapter?.card;
  if (!card) return null;
  const imageUrl = httpsUrl(card.image?.url);
  const image = imageUrl && failedImage !== imageUrl ? card.image : null;
  const artist = card.artist;
  const meta = [
    artist?.name?.ko && <Fragment key="artist">{artist.name.ko}{artist.years && `(${artist.years})`}</Fragment>,
    card.date?.text && <span key="date" lang={JAPANESE.test(card.date.text) ? 'ja' : undefined}>{card.date.text}</span>,
    ...(card.date?.periods ?? []).map((period) => period?.ko && <Fragment key={`period:${period.ko}`}>{period.ko}</Fragment>),
    card.medium?.ko && <Fragment key="medium">{card.medium.ko}</Fragment>,
  ].filter(Boolean);
  const holdings = (card.holdings ?? []).filter((place) => httpsUrl(place.url) && placeName(place));
  const depicted = (card.depicted ?? []).filter((place) => placeName(place));
  // 찾아볼 것은 그림을 보며 하는 질문 — 그림이 보이지 않으면(없음·불러오기 실패) 두지 않는다(카탈로그 계약과 같은 뜻).
  const lookFor = image ? (card.lookFor ?? []).filter((item) => typeof item === 'string' && item.trim()) : [];
  const life = typeof artist?.life === 'string' ? artist.life.trim() : '';
  const credit = chapter.credit;
  const sourceUrl = httpsUrl(credit?.sourceUrl);

  return (
    <>
      <section className="viewer-art-card" aria-label={vt('작품 정보')}>
        {image && (
          <figure className="viewer-art-card__figure">
            {/* 미술관 IIIF 원본을 그대로 — next/image 최적화 경유 없이(원격 도메인 설정·변환 없이 원본 크기 843px 한 장). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="viewer-art-card__img" src={imageUrl} alt={image.alt} loading="lazy" decoding="async"
              onError={() => setFailedImage(imageUrl)} />
            {image.credit && <figcaption className="viewer-art-card__caption" lang={LATIN_ONLY.test(image.credit) ? 'en' : undefined}>{image.credit}</figcaption>}
          </figure>
        )}
        <h2 className="viewer-art-card__title">
          <span lang="ja">{card.title?.native}</span>
          {card.title?.ko && <span className="viewer-art-card__title-ko"> · {card.title.ko}</span>}
        </h2>
        {meta.length > 0 && (
          <p className="viewer-art-card__meta">
            {meta.map((piece, index) => <Fragment key={index}>{index > 0 && ' · '}{piece}</Fragment>)}
          </p>
        )}
        <dl className="viewer-art-card__facts">
          {holdings.length > 0 && (
            <div className="viewer-art-card__fact">
              <dt>{vt('소장')}</dt>
              <dd>
                {holdings.map((place, index) => (
                  <Fragment key={place.id}>
                    {index > 0 && ' · '}
                    <a href={httpsUrl(place.url)} target="_blank" rel="noopener noreferrer"
                      aria-label={vt('{name} 소장품 기록 보기(새 창)', { name: placeName(place) })}>
                      {placeName(place)}<span aria-hidden="true"> ↗</span>
                    </a>
                  </Fragment>
                ))}
              </dd>
            </div>
          )}
          {depicted.length > 0 && (
            <div className="viewer-art-card__fact">
              <dt>{vt('그림 속 장소')}</dt>
              <dd>
                {depicted.map((place, index) => (
                  <Fragment key={place.id}>
                    {index > 0 && ' · '}
                    {place.links?.studiesPin
                      ? <Link href={studiesMapHref(place.links.studiesPin)} prefetch={false}
                          aria-label={vt('{name} 지역학 지도에서 보기', { name: placeName(place) })}>{placeName(place)}</Link>
                      : placeName(place)}
                  </Fragment>
                ))}
              </dd>
            </div>
          )}
          {lookFor.length > 0 && (
            <div className="viewer-art-card__fact">
              <dt>{vt('찾아볼 것')}</dt>
              <dd>
                <ol className="viewer-art-card__look">
                  {lookFor.map((item, index) => (
                    <li key={index}><span aria-hidden="true" className="viewer-art-card__num">{CIRCLED[index] ?? `${index + 1}.`}</span> {item}</li>
                  ))}
                </ol>
              </dd>
            </div>
          )}
        </dl>
        {life && (
          <details className="viewer-art-card__about">
            <summary>{vt('작가 소개')}</summary>
            <p>{life}</p>
          </details>
        )}
      </section>
      {credit?.credit && (
        <p className="viewer-attribution viewer-art-credit">{credit.credit}
          {credit.license && <> · <span className="viewer-attribution__license">{credit.license}</span></>}
          {sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={vt('원문 보기(새 창)')}>{vt('원문')}<span aria-hidden="true"> ↗</span></a></>}
        </p>
      )}
    </>
  );
}
