/**
 * Registri & pembersihan aset gambar (tabel `media_files`, migrasi 09).
 *
 * Setiap unggahan (/api/upload) mencatat satu baris di sini. Saat aplikasi
 * dihapus atau gambarnya diganti/dihapus, `gcMedia()` memastikan BERKAS
 * FISIK di storage ikut hilang — tapi HANYA bila tidak ada aplikasi lain
 * yang masih memakai URL yang sama.
 *
 * Aturan keamanan yang tidak boleh dilanggar:
 *   - URL eksternal (driver 'external', tempelan manual admin) TIDAK PERNAH
 *     disentuh. Portal hanya boleh menghapus berkas yang ia kelola sendiri.
 *   - Kegagalan GC tidak boleh menggagalkan operasi utama (pola best-effort
 *     seperti logActivity) — berkas yatim lebih baik daripada data hilang.
 *
 * Sengaja TIDAK mengimpor dari '@/lib/apps' untuk menghindari impor
 * melingkar (apps.ts memanggil gcMedia dari sini); konfigurasi env dicek
 * lokal.
 */
import 'server-only'
import { rm } from 'fs/promises'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabase'

export const MEDIA_BUCKET = 'app-media'
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

function sbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export type MediaDriver = 'supabase' | 'local' | 'external'

/** Deteksi apakah URL adalah berkas kelolaan portal, dan di mana ia tinggal. */
export function mediaDriverOf(url: string): MediaDriver | null {
  if (!url) return null
  if (url.startsWith('/uploads/')) return 'local'
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (base && url.startsWith(`${base.replace(/\/+$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}/`)) {
    return 'supabase'
  }
  return null
}

/** Catat satu hasil unggahan ke buku besar (best-effort). */
export async function registerMedia(input: {
  url: string
  path?: string | null
  driver: MediaDriver
  mime?: string | null
  sizeBytes?: number | null
  uploadedBy?: number | null
}): Promise<void> {
  try {
    await supabaseAdmin.from('media_files').insert({
      url: input.url.slice(0, 2000),
      path: input.path ?? null,
      driver: input.driver,
      mime: input.mime ?? null,
      size_bytes: input.sizeBytes ?? null,
      uploaded_by: input.uploadedBy ?? null,
    })
  } catch (e) {
    // Kemungkinan terbanyak: migrasi 09 belum dijalankan. Unggahan tetap sah.
    console.error('[media] Gagal mencatat media_files (migrasi 09 sudah jalan?):', e)
  }
}

async function removePhysical(url: string): Promise<void> {
  const driver = mediaDriverOf(url)
  try {
    if (driver === 'supabase') {
      const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
      const filePath = url.slice(url.indexOf(marker) + marker.length)
      if (!filePath) return
      await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([decodeURIComponent(filePath)])
    } else if (driver === 'local') {
      // url selalu dimulai '/uploads/' (lihat mediaDriverOf) — normalisasi
      // dan tolak '..' sebagai jaga-jaga path traversal.
      const rel = path.normalize(url).replace(/^([/\\]|\.\.)+/, '')
      if (rel.includes('..')) return
      await rm(path.join(LOCAL_UPLOAD_DIR, rel), { force: true })
    }
  } catch (e) {
    console.error(`[media] Gagal menghapus berkas fisik (${url}):`, e)
  }
}

/**
 * Bersihkan berkas dari daftar URL yang TIDAK DIPAKAI lagi.
 *
 * Dipanggil setelah mutasi app sukses (update/delete). Referensi dicek ulang
 * ke DB — dua aplikasi boleh menunjuk URL yang sama, jadi "tidak dipakai"
 * harus diputuskan lewat query, bukan asumsi pemanggil.
 */
export async function gcMedia(candidateUrls: Array<string | null | undefined>): Promise<void> {
  const candidates = Array.from(
    new Set(
      candidateUrls
        .filter((u): u is string => Boolean(u) && mediaDriverOf(u as string) !== null)
        .map((u) => u as string)
    )
  )
  if (candidates.length === 0) return

  try {
    const referenced = new Set<string>()

    const { data: logoRows } = await supabaseAdmin
      .from('apps')
      .select('logo_url')
      .in('logo_url', candidates)
    for (const r of logoRows ?? []) {
      if (r.logo_url) referenced.add(r.logo_url)
    }

    const { data: shotRows } = await supabaseAdmin
      .from('app_screenshots')
      .select('url')
      .in('url', candidates)
    for (const r of shotRows ?? []) {
      if (r.url) referenced.add(r.url)
    }

    const unused = candidates.filter((u) => !referenced.has(u))
    for (const url of unused) {
      await removePhysical(url)
    }

    if (unused.length > 0 && sbConfigured()) {
      // Baris registri berkas yang terhapus ikut dibuang; baris 'external'
      // dan berkas yang masih direferensikan dibiarkan.
      await supabaseAdmin.from('media_files').delete().in('url', unused)
    }
  } catch (e) {
    console.error('[media] Pembersihan berkas gagal (biarkan best-effort):', e)
  }
}
