#!/usr/bin/env python3
"""L1 隣り合う字 — TONARI · となり · トナリ 를 서체 없이 골격선에서 작도한다.

구성 규칙(한 줄): 한 굵기 W의 골격선으로 긋되, 이웃한 두 글자는 띄우지 않고
한쪽 획의 끝이 다른 쪽 획 안으로 들어가 멈춘다(덮기·내려앉기) — 접점은 단어당 최대 3곳,
그중 '획 끝이 이웃에 내려앉는' 왼쪽 첫 자리 하나만 주홍.

  - 모든 획 = 중심선 + 굵기 W(끝은 획 방향 직각 절단, 모서리 마이터).
  - 라틴은 높이 H 띠에 잘라 넣는다(사선 꼭짓점은 기준선·윗선에서 평절단).
  - 주홍 = 두 글자 윤곽의 교집합(겹친 잉크)을 접점에서 W 높이까지 자른 조각.
    단색 인쇄(mono-*)는 같은 조각을 본체 색으로 칠할 뿐 형태가 같다.

재생성(리포 루트, shapely 2.x 필요):
  python3 -I docs/japanology/magazine/brand/marks/lettering/L1-tonariau/build.py
같은 입력이면 같은 바이트를 낸다(좌표 소수 1자리 고정, 경로 순서 고정).
"""
import hashlib
import math
import os

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely import set_precision

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'svg')

NIGHT = '#151b2c'
SNOW = '#eef0f4'
VERMILION = '#d4462a'

# ── 작도 파라미터(손 조정은 이 표에서만) ─────────────────────────────────────
H = 1000.0          # 라틴 대문자 높이
W = 176.0           # 획 굵기(세 표기 공통)
KH = 1060.0         # 가나 칸 높이(대문자보다 6% 크게 — 가나는 칸 안에서 작아 보임)
P = dict(
    GAP_OUT=150.0,      # 맞닿지 않는 이웃 사이(잉크 사이)
    # TONARI
    T_HALF=300.0, TO_GAP=110.0,
    N_W=430.0, A_HALF=290.0, A_BAR=290.0,
    NA_SHARED='vertical',  # 'slant' = r3–r6안(N 오른기둥이 기울어 A 왼다리). M으로 읽힐 위험이 있어 r7에서 버림
    R_BOWL=290.0, R_BOWL_X=140.0, R_LEG_IN=40.0, RI_GAP=150.0, RI_JOIN=True,      # R 다리 → I 발(False면 일반 R·I, r5 비교용)
    # となり
    TO_R=230.0, TO_CX=400.0, TO_ANG=30.0, TO_DIAG=470.0, TO1_X=300.0, TO_END=980.0,
    NA_FOOT=90.0, NA_DIAG_TOP=330.0, NA_BAR=560.0, NA_STEM_X=800.0,
    NA_LOOP_RX=200.0, NA_LOOP_RY=160.0, NA_TAIL=250.0, RI1_BOT=0.30,
    RI_ARCH=190.0, RI_X2=640.0, RI_SWEEP_R=520.0, RI_SWEEP_A=62.0,
    # トナリ
    KT_TICK=400.0, KT_OVER=110.0, KN_STEM=400.0, KN_BAR_R=420.0, KN_SWEEP_R=560.0, KN_SWEEP_A=50.0,
    KR_X2=520.0, KR_SWEEP_R=600.0, KR_SWEEP_A=46.0,
)


# ── 기하 도구 ───────────────────────────────────────────────────────────────
def stroke(pts, w=W, join='mitre'):
    return LineString(pts).buffer(w / 2, cap_style='flat', join_style=join, mitre_limit=4.0)


def arc(cx, cy, r, a0, a1, n=None):
    """각도(도, 반시계) a0→a1 원호 점열."""
    if n is None:
        n = max(8, int(abs(a1 - a0) / 3))
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def ring(cx, cy, r_out, w=W):
    return Point(cx, cy).buffer(r_out, 256).difference(Point(cx, cy).buffer(r_out - w, 256))


