"""Generate favicon.ico — gradien blue-500 → blue-600 (senada logo sidebar
`from-blue-500 to-blue-600`) dengan siluet ikon cube putih (fa-cube dari
Font Awesome 6.5.0, path persis dari solid/cube.svg). Hasilnya sama dengan
logo header/sidebar: kotak membulat gradien biru + cube putih.

Setiap ukuran di-render dengan supersampling 4x lalu diturunkan pakai
LANCZOS supaya tepi tetap tajam di 16/32px. Hasil dikemas sebagai
PNG-in-ICO (didukung semua browser modern).
"""
from PIL import Image, ImageDraw
import numpy as np
import re

TOP_LEFT = (59, 130, 246)      # #3b82f6 blue-500
BOTTOM_RIGHT = (37, 99, 235)   # #2563eb blue-600
SIZES = [16, 32, 48, 64, 128, 256]

# Siluet ikon "cube" Font Awesome 6.5.0 (solid/cube.svg), path asli.
CUBE_PATH = (
    "M234.5 5.7c13.9-5 29.1-5 43.1 0l192 68.6C495 83.4 512 107.5 512 134.6"
    "V377.4c0 27-17 51.2-42.5 60.3l-192 68.6c-13.9 5-29.1 5-43.1 0l-192-68.6"
    "C17 428.6 0 404.5 0 377.4V134.6c0-27 17-51.2 42.5-60.3l192-68.6z"
    "M256 66L82.3 128 256 190l173.7-62L256 66zm32 368.6l160-57.1v-188L288 246.6v188z"
)


def rounded_rect_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255
    )
    return mask


def parse_path(d):
    """Parse path SVG (M/m/L/l/C/c/V/v/Z/z) menjadi daftar poligon (x, y)."""

    def cubic_segments(p0, p1, p2, p3, segs=16):
        out = []
        for i in range(1, segs + 1):
            t = i / segs
            mt = 1 - t
            out.append((
                mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0],
                mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1],
            ))
        return out

    token_re = re.compile(r"([MmLlCcVvZz])|(-?\d*\.?\d+)")
    cmds = []
    for tok in token_re.findall(d):
        if tok[0]:
            cmds.append((tok[0], []))
        else:
            cmds[-1][1].append(float(tok[1]))

    polys = []
    cur = [0.0, 0.0]
    start = [0.0, 0.0]
    pts = []
    for cmd, nums in cmds:
        c = cmd
        if c in "Mm":
            for k in range(0, len(nums), 2):
                x, y = nums[k], nums[k + 1]
                if c == "m":
                    x += cur[0]
                    y += cur[1]
                cur = [x, y]
                if k == 0:
                    start = list(cur)
                    pts = [(x, y)]
                    c = "l" if cmd == "m" else "L"  # pasangan berikutnya = lineto
                else:
                    pts.append((x, y))
        elif c in "Ll":
            rel = c == "l"
            for k in range(0, len(nums), 2):
                x, y = nums[k], nums[k + 1]
                if rel:
                    x += cur[0]
                    y += cur[1]
                cur = [x, y]
                pts.append((x, y))
        elif c in "Cc":
            rel = c == "c"
            for k in range(0, len(nums), 6):
                c1 = (nums[k], nums[k + 1])
                c2 = (nums[k + 2], nums[k + 3])
                end = (nums[k + 4], nums[k + 5])
                if rel:
                    c1 = (cur[0] + c1[0], cur[1] + c1[1])
                    c2 = (cur[0] + c2[0], cur[1] + c2[1])
                    end = (cur[0] + end[0], cur[1] + end[1])
                pts.extend(cubic_segments(tuple(cur), c1, c2, end))
                cur = list(end)
        elif c in "Vv":
            rel = c == "v"
            for v in nums:
                cur[1] = (cur[1] + v) if rel else v
                pts.append(tuple(cur))
        elif c in "Zz":
            if pts and pts[0] != tuple(cur):
                pts.append(pts[0])
            polys.append(pts)
            pts = []
            cur = list(start)
    if pts:
        polys.append(pts)
    return polys


def render(size, ss=4):
    """Render satu ukuran dengan supersampling ss, lalu downscale LANCZOS."""
    big = size * ss

    # 1) Gradien diagonal blue-500 → blue-600 (sepadan bg-gradient-to-br)
    yy, xx = np.mgrid[0:big, 0:big]
    t = (xx + yy) / (2 * (big - 1))
    top = np.array(TOP_LEFT, dtype=np.float64)
    bottom = np.array(BOTTOM_RIGHT, dtype=np.float64)
    rgb = top[None, None, :] * (1 - t)[..., None] + bottom[None, None, :] * t[..., None]
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    # 2) Sudut membulat (radius ~22%)
    img.putalpha(rounded_rect_mask(big, int(big * 0.22)))

    # 3) Siluet cube putih di tengah (lebar ~62% kanvas, seperti grid lama)
    polys = parse_path(CUBE_PATH)
    scale = big * 0.62 / 512.0
    offset_x = (big - 512.0 * scale) / 2
    offset_y = (big - (506.3 - 5.7) * scale) / 2
    d = ImageDraw.Draw(img)
    for poly in polys:
        d.polygon(
            [(x * scale + offset_x, y * scale + offset_y) for (x, y) in poly],
            fill=(255, 255, 255, 255),
        )

    return img.resize((size, size), Image.LANCZOS)


def write_ico(path, images_sizes):
    """Kemas daftar (size, PIL image) sebagai PNG-in-ICO (format Vista+)."""
    import io

    blobs = []
    for _, img in images_sizes:
        bio = io.BytesIO()
        img.convert("RGBA").save(bio, format="PNG")
        blobs.append(bio.getvalue())

    out = bytearray()
    out += b"\x00\x00" + b"\x01\x00" + len(images_sizes).to_bytes(2, "little")
    cur = 6 + 16 * len(images_sizes)
    for (size, _), blob in zip(images_sizes, blobs):
        w = 0 if size >= 256 else size
        h = 0 if size >= 256 else size
        out += bytes([w, h, 0, 0])
        out += (1).to_bytes(2, "little")  # planes
        out += (32).to_bytes(2, "little")  # bpp
        out += len(blob).to_bytes(4, "little")
        out += cur.to_bytes(4, "little")
        cur += len(blob)
    for blob in blobs:
        out += blob

    with open(path, "wb") as f:
        f.write(bytes(out))


def main():
    images = [(s, render(s)) for s in SIZES]
    write_ico("src/app/favicon.ico", images)
    print("favicon.ico tersimpan:", ", ".join(str(s) for s in SIZES))


if __name__ == "__main__":
    main()
