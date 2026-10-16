#!/usr/bin/env python3
# 브랜드 마크 패밀리 F3 「둥글고 다정한」 — TONARI · となり · トナリ (2026-10-15 KST)
#
# 출발 서체: M PLUS Rounded 1c Medium(SIL OFL 1.1) 한 벌 — 같은 설계자(森下浩司, M+)가 라틴·가나를 한 원리로 그렸다.
# 손 수정은 모두 아래 숫자 원리(FAMILY)와 EDITS 표로만 한다. 결정적: 같은 서체·같은 shapely면 바이트 단위로 같은 산출물.
#
# 사용(리포 루트):
#   python3 -I docs/japanology/magazine/brand/marks/families/F3-rounded/build-f3.py
#     → svg/{TONARI,tonari-hira,tonari-kata}-{light,dark}.svg, card.html, family.json
#   node <shotfull.cjs> docs/.../F3-rounded/card.html docs/.../F3-rounded/card.png 1500
# 의존: fontTools, shapely 2.2.0(GEOS 3.14.1). shapely가 시스템에 없으면 F3_PYLIB=<pip --target 폴더>.
# 서체: 08-mast/build-mast.py의 google/fonts 고정 커밋·SHA256 검증·캐시(TONARI_FONT_CACHE). 리포에 서체 파일 없음.
import hashlib, importlib.util, json, math, os, sys
sys.dont_write_bytecode = True
if os.environ.get('F3_PYLIB'):
    sys.path.insert(0, os.environ['F3_PYLIB'])
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import affinity
import shapely

HERE = os.path.dirname(os.path.abspath(__file__))
M08 = os.path.join(HERE, '..', '..', '..', '..', 'prototype', 'cover-machi01', '08-mast', 'build-mast.py')
spec = importlib.util.spec_from_file_location('m08', M08)
m08 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m08)
NIGHT, SNOW, VERMILION = m08.NIGHT, m08.SNOW, m08.VERMILION

# google/fonts 67bc647ce1910e92f461bcc82aae30f21d21a9cc (08-mast와 같은 고정 커밋)
m08.FONTS['f3-mplus'] = ('mplusrounded1c/MPLUSRounded1c-Medium.ttf',
                         'adfde1b6bae58719c4e0144612a94232e72fc5ca655c4722165fe88d06521a70', None)

# ── 가족 원리(숫자) ──────────────────────────────────────────────────────────────────
H = 730.0                 # 라틴 대문자 높이(서체 단위, M+ 그대로)
FAMILY = {
    'W': 120.0,           # 기준 기둥 굵기 = 라틴 I 기둥(M+ Medium 그대로). 반경·간격·점은 모두 W 배수
    # 가나 굵기: 가나 6자 평균 획 굵기(2×면적÷둘레) = TONARI 평균 획 굵기가 되도록 윤곽 확장(kana_embolden)
    'kana_h': 1.06,       # 가나 단어 잉크 높이 = H × 1.06
    'r_out': 0.30,        # 바깥 모서리(꺾임·꼭짓점) 반경 = W × 0.30  (획 끝은 서체 고유 반원 = 그 획 굵기 × 0.5)
    'r_in': 0.20,         # 안쪽 모서리(이음) 필렛 반경 = W × 0.20
    'gap': 1.80,          # 글자 사이 = 마주 보는 윤곽의 높이별 거리 평균(깊이 상한 depth×G) = W × 1.80
    'gap_min': 1.15,      # 어느 방향(2D 최단 거리)으로도 W × 1.15보다 붙지 않는다
    'depth': 1.25,        # 평균 거리 계산의 깊이 상한(× G)
    'dot': 1.45,          # 이웃 점 지름 = W × 1.45, 바닥선에 앉는다
    'dot_gap': 0.55,      # 이웃 점 띠(점 높이)에서 마지막 글자 오른 윤곽 ~ 점 왼끝 = G × 0.55
}
W = FAMILY['W']
SEG = 12                  # 곡선 평탄화 분할 수(고정)
QS = 16                   # 원호 분할(shapely quad_segs)

# 쌍 보정(손 수정, × W): 면적식이 못 잡는 광학 차이만. 의도는 NOTES.md.
PAIR = {
    ('O', 'N'): -0.15,   # 둥근-직선: 면적식이 O 위아래 빈 곳을 덜 세서 벌어 보임 → 좁힘
    ('R', 'I'): -0.10,   # R 다리 아래 빈 삼각형 때문에 벌어 보임 → 좁힘
    ('ト', 'ナ'): 0.20,   # ト 짧은 획이 ナ 가로획 끝을 겨눠 붙어 보임 → 벌림(24px 헤더에서 뭉침 방지)
}


