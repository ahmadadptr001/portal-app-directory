import { NextRequest, NextResponse } from 'next/server'

/**
 * Petunjuk UI: apakah pengunjung tampaknya sedang login sebagai admin?
 *
 * Dipakai header publik untuk menukar tombol "Masuk" menjadi "Dashboard".
 *
 * ── Tiga keputusan penting ────────────────────────────────────────────────
 *
 * 1. HANYA MEMERIKSA KEBERADAAN COOKIE, tidak memvalidasi ke database.
 *    Ini murni petunjuk tampilan, bukan keputusan otorisasi. Jadi nol query
 *    DB per kunjungan publik — penting karena endpoint ini dipanggil setiap
 *    pengunjung membuka halaman publik. Kalau ada yang memalsukan cookie, ia
 *    cuma melihat tombol "Dashboard"; begitu diklik, gate sesungguhnya
 *    (`getSessionAdmin`, validasi token ke DB) menolaknya.
 *
 * 2. TIDAK MEMBOCORKAN APA PUN. Responsnya cuma boolean — tanpa username,
 *    tanpa id, tanpa isi cookie.
 *
 * 3. Dipanggil dari klien, BUKAN dibaca sebagai cookie di Server Component.
 *    Membaca cookie di layout publik akan membuat `/` dan `/katalog/[slug]`
 *    menjadi dinamis dan membatalkan `revalidate = 300` — padahal justru
 *    cache itu yang menahan beban trafik publik. Menukar satu label tombol
 *    tidak layak dibayar dengan kehilangan seluruh cache halaman.
 */
export async function GET(request: NextRequest) {
  const hasCookie = Boolean(request.cookies.get('admin_session')?.value)

  return NextResponse.json(
    { loggedIn: hasCookie },
    // Jangan pernah di-cache: jawabannya berbeda per pengunjung.
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
