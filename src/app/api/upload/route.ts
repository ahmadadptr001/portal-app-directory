/**
 * Unggah gambar (logo & screenshot) ke Supabase Storage.
 *
 * Sebelumnya admin harus menyalin URL dari hosting lain — friksi harian yang
 * paling terasa. Kini berkas diunggah langsung (drag & drop di form) ke
 * bucket publik `app-media`.
 *
 * KEPUTUSAN DESAIN:
 *   - Bucket DIBUAT OTOMATIS saat unggahan pertama (idempoten, tanpa migrasi).
 *     Public read diperlukan agar <img> bisa memuatnya tanpa signed URL;
 *     tulis selalu lewat service-role key, jadi RLS tidak jadi masalah.
 *   - Nama berkas ASLI tidak pernah dipakai — path digenerate (timestamp +
 *     random hex) supaya bebas path traversal/karakter aneh dan tabrakan nama.
 *   - Mime di-whitelist TANPA SVG (bisa membawa <script>; lihat catatan
 *     VALID_IMAGE_MIME di validate.ts). Admin masih bisa tempel URL eksternal.
 *   - Deploy MySQL/Laragon: endpoint membalas 503 dengan pesan jelas karena
 *     Storage adalah fitur Supabase; kolom URL manual tetap berfungsi.
 */
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'
import { LIMITS, VALID_IMAGE_MIME } from '@/lib/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'app-media'

// Buat bucket sekali per proses. Gagal → reset promise agar permintaan
// berikutnya mencoba lagi (mis. bucket dihapus admin saat proses hidup).
let bucketPromise: Promise<void> | null = null
function ensureBucket(): Promise<void> {
  bucketPromise ??= supabaseAdmin.storage
    .createBucket(BUCKET, { public: true })
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
    supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
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

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Unggah berkas hanya tersedia saat portal memakai Supabase Storage. Tempel URL gambar secara manual untuk saat ini.' },
      { status: 503 }
    )
  }

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

  try {
    await ensureBucket()

    // Path digenerate penuh — nama asli pengguna tidak pernah menyentuh storage.
    const path = `apps/${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${ext}`
    const bytes = await file.arrayBuffer()

    const error = await uploadWithRetry(path, bytes, file.type)
    if (error) throw error

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl }, { status: 201 })
  } catch (e) {
    console.error('[upload] Gagal mengunggah berkas:', e)
    return NextResponse.json({ error: 'Gagal mengunggah berkas' }, { status: 500 })
  }
}