def glyph_poly(ch):
    """M+ 윤곽 → shapely 다각형(서체 단위, y 위쪽). 곡선은 SEG 분할."""
    from fontTools.ttLib import TTFont
    from fontTools.pens.basePen import BasePen
    if not hasattr(glyph_poly, 't'):
        glyph_poly.t = TTFont(m08.font_path('f3-mplus'))
    t = glyph_poly.t

    class Pen(BasePen):
        def __init__(s, gs):
            super().__init__(gs); s.cs = []; s.c = []
        def _moveTo(s, p): s.c = [p]
        def _lineTo(s, p): s.c.append(p)
        def _qCurveToOne(s, a, b):
            p0 = s.c[-1]
            for i in range(1, SEG + 1):
                u = i / SEG; v = 1 - u
                s.c.append((v * v * p0[0] + 2 * v * u * a[0] + u * u * b[0], v * v * p0[1] + 2 * v * u * a[1] + u * u * b[1]))
        def _curveToOne(s, a, b, c):
            p0 = s.c[-1]
            for i in range(1, SEG + 1):
                u = i / SEG; v = 1 - u
                s.c.append(tuple(v ** 3 * p0[k] + 3 * v * v * u * a[k] + 3 * v * u * u * b[k] + u ** 3 * c[k] for k in (0, 1)))
        def _closePath(s):
            if len(s.c) > 2: s.cs.append(s.c)
            s.c = []
        _endPath = _closePath

    gs = t.getGlyphSet(); pen = Pen(gs); gs[t.getBestCmap()[ord(ch)]].draw(pen)
    pos, neg = [], []
    for c in pen.cs:
        a = sum(c[i - 1][0] * c[i][1] - c[i][0] * c[i - 1][1] for i in range(len(c)))
        (neg if a > 0 else pos).append(Polygon(c).buffer(0))   # TrueType: 잉크 = 시계 방향
    return unary_union(pos).difference(unary_union(neg))


def runs(g, y):
    b = g.bounds
    seg = LineString([(b[0] - 10, y), (b[2] + 10, y)]).intersection(g)
    parts = getattr(seg, 'geoms', [seg])
    return sorted([(p.bounds[0], p.bounds[2]) for p in parts if p.length > 0])


def round_shape(g):
    """가족 둥근 규칙: 열기(바깥 모서리 반경 r_out) → 닫기(안쪽 필렛 r_in)."""
    ro, ri = FAMILY['r_out'] * W, FAMILY['r_in'] * W
    g = g.buffer(-ro, quad_segs=QS).buffer(ro, quad_segs=QS)
    g = g.buffer(ri, quad_segs=QS).buffer(-ri, quad_segs=QS)
    return g


def kana_scale():
    """가나 3+3자 공통 배율: 두 단어 잉크 높이 평균 = H × kana_h."""
    hs = []
    for w in ('となり', 'トナリ'):
        u = unary_union([glyph_poly(c) for c in w]); b = u.bounds; hs.append(b[3] - b[1])
    return H * FAMILY['kana_h'] / (sum(hs) / len(hs))


def kana_stem():
    """가나 세로 기둥 평균(배율 전): ト 줄기·リ 오른 줄기·ナ 줄기를 높이 40% 지점에서 잰 폭."""
    ws = []
    for ch, pick in (('ト', 0), ('リ', -1)):
        g = glyph_poly(ch); b = g.bounds
        r = runs(g, b[1] + (b[3] - b[1]) * 0.4); ws.append(r[pick][1] - r[pick][0])
    return sum(ws) / len(ws)


def thickness(gs):
    """평균 획 굵기 = 2 × 면적 ÷ 둘레(획 모양 도형에서 굵기의 근사)."""
    return 2 * sum(g.area for g in gs) / sum(g.length for g in gs)


def prep(ch, script, d=None):
    g = glyph_poly(ch)
    meta = {'ch': ch}
    if script == 'kana':
        s = kana_scale(); d = kana_embolden() if d is None else d
        g = affinity.scale(g, s, s, origin=(0, 0))
        g = g.buffer(d, quad_segs=QS, join_style='round')
        meta.update(scale=round(s, 4), embolden=round(d, 2))
    g = round_shape(g)
    return g, meta


