/**
 * Pembuat slug URL untuk halaman katalog publik (/katalog/<slug>).
 *
 * Aturannya dibuat SAMA PERSIS dengan backfill SQL di
 * `migrations/{supabase,mysql}/07_add_public_catalog_fields.sql`, supaya slug
 * yang dihasilkan aplikasi dan slug yang dihasilkan migrasi tidak berbeda:
 *   huruf kecil → karakter non-alfanumerik menjadi '-' → '-' berlebih
 *   dirapikan → slug kosong menjadi 'aplikasi'.
 */

/** Panjang maksimal slug — selaras dengan kolom `apps.slug VARCHAR(220)`. */
const MAX_SLUG = 220

export function slugify(name: string): string {
  const base = String(name ?? '')
    .toLowerCase()
    // Pisahkan diakritik lalu buang, supaya "Aplikasi Peduli" dan
    // "Aplikasi Pédulì" tidak menghasilkan slug yang aneh.
    // U+0300..U+036F = blok Combining Diacritical Marks.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    // Pemotongan di atas bisa meninggalkan '-' di ujung.
    .replace(/-+$/g, '')

  return base || 'aplikasi'
}

/**
 * Slug unik: bila slug dasar sudah dipakai, bubuhkan angka pembeda
 * (`-2`, `-3`, …). `taken` biasanya berisi seluruh slug yang sudah ada
 * di database.
 *
 * Catatan: migrasi SQL memakai id aplikasi sebagai pembeda karena di sana
 * id sudah tersedia; di sini id belum ada saat slug dibuat (baris belum
 * di-INSERT), jadi dipakai angka urut. Keduanya sama-sama menghasilkan
 * slug unik — yang penting aturan slug DASAR-nya identik.
 */
export function buildUniqueSlug(name: string, taken: Iterable<string>): string {
  const base = slugify(name)
  const used = new Set(taken)
  if (!used.has(base)) return base

  // Sisakan ruang untuk imbuhan '-<n>' agar tidak melewati batas kolom.
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`
    const candidate = `${base.slice(0, MAX_SLUG - suffix.length).replace(/-+$/g, '')}${suffix}`
    if (!used.has(candidate)) return candidate
  }

  // Praktis tidak akan tercapai; jaring pengaman supaya tidak pernah
  // mengembalikan slug yang bertabrakan.
  return `${base.slice(0, MAX_SLUG - 14)}-${Date.now().toString(36)}`
}

/** True bila string tampak seperti id numerik (dipakai untuk redirect kanonis). */
export function isNumericId(value: string): boolean {
  return /^\d+$/.test(value)
}
