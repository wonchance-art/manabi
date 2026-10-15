#!/usr/bin/env python3
# F6 쇼와 레트로 — TONARI · となり · トナリ 마크 패밀리 (2026-10-15 KST)
#
# 콘셉트: 옛 상점 간판·성냥갑 라벨의 '굵은 팝 덩어리 + 떨어진 주홍 돌출 그림자'.
# 장식 규칙은 하나뿐이다 — 글자 몸통을 45° 아래오른쪽으로 밀어낸 입체 그림자(주홍)를,
# 몸통에서 가는 틈만큼 떼어 둔다. 라틴·가나가 같은 벡터·같은 틈을 쓴다.
#
# 사용(리포 루트):
#   pip install fonttools skia-pathops==0.9.2      # 불리언·윤곽 확장용(fontTools 생태계 표준)
#   python3 docs/japanology/magazine/brand/marks/families/F6-showa/build-f6.py
#   → svg/*.svg, marks.json, card.html  (card.png는 NOTES의 스크린샷 명령)
# 서체: google/fonts 고정 커밋에서 받아 SHA256 검증 후 캐시(TONARI_FONT_CACHE). 리포에 서체 파일 없음.
# 결정적: 같은 서체·같은 pathops 판이면 바이트 단위로 같은 산출물.
import hashlib, json, math, os, sys, tempfile, urllib.request
sys.dont_write_bytecode = True
import pathops
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
COMMIT = '67bc647ce1910e92f461bcc82aae30f21d21a9cc'
GF = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/'
FONT = ('mochiypopone/MochiyPopOne-Regular.ttf', '9e009430e1316c271a5f34759c6b65fc343c4e806f193042528887e7235a92c6')
CACHE = os.environ.get('TONARI_FONT_CACHE') or os.path.join(tempfile.gettempdir(), 'tonari-mast-fonts')

NIGHT, SNOW, VERMILION = '#151b2c', '#eef0f4', '#d4462a'


def font_path():
    rel, sha = FONT
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, rel.split('/')[-1])
    if not os.path.exists(p):
        urllib.request.urlretrieve(GF + rel, p)
    got = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if got != sha:
        sys.exit(f'SHA256 불일치 {p}: {got}')
    return p


TT = TTFont(font_path())
GS, CM = TT.getGlyphSet(), TT.getBestCmap()   # unitsPerEm = 1000

# ── 패밀리 원리(숫자) ──────────────────────────────────────────────────────────
STEM = None            # 라틴 I 기둥(측정, 1000단위) — 모든 비율의 기준
KANA_H = 1.03          # 가나 잉크 높이 = 대문자 잉크 높이 × 1.03 (네모 안에서 작아 보이는 만큼만)
GAP = 0.62             # 잉크 사이 = 기둥 × 0.62 ≈ 그림자 가로 성분(0.495) + 숨(0.125). 그림자 끝이 뒷글자 틈에 살짝 숨는다(간판식)
DEPTH = 0.70           # 돌출 그림자 길이 = 기둥 × 0.70, 방향 45° 아래오른쪽 (가로·세로 성분 각 0.495)
SPLIT = 0.11           # 몸통–그림자 틈 = 기둥 × 0.11 (큰 판만)
OPEN = 0.06           # 그림자 최소 폭 = 기둥 × 0.12 (그보다 얇은 바늘 조각은 버림, 끝은 반경 기둥×0.06으로 둥글게)
CRUMB = 0.35          # 넓이 < (기둥 × 0.35)² 인 그림자 부스러기는 버림
DEPTH_S = 0.70         # 작은 판(웹 헤더 24px 등): 같은 길이, 틈·부스러기 처리만 뺀다 — 24px에서 그림자가 2px 안팎으로 읽히는 하한
ANGLE = -45.0

# 손 수정(1000단위, 잉크 사이 기본값에 더함) — 광학 간격. 대각·돌출 글자 쌍만 조였다.
KERN = {
    ('T', 'O'): -70, ('N', 'A'): -38, ('A', 'R'): -24, ('O', 'N'): -6,
    ('と', 'な'): -10, ('な', 'り'): -14,
    ('ト', 'ナ'): -36, ('ナ', 'リ'): -26,
}


def rect(x0, y0, x1, y1):
    p = pathops.Path(); pen = p.getPen()
    pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    return p


def glyph(ch):
    p = pathops.Path(); GS[CM[ord(ch)]].draw(p.getPen())
    p.simplify(fix_winding=True)
    return p