def kana_embolden():
    """가나 윤곽 확장량: 가나 6자 평균 획 굵기 = 라틴 TONARI 평균 획 굵기(둥근 처리 후)."""
    if not hasattr(kana_embolden, 'd'):
        target = thickness([prep(c, 'latin')[0] for c in 'TONARI'])
        lo, hi = -10.0, 30.0
        for _ in range(24):
            mid = (lo + hi) / 2
            t = thickness([prep(c, 'kana', mid)[0] for c in 'となりトナリ'])
            if t < target: lo = mid
            else: hi = mid
        kana_embolden.d = round((lo + hi) / 2, 3)
        kana_embolden.target = target
    return kana_embolden.d


def place_word(chars, script):
    """면적식 간격: 단어 띠(라틴 0..H, 가나 잉크 띠)를 80줄로 잘라 마주 보는 윤곽의 줄별 거리를
    깊이 상한(depth×G)으로 자른 평균 = G. 어느 방향으로든(2D) W×gap_min보다 붙지 않는다."""
    G = FAMILY['gap'] * W; cap = FAMILY['depth'] * G; gmin = FAMILY['gap_min'] * W
    gl = [prep(c, script) for c in chars]
    if script == 'latin':
        lo, hi = 0.0, H
    else:
        u = unary_union([g for g, _ in gl]); lo, hi = u.bounds[1], u.bounds[3]
    ys = [lo + (hi - lo) * (k + 0.5) / 80 for k in range(80)]
    placed = []; metas = []
    for i, (g, meta) in enumerate(gl):
        g = affinity.translate(g, -g.bounds[0], 0)
        if placed:
            prev = placed[-1]
            rows = []
            for y in ys:
                a = runs(prev, y); b = runs(g, y)
                rows.append((a[-1][1] if a else None, b[0][0] if b else None))
            def mean(off):
                ds = [cap if (ax is None or bx is None) else min(bx + off - ax, cap) for ax, bx in rows]
                return sum(ds) / len(ds)
            lo_o, hi_o = prev.bounds[2] - 1500.0, prev.bounds[2] + 1500.0
            for _ in range(60):
                mid = (lo_o + hi_o) / 2
                if mean(mid) < G: lo_o = mid
                else: hi_o = mid
            off = hi_o
            d2 = affinity.translate(g, off, 0).distance(prev)
            if d2 < gmin:
                lo_o, hi_o = off, off + 8 * W
                for _ in range(40):
                    mid = (lo_o + hi_o) / 2
                    if affinity.translate(g, mid, 0).distance(prev) < gmin: lo_o = mid
                    else: hi_o = mid
                off = hi_o
            off += PAIR.get((prev_ch, meta['ch']), 0.0) * W   # 쌍 보정은 마지막(최소 거리 위에서)
            g = affinity.translate(g, off, 0)
            meta['gap_mean'] = round(mean(off), 1); meta['gap_2d'] = round(g.distance(prev), 1)
        prev_ch = meta['ch']
        placed.append(g); metas.append(meta)
    return placed, metas


def add_dot(placed, script):
    """이웃 점: 지름 W×dot, 바닥 = 단어 바닥선(라틴 0, 가나 잉크 바닥), 마지막 글자와 평균 거리 G×dot_gap."""
    D = FAMILY['dot'] * W
    word = unary_union(placed)
    base = 0.0 if script == 'latin' else word.bounds[1]
    last = placed[-1]
    # 점 높이 띠에서 마지막 글자 오른 윤곽과의 최소 거리 = G × dot_gap
    ys = [base + D * (k + 0.5) / 20 for k in range(20)]
    xs = [runs(last, y)[-1][1] for y in ys if runs(last, y)]
    edge = max(xs) if xs else last.bounds[2]
    cx = edge + FAMILY['dot_gap'] * FAMILY['gap'] * W + D / 2
    return Point(cx, base + D / 2).buffer(D / 2, quad_segs=QS * 2)


def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def to_d(g, ox, oy):
    """다각형 → SVG d(직선, 0.1 단위 화면 = 서체 단위/10). y 뒤집음."""
    g = g.simplify(0.35, preserve_topology=True)
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    out = []
    for p in sorted(polys, key=lambda p: (round(p.bounds[0], 3), round(p.bounds[1], 3))):
        p = orient(p, 1.0)
        for ring in [p.exterior] + list(p.interiors):
            cs = list(ring.coords)[:-1]
            out.append('M' + 'L'.join(f'{fmt((x - ox) / 10)} {fmt((oy - y) / 10)}' for x, y in cs) + 'Z')
    return ''.join(out)


