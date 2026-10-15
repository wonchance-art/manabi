#!/usr/bin/env python3
# 『となり』 라틴 제호 TONARI — 표지 폭 70–90%용 새 설계(2026-10-15 KST, 10-mh/mast)
#
# 오너 결정(2026-10-15 KST): 마ガジンハウス 생활지 문법(위쪽 전체 폭의 큰 라틴 제호 + 큰 특집 제목 + 그림 한 장 + 문구 2–3).
# 09-mast-lab 실증: 라틴 제호는 폭 40%에서 대문자 약 6mm로 실패 → 70–90% 전용으로 새로 그린다(작은 크기용 B 확대 금지).
#   B1 굵은 세리프(편집지형)  — EB Garamond 800 대문자, 좁은 자간, となり 읽기 보조(작게, 오른쪽 아래)
#   B2 압축 그로테스크 대문자 — Archivo wdth 62·wght 700, 글자 사이 = 기둥 굵기(등간 세로 리듬), となり 고딕 읽기 보조
#   B3 자유안: 명조 한 가족 결합 — Shippori Mincho의 라틴 대문자 + 오른쪽 끝 세로 となり(높이 = 대문자 높이)
#
# 사용(리포 루트):
#   python3 -I docs/japanology/magazine/prototype/cover-machi01/10-mh/mast/build-mast.py      → svg/*.svg, specimen.html, layout.json
#   node docs/japanology/magazine/prototype/cover-machi01/10-mh/mast/shoot.cjs                → specimen.png
# 서체: 08-mast/build-mast.py의 고정 커밋·SHA256 검증·캐시(TONARI_FONT_CACHE)를 그대로 쓴다. 리포에 서체 파일 없음.
import importlib.util, json, os, sys
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('m08', os.path.join(HERE, '..', '..', '08-mast', 'build-mast.py'))
m08 = importlib.util.module_from_spec(spec); spec.loader.exec_module(m08)
apply, Mast, row, col, eb_kana, SB_KANA, fmt, load = m08.apply, m08.Mast, m08.row, m08.col, m08.eb_kana, m08.SB_KANA, m08.fmt, m08.load
NIGHT, SNOW, VERMILION = m08.NIGHT, m08.SNOW, m08.VERMILION

# 추가 서체(모두 OFL 1.1, 같은 google/fonts 고정 커밋)
m08.FONTS['archivo'] = ('archivo/Archivo%5Bwdth,wght%5D.ttf', '0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053', None)
m08.FONTS['zenkaku-b'] = ('zenkakugothicnew/ZenKakuGothicNew-Bold.ttf', '0081cedabc4921982fcd061f845a005664ac7fb642af2dd34b4007bc63ccd235', None)
_VAR = {}


def load_var(key, ch, loc):
    """가변 서체를 loc 축 값으로 고정한 윤곽."""
    k = (key, tuple(sorted(loc.items())))
    if k not in _VAR:
        from fontTools.ttLib import TTFont
        from fontTools.varLib.instancer import instantiateVariableFont
        _VAR[k] = instantiateVariableFont(TTFont(m08.font_path(key)), loc)
    t = _VAR[k]; glyf = t['glyf']
    g = glyf[t.getBestCmap()[ord(ch)]]
    co, ends, fl = g.getCoordinates(glyf)
    cs, s = [], 0
    for e in ends:
        cs.append([[float(co[i][0]), float(co[i][1]), bool(fl[i] & 1)] for i in range(s, e + 1)]); s = e + 1
    return cs


def gl(m, raw_cs, ops, s, name):
    """수정본 글리프 조각. 겹쳐 보기용으로 원래 윤곽(raw)을 같이 들고 다닌다."""
    g = m.glyph(apply(raw_cs, ops), s, name=name); g['raw'] = raw_cs
    return g


TARGET_W = 168.0   # 표지 폭 80%(mm). 70–90%는 SVG를 그대로 확대·축소(147–189mm)
EDITS = {}


