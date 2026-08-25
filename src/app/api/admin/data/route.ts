import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logActivity } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { revalidateKatalog } from '@/lib/public'
import { buildUniqueSlug } from '@/lib/slug'
import { LIMITS, validateAppInput, validateCategoryName } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

const MAX_APPS = 2000
const MAX_CATEGORIES = 500

// Kosongkan data aplikasi, kategori, tech, dan screenshot — admin & sesi
// dipertahankan. Screenshot dihapus eksplisit (bukan mengandalkan CASCADE)
// mengikuti gaya yang sudah dipakai untuk app_tech, yang juga ber-CASCADE.
async function wipeData(): Promise<void> {
  const { error: t0 } = await supabaseAdmin
    .from('app_screenshots')
    .delete()
    .neq('app_id', 0)
  // Tabel ini baru ada setelah migrasi 07 — kegagalannya tidak boleh
  // menggagalkan reset pada database yang belum dimigrasi.
  if (t0) console.error('[admin/data] Gagal mengosongkan app_screenshots:', t0)
  const { error: t1 } = await supabaseAdmin.from('app_tech').delete().neq('app_id', 0)
  if (t1) throw t1
  const { error: t2 } = await supabaseAdmin.from('apps').delete().neq('id', 0)
  if (t2) throw t2
  const { error: t3 } = await supabaseAdmin.from('categories').delete().neq('id', 0)
  if (t3) throw t3
}

// ---------------------------------------------------------------------------
// Snapshot & restore (compensating rollback)
//
// Supabase JS tidak punya BEGIN/COMMIT, dan RPC khusus akan memecah paritas
// Supabase↔MySQL. Maka: seluruh data DI-MEMORI sebelum wipe, dan bila insert
// berikutnya gagal di tengah, data lama direstorasi persis seperti semula
// (id sengaja dipertahankan agar entity_id di activity_logs tetap menunjuk
// aplikasi yang benar).
//
// Catatan PostgreSQL: restore dengan id eksplisit TIDAK menggerakkan sequence
// — INSERT baru bisa menabrak sampai sequence menyusul. Perbaikan sekali
// jalan tersedia di migrations/*/03_fix_sequence_ids.sql (gotcha terdokumentasi
// di CLAUDE.md). Di MySQL ini bukan masalah: AUTO_INCREMENT otomatis melompat
// ke atas max(id).
// ---------------------------------------------------------------------------

interface DataSnapshot {
  categories: Record<string, unknown>[]
  apps: Record<string, unknown>[]
  tech: Record<string, unknown>[]
  screenshots: Record<string, unknown>[]
}

/** Ambil salinan seluruh data yang akan terdampak wipe/reset. */
async function snapshotData(): Promise<DataSnapshot> {
  const [cats, appsRows, techRows, shotRows] = await Promise.all([
    supabaseAdmin.from('categories').select('*'),
    supabaseAdmin.from('apps').select('*'),
    supabaseAdmin.from('app_tech').select('*'),
    supabaseAdmin.from('app_screenshots').select('*'),
  ])
  // Jika pembacaan snapshot gagal, JANGAN lanjut wipe — lebih baik operasi
  // dibatalkan sekarang daripada menghapus tanpa jaring pengaman.
  if (cats.error) throw cats.error
  if (appsRows.error) throw appsRows.error
  if (techRows.error) throw techRows.error
  // app_screenshots boleh gagal (DB belum dimigrasi 07) — cukup dicatat.
  if (shotRows.error) {
    console.error('[admin/data] Snapshot app_screenshots gagal (migrasi 07?):', shotRows.error)
  }
  return {
    categories: cats.data ?? [],
    apps: appsRows.data ?? [],
    tech: techRows.data ?? [],
    screenshots: shotRows.error ? [] : shotRows.data ?? [],
  }
}

/** Kembalikan persis isi snapshot (urutan menghormati FK: kategori → app → relasi). */
async function restoreSnapshot(snap: DataSnapshot): Promise<void> {
  await wipeData()

  if (snap.categories.length > 0) {
    const { error } = await supabaseAdmin.from('categories').insert(snap.categories)
    if (error) throw error
  }
  if (snap.apps.length > 0) {
    const { error } = await supabaseAdmin.from('apps').insert(snap.apps)
    if (error) throw error
  }
  if (snap.tech.length > 0) {
    const { error } = await supabaseAdmin.from('app_tech').insert(snap.tech)
    if (error) throw error
  }
  if (snap.screenshots.length > 0) {
    const { error } = await supabaseAdmin.from('app_screenshots').insert(snap.screenshots)
    if (error) throw error
  }
}

/**
 * Reset semua data. DESTRUKTIF — hanya superadmin (wewenang "reset data"
 * memang milik superadmin, lihat ROLE_DESCRIPTION di roles.ts).
 */
export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }

  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  try {
    // Snapshot dulu: bila wipe terganggu di tengah (koneksi putus dsb.), data
    // lama dikembalikan alih-alih meninggalkan database setengah kosong.
    const snap = await snapshotData()
    try {
      await wipeData()
    } catch (wipeErr) {
      await restoreSnapshot(snap)
      throw wipeErr
    }
    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'reset',
      entityType: 'system',
      entityName: 'semua data',
      details: 'Seluruh aplikasi, kategori, dan tech stack dikosongkan',
    })
    revalidateKatalog()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// Restore dari hasil export/backup: { apps: App[], categories: string[] }.
