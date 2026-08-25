"""Generate favicon.ico — lambang mini Provinsi Sulawesi Tenggara.

Desain sama dengan src/app/icon.png (dibuat scripts/gen_static_images.py):
perisai pentagon putih dengan empat segmen warna lambang (kuning emas atas,
emas tua kiri, hijau bawah, abu gelap kanan), proporsi mengikuti logo.svg.
Hasilnya PNG transparan berisi lambang, terbaca jelas di tab browser
terang maupun gelap.

Setiap ukuran di-render dengan supersampling 4x lalu diturunkan pakai
LANCZOS supaya tepi tetap tajam di 16/32px. Hasil dikemas sebagai
PNG-in-ICO (didukung semua browser modern).
"""
import io

from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 64, 128, 256]

# Warna lambang (lihat src/lib/branding.ts → BRAND).
YELLOW = (233, 195, 30, 255)    # #E9C31E — kuning emas atas
OLD_GOLD = (209, 181, 85, 255)  # #D1B555 — emas tua kiri
GREEN = (0, 171, 78, 255)       # #00AB4E — hijau bawah
DARK = (31, 41, 55, 255)        # #1F2937 — segmen kanan
WHITE = (255, 255, 255, 255)
OUTLINE = (17, 24, 39, 255)     # #111827

# Koordinat segmen pada viewBox 0-100 (sumber: src/lib/branding.ts).
SHIELD = [(50.2, 5.9), (95.1, 39.8), (77.9, 94.6), (22.5, 94.6), (5.4, 39.8)]
SEG_YELLOW = [(12.1, 42.5), (50.2, 13.7), (88.3, 42.5), (50.1, 55.4)]
SEG_GOLD = [(12.1, 42.5), (50.1, 55.4), (26.6, 89.1)]
SEG_GREEN = [(50.1, 55.4), (26.6, 89.1), (73.7, 89.1)]
SEG_DARK = [(88.3, 42.5), (50.1, 55.4), (73.7, 89.1)]


def scale(points, big):
    """Skala viewBox 0-100 ke kanvas `big`px dengan margin ~4%."""
    s = big * 0.92 / 100.0
    off = (big - 100.0 * s) / 2
    return [(x * s + off, y * s + off) for (x, y) in points]


def render(size, ss=4):
    """Render satu ukuran dengan supersampling ss, lalu downscale LANCZOS."""
    big = size * ss
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 1) Perisai pentagon putih + segmen warna lambang.
    d.polygon(scale(SHIELD, big), fill=WHITE)
    d.polygon(scale(SEG_YELLOW, big), fill=YELLOW)
    d.polygon(scale(SEG_GOLD, big), fill=OLD_GOLD)
    d.polygon(scale(SEG_GREEN, big), fill=GREEN)
    d.polygon(scale(SEG_DARK, big), fill=DARK)

    # 2) Garis tepi tipis mengikuti kontur perisai.
    outline_w = max(2, round(big * 0.03))
    d.line(scale(SHIELD, big) + [scale(SHIELD, big)[0]], fill=OUTLINE, width=outline_w, joint="curve")

    return img.resize((size, size), Image.LANCZOS)


def write_ico(path, images_sizes):
    """Kemas daftar (size, PIL image) sebagai PNG-in-ICO (format Vista+)."""
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