# ── B1 굵은 세리프 ─────────────────────────────────────────────────────────────────────
B1_OPS = {
    'T': [('squash', 0, 652, 0.4, 'above')],
    'O': [],
    'N': [],
    'A': [('squash', 0, 655, 0.5, 'above')],
    'R': [('region', 0, (560, -40, 820, 130), (30, 0))],
    'I': [],
}
EDITS['B1'] = [
    'EB Garamond 800 대문자. T 가로획 끝 세리프가 대문자선 위로 50단위 솟는 것을 40%로 눌러 O·N과 같은 선에 맞춤',
    'A 꼭짓점 깃발을 50%로 눌러 대문자선에 맞춤(큰 크기에서 깃발이 장식으로 튀는 것 정리)',
    'R 다리 끝(x 560–820, y<130)을 오른쪽 30 연장 — R–I 사이를 메우는 획',
    '자간(잉크 사이): 기본 0.07 cap, T–O 0.025·N–A 0.04·A–R 0.05 광학 보정 — 큰 크기 전용으로 조임',
    'となり 읽기 보조: Shippori SemiBold 작은 크기 수정본(08-mast SB_KANA), em 0.25 cap(70% 폭에서도 5.6mm ≥ 15pt), I 오른끝에 맞춰 기준선 아래 0.2 cap',
]


def b1(c, raw=False):
    m = Mast('TONARI（となり）')
    s = c / 650
    g = [gl(m, load_var('garamond-600', ch, {'wght': 800}), [] if raw else B1_OPS[ch], s, ch) for ch in 'TONARI']
    xs = row(m, g, [0.025 * c, 0.07 * c, 0.04 * c, 0.05 * c, 0.07 * c], base=c)
    ke = 0.25 * c   # 70% 폭에서도 em ≥ 5.4mm(15pt)
    k = [gl(m, load('shippori-sb', ch), [] if raw else SB_KANA[ch], ke / 1000, ch) for ch in 'となり']
    w = sum(x['w'] for x in k) + 2 * 0.14 * ke
    row(m, k, [0.14 * ke, 0.14 * ke], x=xs[-1][2] - w, base=c + 0.2 * c + 0.88 * ke)
    return m


# ── B2 압축 그로테스크 ─────────────────────────────────────────────────────────────────
B2_LOC = {'wght': 700, 'wdth': 62}
B2_OPS = {
    'T': [],
    'O': [],
    'N': [],
    # A 가로대를 40 내림: 가로대 아래(점 5·6)·위(윤곽 1의 0·1)를 내리고, 사선 위에 머물도록 x도 기울기만큼 옮김
    'A': [('move', 0, [6], (-7.9, -40)), ('move', 0, [5], (8.2, -40)), ('move', 1, [0], (-8.1, -40)), ('move', 1, [1], (7.5, -40))],
    # R 다리를 세움: 발끝(10·11)을 왼쪽으로 — 다리 바깥이 볼 오른끝(x458)과 세로로 맞는다
    'R': [('move', 0, [10], (-25, 0)), ('move', 0, [11], (-19, 0))],
    'I': [],
}
EDITS['B2'] = [
    'Archivo wdth 62·wght 700 대문자(압축 그로테스크)',
    'A 가로대를 40단위 내림(146–256 → 106–216) — 속공간을 키워 큰 크기에서 A가 뭉치지 않고 자세가 낮아짐. 사선 위 점은 기울기만큼 x 보정',
    'R 다리 발끝을 왼쪽 25·19 — 다리 바깥선이 볼 오른끝과 세로로 맞아 기둥 리듬에 합류',
    '자간: 글자 사이 잉크 = 기둥 굵기(131/687 = 0.19 cap)로 등간 — 세로 기둥이 같은 간격으로 늘어선 「이웃」의 리듬. T–O 0.13·N–A 0.15·A–R 0.15 광학 보정',
    'となり 읽기 보조: Zen Kaku Gothic New Bold(호 표기·크레딧과 같은 고딕 계열), em 0.16 cap, 수정 없음(읽기 크기라 서체 그대로)',
]


def b2(c, raw=False):
    m = Mast('TONARI（となり）')
    s = c / 687
    g = [gl(m, load_var('archivo', ch, B2_LOC), [] if raw else B2_OPS[ch], s, ch) for ch in 'TONARI']
    st = 0.19 * c
    xs = row(m, g, [0.13 * c, st, 0.15 * c, 0.15 * c, st], base=c)
    ke = 0.16 * c
    k = [m.glyph(load('zenkaku-b', ch), ke / 1000, name=ch) for ch in 'となり']
    w = sum(x['w'] for x in k) + 2 * 0.1 * ke
    row(m, k, [0.1 * ke, 0.1 * ke], x=xs[-1][2] - w, base=c + 0.14 * c + 0.88 * ke)
    return m