def build_mark(name, chars, script, label):
    placed, metas = place_word(chars, script)
    dot = add_dot(placed, script)
    body = unary_union(placed)
    allg = unary_union([body, dot])
    b = allg.bounds
    vb_w, vb_h = (b[2] - b[0]) / 10, (b[3] - b[1]) / 10
    svgs = {}
    for mode, fg in (('light', NIGHT), ('dark', SNOW)):
        svgs[mode] = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(vb_w)} {fmt(vb_h)}" '
                      f'width="{fmt(vb_w)}mm" height="{fmt(vb_h)}mm" role="img" aria-label="{label}">'
                      f'<path fill="{fg}" d="{to_d(body, b[0], b[3])}"/>'
                      f'<path fill="{VERMILION}" d="{to_d(dot, b[0], b[3])}"/></svg>\n')
    info = {'label': label, 'script': script, 'viewBox': [round(vb_w, 2), round(vb_h, 2)],
            'body_box': [round(v, 1) for v in body.bounds], 'glyphs': metas}
    return svgs, info


def main():
    os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
    marks = [('TONARI', 'TONARI', 'latin', 'TONARI'),
             ('tonari-hira', 'となり', 'kana', 'となり'),
             ('tonari-kata', 'トナリ', 'kana', 'トナリ')]
    kana_embolden()
    fam = {'source': 'M PLUS Rounded 1c Medium 1.059 (SIL OFL 1.1)', 'H': H, 'family': FAMILY,
           'kana': {'scale': round(kana_scale(), 4), 'stem_before': round(kana_stem(), 1),
                    'embolden': kana_embolden.d, 'thickness_target': round(kana_embolden.target, 2),
                    'thickness_kana': round(thickness([prep(c, 'kana')[0] for c in 'となりトナリ']), 2)},
           'shapely': shapely.__version__, 'geos': shapely.geos_version_string, 'marks': {}}
    for name, chars, script, label in marks:
        svgs, info = build_mark(name, chars, script, label)
        for mode, text in svgs.items():
            p = os.path.join(HERE, 'svg', f'{name}-{mode}.svg')
            open(p, 'w').write(text)
            info.setdefault('sha256', {})[mode] = hashlib.sha256(text.encode()).hexdigest()
        fam['marks'][name] = info
    open(os.path.join(HERE, 'family.json'), 'w').write(json.dumps(fam, ensure_ascii=False, indent=1) + '\n')
    open(os.path.join(HERE, 'card.html'), 'w').write(card(fam))
    print(json.dumps({k: v['viewBox'] for k, v in fam['marks'].items()}))


ROLES = {'TONARI': '우산 · 국제', 'tonari-hira': '일본 시리즈', 'tonari-kata': '하이브리드 · 경계'}


def card(fam):
    F = fam['family']; ms = fam['marks']
    k = 1.10   # 같은 배율: 1 viewBox 단위(서체 10단위) = 1.10px → 대문자 높이 80px
    def img(name, mode, h=None, w=None):
        vb = ms[name]['viewBox']
        size = f'height:{fmt(h)}px' if h else (f'width:{fmt(w)}px' if w else f'height:{fmt(vb[1] * k)}px')
        return f'<img src="svg/{name}-{mode}.svg" alt="{ms[name]["label"]}" style="{size};display:block">'
    def row(mode):
        cells = ''.join(f'<div class="cell {mode}"><span class="role">{ROLES[n]}</span>{img(n, mode)}</div>' for n in ms)
        return f'<div class="row">{cells}</div>'
    heads = ''
    for mode in ('light', 'dark'):
        for n in ms:
            heads += f'<div class="hdr {mode}">{img(n, mode, h=24)}<span>（ダミー）見出し</span></div>'
    covers = ''
    for n in ms:
        for mode in ('light', 'dark'):
            covers += (f'<div class="covwrap"><div class="cover {mode}"><div class="mast">{img(n, mode, w=312)}</div>'
                       f'<div class="ph">写真ダミー</div><div class="foot">No.00（ダミー）</div></div></div>')
    K = fam['kana']
    rule = (f'기둥 W = {fmt(F["W"])}단위(라틴 I) · 평균 획 굵기(2×면적÷둘레) 세 마크 같음 = {K["thickness_target"]:.1f} · '
            f'획 끝 = 반원(그 획 굵기×0.5) · 바깥 모서리 반경 = W×{F["r_out"]:.2f} · 안쪽 필렛 = W×{F["r_in"]:.2f} · '
            f'가나 잉크 높이 = 대문자×{F["kana_h"]:.2f} · 글자 사이 = 면적식 평균 W×{F["gap"]:.2f}, 2D 최소 W×{F["gap_min"]:.2f} · '
            f'이웃 점 지름 = W×{F["dot"]:.2f}, 바닥선에 앉음')
    return f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>F3 둥글고 다정한</title>