def xform(p, s=1.0, dx=0.0, dy=0.0):
    return p.transform(s, 0, 0, s, dx, dy)   # 새 Path를 돌려준다


def union(paths):
    acc = pathops.Path(paths[0])
    for q in paths[1:]:
        acc = pathops.op(acc, q, pathops.PathOp.UNION, fix_winding=True)
    return acc


def slice_w(p, y):
    """높이 y에서 가로로 자른 잉크 조각들의 폭."""
    r = pathops.op(p, rect(-5000, y - 1, 9000, y + 1), pathops.PathOp.INTERSECTION)
    return sorted([c.bounds[2] - c.bounds[0] for c in r.contours])


def grow(p, e):
    """윤곽을 e만큼 바깥(+)·안(−)으로 옮긴다. 둥근 결합 — 팝 서체의 무른 모서리를 지킨다."""
    if abs(e) < 1e-6:
        return pathops.Path(p)
    s = pathops.Path(p)
    s.stroke(abs(e) * 2, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
    s.convertConicsToQuads()
    s.simplify(fix_winding=True)   # 획 윤곽의 자기 교차를 먼저 풀어야 불리언이 안정적이다
    if e > 0:
        return union([p, s])
    return pathops.op(p, s, pathops.PathOp.DIFFERENCE, fix_winding=True)


def clean(p, q=0.25):
    """좌표를 q 격자에 맞추고 길이 0 조각을 버린 뒤 다시 정리 — 획 만들기 전 불리언 안정화."""
    r = pathops.Path(); pen = r.getPen(); last = None
    snap = lambda v: (round(v[0] / q) * q, round(v[1] / q) * q)
    for verb, pts in p.segments:
        if verb == 'moveTo':
            last = snap(pts[0]); pen.moveTo(last)
        elif verb == 'lineTo':
            v = snap(pts[0])
            if v != last:
                pen.lineTo(v); last = v
        elif verb == 'qCurveTo':
            v = [snap(x) for x in pts]
            if any(x != last for x in v):
                pen.qCurveTo(*v); last = v[-1]
        elif verb == 'curveTo':
            v = [snap(x) for x in pts]
            if any(x != last for x in v):
                pen.curveTo(*v); last = v[-1]
        elif verb == 'closePath':
            pen.closePath()
    r.simplify(fix_winding=True)
    return r


def flatten(p, tol=24):
    """윤곽을 꺾은선으로(돌출 쓸기용). 곡선은 조각 tol개."""
    polys, cur = [], []
    for verb, pts in p.segments:
        if verb == 'moveTo':
            cur = [pts[0]]
        elif verb == 'lineTo':
            cur.append(pts[0])
        elif verb == 'qCurveTo':
            # TrueType 연쇄 2차: 사이 점은 암묵 on-curve
            p0 = cur[-1]; offs = list(pts[:-1]); end = pts[-1]
            chain = []
            for i, c in enumerate(offs):
                e = end if i == len(offs) - 1 else ((c[0] + offs[i + 1][0]) / 2, (c[1] + offs[i + 1][1]) / 2)
                chain.append((c, e))
            for c, e in chain:
                for k in range(1, tol + 1):
                    t = k / tol
                    cur.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * e[0],
                                (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * e[1]))
                p0 = e
        elif verb == 'curveTo':
            p0 = cur[-1]; c1, c2, e = pts
            for k in range(1, tol + 1):
                t = k / tol; u = 1 - t
                cur.append((u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * e[0],
                            u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * e[1]))
        elif verb in ('closePath', 'endPath'):
            if len(cur) > 2:
                polys.append(cur)
            cur = []
    return polys


