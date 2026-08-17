import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionAdmin, logActivity } from '@/lib/apps'
import { LIMITS, validateAppInput, validateCategoryName } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

const MAX_APPS = 2000
const MAX_CATEGORIES = 500

// Kosongkan data aplikasi, kategori, dan tech — admin & sesi dipertahankan.
async function wipeData(): Promise<void> {
  const { error: t1 } = await supabaseAdmin.from('app_tech').delete().neq('app_id', 0)
  if (t1) throw t1
  const { error: t2 } = await supabaseAdmin.from('apps').delete().neq('id', 0)
  if (t2) throw t2
  const { error: t3 } = await supabaseAdmin.from('categories').delete().neq('id', 0)
  if (t3) throw t3
}

export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }

  const admin = await getSessionAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await wipeData()
    await logActivity({
      adminId: admin.id,
      username: admin.username,
      action: 'reset',
      entityType: 'system',
      entityName: 'semua data',
      details: 'Seluruh aplikasi, kategori, dan tech stack dikosongkan',
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// Restore dari hasil export/backup: { apps: App[], categories: string[] }.
// Menggantikan seluruh data saat ini (wipe lalu insert).
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  const admin = await getSessionAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    await wipeData()

    // Kategori — sisipkan sesuai urutan export.
    for (const name of categoryNames) {
      const { error } = await supabaseAdmin
        .from('categories')
        .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true })
      if (error) throw error
    }

    const { data: catRows } = await supabaseAdmin.from('categories').select('id, name')
    const catId: Record<string, number> = {}
    for (const c of catRows ?? []) catId[c.name] = c.id

    let insertedApps = 0
    for (const parsed of apps) {
      if (!parsed.ok) continue // sudah dipastikan ok di atas (penjaga tipe)
      const a = parsed.value
      const catName = a.category === 'Uncategorized' ? '' : a.category
      const { data: row, error } = await supabaseAdmin
        .from('apps')
        .insert({
          name: a.name,
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
      insertedApps += 1
    }

    await logActivity({
      adminId: admin.id,
      username: admin.username,
      action: 'import',
      entityType: 'system',
      entityName: 'data',
      details: `${insertedApps} aplikasi, ${catRows?.length ?? 0} kategori`,
    })
    return NextResponse.json({
      success: true,
      apps: insertedApps,
      categories: catRows?.length ?? 0,
    })
  } catch (e) {
    const message = (e as Error)?.message ?? ''
    if (message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: 'Gagal impor: ada data duplikat' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
