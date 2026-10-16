#!/usr/bin/env python3
# 『となり』 제호 실험 매트릭스 — 2026-10-15 KST, 09-mast-lab
#
# 계기: 실제 잡지 20종 대조(편집장 비공개 시트) — 현행 제호는 표지 폭 25–95%, 08-mast 5안은 약 10%로 너무 작다.
# 축1 제호: A 가나(큰 크기 전용으로 다듬은 글자) · B TONARI · C1 隣+세로 읽기 · C2 隣+가로 읽기 · D 세로 띠
# 축2 크기: 제호 폭(D는 높이)이 표지의 15% · 25% · 40%
# 축3 표지: 07-refine/01-ippon(밝음) · 07-refine/05-danmen(밤) — 원본은 수정하지 않고 복사본에서 제호·호 표기·크레딧 한 줄만 바꾼다.
# 추가: 가장 나은 2조합 + 표지 문구 1줄(「一つの町　富士吉田」).
#
# 사용(리포 루트):  python3 -I docs/japanology/magazine/prototype/cover-machi01/09-mast-lab/build-lab.py
#                   node docs/japanology/magazine/prototype/cover-machi01/09-mast-lab/shoot.cjs   (검사 → results.json → 시트 재생성 → matrix.png)
# 글리프 읽기·손 수정 연산·서체 SHA256 고정은 08-mast/build-mast.py를 그대로 불러 쓴다(중복 신설 없음).
import importlib.util, json, math, os, re, sys
sys.dont_write_bytecode = True   # 08-mast 모듈을 불러도 __pycache__를 남기지 않는다

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('m08', os.path.join(HERE, '..', '08-mast', 'build-mast.py'))
m08 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m08)
from_08 = m08
load, apply, Mast, row, col, eb_kana, SB_KANA, fmt = m08.load, m08.apply, m08.Mast, m08.row, m08.col, m08.eb_kana, m08.SB_KANA, m08.fmt
NIGHT, SNOW = m08.NIGHT, m08.SNOW
# 큰 크기 B용 Garamond 500 인스턴스(같은 가변 서체 파일, 같은 SHA256)
m08.FONTS['garamond-500'] = (m08.FONTS['garamond-600'][0], m08.FONTS['garamond-600'][1], 500)

REFINE = os.path.join(HERE, '..', '07-refine')
COVERS = {'ippon': ('01-ippon/cover.html', 'light'), 'danmen': ('05-danmen/cover.html', 'dark')}
SIZES = {15: 0.15, 25: 0.25, 40: 0.40}
X0, Y0 = 13.0, 13.0     # 제호 잉크 왼쪽 위
NO_INK_DX, NO_INK_DY = 0.43, 0.69   # 호 표기 CSS 상자 → 잉크 왼쪽 위 (07-refine 실측: left 12.57→x13, top 30.31→y31)

LOG = {}   # 제호별 손 수정 기록


# ── 제호 ──────────────────────────────────────────────────────────────────────────────
def mast_A(u, small):
    """A 가나. small(15%): 03-mast 작은 크기 수정 전부. 큰 크기: 작은 크기용 처리를 풀고 디스플레이 전용으로 다시 다듬는다."""
    m = Mast('となり')
    if small:
        g = [m.glyph(eb_kana(c, ['T1', 'T2', 'T3', 'N2', 'N3', 'R1', 'R2', 'N1']), u / 1000, name=c) for c in 'となり']
        row(m, g, [0.131 * u, 0.131 * u], base=0.9 * u)
    else:
        disp = {
            'と': m08.EB_KANA['と']['T1'] + m08.EB_KANA['と']['T3'] + [('embolden', -6)],
            'な': m08.EB_KANA['な']['N3'] + [('embolden', -6)],
            'り': [('region', 0, (300, -90, 520, 40), (-6, -26)), ('embolden', -6)],
        }
        g = [m.glyph(apply(load('shippori-eb', c), disp[c]), u / 1000, name=c) for c in 'となり']
        row(m, g, [0.072 * u, 0.068 * u], base=0.9 * u)
    return m


