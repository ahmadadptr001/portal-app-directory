import { NextRequest, NextResponse } from 'next/server'
import { createApp, getAllApps, getSessionAdmin, getSessionAdminId, logActivity } from '@/lib/apps'
import { validateAppInput } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

export async function GET(request: NextRequest) {
  if (!(await getSessionAdminId(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const apps = await getAllApps()
    return NextResponse.json({ apps })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

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

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    // Validasi penuh: nama, status, env, URL, progress, tech, panjang field.
    const parsed = validateAppInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const app = await createApp(parsed.value)
    await logActivity({
      adminId: admin.id,
      username: admin.username,
      action: 'create',
      entityType: 'app',
      entityName: app.name,
      entityId: app.id,
    })
    return NextResponse.json({ app }, { status: 201 })
  } catch (e) {
    const message = (e as Error)?.message
    if (message === 'DATABASE_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'Database belum dikonfigurasi' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