def extrude(body, L):
    """몸통을 (cosθ, sinθ)·L 방향으로 쓸어낸 입체(민코프스키 합: 몸통 ∪ 밀린 몸통 ∪ 변마다 평행사변형)."""
    a = math.radians(ANGLE); dx, dy = L * math.cos(a), L * math.sin(a)
    sweep = pathops.Path(); pen = sweep.getPen()
    for poly in flatten(body):
        n = len(poly)
        for i in range(n):
            (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
            if abs(x1 - x0) + abs(y1 - y0) < 1e-3:
                continue
            q = [(x0, y0), (x1, y1), (x1 + dx, y1 + dy), (x0 + dx, y0 + dy)]
            area = sum(q[j][0] * q[(j + 1) % 4][1] - q[(j + 1) % 4][0] * q[j][1] for j in range(4))
            if abs(area) < 1e-3:
                continue
            if area > 0:
                q = q[::-1]   # 모두 같은 방향 → 0이 아닌 감김 규칙에서 합집합
            pen.moveTo(q[0]); [pen.lineTo(v) for v in q[1:]]; pen.closePath()
    sweep.simplify(fix_winding=True)   # 고리 모양 쓸기(바깥·안 경계)의 감김을 바로잡는다
    return union([body, xform(body, 1, dx, dy), sweep])


# ── 측정 ────────────────────────────────────────────────────────────────────
I = glyph('I'); ib = I.bounds
STEM = sum(slice_w(I, ib[1] + (ib[3] - ib[1]) * f)[0] for f in (0.3, 0.5, 0.7)) / 3
CAP_INK = ib[3] - ib[1]


def kana_stem(s, e):
    """가나 수직 기둥 평균(배율 s·확장 e 적용 뒤): ト 줄기 위쪽, リ 두 줄기, り 왼 줄기."""
    vals = []
    for ch, fs, pick in (('ト', (0.72, 0.8), 0), ('リ', (0.55, 0.7), None), ('り', (0.7,), 0)):
        g = grow(xform(glyph(ch), s), e); b = g.bounds
        for f in fs:
            w = slice_w(g, b[1] + (b[3] - b[1]) * f)
            vals += w if pick is None else [w[pick]]
    return sum(vals) / len(vals)


def word_ink_h(chars, s=1.0):
    bs = [xform(glyph(c), s).bounds for c in chars]
    return max(b[3] for b in bs) - min(b[1] for b in bs)


FAM = {'stem': STEM, 'cap_ink': CAP_INK}
# 가나 배율: と·な·り / ト·ナ·リ 공통 하나(두 낱말 잉크 높이 평균으로)
KS = KANA_H * CAP_INK / ((word_ink_h('となり') + word_ink_h('トナリ')) / 2)
k0 = kana_stem(KS, 0)
KE = (STEM - k0) / 2          # 1차 근사 후 한 번 보정
KE += (STEM - kana_stem(KS, KE)) / 2
FAM.update(kana_scale=KS, kana_stem_raw=k0, kana_grow=KE, kana_stem_after=kana_stem(KS, KE))


def set_word(chars, kana):
    """글자를 잉크 사이 = 기둥×GAP(+손 수정)로 늘어놓는다. 바탕선은 공통 0."""
    out, x, prev = [], 0.0, None
    for c in chars:
        g = glyph(c)
        if kana:
            g = grow(xform(g, KS), KE)
        b = g.bounds
        if prev is not None:
            x += STEM * GAP + KERN.get((prev, c), 0)
        out.append(xform(g, 1, x - b[0], 0))
        x += b[2] - b[0]; prev = c
    return union(out)


def svg_d(p):
    def f(v):
        s = f'{round(v, 1):.1f}'.rstrip('0').rstrip('.')
        return '0' if s == '-0' else s
    d = []
    for verb, pts in p.segments:
        if verb == 'moveTo':
            d.append(f'M{f(pts[0][0])} {f(-pts[0][1])}')
        elif verb == 'lineTo':
            d.append(f'L{f(pts[0][0])} {f(-pts[0][1])}')
        elif verb == 'qCurveTo':
            offs = list(pts[:-1]); end = pts[-1]
            for i, c in enumerate(offs):
                e = end if i == len(offs) - 1 else ((c[0] + offs[i + 1][0]) / 2, (c[1] + offs[i + 1][1]) / 2)
                d.append(f'Q{f(c[0])} {f(-c[1])} {f(e[0])} {f(-e[1])}')
        elif verb == 'curveTo':
            c1, c2, e = pts
            d.append(f'C{f(c1[0])} {f(-c1[1])} {f(c2[0])} {f(-c2[1])} {f(e[0])} {f(-e[1])}')
        elif verb == 'closePath':
            d.append('Z')
    return ''.join(d)


def mark(chars, kana, small):
    body = set_word(chars, kana)
    L = STEM * (DEPTH_S if small else DEPTH)
    ext = extrude(body, L)
    if small:
        shadow = ext          # 몸통 밑에 통째로 — 틈 없음, 경계 이음매 없음
    else:
        shadow = pathops.op(ext, grow(body, STEM * SPLIT), pathops.PathOp.DIFFERENCE, fix_winding=True)
        # 열림(깎고 다시 붙임): 오목 모서리·속공간에 남는 바늘 조각(폭 < 기둥×2·OPEN)을 지운다
        shadow = grow(clean(grow(clean(shadow), -STEM * OPEN)), STEM * OPEN)
        keep = pathops.Path(); pen = keep.getPen()
        for c in shadow.contours:
            if abs(c.area) >= (STEM * CRUMB) ** 2:
                c.draw(pen)
        shadow = keep
    return body, shadow


def write_svg(name, body, shadow, fg, title):
    b1, b2 = body.bounds, shadow.bounds
    b = (min(b1[0], b2[0]), min(b1[1], b2[1]), max(b1[2], b2[2]), max(b1[3], b2[3]))
    pad = 6
    x0, x1 = b[0] - pad, b[2] + pad
    y0, y1 = -b[3] - pad, -b[1] + pad
    w, h = x1 - x0, y1 - y0
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {y0:.0f} {w:.0f} {h:.0f}" '
         f'role="img" aria-label="{title}">\n'
         f'<title>{title}</title>\n'
         f'<path fill="{VERMILION}" d="{svg_d(shadow)}"/>\n'
         f'<path fill="{fg}" d="{svg_d(body)}"/>\n</svg>\n')
    with open(os.path.join(HERE, 'svg', name + '.svg'), 'w') as fh:
        fh.write(s)
    return {'file': f'svg/{name}.svg', 'viewBox': [round(x0), round(y0), round(w), round(h)]}