def clip_h(g, top=H, bottom=0.0, x0=-1e5, x1=1e5):
    return g.intersection(box(x0, bottom, x1, top))


# ── TONARI ──────────────────────────────────────────────────────────────────
def band_line(p0, p1, w=W, lo=0.0, hi=H, ext=600.0):
    """p0→p1 직선을 양끝으로 늘린 뒤 [lo, hi] 띠로 자른 획(꼭짓점 마이터 대신 평절단)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    a = (p0[0] - ux * ext, p0[1] - uy * ext)
    b = (p1[0] + ux * ext, p1[1] + uy * ext)
    return stroke([a, b], w).intersection(box(-1e5, lo, 1e5, hi))


def mark_tonari():
    hw = W / 2
    g = {}
    # T + O : T의 가로대가 O의 지붕이 된다(O 윗변이 가로대 안에 잠기고 속공간이 가로대 밑에 닿는다).
    t_stem = P['T_HALF']
    o_r = H / 2
    o_cx = t_stem + hw + P['TO_GAP'] + o_r
    g['T'] = unary_union([box(0, H - W, o_cx + o_r, H), box(t_stem - hw, 0, t_stem + hw, H)])
    g['O'] = ring(o_cx, o_r, o_r)
    x = o_cx + o_r + P['GAP_OUT']

    # N + A : N의 오른 기둥 = A의 왼다리(한 획을 둘이 나눠 쓴다). N 대각은 그 발치에 내려앉는다(주홍).
    n_l = x + hw
    v_x = n_l + P['N_W']                        # N 바닥 꼭짓점(중심선)
    if P['NA_SHARED'] == 'vertical':           # r7 비교안: 공유 획을 수직 기둥으로(N 온전, A 왼다리 수직)
        apex = v_x + hw * 0.6
        a_r = apex + P['A_HALF'] * 1.5
    else:
        apex = v_x + P['A_HALF']
        a_r = apex + P['A_HALF']
    stem = box(n_l - hw, 0, n_l + hw, H)
    diag = band_line((n_l, H - hw * 0.0), (v_x, 0)).intersection(box(n_l - hw, -1, 1e5, H + 1))
    g['N'] = unary_union([stem, diag])
    left = (band_line((v_x, 0), (apex, H)) if P['NA_SHARED'] != 'vertical'
            else box(v_x - hw, 0, v_x + hw, H))
    right = band_line((apex, H), (a_r, 0))
    tri = Polygon([(v_x, 0), (apex, H), (a_r, 0)])
    cb = box(-1e5, P['A_BAR'], 1e5, P['A_BAR'] + W * 0.9).intersection(tri)
    lap = diag.intersection(left)
    joint = unary_union([diag, left]).intersection(
        box(-1e5, 0, 1e5, lap.bounds[3])).convex_hull    # 꼭짓점 V 밑 홈을 메운 '발치'
    g['N'] = unary_union([g['N'], joint])
    g['A'] = unary_union([left, right, cb, joint])
    x = a_r + hw * 1.15 + P['GAP_OUT']

    # R + I : R의 다리가 I의 발로 이어진다.
    r_l = x + hw
    bowl_r = P['R_BOWL']
    bowl_cy = H - bowl_r
    bowl_x = r_l + P['R_BOWL_X']
    i_x = bowl_x + bowl_r + P['RI_GAP'] + (0 if P['RI_JOIN'] else P['GAP_OUT'] + 30)
    bowl = stroke([(r_l - hw, H - hw), (bowl_x, H - hw)] +
                  arc(bowl_x, bowl_cy, bowl_r - hw, 90, -90)[1:] +
                  [(r_l - hw, bowl_cy - bowl_r + hw)])
    leg_end = i_x - hw * 0.2 if P['RI_JOIN'] else bowl_x + bowl_r + P['RI_GAP'] - hw * 0.6
    leg = band_line((bowl_x - P['R_LEG_IN'], bowl_cy - bowl_r + hw), (leg_end, 0),
                    hi=bowl_cy - bowl_r + hw).intersection(box(-1e5, -1, i_x, H))
    g['R'] = clip_h(unary_union([box(r_l - hw, 0, r_l + hw, H), bowl, leg]))
    g['I'] = box(i_x - hw, 0, i_x + hw, H)
    pairs = [('N', 'A'), ('T', 'O')] + ([('R', 'I')] if P['RI_JOIN'] else [])   # 첫 항목 = 주홍(획 끝이 이웃에 내려앉는 첫 자리)
    return g, pairs


# ── となり ──────────────────────────────────────────────────────────────────
def mark_tonari_hira():
    K = KH
    hw = W / 2
    g = {}
    # と : 사선 → 왼쪽 아래 원호 → 바닥 맺음(오른쪽으로 길게 나가 な의 사선 발에 닿는다)
    rc = P['TO_R']
    cx, cy = P['TO_CX'], hw + rc
    a0 = 90 + P['TO_ANG']                      # 사선 진행각(아래 왼쪽) = a0+90
    s = (cx + rc * math.cos(math.radians(a0)), cy + rc * math.sin(math.radians(a0)))
    d = math.radians(P['TO_ANG'])
    top = (s[0] + P['TO_DIAG'] * math.cos(d), s[1] + P['TO_DIAG'] * math.sin(d))
    to_end = P['TO_END']
    to2 = stroke([top] + arc(cx, cy, rc, a0, 270) + [(to_end, hw)], join='round')
    to1 = stroke([(P['TO1_X'], K * 0.99), (P['TO1_X'] + 55, K * 0.54)])
    g['と'] = unary_union([to1, to2])

    # な : 사선의 발이 と의 맺음 끝 안으로 내려앉는다(접점·주홍).
    foot_x = P['TO_END'] - hw                   # 사선 발 중심 = と 맺음 끝에서 W/2 안
    n0 = foot_x - P['NA_FOOT']
    bar_y = K * 0.70
    na_bar = stroke([(n0 + 20, bar_y), (n0 + P['NA_BAR'], bar_y)])
    na_diag = band_line((n0 + P['NA_DIAG_TOP'], K), (foot_x, 0), lo=0, hi=K)
    sx = n0 + P['NA_STEM_X']
    dot0 = (sx - 90, K * 0.82)
    na_dot = stroke([dot0, (dot0[0] + 170, K * 0.68)])
    rx, ry = P['NA_LOOP_RX'], P['NA_LOOP_RY']
    lcx, lcy = sx - rx, hw + ry
    loop_pts = [(lcx + rx * math.cos(math.radians(a)), lcy + ry * math.sin(math.radians(a)))
                for a in range(0, -361, -4)]
    na_stem = stroke([(sx, K * 0.56), (sx, lcy)])
    na_loop = Polygon(loop_pts).buffer(hw, 64).difference(Polygon(loop_pts).buffer(-hw, 64))
    na_tail = stroke([(sx - 10, lcy), (sx + P['NA_TAIL'], lcy - 30)])
    g['な'] = unary_union([na_bar, na_diag, na_dot, na_stem, na_loop, na_tail])

    # り : 접점 없이 띄운다(r4에서 な 꼬리 → り 첫 획 접점은 화살표처럼 읽혀 버렸다).
    r0 = sx + P['NA_TAIL'] + P['GAP_OUT'] * 0.8
    ri1_x = r0 + hw
    ri1_bot = K * P['RI1_BOT']
    ri1 = stroke([(ri1_x, K * 0.88), (ri1_x, ri1_bot), (ri1_x + 130, ri1_bot + 150)], join='round')
    a_r = P['RI_ARCH']
    ax, ay = r0 + P['RI_X2'] - a_r, K * 0.64
    sweep_r = P['RI_SWEEP_R']
    drop = K * 0.42
    ri2 = stroke(arc(ax, ay, a_r, 165, 0) + [(ax + a_r, drop)] +
                 arc(ax + a_r - sweep_r, drop, sweep_r, 0, -P['RI_SWEEP_A'])[1:], join='round')
    g['り'] = unary_union([ri1, ri2])
    return g, [('と', 'な')]


# ── トナリ ──────────────────────────────────────────────────────────────────
def mark_tonari_kata():
    K = KH
    hw = W / 2
    g = {}
    pil = hw
    bar_y = K * 0.58
    bx0 = pil + P['KT_TICK']                     # ナ 가로획 왼끝
    tick_end = (bx0 + P['KT_OVER'], bar_y)      # ト 짧은 획 끝이 ナ 가로획 안으로 들어가 멈춘다
    g['ト'] = unary_union([box(pil - hw, 0, pil + hw, K),
                          stroke([(pil, K * 0.76), tick_end])])
    stem = bx0 + P['KN_STEM']
    bx1 = stem + P['KN_BAR_R']
    sw = P['KN_SWEEP_R']
    g['ナ'] = unary_union([stroke([(bx0, bar_y), (bx1, bar_y)]),
                          stroke([(stem, K), (stem, K * 0.44)] +
                                 arc(stem - sw, K * 0.44, sw, 0, -P['KN_SWEEP_A'])[1:])])
    r0 = bx1 + P['GAP_OUT']
    sw2 = P['KR_SWEEP_R']
    x2 = r0 + P['KR_X2']
    g['リ'] = unary_union([box(r0, K * 0.26, r0 + W, K * 0.92),
                          stroke([(x2, K), (x2, K * 0.44)] +
                                 arc(x2 - sw2, K * 0.44, sw2, 0, -P['KR_SWEEP_A'])[1:])])
    return g, [('ト', 'ナ')]


# ── 출력 ────────────────────────────────────────────────────────────────────
def to_path(geom, H_flip):
    def ring_d(coords):
        pts = list(coords)[:-1]
        s = 'M' + ' L'.join(f'{x:.1f} {H_flip - y:.1f}' for x, y in pts) + 'Z'
        return s
    polys = [geom] if geom.geom_type == 'Polygon' else list(getattr(geom, 'geoms', []))
    out = []
    for p in sorted(polys, key=lambda p: (round(p.bounds[0], 1), round(p.bounds[1], 1))):
        if p.is_empty or p.geom_type != 'Polygon':
            continue
        out.append(ring_d(p.exterior.coords))
        for it in p.interiors:
            out.append(ring_d(it.coords))
    return ' '.join(out)


def build(name, fn):
    glyphs, pairs = fn()
    a, b = pairs[0]                              # 주홍 = 왼쪽 첫 이웃 접점(두 글자 윤곽의 교집합)
    lap = glyphs[a].intersection(glyphs[b])
    accent = lap.intersection(box(-1e5, lap.bounds[1], 1e5, lap.bounds[1] + W))   # 접점에서 획 굵기 W만큼
    body = unary_union(list(glyphs.values()))
    body = set_precision(body, 0.1)
    accent = set_precision(accent, 0.1)
    minx, miny, maxx, maxy = body.bounds
    vb_w, vb_h = maxx - minx, maxy - miny
    body_only = set_precision(body.difference(accent), 0.1)
    out = {}
    for mode, ink in (('light', NIGHT), ('dark', SNOW), ('mono-light', NIGHT), ('mono-dark', SNOW)):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx:.1f} 0 {vb_w:.1f} {vb_h:.1f}" '
                f'width="{vb_w / 10:.1f}" height="{vb_h / 10:.1f}" role="img" aria-label="{name}">')
        if mode.startswith('mono'):              # 단색: 한 경로(두 경로 경계의 머리카락 틈 방지)
            svg = head + f'<path fill="{ink}" fill-rule="evenodd" d="{to_path(body, maxy)}"/></svg>\n'
        else:
            svg = (head + f'<path fill="{ink}" fill-rule="evenodd" d="{to_path(body_only, maxy)}"/>'
                   f'<path fill="{VERMILION}" fill-rule="evenodd" d="{to_path(accent, maxy)}"/></svg>\n')
        out[mode] = svg
    out['anatomy'] = anatomy_svg(name, glyphs, pairs, accent)
    return out, glyphs, pairs


def anatomy_svg(name, glyphs, pairs, accent):
    """분해도: 글자마다 반투명으로 칠해 겹친 자리(나눠 쓴 획)가 짙게 보이게 한다."""
    body = unary_union(list(glyphs.values()))
    minx, miny, maxx, maxy = body.bounds
    parts = []
    for i, (k, gq) in enumerate(glyphs.items()):
        gq = set_precision(gq, 0.1)
        parts.append(f'<path fill="{NIGHT}" fill-opacity="0.34" fill-rule="evenodd" d="{to_path(gq, maxy)}"/>')
    for a, b in pairs:
        lap = set_precision(glyphs[a].intersection(glyphs[b]), 0.1)
        parts.append(f'<path fill="none" stroke="{VERMILION}" stroke-width="10" d="{to_path(lap, maxy)}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx:.1f} 0 {maxx - minx:.1f} {maxy - miny:.1f}" '
            f'width="{(maxx - minx) / 10:.1f}" height="{(maxy - miny) / 10:.1f}" role="img" aria-label="{name} 분해도">'
            + ''.join(parts) + '</svg>\n')


MARKS = [
    ('TONARI', 'L1-up', mark_tonari),
    ('となり', 'L1-hira', mark_tonari_hira),
    ('トナリ', 'L1-kata', mark_tonari_kata),
]


CARD_CSS = """
  :root { --night:#151b2c; --snow:#eef0f4; --ver:#d4462a; --paper:#d9dce4; --mute:#5a6275; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--paper); color:var(--night); width:1500px; padding:28px 26px 34px;
         font-family:"Noto Sans KR","Hiragino Sans","Apple SD Gothic Neo",system-ui,sans-serif; }
  h1 { font-size:20px; font-weight:700; }
  h1 b { display:inline-block; background:var(--night); color:var(--snow); font-size:13px; padding:2px 8px; margin-right:8px; vertical-align:3px; }
  .lede { font-size:14px; color:#2a3142; margin-top:6px; }
  .rule { margin:14px 0; padding:10px 14px; background:var(--snow); border-left:4px solid var(--ver); font-size:12.5px; line-height:1.65; color:#2a3142; }
  .row { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:10px; }
  .cell { position:relative; height:200px; display:flex; align-items:center; justify-content:center; background:var(--snow); }
  .cell.dark { background:var(--night); }
  .cell.ana { background:#f7f8fa; height:180px; }
  .cell img { display:block; }
  .tag { position:absolute; left:10px; top:8px; font-size:11px; font-weight:700; padding:1px 6px; background:var(--night); color:var(--snow); }
  .dark .tag { background:var(--snow); color:var(--night); }
  .cap { font-size:11.5px; color:var(--mute); margin:2px 0 14px; }
  h2 { font-size:14px; margin:18px 0 8px; }
  .sizes { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .col { display:flex; flex-direction:column; gap:6px; }
  .hdr { height:48px; display:flex; align-items:center; justify-content:space-between; padding:0 14px; background:var(--snow); border-bottom:1px solid #c7ccd6; }
  .hdr.dark { background:var(--night); border-bottom-color:#2b344a; }
  .hdr span { font-size:11px; color:var(--mute); }
  .hdr.dark span { color:#a3abbd; }
  .cover { height:200px; background:var(--snow); display:flex; align-items:center; justify-content:center; }
  .cover.dark { background:var(--night); }
"""

ROLES = {'L1-up': ('우산·국제', 'TONARI'), 'L1-hira': ('일본 시리즈', 'となり'), 'L1-kata': ('하이브리드·경계', 'トナリ')}


def write_card(dims):
    big = 0.115                                  # 큰 칸: 1000단위 = 115px(세 마크 같은 배율)
    def img(key, mode, h=None, w=None, scale=None):
        vw, vh, _, _ = dims[key]
        if scale is not None:
            w, h = vw * scale, vh * scale
        elif h is not None:
            w = vw * h / vh
        else:
            h = vh * w / vw
        return (f'<img src="svg/{key}-{mode}.svg" width="{w:.1f}" height="{h:.1f}" '
                f'alt="{ROLES[key][1]}">')
    keys = ['L1-up', 'L1-hira', 'L1-kata']
    def row(mode, cls=''):
        return '<div class="row">' + ''.join(
            f'<div class="cell {cls}"><span class="tag">{ROLES[k][0]}</span>{img(k, mode, scale=big)}</div>'
            for k in keys) + '</div>'
    cols = ''
    for k in keys:
        cols += ('<div class="col">'
                 f'<div class="hdr">{img(k, "light", h=24)}<span>（ダミー）見出し</span></div>'
                 f'<div class="hdr dark">{img(k, "dark", h=24)}<span>（ダミー）見出し</span></div>'
                 f'<div class="cover">{img(k, "light", w=312)}</div>'
                 f'<div class="cover dark">{img(k, "dark", w=312)}</div>'
                 '</div>')
    html = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>L1 隣り合う字</title>
<style>{CARD_CSS}</style>
</head>
<body>
  <h1><b>L1</b>隣り合う字 — 이웃한 글자가 획을 나눠 쓰는 TONARI · となり · トナリ</h1>
  <p class="lede">한 줄 규칙: 한 굵기의 골격선으로 긋되, 이웃 두 글자는 띄우지 않고 한쪽 획 끝이 다른 쪽 획 안으로 들어가 멈춘다. 주홍은 '획 끝이 이웃에 내려앉는' 왼쪽 첫 자리 하나.</p>
  <div class="rule">숫자: 대문자 높이 H = 1000 · 획 굵기 W = 176(0.176H, 세 표기 공통, 끝은 획 직각 절단) · 가나 칸 1.06H ·
    맞닿지 않는 이웃 사이 150 · 접점 TONARI 3곳(T 가로대가 O의 지붕 / N 오른기둥 = A 왼다리, N 대각이 그 발치에 내려앉음 / R 다리가 I 발에 닿음) ·
    となり 1곳(と 맺음 끝에 な 사선 발이 내려앉음) · トナリ 1곳(ト 짧은 획 끝이 ナ 가로획 속으로) ·
    주홍 = 두 글자 윤곽의 교집합을 접점에서 W 높이까지 자른 조각(단색이면 본체 색, 형태 동일).</div>
  {row('light')}
  {row('dark', 'dark')}
  <p class="cap">세 칸 모두 같은 배율(1000단위 = 115px). 위 밝은 바탕(밤 글자), 아래 밤 바탕(눈 글자).</p>
  <h2>분해도 — 글자마다 반투명으로 겹쳐 칠했다. 짙은 곳 = 두 글자가 나눠 쓴 잉크, 주홍 선 = 접점 윤곽</h2>
  <div class="row">{''.join(f'<div class="cell ana"><span class="tag">{ROLES[k][1]}</span>{img(k, "anatomy", scale=0.11)}</div>' for k in keys)}</div>
  <h2>작은 크기 — 웹 헤더 마크 높이 24px · 표지 제호 폭 312px(390px 표지의 80%)</h2>
  <div class="sizes">{cols}</div>
  <h2>단색(mono) — 주홍 조각을 본체 색으로</h2>
  <div class="row">{''.join(f'<div class="cell" style="height:120px">{img(k, "mono-light", scale=0.07)}</div>' for k in keys)}</div>
</body>
</html>
"""
    with open(os.path.join(HERE, 'card.html'), 'w', encoding='utf-8') as f:
        f.write(html)


def main():
    os.makedirs(OUT, exist_ok=True)
    dims = {}
    for name, key, fn in MARKS:
        svgs, glyphs, pairs = build(name, fn)
        b = unary_union(list(glyphs.values())).bounds
        dims[key] = (b[2] - b[0], b[3] - b[1], b[1], len(pairs))
        for mode, s in svgs.items():
            with open(os.path.join(OUT, f'{key}-{mode}.svg'), 'w', encoding='utf-8') as f:
                f.write(s)
    write_card(dims)
    lines = []
    for fn in sorted(os.listdir(OUT)):
        with open(os.path.join(OUT, fn), 'rb') as f:
            lines.append(f'{hashlib.sha256(f.read()).hexdigest()}  svg/{fn}')
    with open(os.path.join(HERE, 'SHA256SUMS.txt'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
