# 붙여넣기용 완성 프롬프트 (2026-10-16 KST)

`PROMPTS.md`는 설명서다. **실제로 생성기에 붙여 넣는 것은 이 파일의 회색 블록 하나씩**이다.
블록 하나가 이미지 한 번 생성에 해당한다(한 대화에 한 블록씩, 방향마다 4장 정도).
문장은 `PROMPTS.md`와 같다(방향 문장 + 글자 지정 + 공통 꼬리말을 미리 합쳐 둔 것). PROMPTS.md를 고치면 이 파일도 함께 고친다.

## 1단계 — TONARI 탐색 (방향 A~F) · 보조 경로

기본 탐색은 `CONCEPT.md`(컨셉 브리프 → 자유 탐색)다. 이 1단계는 틀을 정해 둔 보조 경로다. 고른 안이 생기면 어느 경로였든 아래 2단계로 온다.

### TONARI-A · 隣り合う — 맞닿는 글자
```
Custom hand-lettered wordmark of the word "TONARI" — six Latin capital letters, T, O, N, A, R, I, in that order. Neighbouring letters lean on each other and share a single touching point, like neighbours standing shoulder to shoulder — a tight, interlocking logotype. Bold, confident, modern editorial lettering.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Neighbouring letters touch at exactly one clear point each; elsewhere keep visible gaps.
```