# ── B3 명조 한 가족 결합 ───────────────────────────────────────────────────────────────
B3_OPS = {
    'T': [('region', 0, (0, 560, 130, 640), (0, 44)), ('region', 0, (670, 560, 800, 640), (0, 44))],
    'O': [],
    'N': [],
    'A': [],
    'R': [('region', 0, (640, -10, 820, 130), (24, 0))],
    'I': [],
}
EDITS['B3'] = [
    'Shippori Mincho ExtraBold의 라틴 대문자 — 표지 제목 「富士吉田」(Shippori 800)과 같은 가족이라 제호·제목이 한 목소리',
    'T 가로획 양끝의 아래로 휜 뿔(y 577–640)을 44 올려 짧게 — 큰 크기에서 뿔이 장식으로 튀는 것 정리',
    'R 다리 끝(x>640, y<130)을 오른쪽 24 — 발을 길게 끌어 I 쪽으로',
    '자간 0.05 cap(I–となり 0.11 cap)',
    'となり 결합: 오른쪽 끝에 세로로 세움, 세로 줄 높이 = 대문자 높이. 03/08-mast 작은 크기 가나 수정(T2·T3·N1·N2·R1·R2) — 세로 ルビ처럼 라틴 이름의 읽기를 단다',
]


def b3(c, raw=False):
    m = Mast('TONARI となり')
    s = c / 740
    g = [gl(m, load('shippori-eb', ch), [] if raw else B3_OPS[ch], s, ch) for ch in 'TONARI']
    xs = row(m, g, [0.05 * c] * 5, base=c)
    top, bot = min(b[1] for b in xs), max(b[3] for b in xs)
    use = ['T2', 'T3', 'N2', 'R1', 'R2', 'N1']
    # 세로 줄 높이가 대문자 높이와 같도록 em을 맞춘다
    ke = 0.3 * c
    for _ in range(4):
        k = [m08.Mast('').glyph(eb_kana(ch, use), ke / 1000, name=ch) for ch in 'となり']
        h = sum(x['h'] for x in k) + 0.1 * ke + 0.08 * ke
        ke *= (bot - top) / h
    k = []
    for ch in 'となり':
        g_ = m.glyph(load('shippori-eb', ch) if raw else eb_kana(ch, use), ke / 1000, name=ch); g_['raw'] = load('shippori-eb', ch); k.append(g_)
    cx = xs[-1][2] + 0.11 * c + max(x['w'] for x in k) / 2
    col(m, k, [0.1 * ke, 0.08 * ke], cx, y=top)
    return m


BUILDERS = {'B1': ('B1 굵은 세리프', b1), 'B2': ('B2 압축 그로테스크', b2), 'B3': ('B3 명조 가족 결합(세로 となり)', b3)}


def fit(fn):
    c = 20.0
    for _ in range(3):
        m = fn(c); x0, y0, x1, y1 = m.bbox(); c *= TARGET_W / (x1 - x0)
    return fn(c), c


