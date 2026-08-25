"""Generate aset metadata STATIS untuk src/app/:

  - src/app/icon.png            (256x256, lambang mini Sulawesi Tenggara)
  - src/app/opengraph-image.png (1200x630, kartu OG: gradasi biru + lambang
                                  + nama portal & daerah)

Kenapa statis? Renderer next/og (ImageResponse) bermasalah di environment
ini ("Input buffer contains unsupported image format" — bahkan untuk JSX
path sederhana), sehingga ikon/OG dibuat saat build-time dengan PIL.
Konvensi file statis Next.js (icon.png / opengraph-image.png) otomatis
me-render <link>/<meta> yang benar.

Desain lambang & warna bersumber dari gen_favicon.py (proporsi logo.svg).
Jalankan ulang bila desain berubah:
    python scripts/gen_static_images.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

from gen_favicon import render as render_emblem

ROOT = os.path.join(os.path.dirname(__file__), "..")
ICON_PATH = os.path.join(ROOT, "src", "app", "icon.png")
OG_PATH = os.path.join(ROOT, "src", "app", "opengraph-image.png")

OG_W, OG_H = 1200, 630

# Gradasi biru portal (sama dengan tema aksen aplikasi).
GRAD_TOP = (30, 58, 138)     # #1e3a8a blue-900
GRAD_MID = (37, 99, 235)     # #2563eb blue-600
GRAD_END = (59, 130, 246)    # #3b82f6 blue-500

INK_SOFT = (199, 210, 254)   # #c7d2fe indigo-200 (eyebrow)
WHITE = (255, 255, 255)

APP_NAME = "Portal Direktori Aplikasi"
GOV_NAME = "PEMERINTAH PROVINSI SULAWESI TENGGARA"
TAGLINE = "Kelola dan jelajahi aplikasi daerah dalam satu portal"


def load_font(size, bold=True):
    """Font sistem Windows (Segoe UI), fallback ke Arial."""
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def text_width(draw, text, font, tracking=0.0):
    """Lebar teks dengan letter-spacing tambahan (px per karakter)."""
    w = draw.textlength(text, font=font)
    return w + tracking * max(0, len(text) - 1)


def draw_tracked(draw, xy, text, font, fill, tracking=0.0):
    """Gambar teks per karakter agar letter-spacing merata."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def fit_font(draw, text, max_width, start_size, bold=True, tracking=0.0):
    """Kecilkan ukuran font sampai teks muat dalam max_width."""
    size = start_size
    while size > 12:
        font = load_font(size, bold=bold)
        if text_width(draw, text, font, tracking) <= max_width:
            return font
        size -= 2
    return load_font(12, bold=bold)


def gradient_rgb(size):
    """Gradasi diagonal 3-warna (blue-900 → blue-600 → blue-500)."""
    import numpy as np

    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    t = (xx / max(1, w - 1) + yy / max(1, h - 1)) / 2  # 0..1 diagonal
    top = np.array(GRAD_TOP, dtype=np.float64)
    mid = np.array(GRAD_MID, dtype=np.float64)
    end = np.array(GRAD_END, dtype=np.float64)
    t1 = np.clip(t * 2, 0, 1)[..., None]      # top → mid
    t2 = np.clip(t * 2 - 1, 0, 1)[..., None]  # mid → end
    rgb = top * (1 - t1) + mid * t1
    rgb = rgb * (1 - t2) + end * t2
    return Image.fromarray(np.clip(rgb, 0, 255).astype("uint8"), "RGB").convert("RGBA")


def gen_icon():
    img = render_emblem(256)
    img.save(ICON_PATH, format="PNG")
    print("icon.png tersimpan (256x256)")


def gen_og():
    ss = 2  # supersampling 2x agar teks & tepi tajam setelah downscale
    W, H = OG_W * ss, OG_H * ss
    img = gradient_rgb((W, H))
    d = ImageDraw.Draw(img)

    pad = 72 * ss
    card = 200 * ss
    card_y = (H - card) // 2

    # Kartu kaca berisi lambang (kiri)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(
        [pad, card_y, pad + card, card_y + card],
        radius=40 * ss,
        fill=(255, 255, 255, 34),
        outline=(255, 255, 255, 60),
        width=2 * ss,
    )
    img = Image.alpha_composite(img, overlay)
    d = ImageDraw.Draw(img)

    emblem = render_emblem(168 * ss)
    ex = pad + (card - emblem.width) // 2
    ey = (H - emblem.height) // 2
    img.paste(emblem, (ex, ey), emblem)
    d = ImageDraw.Draw(img)

    # Blok teks (kanan kartu lambang)
    tx = pad + card + 56 * ss
    max_w = W - tx - pad

    f_eyebrow = fit_font(d, GOV_NAME, max_w, 24 * ss, bold=True, tracking=5 * ss)
    draw_tracked(d, (tx, 196 * ss), GOV_NAME, f_eyebrow, INK_SOFT, tracking=5 * ss)

    f_title = fit_font(d, APP_NAME, max_w, 74 * ss, bold=True)
    d.text((tx, 246 * ss), APP_NAME, font=f_title, fill=WHITE)

    # Pill tagline — digambar lewat overlay agar alpha ter-composite benar
    f_tag = fit_font(d, TAGLINE, max_w - 68 * ss, 28 * ss, bold=False)
    tag_w = text_width(d, TAGLINE, f_tag)
    pill_x1, pill_y1 = tx, 386 * ss
    pill_x2, pill_y2 = tx + tag_w + 68 * ss, pill_y1 + 64 * ss
    pill_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill_overlay)
    pd.rounded_rectangle(
        [pill_x1, pill_y1, pill_x2, pill_y2],
        radius=(pill_y2 - pill_y1) // 2,
        fill=(255, 255, 255, 46),
        outline=(255, 255, 255, 90),
        width=2 * ss,
    )
    img = Image.alpha_composite(img, pill_overlay)
    d = ImageDraw.Draw(img)
    bbox = f_tag.getbbox(TAGLINE)
    tag_y = pill_y1 + ((pill_y2 - pill_y1) - (bbox[3] - bbox[1])) // 2
    d.text((pill_x1 + 34 * ss, tag_y - bbox[1]), TAGLINE, font=f_tag, fill=(255, 255, 255, 242))

    img = img.resize((OG_W, OG_H), Image.LANCZOS)
    # Flatten ke RGB — OG image sebaiknya opaque agar konsisten di semua platform.
    img = img.convert("RGB")
    img.save(OG_PATH, format="PNG")
    print(f"opengraph-image.png tersimpan ({OG_W}x{OG_H})")


if __name__ == "__main__":
    gen_icon()
    gen_og()