LOG['A'] = {
    'small': ['03-mast 작은 크기 수정 8곳(T1–T3·N1–N3·R1·R2), 잉크 사이 0.131em'],
    'display': [
        '작은 크기용 처리 해제: な 교차부 바늘구멍(N1)·원래 고리 속공간(N2 해제)·り 바늘 꼬리(R2 해제)·이음선 보강(R1 해제)을 서체 원형으로 되돌림 — 큰 크기에서는 세부가 보이고 막히지 않는다',
        '윤곽 −6단위(디스플레이 광학 보정): ExtraBold를 크게 쓰면 획이 둔하고 속공간이 좁아 보인다 → 획을 얇혀 굵기 대비를 키움',
        'と 맺음 연장(T1)·첫 획 보강(T3), な 삐침 연장(N3)은 유지 — 가로 이웃을 향한 몸짓',
        'り 꼬리 끝을 아래로 26·왼쪽 6 늘임 — 큰 글자에서 줄 끝을 길게 끊음',
        '자간: 잉크 사이 0.072·0.068em(작은 크기 0.131em보다 조임 — 큰 글자는 빈자리가 커 보인다)',
    ],
}


def mast_B(c, small):
    """B TONARI(EB Garamond) 주 + となり 부. c = 대문자 높이(mm)."""
    m = Mast('TONARI となり')
    s = c / 650
    ops = {'T': [('squash', 0, 655, 0.35, 'above')], 'O': [], 'N': [], 'A': [('squash', 0, 652, 0.45, 'above')],
           'R': [('region', 0, (560, -40, 800, 130), (34, 0))], 'I': []}
    key = 'garamond-600' if small else 'garamond-500'
    g = [m.glyph(apply(load(key, ch), ops[ch]), s, name=ch) for ch in 'TONARI']
    tr = 0.32 if small else 0.22
    xs = row(m, g, [0.21 * c if small else 0.15 * c, tr * c, tr * c, (0.27 if small else 0.19) * c, (0.34 if small else 0.24) * c], base=c)
    ke = max(6.0, (0.87 if small else 0.5) * c)
    k = [m.glyph(apply(load('shippori-sb', ch), SB_KANA[ch]), ke / 1000, name=ch) for ch in 'となり']
    row(m, k, [0.15 * ke, 0.15 * ke], x=xs[-1][2] + 0.55 * c, base=c)
    return m


LOG['B'] = {
    'small': ['08-mast B 수정(T 세리프 솟음 35%·A 꼭짓점 45%·R 다리 +34), Garamond 600, 자간 0.32 cap', 'となり = A안 SemiBold 작은 크기 수정본, em 0.87 cap'],
    'display': ['같은 수정에 Garamond 500 인스턴스(큰 크기에서 600은 무겁다)', '자간 0.22 cap으로 조임(T–O 0.15·A–R 0.19 광학 보정)',
                'となり 부 = em 0.5 cap(최소 6mm) — 라틴 주의 읽기 보조로 낮춤'],
}

C_SMALL = [('scale', 5, (1.22, 1.22)), ('scale', 6, (1.35, 1.0)), ('scale', 7, (1.15, 1.06)), ('scale', 3, (1.06, 1.04))]
READ = ['T2', 'T3', 'N2', 'R1', 'R2', 'N1']   # 읽기 가나는 늘 작으므로 작은 크기 수정


def kanji(u, small):
    ops = C_SMALL if small else [('embolden', -6)]
    return load('shippori-eb', '隣'), ops


def mast_C1(u, small):
    """C1 隣 + 오른쪽 세로 읽기(ルビ 자리)."""
    m = Mast('隣（となり）')
    cs, ops = kanji(u, small)
    big = m.glyph(apply(cs, ops), u / 1000, name='隣'); m.put(big, 0, 0)
    r = max(5.9, (0.32 if small else 0.15) * u)
    k = [m.glyph(eb_kana(ch, READ), r / 1000, name=ch) for ch in 'となり']
    col(m, k, [0.09 * r, 0.08 * r], big['w'] + 0.085 * u + max(g['w'] for g in k) / 2, y=0.02 * u)
    return m


