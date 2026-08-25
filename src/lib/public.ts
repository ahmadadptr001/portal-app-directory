/**
 * SATU-SATUNYA jalan baca data untuk permukaan publik (/, /katalog, ...).
 *
 * ATURAN (jangan dilanggar):
 *   1. Halaman publik TIDAK BOLEH mengimpor `getAllApps` dari '@/lib/apps'.
 *      Fungsi itu mengembalikan `App` lengkap — termasuk `server`,
 *      `database`, `env`, dan `progress` — dan data itu akan ikut terkirim
 *      ke browser sebagai payload RSC walau tidak dirender di layar.
 *   2. Kolom dipilih EKSPLISIT di bawah (`PUBLIC_COLUMNS`), bukan
 *      `select('*')`. Jadi menambah kolom sensitif baru di tabel `apps`
 *      tidak otomatis membocorkannya ke publik.
 *   3. Nilai yang keluar dari sini bertipe `PublicApp`, yang secara
 *      struktural tidak punya field internal — kebocoran gagal di `tsc`.
 *
 * Visibilitas: `apps.is_public` adalah penentu tunggal. Lihat migrasi 07.
 */
import { unstable_cache, revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import type { AppStatus, PublicApp, Screenshot } from '@/types'
import { isSupabaseConfigured } from '@/lib/apps'

/** Tag cache untuk seluruh data katalog publik. */
export const KATALOG_TAG = 'katalog'

/** Berapa lama data katalog boleh basi (detik) bila tidak ada mutasi admin. */
const KATALOG_REVALIDATE = 300

/**
 * Kolom yang boleh dibaca publik.
 *
 * SENGAJA TIDAK ADA: `server`, `database` (informasi infrastruktur),
 * `env`, `progress` (informasi internal proyek).
 */
const PUBLIC_COLUMNS = [
  'id',
  'slug',
  'name',
  'status',
  'description',
  'url',
  'owner',
  'version',
  'logo_url',
  'go_live_date',
  'contact_name',
  'contact_email',
  'contact_phone',
  'created_at',
  'updated_at',
  'categories(name)',
].join(', ')

/**
 * Normalkan sentinel menjadi `null`.
 *
 * Data lama memakai `'#'` untuk URL kosong dan `'-'` untuk owner/server/
 * database yang belum diisi (lihat `mapDbRow` di '@/lib/apps'). Di sisi
 * admin itu tidak mengganggu, tapi di halaman publik tanda hubung yatim
 * terlihat seperti bug. Semua dibersihkan di SATU tempat: di sini.
 */
export function orNull(value: unknown): string | null {
  const s = String(value ?? '').trim()
  if (!s || s === '#' || s === '-') return null
  return s
}

interface PublicRow {
  id: number
  slug: string | null
  name: string
  status: AppStatus
  description: string | null
  url: string | null
  owner: string | null
  version: string | null
  logo_url: string | null
  go_live_date: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  created_at: string | null
  updated_at: string | null
  categories?: { name: string } | null
}

/**
 * Proyeksi baris DB menjadi `PublicApp`. Satu-satunya pembuat `PublicApp`.
 * Jangan merakit objek ini manual di komponen.
 */
export function toPublicApp(
  row: PublicRow,
  tech: string[] = [],
  screenshots: Screenshot[] = []
): PublicApp {
  return {
    id: row.id,
    // Baris tanpa slug sudah disaring di query; `??` hanya penjaga tipe.
    slug: row.slug ?? String(row.id),
    name: row.name,
    category: row.categories?.name ?? 'Uncategorized',
    status: row.status,
    description: row.description ?? '',
    url: orNull(row.url),
    owner: orNull(row.owner),
    version: orNull(row.version),
    logoUrl: orNull(row.logo_url),
    goLiveDate: orNull(row.go_live_date),
    contactName: orNull(row.contact_name),
    contactEmail: orNull(row.contact_email),
    contactPhone: orNull(row.contact_phone),
    tech,
    screenshots,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

async function loadPublicApps(): Promise<PublicApp[]> {
  // Tanpa database, katalog publik tampil KOSONG — bukan diisi data contoh
  // `APP_DATA`. Menayangkan aplikasi karangan di portal resmi pemerintah
  // jauh lebih buruk daripada menampilkan keadaan "belum ada data".
  if (!isSupabaseConfigured()) return []

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('apps')
      .select(PUBLIC_COLUMNS)
      .eq('is_public', true)
      // Aplikasi tanpa slug tidak punya URL publik yang bisa dibuka,
      // jadi tidak ikut ditampilkan.
      .not('slug', 'is', null)
      .order('name', { ascending: true })

    if (error) throw error
    if (!rows || rows.length === 0) return []

    const list = rows as unknown as PublicRow[]
    const ids = new Set(list.map((r) => r.id))

    // Relasi dibaca sekali untuk semua aplikasi lalu dikelompokkan di JS —
    // pola yang sama seperti `getAllApps`, supaya panjang query tidak
    // meledak saat jumlah aplikasi besar.
    const [{ data: techRows }, { data: shotRows }] = await Promise.all([
      supabaseAdmin.from('app_tech').select('app_id, tech'),
      supabaseAdmin
        .from('app_screenshots')
        .select('app_id, url, caption, sort_order')
        .order('sort_order', { ascending: true }),
    ])

    const techMap: Record<number, string[]> = {}
    for (const t of techRows ?? []) {
      if (ids.has(t.app_id)) (techMap[t.app_id] ??= []).push(t.tech)
    }

    const shotMap: Record<number, Screenshot[]> = {}
    for (const s of shotRows ?? []) {
      if (ids.has(s.app_id)) {
        ;(shotMap[s.app_id] ??= []).push({ url: s.url, caption: s.caption ?? null })
      }
    }

    return list.map((r) => toPublicApp(r, techMap[r.id] ?? [], shotMap[r.id] ?? []))
  } catch (e) {
    console.error('[public] Gagal membaca katalog publik:', e)
    return []
  }
}

/**
 * Seluruh aplikasi yang boleh tampil publik.
 *
 * Dibungkus `unstable_cache` supaya perayap atau scraper yang menghajar
 * `/katalog` tidak menembus ke database. Cache dibatalkan seketika oleh
 * `revalidateKatalog()` yang dipanggil setiap route mutasi admin, jadi
 * suntingan tetap terlihat cepat.
 */
export const getPublicApps = unstable_cache(loadPublicApps, ['katalog-apps'], {
  tags: [KATALOG_TAG],
  revalidate: KATALOG_REVALIDATE,
})

/** Satu aplikasi publik berdasarkan slug; null bila tidak ada / tidak publik. */
export async function getPublicAppBySlug(slug: string): Promise<PublicApp | null> {
  const apps = await getPublicApps()
  return apps.find((a) => a.slug === slug) ?? null
}

/**
 * Satu aplikasi publik berdasarkan id — dipakai untuk mengalihkan URL
 * lama berbasis id ke URL slug kanonis.
 */
export async function getPublicAppById(id: number): Promise<PublicApp | null> {
  const apps = await getPublicApps()
  return apps.find((a) => a.id === id) ?? null
}

export interface PublicCategory {
  name: string
  count: number
}

/** Kategori yang punya minimal satu aplikasi publik, beserta jumlahnya. */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  const apps = await getPublicApps()
  const counts = new Map<string, number>()
  for (const a of apps) {
    counts.set(a.category, (counts.get(a.category) ?? 0) + 1)
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  )
}

/** Teknologi yang dipakai aplikasi publik (untuk chip filter katalog). */
export async function getPublicTechnologies(): Promise<string[]> {
  const apps = await getPublicApps()
  return Array.from(new Set(apps.flatMap((a) => a.tech))).sort((a, b) =>
    a.localeCompare(b)
  )
}

/**
 * Batalkan cache katalog publik.
 *
 * WAJIB dipanggil dari SETIAP route mutasi admin yang mengubah apa yang
 * tampil publik (aplikasi, kategori, teknologi, impor/reset). Tanpa ini,
 * suntingan admin baru terlihat publik setelah `KATALOG_REVALIDATE` detik.
 *
 * Argumen kedua `revalidateTag` (Next 16) menentukan berapa lama data basi
 * masih boleh disajikan sementara data segar dibangun di latar belakang.
 * Dipilih `{ expire: 0 }` — TANPA jendela basi: permintaan berikutnya
 * menunggu data segar. Konsekuensinya satu permintaan itu menanggung satu
 * pembacaan DB (~ratusan milidetik), dan itu ditukar dengan sesuatu yang
 * lebih penting di portal pemda: admin yang baru menerbitkan aplikasi
 * langsung melihatnya di katalog, bukan menduga portalnya rusak.
 * (`updateTag` yang semantiknya persis "kedaluwarsa seketika" hanya boleh
 *  dipakai di Server Action, sedangkan mutasi di proyek ini lewat Route
 *  Handler — jadi inilah padanan terdekatnya.)
 */
export function revalidateKatalog(): void {
  try {
    revalidateTag(KATALOG_TAG, { expire: 0 })
  } catch (e) {
    // Best-effort: kegagalan invalidasi cache tidak boleh menggagalkan
    // operasi utama (pola yang sama seperti `logActivity`).
    console.error('[public] Gagal membatalkan cache katalog:', e)
  }
}
