# AI 생성 마크 후보 1장을 단색 벡터 SVG로 바꾼다 — intake.mjs가 부른다.
# 사용: python3 -I trace.py <입력 png> <출력 svg> <출력 json>
# 순서: 흰 바탕 합성 → 회색조 → 테두리 중앙값으로 바탕 판정(어두우면 반전) → 잉크 높이 ≥1200px로 확대
#      → Otsu 이진화 → 잉크 상자 + 여백으로 자르기 → vtracer(MIT) binary/spline 추적 → fill=currentColor
# 같은 입력이면 같은 출력(vtracer·PIL 모두 결정적). 색은 버린다 — 색은 표지 쪽 토큰이 정한다.
import json, re, sys, tempfile, os
from PIL import Image, ImageFilter, ImageOps
import vtracer

src, out_svg, out_json = sys.argv[1:4]
im = Image.open(src)
im.load()
if im.mode in ('RGBA', 'LA', 'P'):
    im = im.convert('RGBA')
    bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
    im = Image.alpha_composite(bg, im)
g = im.convert('L')
w, h = g.size
border = [g.getpixel((x, 0)) for x in range(w)] + [g.getpixel((x, h - 1)) for x in range(w)] \
    + [g.getpixel((0, y)) for y in range(h)] + [g.getpixel((w - 1, y)) for y in range(h)]
border.sort()
inverted = border[len(border) // 2] < 128
if inverted:
    g = ImageOps.invert(g)

def otsu(img):
    hist = img.histogram()
    total = sum(hist)
    sum_all = sum(i * c for i, c in enumerate(hist))
    wb = sb = 0
    best, thr = -1, 128
    for t in range(256):
        wb += hist[t]
        if wb == 0:
            continue
        wf = total - wb
        if wf == 0:
            break
        sb += t * hist[t]
        mb, mf = sb / wb, (sum_all - sb) / wf
        between = wb * wf * (mb - mf) ** 2
        if between > best:
            best, thr = between, t
    return thr

thr = otsu(g)
ink = g.point(lambda v: 255 if v <= thr else 0)  # 잉크 = 255
# 잡티(생성 노이즈·스캔 먼지)가 잉크 상자를 넓히지 않도록, 상자는 열림 연산(침식→팽창)을 거친 마스크로 잰다
opened = lambda m, k: m.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
box = opened(ink, 3).getbbox()
if not box:
    sys.exit(f'{src}: 잉크를 찾지 못했다')
ink_h = box[3] - box[1]
scale = max(1.0, 1200 / ink_h)
if scale > 1.0:
    g = g.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    thr = otsu(g)
bw = g.point(lambda v: 0 if v <= thr else 255)  # 잉크 = 검정
# 확대 후 상자 = 원해상도 열림 상자 × 배율(큰 커널 순위 필터는 느리다)
x0, y0 = int(box[0] * scale), int(box[1] * scale)
x1, y1 = min(bw.width, -int(-box[2] * scale)), min(bw.height, -int(-box[3] * scale))
pad = round(0.04 * (y1 - y0))
crop = (max(0, x0 - pad), max(0, y0 - pad), min(bw.width, x1 + pad), min(bw.height, y1 + pad))
bw = bw.crop(crop).convert('RGB')
with tempfile.TemporaryDirectory() as td:
    p_in, p_out = os.path.join(td, 'bw.png'), os.path.join(td, 'bw.svg')
    bw.save(p_in)
    speck = max(4, round((y1 - y0) / 150) ** 2)
    vtracer.convert_image_to_svg_py(p_in, p_out, colormode='binary', mode='spline', filter_speckle=speck,
                                    corner_threshold=60, length_threshold=4.0, splice_threshold=45,
                                    path_precision=1)
    raw = open(p_out, encoding='utf-8').read()
paths = re.findall(r'<path [^>]*/>', raw)
paths = [re.sub(r' fill="[^"]*"', '', p) for p in paths]
W, H = bw.size
ix0, iy0 = x0 - crop[0], y0 - crop[1]
iw, ih = x1 - x0, y1 - y0
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{ix0} {iy0} {iw} {ih}" '
       f'data-src="{os.path.basename(src)}"><g fill="currentColor">\n' + '\n'.join(paths) + '\n</g></svg>\n')
open(out_svg, 'w', encoding='utf-8').write(svg)
nodes = sum(len(re.findall(r'[MCLZ]', p)) for p in paths)
json.dump({'src': os.path.basename(src), 'inverted': inverted, 'threshold': thr, 'scale': round(scale, 3),
           'aspect': round(iw / ih, 4), 'paths': len(paths), 'nodes': nodes}, open(out_json, 'w'), ensure_ascii=False)
print(f'{os.path.basename(src)} → aspect {iw / ih:.3f}, paths {len(paths)}, nodes {nodes}')