def mast_C2(u, small):
    """C2 隣 + 아래 가로 읽기(가운데)."""
    m = Mast('隣（となり）')
    cs, ops = kanji(u, small)
    big = m.glyph(apply(cs, ops), u / 1000, name='隣'); m.put(big, 0, 0)
    r = max(5.9, (0.3 if small else 0.15) * u)
    k = [m.glyph(eb_kana(ch, READ), r / 1000, name=ch) for ch in 'となり']
    w = sum(g['w'] for g in k) + 2 * 0.18 * r
    row(m, k, [0.18 * r, 0.18 * r], x=(big['w'] - w) / 2, base=big['h'] + 0.07 * u + 0.86 * r)
    return m


LOG['C1'] = LOG['C2'] = {
    'small': ['隣 속공간 4곳 열기(08-mast C: 夕 122%·舛 틈 135%/115×106%·阝 106×104%)', '읽기 가나 = 작은 크기 수정(T2·T3·N1·N2·R1·R2)'],
    'display': ['隣 속공간 열기 해제(서체 원형) + 윤곽 −6단위 — 큰 한자는 획 대비가 살아야 마크가 선다', '읽기 가나 em 0.15×隣(최소 5.9mm)'],
}


def mast_D(u, small):
    """D 세로 띠."""
    m = Mast('となり')
    tail = [('region', 0, (300, -90, 520, 40), (-10, -46)), ('move', 0, [5, 13], (-4, -18))]
    if small:
        use = ['T2', 'T3', 'N2', 'R1', 'R2', 'N1']
        g = [m.glyph(eb_kana('と', use), u / 1000, name='と'), m.glyph(eb_kana('な', use), u / 1000, name='な'),
             m.glyph(apply(eb_kana('り', use), tail), u / 1000, name='り')]
    else:
        g = [m.glyph(apply(load('shippori-eb', 'と'), m08.EB_KANA['と']['T3'] + [('embolden', -6)]), u / 1000, name='と'),
             m.glyph(apply(load('shippori-eb', 'な'), [('embolden', -6)]), u / 1000, name='な'),
             m.glyph(apply(load('shippori-eb', 'り'), tail + [('embolden', -6)]), u / 1000, name='り')]
    col(m, g, [0.112 * u, 0.095 * u], cx=u / 2, dx=[0, -0.021 * u, 0.03 * u])
    return m


LOG['D'] = {
    'small': ['08-mast D 그대로(T2·T3·N1·N2·R1·R2 + り 꼬리 아래로 46)'],
    'display': ['작은 크기용 N1·N2·R1·R2 해제(서체 원형), と 첫 획 보강(T3)과 り 꼬리 연장만 유지', '윤곽 −6단위(디스플레이 광학 보정)'],
}

MASTS = {'A': ('A 가나', mast_A, 'w'), 'B': ('B TONARI', mast_B, 'w'), 'C1': ('C1 隣+세로 읽기', mast_C1, 'w'),
         'C2': ('C2 隣+가로 읽기', mast_C2, 'w'), 'D': ('D 세로 띠', mast_D, 'h')}


def fit(fn, axis, target, small):
    u = 10.0
    for _ in range(3):
        m = fn(u, small); x0, y0, x1, y1 = m.bbox()
        cur = (x1 - x0) if axis == 'w' else (y1 - y0)
        u *= target / cur
    return fn(u, small), u


