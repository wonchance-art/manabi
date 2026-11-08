# YouTube 공급원 — 공식 Data API v3 전환 설계 메모 (YT-API-001 · 2026-11-08 KST)

오케스트레이터 지시(08:25 KST)에 따라 설계만 정리한다.
- 코드 착수는 **오너 결정(a 의존성 갱신 · b 공식 API · c 끄기) 뒤, b라면 API 키 등록 뒤**다.
- 키는 새 환경 변수라 오너 영역이다.

## 지금 상태(실측 11/8 05:50 KST)
- 영어 · 일본어 `youtube_channel` · `youtube_cc`는 **3/28 이후 수확 0**이다.
- 원인은 `youtubei.js` 17.2.0(비공식 InnerTube)이다.
  - 채널 목록(getChannel · getVideos)은 된다.
  - 영상마다 부르는 `getBasicInfo`가 YouTube에서 `UNPLAYABLE — "The page needs to be reloaded"`를 받는다.
  - 그래서 자막 목록 · 임베드 판정이 비고, fail-closed로 전부 버려진다.
- 같은 라이브러리를 쓰는 곳은 넷이다: `src/lib/server/youtubeChannel.js`(채널) · `youtubeShareable.js`(CC 검색 · VOA 본문) · `media.js`(정규화) · `content-sources.js`(디스패처).
- 클릭 시점 가져오기(`/api/import/link`)는 `youtube-transcript` → Supadata 경로라 별개다. 이번 고장과 무관하지만, 같은 비공식 자막 경로라 따로 점검할 대상이다.

## 공식 API로 바꿀 수 있는 것 / 없는 것
| 단계 | 지금(youtubei.js) | 공식 Data API v3 | 비용(단위) |
|---|---|---|---|
| 핸들 → 채널 | `resolveURL` | `channels.list?part=contentDetails&forHandle=@VOALearningEnglish` → `uploads` 재생목록 id | 1 (결과는 오래 기억) |
| 채널 최신 영상 | `getChannel().getVideos()` | `playlistItems.list?part=snippet,contentDetails&playlistId=UU…&maxResults=12` | 1 |
| 자막 · 임베드 · 라이선스 판정 | `getBasicInfo`(caption_tracks · playableInEmbed) | `videos.list?part=snippet,contentDetails,status&id=…(최대 50)` — `contentDetails.caption`(자막 유무) · `status.embeddable` · `status.license`(`creativeCommon`) · `snippet.defaultAudioLanguage` | 1 (50개 묶음) |
| 자막 **언어** 목록 | caption_tracks | `captions.list?part=snippet&videoId=…` | **50 / 영상** |
| CC 검색 | `yt.search(q, {features:[creative_commons, subtitles]})` | `search.list?part=snippet&type=video&q=…&videoLicense=creativeCommon&videoCaption=closedCaption&relevanceLanguage=en` | **100** |
| 자막 **본문**(VOA · CC 공개 자료) | timedtext 직접 | **불가** — `captions.download`는 영상 소유자 OAuth가 필요하다 | — |

- 결론: **목록 · 판정은 공식 API로 옮길 수 있다.** 서버가 자막 본문을 미리 담던 두 갈래(VOA 퍼블릭 도메인 · CC 공개 자료, F R5)는 공식 API로는 안 된다.
  - 이 둘은 「목록만 담고 본문은 클릭 시점(`/api/import/link`)」(= 지금 `youtube_ondemand`와 같은 모양)으로 바꾸는 것이 자연스럽다.
  - 이렇게 바꾸면 공개 자료(본문 포함) 대신 개인 자료가 된다. **제품 결정이 필요하다.**

## 쿼터(기본 10,000 단위/일)
- 하루 1회 크론, 운영 `content_sources` 활성 행 + 프랑스어 기본값 기준이다: 채널 4개(VOA · cijapanese · Onomappu · innerFrench) · CC 검색 3개(en · ja · fr).
- 채널: playlistItems 1 + videos 1 = **2 × 4 = 8**. channels는 첫 회만 1이다.
  - 자막 언어까지 확인하려면 captions.list 50 × 후보 12개 × 4채널 = 2,400이 든다. 대신 `contentDetails.caption = "true"` + `defaultAudioLanguage`로 판정하면 0이다.