MARKS = [('TONARI', 'TONARI', False, '우산·국제'), ('tonari-hira', 'となり', True, '일본 시리즈'),
         ('tonari-kata', 'トナリ', True, '하이브리드·경계')]
os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
INFO = {}
for key, chars, kana, role in MARKS:
    for small in (False, True):
        body, shadow = mark(chars, kana, small)
        for theme, fg in (('light', NIGHT), ('dark', SNOW)):
            nm = f"F6-{key}{'-s' if small else ''}-{theme}"
            INFO[nm] = write_svg(nm, body, shadow, fg, chars)
            INFO[nm].update(role=role, small=small, theme=theme)

R = lambda v: round(v, 2)
meta = {
    'family': 'F6 쇼와 레트로',
    'font': {'name': 'Mochiy Pop One 2.000', 'license': 'SIL OFL 1.1', 'copyright': 'Copyright 2020 The Mochiypop Project Authors',
             'url': GF + FONT[0], 'sha256': FONT[1]},
    'principles': {'stem_I': R(STEM), 'cap_ink': R(CAP_INK), 'kana_ink_over_cap': KANA_H, 'kana_scale': round(KS, 4),
                   'kana_stem_raw_scaled': R(FAM['kana_stem_raw']), 'kana_grow': R(KE), 'kana_stem_after': R(FAM['kana_stem_after']),
                   'gap_over_stem': GAP, 'gap_units': R(STEM * GAP), 'shadow_angle_deg': ANGLE,
                   'shadow_depth_over_stem': DEPTH, 'shadow_depth_units': R(STEM * DEPTH),
                   'split_over_stem': SPLIT, 'split_units': R(STEM * SPLIT),
                   'small_depth_over_stem': DEPTH_S, 'small_depth_units': R(STEM * DEPTH_S),
                   'shadow_min_width_over_stem': 2 * OPEN, 'shadow_crumb_side_over_stem': CRUMB},
    'kern_hand_edits': {f'{a}{b}': v for (a, b), v in KERN.items()},
    'svg': INFO,
}
with open(os.path.join(HERE, 'marks.json'), 'w') as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=1, sort_keys=True); fh.write('\n')

# ── card.html ─────────────────────────────────────────────────────────────
def inline(nm):
    return open(os.path.join(HERE, 'svg', nm + '.svg')).read().split('\n', 1)[1]


def vb(nm):
    return INFO[nm]['viewBox']


def img(nm, *, h=None, w=None, scale=None):
    x, y, ww, hh = vb(nm)
    if scale:
        w, h = ww * scale, hh * scale
    elif h:
        w = ww * h / hh
    else:
        h = hh * w / ww
    return f'<img src="svg/{nm}.svg" width="{w:.1f}" height="{h:.1f}" alt="">'


SC = 0.085   # 맨 위 두 줄: 세 마크 같은 배율(1000단위 → 0.075px)
cells_l = ''.join(f'<div class="cell"><span class="tag">{role}</span>{img(f"F6-{k}-light", scale=SC)}</div>' for k, _, _, role in MARKS)
cells_d = ''.join(f'<div class="cell dk"><span class="tag">{role}</span>{img(f"F6-{k}-dark", scale=SC)}</div>' for k, _, _, role in MARKS)
hdr = ''.join(
    f'<div class="hcol"><div class="hdr">{img(f"F6-{k}-s-light", h=24)}<span>（ダミー）見出し</span></div>'
    f'<div class="hdr dk">{img(f"F6-{k}-s-dark", h=24)}<span>（ダミー）見出し</span></div>'
    f'<div class="cap">웹 헤더 24px · 작은 판(틈 없음, 그림자 길이 같음)</div></div>' for k, _, _, _ in MARKS)