# ── 판면 지물(충돌 검사) ───────────────────────────────────────────────────────────────
def plate_shapes(html):
    i = html.index('<svg class="plate"'); j = html.index('</svg>', i); p = html[i:j]
    p = re.sub(r'<g [^>]*transform[^>]*>.*?</g>', '', p, flags=re.S)   # 金鳥居 도리이(국소 좌표) 제외 — 제호에서 멀다
    out = []
    for m in re.finditer(r'<path d="(M[^"]*)"([^>]*)>', p):
        d, attr = m.group(1), m.group(2)
        if 'transform' in attr:
            continue
        pts = []   # 절대 좌표 M/L/Q/A 명령의 끝점(Q는 조종점 포함 — 근사, A는 반경 2.5mm 필렛이라 끝점만)
        need = {'M': 2, 'L': 2, 'Q': 4, 'A': 7}
        for cmd, args in re.findall(r'([MLQAZ])([^MLQAZ]*)', d):
            if cmd == 'Z':
                continue
            nums = [float(t) for t in re.findall(r'-?[0-9]*\.?[0-9]+', args)]
            for k in range(0, len(nums), need[cmd]):
                a = nums[k:k + need[cmd]]
                if cmd == 'Q':
                    pts += [(a[0], a[1]), (a[2], a[3])]
                else:
                    pts.append((a[-2], a[-1]))
        sw = re.search(r'stroke-width="([0-9.]+)"', attr)
        fill = re.search(r'fill="(#[0-9a-f]+)"', attr)
        out.append({'pts': pts, 'stroke': float(sw.group(1)) if sw else 0, 'filled': bool(fill) and fill.group(1) != 'none'})
    return out


def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def inside(p, poly):
    x, y = p; c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i - 1], poly[i]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def mast_points(m, ox, oy):
    bx0, by0, _, _ = m.bbox(); pts = []
    for it in m.items:
        if it[0] == 'g':
            _, g, x, y = it; s = g['s']
            pts += m08.flat(g['cs'], lambda u, v: (ox + x - bx0 + g['ox'] + u * s, oy + y - by0 + g['oy'] - v * s), 4)
    return pts


def clearance(m, ox, oy, shapes):
    pts = mast_points(m, ox, oy)[::2]
    best = 1e9
    for sh in shapes:
        P = sh['pts']
        if sh['filled'] and any(inside(p, P) for p in pts):
            return -1.0
        for p in pts:
            for a, b in zip(P, P[1:]):
                if abs(p[0] - a[0]) > 40 and abs(p[0] - b[0]) > 40:
                    continue
                best = min(best, seg_dist(p, a, b) - sh['stroke'] / 2)
    return best


# ── 표지 사본 ─────────────────────────────────────────────────────────────────────────
def cover_copy(which, svg_text, W, H, no_css, extra_css='', extra_html='', note=''):
    src, _ = COVERS[which]
    html = open(os.path.join(REFINE, src), encoding='utf-8').read()
    inline = svg_text.replace('<svg xmlns="http://www.w3.org/2000/svg" ', '<svg class="mast" xmlns="http://www.w3.org/2000/svg" ', 1)
    html, n = re.subn(r'<svg class="mast".*?</svg>', lambda _: inline, html, count=1, flags=re.S); assert n == 1
    html, n = re.subn(r'\.cover \.mast\{[^}]*\}', f'.cover .mast{{left:calc(var(--mm)*{fmt(X0)});top:calc(var(--mm)*{fmt(Y0)});'
                      f'width:calc(var(--mm)*{fmt(W)});height:calc(var(--mm)*{fmt(H)})}}', html, count=1); assert n == 1
    html, n = re.subn(r'<span class="hang">『となり』編集部</span>', '<span>となり編集部</span>', html); assert n == 1
    html = html.replace('</style>', f'/* 09-mast-lab */\n{no_css}\n{extra_css}\n</style>', 1)
    if extra_html:
        html = html.replace('<h1 class="ttl">', extra_html + '\n  <h1 class="ttl">', 1)
    html = html.replace('<!--', f'<!--\n  ※ 09-mast-lab/build-lab.py가 07-refine/{src}를 복사해 제호·호 표기·크레딧 「となり編集部」만 바꾼 실험 사본(2026-10-15 KST). {note}', 1)
    return html