- CC 검색: search 100 + videos 1 = **101 × 3 = 303**.
- 합계 **약 311/일**(captions.list를 쓰지 않을 때)로 쿼터의 3%다. captions.list를 쓰면 약 2,700/일(27%)이다.
- 권장: 언어 판정은 `defaultAudioLanguage` · `snippet.defaultLanguage`로 하고, 애매한 영상만 captions.list로 확인한다(상한 10개/일).

## 환경 변수(제안)
- `YOUTUBE_DATA_API_KEY` — 서버 전용(브라우저 노출 금지, `NEXT_PUBLIC_` 아님).
- Google Cloud에서 「YouTube Data API v3」만 허용하고, HTTP 리퍼러 대신 **API 제한**을 건다(서버 호출).
- 키가 없으면 지금처럼 0건 + 로그 한 줄로 끝난다(fail-closed). 크론은 멈추지 않는다.
- **구현 뒤 보완(YT-API-002 · 2026-11-08 KST, 오케스트레이터 13:30)**:
  - 키 이름은 `YOUTUBE_DATA_API_KEY` → `YOUTUBE_API_KEY` 순서로 읽는다. 뒤의 것은 3월 첫 「오늘의 추천」이 같은 Data API v3를 부르던, 오너가 이미 등록해 둔 키다(환경 변수는 바꾸지 않는다).
  - 400 · 403(키 무효 · 리퍼러/IP 제한 · 쿼터 초과)이면 그날 나머지 호출을 보내지 않고 0건으로 끝낸다. `observe.error_events`에 하루 한 줄(`server.youtube-collect`, 키 값 · `AIza…` 모양은 지움).
  - 하루 상한 `YT_DAILY_UNIT_CAP = 320`(KST 날짜, 호출 전에 셈). 위 합계 311은 channels.list를 첫 회만으로 쳤는데 지금 코드는 매일 4채널을 해석해 기본이 315다.
  - 그래서 captions.list(50)는 자리가 없어 `MAX_CAPTION_PROBES = 0` — 오디오 언어로 못 가르는 영상은 버린다(fail-closed).

## 바꿀 자리(디스패처는 그대로)
- `src/lib/content-sources.js` `fetchFromSource`의 `case 'youtube_channel'` · `case 'youtube_cc'`는 **그대로** 둔다. 동적 import 대상만 바꾼다.
- 새 모듈 `src/lib/server/youtubeDataApi.js`:
  - `listChannelUploads(handle, n)` · `probeVideos(ids)` → `{ videoId, title, channel, thumbnailUrl, captionLangs?, embeddable, license, audioLanguage }`.
  - `fetch` 주입형으로 만들어 테스트에서 네트워크 없이 검증한다.
- `youtubeChannel.js` `fetchYoutubeChannel`: 목록 · 판정 부분만 새 모듈로 바꾼다. `isListable` · `toSuggestionArticle` · `probeBudget`는 재사용한다(정본 유지).
- `youtubeShareable.js` `fetchYoutubeCc`: `search.list` + `videos.list(status.license === 'creativeCommon')`로 라이선스를 재확인한다(지금의 fail-closed 원칙 유지). 본문은 위 제품 결정에 따른다.
- `media.js`의 youtubei.js 정규화 함수는 클릭 경로 · 보관 코드가 쓰는지 확인한 뒤 남기거나 정리한다.
- 계약: 응답 모양 고정 픽스처(공식 API 문서 예시 구조)로 `listChannelUploads` · `probeVideos` · 라이선스 재확인 · 키 없음 fail-closed를 검사한다.

## 결정이 필요한 것(오너)
1. a · b · c 중 무엇을 고를지(오케스트레이터 권장: b).
2. b라면 VOA · CC 「본문을 담는 공개 자료」를 「목록만 + 클릭 시 개인 자료」로 바꿔도 되는지.
3. 키 발급 · 등록: Google Cloud 프로젝트 · Vercel 환경 변수 `YOUTUBE_DATA_API_KEY`.
