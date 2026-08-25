# Video hero beranda publik

Letakkan **tiga** berkas video di folder ini:

```
hero-1.mp4
hero-2.mp4
hero-3.mp4
```

Ketiganya dimainkan **berurutan** di hero `/` (video 1 selesai → menyilang
halus ke video 2 → 3 → kembali ke 1). Daftar berkasnya didefinisikan di
`src/app/(publik)/page.tsx` pada konstanta `HERO_VIDEOS` — tambah/kurangi
jumlah video dengan mengedit daftar itu.

## Selama berkas belum ada

Hero **tetap tampil normal**: `HeroMedia` otomatis memakai poster
`public/img/kendari-bridge.jpg`. Tidak ada layar hitam, tidak ada error.
Jadi menambahkan video bisa dilakukan kapan saja tanpa mengubah kode.

## Spesifikasi yang disarankan

| Hal | Nilai |
|---|---|
| Format | MP4 (H.264 video + AAC audio) |
| Lebar | 1920 px (16:9) |
| Durasi | 8–15 detik per video |
| Audio | **tidak perlu** — hero selalu di-mute |
| Ukuran | usahakan < 3 MB per berkas |

Ukuran berkas penting: portal ini banyak diakses lewat data seluler. Hanya
video pertama yang di-`preload`, sisanya dimuat saat hampir dipakai.

Contoh kompresi dengan ffmpeg (buang audio sekalian):

```bash
ffmpeg -i sumber.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 28 -preset slow -movflags +faststart hero-1.mp4
```

## Catatan aksesibilitas

Pengunjung yang mengaktifkan *prefers-reduced-motion* di sistemnya **tidak**
mendapat video sama sekali — cukup poster diam. Ini disengaja.