def min_em(m):
    """제호 안 가장 작은 글자의 em(mm). 표지 규칙 15pt(5.4mm)는 SVG 제호에도 적용한다(check-cover는 SVG를 보지 않음)."""
    return round(min(it[1]['s'] * 1000 for it in m.items if it[0] == 'g'), 2)


NO_W, NO_H = 32.8, 5.0   # 호 표기 「一つの町 01」 잉크 상자(mm, 07-refine 실측 근사)


def rect_clear(r, shapes):
    """사각형(잉크) ↔ 판면 지물 최소 거리(mm)."""
    x0, y0, x1, y1 = r
    pts = [(x0 + (x1 - x0) * i / 12, y) for i in range(13) for y in (y0, y1)] + [(x, y0 + (y1 - y0) * i / 4) for i in range(5) for x in (x0, x1)]
    best = 1e9
    for sh in shapes:
        if sh['filled'] and any(inside(p, sh['pts']) for p in pts):
            return -1.0
        for p in pts:
            for a, b in zip(sh['pts'], sh['pts'][1:]):
                best = min(best, seg_dist(p, a, b) - sh['stroke'] / 2)
    return best


def no_place(key, bb, shapes=None):
    """호 표기(잉크) 위치: 가로 제호는 아래, D는 오른쪽 세로. 아래 자리가 판면 지물(능선)에 걸리면 제호 오른쪽 위로 옮긴다.
    돌려주는 값: (css, 옮김 설명)."""
    x0, y0, x1, y1 = bb
    if key == 'D':
        return ((f'.cover .no{{left:calc(var(--mm)*{fmt(x1 + 2.2)});top:calc(var(--mm)*{fmt(y0 - 0.5)});writing-mode:vertical-rl;letter-spacing:.12em}}'
                 '.cover .no .n,.cover .no span{margin-left:0;margin-top:calc(var(--mm)*2.5);text-combine-upright:all;letter-spacing:0}'), '')
    gap = 4.0 if (y1 - y0) < 20 else 5.0
    nx, ny = X0, y1 + gap
    moved = ''
    if shapes is not None and rect_clear((nx, ny, nx + NO_W, ny + NO_H), shapes) < 2.0:
        nx, ny = x1 + 4.0, y0 + 0.4
        moved = f'호 표기가 제호 아래에서 능선에 걸려 제호 오른쪽 위({nx:.1f}, {ny:.1f})로 옮김.'
    return f'.cover .no{{left:calc(var(--mm)*{fmt(nx - NO_INK_DX)});top:calc(var(--mm)*{fmt(ny - NO_INK_DY)})}}', moved


# 추가 실험: 표지 문구 1줄 — 「一つの町　富士吉田」(원고 연재명 + 지명, 새 사실 없음)
LINES = {
    'name': '一つの町　富士吉田',                    # 편집장 예시: 연재명 + 지명
    'quote': '「聖なる町と俗なる町」が隣り合う',     # 원고 (2)절 46행 그대로(県の紹介, A17 1次 原文照合)
}
EXTRA = [('C1', 25, 'name'), ('C1', 25, 'quote'), ('A', 40, 'quote')]