### TONARI-B · 고대비 세리프
```
Custom display lettering of the word "TONARI" — six Latin capital letters, T, O, N, A, R, I, in that order for a calm, premium travel-and-culture magazine masthead. High stroke contrast with heavy verticals and fine (but not hairline) horizontals, sharp wedge serifs, slightly condensed proportions, crafted by a type designer.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### TONARI-C · 쇼와 간판 손글씨
```
Hand-lettered the word "TONARI" — six Latin capital letters, T, O, N, A, R, I, in that order in the spirit of a mid-century Japanese shop sign painted by a sign painter: chunky rounded strokes, slightly varied but deliberate letter widths, warm and friendly, heavy weight, crisp clean edges.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### TONARI-D · 종이 오리기
```
Paper-cut lettering of the word "TONARI" — six Latin capital letters, T, O, N, A, R, I, in that order: each letter cut from one sheet with scissors, straight cuts and confident angles, small sharp notches instead of smooth curves, solid filled shapes, minimal and graphic.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### TONARI-E · 원·직선 모노라인
```
Geometric monoline lettering of the word "TONARI" — six Latin capital letters, T, O, N, A, R, I, in that order, built only from perfect circles, arcs and straight lines of one uniform, fairly thick stroke weight, rounded stroke ends, open counters, airy and clear, modern Japanese graphic design.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### TONARI-F · 붓 한 번
```
Brush lettering of the word "TONARI" — six Latin capital letters, T, O, N, A, R, I, in that order written with a soft brush in confident, continuous strokes, visible speed and pressure changes, but smooth solid edges with no dry-brush texture, expressive yet legible, balanced as a logotype.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

## 2단계 — 고른 안을 이어받기 (고른 이미지를 첨부한 채, 같은 대화에서)

### 정리판 (필수) → 파일 끝 글자 `c`
컨셉 탐색(CONCEPT.md ②)의 칸에는 TONARI와 となり가 함께 들어 있다. 정리판은 **TONARI만 떼어** 받는다.
- TONARI 단독은 국제판·다른 나라 시리즈·작은 크기(아바타·파비콘)에 쓴다.
- となり는 칸 안에서 작게 그려져 세부가 부족하다. 정리판으로 키우지 말고 아래 「패밀리 확장」으로 크게 새로 받는다.
- 둘을 함께 놓은 조합판은 Claude가 두 정리판으로 정밀하게 다시 짠다. 크기 비율과 간격은 원래 칸 이미지를 기준으로 삼는다.

```
From the attached image, take only the large word "TONARI" and redraw it alone, without the smaller hiragana line.
Keep every letterform, proportion and stroke shape exactly the same.
Only clean it: perfectly smooth edges, uniform solid black fill, remove any texture or noise, pure white background,
centered with wide margins, maximum resolution.
```
TONARI만 들어 있는 이미지라면 첫 줄 대신 `Redraw the attached wordmark exactly.`로 시작한다.

### 패밀리 확장 — となり → `hira-…` (TONARI 정리판을 첨부하고 넣는다)
```
Using exactly the same lettering style as the attached image — same stroke weight, contrast, stroke endings, proportions and spirit — write the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana. Keep the same height and the same spacing rhythm.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### 패밀리 확장 — トナリ → `kata-…`
```
Using exactly the same lettering style as the attached image — same stroke weight, contrast, stroke endings, proportions and spirit — write the Japanese word "トナリ" written in katakana, exactly three characters in this order: ト (to), ナ (na), リ (ri). Each character keeps its standard stroke structure: ト has two strokes, ナ has two strokes, リ has two strokes. No hiragana, no kanji. Keep the same height and the same spacing rhythm.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### 글리프 시트 (선택) → 끝 글자 `g`
```
Using exactly the same lettering style as the attached image (same stroke weight, contrast, terminals, proportions), draw each character separately on a grid: T, O, N, A, R, I, one character per cell, all the same height, aligned on one baseline, black on white, generous space between cells, no labels.
```
(となり면 `と, な, り`, トナリ면 `ト, ナ, リ`로 바꾼다)

### 골격판 (선택, E·F 방향) → 끝 글자 `s`
```
Trace the centerline skeleton of the attached wordmark as a single thin uniform black line (about 1/60 of the letter height), same letter shapes and positions, no fill, white background.
```

### 부분 수정 (선택, 2~3회까지만)
```
Keep everything in the attached image identical except: make the second letter slightly narrower.
```
(콜론 뒤만 원하는 수정으로 바꾼다)

## 부록 — 가나를 처음부터 탐색하고 싶을 때 (となり A~F)

### hira-A · 隣り合う — 맞닿는 글자
```
Custom hand-lettered wordmark of the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana. Neighbouring letters lean on each other and share a single touching point, like neighbours standing shoulder to shoulder — a tight, interlocking logotype. Bold, confident, modern editorial lettering.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Neighbouring letters touch at exactly one clear point each; elsewhere keep visible gaps.
```

### hira-B · 고대비 세리프
```
Custom display lettering of the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana for a calm, premium travel-and-culture magazine masthead. High stroke contrast with heavy verticals and fine (but not hairline) horizontals, sharp wedge serifs, slightly condensed proportions, crafted by a type designer.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### hira-C · 쇼와 간판 손글씨
```
Hand-lettered the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana in the spirit of a mid-century Japanese shop sign painted by a sign painter: chunky rounded strokes, slightly varied but deliberate letter widths, warm and friendly, heavy weight, crisp clean edges.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### hira-D · 종이 오리기
```
Paper-cut lettering of the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana: each letter cut from one sheet with scissors, straight cuts and confident angles, small sharp notches instead of smooth curves, solid filled shapes, minimal and graphic.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### hira-E · 원·직선 모노라인
```
Geometric monoline lettering of the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana, built only from perfect circles, arcs and straight lines of one uniform, fairly thick stroke weight, rounded stroke ends, open counters, airy and clear, modern Japanese graphic design.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

### hira-F · 붓 한 번
```
Brush lettering of the Japanese word "となり" written in hiragana, exactly three characters in this order: と (to), な (na), り (ri). Each character keeps its standard stroke structure: と has two strokes, な has four strokes, り has two strokes. No extra or missing strokes, no kanji, no katakana written with a soft brush in confident, continuous strokes, visible speed and pressure changes, but smooth solid edges with no dry-brush texture, expressive yet legible, balanced as a logotype.

Output requirements: pure solid black (#000000) letters on a pure white background, one flat color only.
No texture, no grain, no paper, no shadow, no gradient, no 3D, no outline stroke, no mockup, no perspective — flat front view.
Only this word, nothing else: no tagline, no extra letters, no icon, no frame, no border, no decoration.
Single horizontal line, centered, with at least 15% empty margin on every side.
Every stroke is clearly thick enough to survive at small size (thinnest stroke at least 1/40 of the letter height).
Clear, visible gaps between neighbouring letters.
```