// Menggantikan seluruh data saat ini (wipe lalu insert) — hanya superadmin
// karena sama destruktifnya dengan reset.
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  try {
    const record = (body ?? {}) as Record<string, unknown>
    const categories: string[] = Array.isArray(record.categories) ? record.categories : []
    const appsRaw: Array<Record<string, unknown>> = Array.isArray(record.apps) ? record.apps : []

    if (appsRaw.length === 0 && categories.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data untuk diimpor' },
        { status: 400 }
      )
    }
    if (appsRaw.length > MAX_APPS || categories.length > MAX_CATEGORIES) {
      return NextResponse.json(
        { error: `Data terlalu besar: maksimal ${MAX_APPS} aplikasi dan ${MAX_CATEGORIES} kategori` },
        { status: 400 }
      )
    }

    // Validasi SELURUH data dulu (pakai validator yang sama dengan form app)
    // sebelum menghapus data lama — kalau ada yang tidak valid, database
    // tidak ikut ter-wipe (hindari data rusak sebagian).
    const apps = appsRaw.map((a) => validateAppInput(a))
    for (const parsed of apps) {
      if (!parsed.ok) {
        return NextResponse.json({ error: `Data aplikasi tidak valid: ${parsed.error}` }, { status: 400 })
      }
    }
    const categoryNames: string[] = []
    for (const rawName of categories) {
      const parsed = validateCategoryName(rawName)
      if (!parsed.ok) {
        return NextResponse.json({ error: `Data kategori tidak valid: ${parsed.error}` }, { status: 400 })
      }
      categoryNames.push(parsed.value.slice(0, LIMITS.category))
    }

    // Jaring pengaman: simpan keadaan lama SEBELUM apa pun dihapus.
    const snap = await snapshotData()

    await wipeData()

    let insertedApps = 0
    let catCount = 0
    // Slug yang sudah terpakai selama impor ini. `wipeData()` sudah
    // mengosongkan tabel apps, jadi mulai dari kosong. Tanpa slug, aplikasi
    // hasil restore tidak akan pernah muncul di katalog publik (query publik
    // menyaring slug NULL) — jadi slug WAJIB dibuat di sini juga.
    const usedSlugs: string[] = []
    try {
      // Kategori — sisipkan sesuai urutan export.
      for (const name of categoryNames) {
        const { error } = await supabaseAdmin
          .from('categories')
          .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true })
        if (error) throw error
      }

      const { data: catRows, error: catReadErr } = await supabaseAdmin
        .from('categories')
        .select('id, name')
      if (catReadErr) throw catReadErr
      const catId: Record<string, number> = {}
      for (const c of catRows ?? []) catId[c.name] = c.id
      catCount = catRows?.length ?? 0

      for (const parsed of apps) {
        if (!parsed.ok) continue // sudah dipastikan ok di atas (penjaga tipe)
        const a = parsed.value
        const catName = a.category === 'Uncategorized' ? '' : a.category
        const slug = buildUniqueSlug(a.slug || a.name, usedSlugs)
        usedSlugs.push(slug)
        const { data: row, error } = await supabaseAdmin
          .from('apps')
          .insert({
            name: a.name,
            slug,
            category_id: catName ? (catId[catName] ?? null) : null,
            status: a.status,
            env: a.env,
            url: a.url && a.url !== '#' ? a.url : null,
            owner: a.owner && a.owner !== '-' ? a.owner : null,
            version: a.version,
            progress: a.progress,
            description: a.description,
            server: a.server && a.server !== '-' ? a.server : null,
            database: a.database && a.database !== '-' ? a.database : null,
            // Berkas backup lama tidak punya field ini — `validateAppInput`
            // memberi nilai default yang aman (is_public = false).
            is_public: Boolean(a.isPublic),
            logo_url: a.logoUrl ?? null,
            go_live_date: a.goLiveDate ?? null,
            contact_name: a.contactName ?? null,
            contact_email: a.contactEmail ?? null,
            contact_phone: a.contactPhone ?? null,
          })
          .select('id')
          .single()
        if (error) throw error

        if (a.tech.length > 0) {
          const { error: techErr } = await supabaseAdmin
            .from('app_tech')
            .insert(a.tech.map((t) => ({ app_id: row.id, tech: t })))
          if (techErr) throw techErr
        }

        if (a.screenshots && a.screenshots.length > 0) {
          const { error: shotErr } = await supabaseAdmin.from('app_screenshots').insert(
            a.screenshots.map((s, i) => ({
              app_id: row.id,
              url: s.url,
              caption: s.caption,
              sort_order: i,
            }))
          )
          if (shotErr) throw shotErr
        }
        insertedApps += 1
      }
    } catch (insertErr) {
      // Insert gagal di tengah → kembalikan PERSIS keadaan sebelum impor,
      // baru laporkan. Tanpa ini database tertinggal setengah terisi.
      await restoreSnapshot(snap)
      throw insertErr
    }

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'import',
      entityType: 'system',
      entityName: 'data',
      details: `${insertedApps} aplikasi, ${catCount} kategori`,
    })
    revalidateKatalog()
    return NextResponse.json({
      success: true,
      apps: insertedApps,
      categories: catCount,
    })
  } catch (e) {
    const message = (e as Error)?.message ?? ''
    if (message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: 'Gagal impor: ada data duplikat' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