def main(matrix_only=False):
    os.makedirs(os.path.join(HERE, 'covers'), exist_ok=True)
    os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
    cells, built = [], {}
    shapes = {w: plate_shapes(open(os.path.join(REFINE, COVERS[w][0]), encoding='utf-8').read()) for w in COVERS}
    for key, (label, fn, axis) in MASTS.items():
        for pct, f in SIZES.items():
            target = (210 if axis == 'w' else 297) * f
            small = pct == 15
            m, u = fit(fn, axis, target, small)
            light, W, H = m.svg(NIGHT); dark, _, _ = m.svg(SNOW)
            bb = (X0, Y0, X0 + W, Y0 + H)
            built[(key, pct)] = (m, light, dark, W, H, bb)
            open(os.path.join(HERE, 'svg', f'{key}-{pct}-light.svg'), 'w').write(light + '\n')
            open(os.path.join(HERE, 'svg', f'{key}-{pct}-dark.svg'), 'w').write(dark + '\n')
            for which, (_, tone) in COVERS.items():
                cl = clearance(m, X0, Y0, shapes[which])
                halo, note = '', ''
                no_css, moved = no_place(key, bb, shapes[which])
                if cl < 1.5:
                    halo = '.cover .mast path{stroke:var(--cover-bg);stroke-width:1.6;stroke-linejoin:round;paint-order:stroke fill}'
                    note = f'제호가 판면 지물과 {"겹침" if cl < 0 else f"{cl:.1f}mm"} → 제호 둘레 0.8mm 바탕색 테로 지물을 끊고 앞에 얹음.'
                name = f'{key}-{pct}-{which}'
                open(os.path.join(HERE, 'covers', name + '.html'), 'w').write(
                    cover_copy(which, light if tone == 'light' else dark, W, H, no_css, halo, note=note + ' ' + moved))
                cells.append({'name': name, 'key': key, 'pct': pct, 'which': which, 'w': round(W, 1), 'h': round(H, 1),
                              'px': [round(W * 390 / 210, 1), round(H * 390 / 210, 1)], 'em': round(u, 2), 'min_em': min_em(m),
                              'plate_clear_mm': None if cl > 50 else round(cl, 1), 'halo': bool(halo), 'note': (note + ' ' + moved).strip()})
    # 추가 실험: 문구 1줄 — 제호 오른쪽 위, Shippori Mincho 500 5.6mm(15pt 이상)
    for key, pct, tid in EXTRA:
        m, light, dark, W, H, bb = built[(key, pct)]
        text = LINES[tid]
        for which, (_, tone) in COVERS.items():
            x0, y0, x1, y1 = bb
            lx, ly, fs = x1 + 5.0, y0 + 0.4, 5.6
            line_css = (f'.cover .line1{{left:calc(var(--mm)*{fmt(lx - 0.1)});top:calc(var(--mm)*{fmt(ly - 0.6)});font-family:\'Shippori Mincho\',serif;'
                        f'font-weight:500;font-size:calc(var(--mm)*{fs});line-height:1;letter-spacing:.04em;white-space:nowrap;font-feature-settings:\'palt\'}}')
            no_css, moved = no_place(key, bb, shapes[which])
            if moved:   # 호 표기도 오른쪽으로 갔으면 문구 아래로
                no_css = f'.cover .no{{left:calc(var(--mm)*{fmt(lx - NO_INK_DX)});top:calc(var(--mm)*{fmt(ly + fs + 3.4 - NO_INK_DY)})}}'
            cl = clearance(m, X0, Y0, shapes[which])
            lcl = rect_clear((lx, ly, lx + len(text) * fs * 0.92, ly + fs), shapes[which])
            halo = '.cover .mast path{stroke:var(--cover-bg);stroke-width:1.6;stroke-linejoin:round;paint-order:stroke fill}' if cl < 1.5 else ''
            name = f'{key}-{pct}-{which}-{tid}'
            open(os.path.join(HERE, 'covers', name + '.html'), 'w').write(cover_copy(
                which, light if tone == 'light' else dark, W, H, no_css, line_css + halo,
                f'<p class="line1">{text}</p>', note=f'표지 문구 1줄 실험: {text}'))
            cells.append({'name': name, 'key': key, 'pct': pct, 'which': which, 'w': round(W, 1), 'h': round(H, 1),
                          'px': [round(W * 390 / 210, 1), round(H * 390 / 210, 1)], 'line': tid, 'line_text': text, 'halo': bool(halo),
                          'min_em': min_em(m), 'line_plate_clear_mm': round(lcl, 1)})
    json.dump({'cells': cells, 'log': LOG}, open(os.path.join(HERE, 'layout.json'), 'w'), ensure_ascii=False, indent=1)
    write_matrix(cells)