def main():
    os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True)
    layout = {}
    svgs = {}
    for k, (label, fn) in BUILDERS.items():
        m, c = fit(fn)
        light, W, H = m.svg(NIGHT); dark, _, _ = m.svg(SNOW)
        open(os.path.join(HERE, 'svg', f'{k}-light.svg'), 'w').write(light + '\n')
        open(os.path.join(HERE, 'svg', f'{k}-dark.svg'), 'w').write(dark + '\n')
        kana_em = min(it[1]['s'] * 1000 for it in m.items if it[0] == 'g')
        layout[k] = {'label': label, 'w_mm': round(W, 2), 'h_mm': round(H, 2), 'cap_mm': round(c, 2), 'min_em_mm': round(kana_em, 2),
                     'at_390px': [round(W * 390 / 210, 1), round(H * 390 / 210, 1)], 'cap_390px': round(c * 390 / 210, 1),
                     'range_70_90_mm': [[round(W * r, 1), round(H * r, 1)] for r in (147 / 168, 189 / 168)], 'edits': EDITS[k]}
        svgs[k] = (light, dark, W, H)
        # 겹쳐 보기: 수정본 면 + 같은 자리(같은 서체 원점)에 원래 윤곽선
        bx0, by0, _, _ = m.bbox(); raws = []
        for it in m.items:
            if it[0] == 'g' and 'raw' in it[1]:
                _, g, x, y = it; sc = g['s']
                raws.append(m08.to_d(g['raw'], lambda u, v, x=x, y=y, g=g, sc=sc: (x - bx0 + g['ox'] + u * sc, y - by0 + g['oy'] - v * sc)))
        ov = m.svg(NIGHT)[0].replace('fill="#151b2c"', 'fill="#151b2c" fill-opacity=".14" stroke="#151b2c" stroke-width=".12"')
        ov = ov.replace('</svg>', f'<path fill="none" stroke="#d4462a" stroke-width=".18" d="{"".join(raws)}"/></svg>')
        open(os.path.join(HERE, 'svg', f'{k}-edits.svg'), 'w').write(ov + '\n')
        print(k, f'{W:.1f}×{H:.1f}mm cap {c:.1f}mm  390px: {W * 390 / 210:.0f}×{H * 390 / 210:.0f}px  가장 작은 글자 em {kana_em:.1f}mm', file=sys.stderr)
    json.dump(layout, open(os.path.join(HERE, 'layout.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(HERE, 'layout.json'), 'a').write('\n')
    write_specimen(layout)


def write_specimen(layout):
    k390 = 390 / 210
    def frame(key, tone, ratio=1.0):
        w = layout[key]['w_mm'] * ratio; h = layout[key]['h_mm'] * ratio
        bg, fg = (SNOW, NIGHT) if tone == 'light' else (NIGHT, SNOW)
        x = (210 - w) / 2
        return (f'<div class="cv" style="background:{bg}">'
                f'<img src="svg/{key}-{tone}.svg" style="left:{x * k390:.2f}px;top:{13 * k390:.2f}px;width:{w * k390:.2f}px;height:{h * k390:.2f}px">'
                f'<span class="no" style="color:{fg};top:{(13 + h + 5) * k390:.1f}px;left:{x * k390:.1f}px">一つの町　01</span>'
                f'<span class="sz" style="color:{fg}">폭 {w:.0f}mm = 표지 {w / 2.1:.0f}% · 390px에서 {w * k390:.0f}×{h * k390:.0f}px</span></div>')
    rows = ''
    for key, v in layout.items():
        rows += (f'<section><h2>{v["label"]}</h2><p>{v["w_mm"]}×{v["h_mm"]}mm(표지 폭 80%) · 대문자 높이 {v["cap_mm"]}mm · 390px 표지에서 {v["at_390px"][0]}×{v["at_390px"][1]}px(대문자 {v["cap_390px"]}px) · 가장 작은 글자 em {v["min_em_mm"]}mm</p>'
                 f'<div class="row">{frame(key, "light")}{frame(key, "dark")}'
                 f'<div class="big"><img src="svg/{key}-light.svg"><img src="svg/{key}-dark.svg" style="background:{NIGHT}">'
                 f'<img src="svg/{key}-edits.svg" style="background:#fff"><small>손 수정 겹쳐 보기 — 주홍 선 = 서체 원래 윤곽, 남색 면 = 수정본</small></div></div></section>')
    rng = ''.join(frame(k, 'light', r) for k in layout for r in (147 / 168, 189 / 168))
    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TONARI 제호 견본</title>
<style>
:root{{--bg:#d9dce3;--fg:#151b2c;--mute:#4a5163}}
body{{margin:0;padding:20px 24px 30px;background:var(--bg);color:var(--fg);font:13px/1.5 system-ui,sans-serif}}
h1{{font-size:17px;margin:0 0 4px}} h2{{font-size:14px;margin:18px 0 2px}} p{{margin:0 0 8px;color:var(--mute)}}
.row{{display:flex;gap:14px;align-items:flex-start}}
.cv{{position:relative;width:390px;height:{297 * k390:.0f}px;overflow:hidden;flex:none}}
.cv img{{position:absolute;display:block}}
.cv .no{{position:absolute;font:500 {5.64 * k390:.1f}px/1 'Zen Kaku Gothic New',sans-serif;letter-spacing:.08em}}
.cv .sz{{position:absolute;left:10px;bottom:8px;font-size:11px;opacity:.75}}
.big{{display:flex;flex-direction:column;gap:10px}} .big img{{width:620px;display:block;padding:14px;background:#eef0f4}}
.rng{{display:flex;gap:12px;flex-wrap:wrap}} .rng .cv{{height:150px}}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500&display=swap">
</head><body>
<h1>TONARI 라틴 제호 — 표지 폭 70–90%용 3안 (390px 표지 실제 크기 견본)</h1>
<p>왼쪽 두 칸 = 390px 폭 표지에 실제 크기로 얹은 것(위 13mm, 가운데 정렬, 호 표기는 자리 표시). 오른쪽 = 확대. 모두 아웃라인 SVG.</p>
{rows}
<h2>70%·90% 폭(같은 SVG 확대·축소) — 390px 표지 윗부분</h2>
<div class="rng">{rng}</div>
</body></html>'''
    open(os.path.join(HERE, 'specimen.html'), 'w').write(html)


if __name__ == '__main__':
    main()