cov = ''.join(
    f'<div class="ccol"><div class="cover">{img(f"F6-{k}-light", w=312)}<div class="ph">写真ダミー</div></div>'
    f'<div class="cap">표지 제호 폭 80%(390px 표지에서 312px) · 큰 판</div></div>' for k, _, _, _ in MARKS)
P = meta['principles']
card = f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>F6 쇼와 레트로</title>
<style>
:root{{--night:{NIGHT};--snow:{SNOW};--ver:{VERMILION};--mute:#5b6274}}
*{{box-sizing:border-box}}
body{{margin:0;background:#dcdfe6;color:var(--night);font:14px/1.5 "Noto Sans KR","Noto Sans JP",system-ui,sans-serif;width:1500px;padding:36px 40px 44px}}
h1{{font-size:30px;margin:0 0 4px;letter-spacing:-.01em}} h1 b{{color:var(--ver)}}
.lead{{font-size:17px;margin:0 0 6px}} .sub{{color:var(--mute);font-size:13px;margin:0 0 22px}}
.row{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}}
.cell{{position:relative;background:var(--snow);height:200px;display:flex;align-items:center;justify-content:center}}
.cell.dk{{background:var(--night)}}
.tag{{position:absolute;left:10px;top:10px;font-size:12px;font-weight:700;background:var(--night);color:var(--snow);padding:1px 7px}}
.dk .tag{{background:var(--snow);color:var(--night)}}
.rule{{border-left:4px solid var(--ver);background:#eef0f4;padding:10px 14px;margin:6px 0 26px;font-size:13.5px}}
h2{{font-size:16px;margin:0 0 10px}}
.hrow,.crow{{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-bottom:26px}}
.hdr{{height:48px;background:var(--snow);display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #c9ced8;margin-bottom:6px}}
.hdr.dk{{background:var(--night);color:#aab1c2;border:0}} .hdr span{{font-size:12px;color:var(--mute)}} .hdr.dk span{{color:#aab1c2}}
.hdr img{{display:block}}
.cap{{font-size:12px;color:var(--mute)}}
.cover{{width:390px;height:300px;background:var(--snow);padding:22px 39px 0;margin-bottom:6px;overflow:hidden}}
.cover img{{display:block}}
.ph{{margin-top:16px;height:180px;background:#c9ced8;color:#7a8192;font-size:12px;display:flex;align-items:center;justify-content:center}}
</style></head><body>
<h1>F6 <b>쇼와 레트로</b> — TONARI · となり · トナリ</h1>
<p class="lead">옛 상점 간판·성냥갑 라벨처럼 굵은 팝 덩어리에, 몸통에서 한 올 떨어진 주홍 돌출 그림자 하나.</p>
<p class="sub">출발 서체 Mochiy Pop One(SIL OFL 1.1, 라틴·가나 한 디자이너) · 모두 아웃라인 path · 밤 {NIGHT} · 눈 {SNOW} · 주홍 {VERMILION}(그림자 = 비글자 장식) · 2026-10-15 KST</p>
<div class="row">{cells_l}</div>
<div class="row">{cells_d}</div>
<div class="rule">가족 원리 — 기둥 S = 라틴 I {P["stem_I"]:.0f}단위 · 가나 기둥도 S(배율 {P["kana_scale"]:.3f} 뒤 윤곽 +{P["kana_grow"]:.1f}) · 가나 잉크 높이 = 대문자 × {KANA_H} · 잉크 사이 = S × {GAP} · 그림자 = 45° 아래오른쪽 S × {DEPTH} · 몸통–그림자 틈 = S × {SPLIT} · 그림자 최소 폭 S × {2*OPEN:.2f} · 작은 판(40px 미만)은 틈 없이 같은 길이</div>
<h2>웹 헤더 24px (작은 판)</h2>
<div class="hrow">{hdr}</div>
<h2>표지 제호 크기</h2>
<div class="crow">{cov}</div>
</body></html>
'''
with open(os.path.join(HERE, 'card.html'), 'w') as fh:
    fh.write(card)
print(json.dumps(meta['principles'], ensure_ascii=False))