<style>
:root{{--night:{NIGHT};--snow:{SNOW};--ver:{VERMILION};--paper:#dfe2e8;--ink2:#4a5163}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--paper);color:var(--night);font-family:"Pretendard","Noto Sans KR","Hiragino Sans",sans-serif;width:1500px}}
.wrap{{padding:44px 40px 48px}}
h1{{font-size:30px;margin:0 0 6px;letter-spacing:-.01em}}
h1 small{{font-size:15px;color:var(--ink2);font-weight:500;margin-left:10px}}
.lead{{font-size:17px;margin:0 0 4px}}
.meta{{font-size:12.5px;color:var(--ink2);margin:0 0 26px}}
.row{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px}}
.cell{{height:190px;display:flex;align-items:center;justify-content:center;position:relative}}
.cell.light{{background:var(--snow)}} .cell.dark{{background:var(--night)}}
.role{{position:absolute;left:12px;top:10px;font-size:12px;font-weight:700;padding:2px 7px;border-radius:3px}}
.light .role{{background:var(--night);color:var(--snow)}} .dark .role{{color:var(--snow);opacity:.8}}
.rule{{border-left:4px solid var(--ver);background:var(--snow);padding:12px 16px;font-size:13px;margin:16px 0 30px;line-height:1.6}}
h2{{font-size:15px;margin:0 0 10px}} h2 span{{font-weight:400;color:var(--ink2);font-size:12.5px;margin-left:8px}}
.hdrs{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 10px;margin-bottom:30px}}
.hdr{{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-size:12px}}
.hdr.light{{background:var(--snow);color:var(--ink2);border-bottom:1px solid #c9cdd6}} .hdr.dark{{background:var(--night);color:#aab1c2}}
.hdrs .col{{display:flex;flex-direction:column;gap:6px}}
.covers{{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}}
.cover{{width:390px;height:560px;transform-origin:0 0;transform:scale(.5768);display:flex;flex-direction:column;align-items:center;padding-top:28px}}
.cover.light{{background:var(--snow)}} .cover.dark{{background:var(--night)}}
.covwrap{{width:225px;height:323px;overflow:hidden}}
.mast{{width:312px}}
.ph{{margin-top:22px;width:342px;flex:1;background:repeating-linear-gradient(135deg,#c7ccd6 0 8px,#d3d7df 8px 16px);display:flex;align-items:center;justify-content:center;font-size:13px;color:#59607a}}
.dark .ph{{background:repeating-linear-gradient(135deg,#252d42 0 8px,#2b3449 8px 16px);color:#8b93a8}}
.foot{{height:52px;display:flex;align-items:center;font-size:13px;color:var(--ink2)}} .dark .foot{{color:#8b93a8}}
.note{{font-size:12px;color:var(--ink2);margin-top:8px}}
</style></head><body><div class="wrap">
<h1>F3 둥글고 다정한 <small>Rounded Neighbor — TONARI · となり · トナリ</small></h1>
<p class="lead">모서리를 깎아 낸 차분한 굵기와 넉넉한 자간, 그리고 글자 곁에 하나 더 앉은 주홍 ‘이웃 점’ — 말을 거는 옆집 같은 마크.</p>
<p class="meta">출발 서체 M PLUS Rounded 1c Medium(SIL OFL 1.1, google/fonts 고정 커밋) → 아웃라인 SVG · 색 밤 {NIGHT} · 눈 {SNOW} · 주홍 {VERMILION}(이웃 점, 비글자) · 2026-10-15 KST</p>
{row('light')}{row('dark')}
<div class="rule"><b>가족 원리</b> — {rule}</div>
<h2>웹 헤더 24px <span>마크 높이 24px(실제 크기)</span></h2>
<div class="hdrs">{heads}</div>
<h2>표지 제호 폭 80% <span>390px 표지에서 312px — 견본은 57.7% 축소 표시</span></h2>
<div class="covers">{covers}</div>
<p class="note">더미 글자 「（ダミー）」「写真ダミー」「No.00（ダミー）」는 자리 표시다. 마크 외 글자는 견본용 시스템 서체.</p>
</div></body></html>
'''


if __name__ == '__main__':
    main()