EVAL = {}   # (key, pct, which) → 한 줄 평. NOTES.md의 표와 같은 문장.
EVAL_FILE = os.path.join(HERE, 'eval.json')


def write_matrix(cells):
    res_path = os.path.join(HERE, 'results.json')
    res = json.load(open(res_path)) if os.path.exists(res_path) else {}
    ev = json.load(open(EVAL_FILE)) if os.path.exists(EVAL_FILE) else {}
    by = {}
    for c in cells:
        by.setdefault((c['key'], c['pct'], c.get('line') or ''), {})[c['which']] = c
    rows = ''
    order = [(k, p, '') for k in MASTS for p in SIZES] + [(k, p, t) for k, p, t in EXTRA]
    for k, p, line in order:
        cs = by[(k, p, line)]
        c0 = cs['ippon']
        label = f'{MASTS[k][0]} · {p}%' + (f' · + 문구 「{LINES[line]}」' if line else '')
        dim = f'{c0["w"]}×{c0["h"]}mm · 390px에서 {c0["px"][0]}×{c0["px"][1]}px'
        cells_html = ''
        for which in ('ippon', 'danmen'):
            c = cs[which]; r = dict(res.get(c['name'], {}))
            if r and c['min_em'] < 5.4:
                r = {'ok': False, 'fails': r.get('fails', []) + [f'제호 글자 em {c["min_em"]}mm < 15pt(5.4mm)']}
            if r and c.get('line_plate_clear_mm', 99) < 1.5:
                r = {'ok': False, 'fails': r.get('fails', []) + ['문구×판면 지물 겹침']}
            ok = r.get('ok')
            badge = '<b class="ok">검사 통과</b>' if ok else (f'<b class="ng">실패</b> {"; ".join(r.get("fails", []))}' if ok is False else '<b>미검사</b>')
            adj = (' · 지물 앞에 얹음(바탕색 테)' if c.get('halo') else '') + (' · 호 표기 제호 오른쪽으로 옮김' if '옮김' in c.get('note', '') else '')
            e = ev.get(c['name'], '')
            cells_html += (f'<td><div class="fr"><iframe src="covers/{c["name"]}.html" width="422" height="592" scrolling="no"></iframe></div>'
                           f'<div class="cap">{badge}{adj}<br>{e}</div></td>')
        rows += f'<tr><th>{label}<br><small>{dim}</small></th>{cells_html}</tr>'
    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>제호 실험 매트릭스</title>
<style>
:root{{--bg:#d9dce3;--fg:#151b2c;--mute:#4a5163}}
body{{margin:0;padding:20px 22px 30px;background:var(--bg);color:var(--fg);font:13px/1.45 system-ui,sans-serif}}
h1{{font-size:17px;margin:0 0 2px}} p{{margin:0 0 10px;color:var(--mute)}}
table{{border-collapse:collapse}} th{{text-align:left;vertical-align:top;width:190px;padding:6px 10px 6px 0;font-size:13px}}
th small{{font-weight:400;color:var(--mute)}} td{{vertical-align:top;padding:6px 8px}}
.fr{{width:211px;height:296px;overflow:hidden}} .fr iframe{{border:0;transform:scale(.5);transform-origin:0 0;display:block}}
.cap{{width:211px;font-size:11.5px;color:var(--mute);margin-top:3px}} b.ok{{color:#1d6b3a}} b.ng{{color:#b3261e}}
tr{{border-top:1px solid #c3c7d1}}
</style></head><body>
<h1>『となり』 제호 실험 — 제호 × 크기(표지 폭 15·25·40%, D는 높이) × 표지</h1>
<p>각 칸 = 390px 표지의 50% 축소. 원본 07-refine 표지는 그대로, 사본에서 제호·호 표기·크레딧 「となり編集部」만 교체. 검사 = check-cover + 제호 SVG와 글자 요소 겹침·안전선.</p>
<table>{rows}</table>
</body></html>'''
    open(os.path.join(HERE, 'matrix.html'), 'w').write(html)


if __name__ == '__main__':
    main()
