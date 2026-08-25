/**
 * Unggah gambar (logo & screenshot) — DUA DRIVER, pilihan otomatis:
 *
 *   1. Supabase Storage (bucket `app-media`, public read) — dipakai bila env
 *      Supabase terisi. Bucket dibuat otomatis saat unggahan pertama.
 *   2. Disk lokal `public/uploads/apps/` — dipakai deploy MySQL/Laragon yang
 *      tidak punya layanan storage. Next.js menyajikan isi `public/` langsung,
 *      jadi URL `/uploads/apps/<nama>` bisa dimuat tanpa konfigurasi tambahan.
 *      (Asumsi single-instance yang sama dengan rate limiter: disk lokal tidak
 *       dibagi antar mesin.)
 *
 * Setiap unggahan sukses dicatat ke tabel `media_files` (migrasi 09) — buku
 * besar aset yang dipakai `gcMedia()` untuk membereskan berkas fisik ketika
 * aplikasi/gambarnya dihapus.
 *
 * Keamanan: requireRole('admin'), same-origin, whitelist mime TANPA SVG
 * (bisa membawa <script>), maks 5 MB, nama berkas asli tidak pernah
 * menyentuh path penyimpanan.
 */
import { randomBytes } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/apps'
import { MEDIA_BUCKET, registerMedia } from '@/lib/media'
import { requireRole } from '@/lib/roles'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'
import { LIMITS, VALID_IMAGE_MIME } from '@/lib/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'apps')

// Buat bucket sekali per proses. Gagal → reset promise agar permintaan
// berikutnya mencoba lagi (mis. bucket dihapus admin saat proses hidup).
let bucketPromise: Promise<void> | null = null
function ensureBucket(): Promise<void> {
  bucketPromise ??= supabaseAdmin.storage
    .createBucket(MEDIA_BUCKET, { public: true })
    .then(({ error }) => {
      if (error) {
        const msg = String(error.message ?? '').toLowerCase()
        // "already exists" = kondisi normal, bukan kegagalan.
        if (!msg.includes('exist') && !msg.includes('duplicate')) throw error
      }
    })
    .catch((e) => {
      bucketPromise = null
      throw e
    })
  return bucketPromise
}

/** Unggah sekali; bila bucket ternyata hilang, buat lalu coba SEKALI lagi. */
async function uploadWithRetry(path: string, bytes: ArrayBuffer, contentType: string) {
  const doUpload = () =>
    supabaseAdmin.storage.from(MEDIA_BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: '31536000', // aset immutable — nama path unik per unggahan
      upsert: false,
    })

  let { error } = await doUpload()
  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('not found') || msg.includes('does not exist')) {
      bucketPromise = null
      await ensureBucket()
      ;({ error } = await doUpload())
    }
  }
  return error
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  // Mengunggah aset konten = mutasi konten → peran `admin` ke atas.
  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Body bukan formulir unggahan yang valid' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Berkas tidak ditemukan (field "file")' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Berkas kosong' }, { status: 400 })
  }

  const ext = VALID_IMAGE_MIME[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: 'Jenis berkas tidak didukung. Gunakan PNG, JPG, WebP, atau GIF.' },
      { status: 415 }
    )
  }
  if (file.size > LIMITS.uploadMaxBytes) {
    return NextResponse.json(
      { error: `Ukuran maksimal ${Math.round(LIMITS.uploadMaxBytes / (1024 * 1024))} MB` },
      { status: 413 }
    )
  }

  // Nama berkas digenerate penuh — nama asli pengguna tidak pernah menjadi path.
  const fileName = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${ext}`
  const bytes = await file.arrayBuffer()

  try {
    if (isSupabaseConfigured()) {
      await ensureBucket()
      const storagePath = `apps/${fileName}`

      const error = await uploadWithRetry(storagePath, bytes, file.type)
      if (error) throw error

      const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath)
      const url = data.publicUrl

      await registerMedia({
        url,
        path: storagePath,
        driver: 'supabase',
        mime: file.type,
        sizeBytes: file.size,
        uploadedBy: gate.admin.id,
      })
      return NextResponse.json({ url }, { status: 201 })
    }

    // ---- Driver lokal (deploy MySQL/Laragon tanpa Supabase Storage) ----
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
    await writeFile(path.join(LOCAL_UPLOAD_DIR, fileName), Buffer.from(bytes))
    const url = `/uploads/apps/${fileName}`

    await registerMedia({
      url,
      path: `apps/${fileName}`,
      driver: 'local',
      mime: file.type,
      sizeBytes: file.size,
      uploadedBy: gate.admin.id,
    })
    return NextResponse.json({ url }, { status: 201 })
  } catch (e) {
    console.error('[upload] Gagal mengunggah berkas:', e)
    return NextResponse.json({ error: 'Gagal mengunggah berkas' }, { status: 500 })
  }
}
