import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdminId, logActivity } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { createChangelog, getAppNameForLog, listChangelogs } from '@/lib/changelogs'
import { revalidateKatalog } from '@/lib/public'
import { validateChangelogInput } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** Daftar riwayat versi satu aplikasi (untuk form admin; viewer boleh baca). */
export async function GET(request: NextRequest) {
  if (!(await getSessionAdminId(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appIdRaw = request.nextUrl.searchParams.get('appId')
  const appId = Number(appIdRaw)
  if (!appIdRaw || !Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: 'Parameter appId wajib angka' }, { status: 400 })
  }

  try {
    const changelogs = await listChangelogs(appId)
    return NextResponse.json({ changelogs })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** Tambah entri riwayat versi — peran `admin` ke atas. */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validateChangelogInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    if (!parsed.value.appId) {
      return NextResponse.json({ error: 'Aplikasi wajib ditentukan' }, { status: 400 })
    }

    let entry
    try {
      entry = await createChangelog(parsed.value)
    } catch (e) {
      const message = (e as Error)?.message
      if (message === 'APP_NOT_FOUND') {
        return NextResponse.json({ error: 'Aplikasi tidak ditemukan' }, { status: 404 })
      }
      throw e
    }

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'create',
      entityType: 'changelog',
      entityName: `${await getAppNameForLog(entry.appId)} v${entry.version}`,
      entityId: entry.id,
    })
    revalidateKatalog()
    return NextResponse.json({ changelog: entry }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
