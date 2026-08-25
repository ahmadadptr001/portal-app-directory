import { NextRequest, NextResponse } from 'next/server'
import { deleteApp, logActivity, updateApp } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { revalidateKatalog } from '@/lib/public'
import { supabaseAdmin } from '@/lib/supabase'
import { validateAppInput } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params
  // Hanya terima angka bulat; hindari parseInt yang menerima "12abc" → 12.
  return /^\d+$/.test(id) ? Number(id) : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  // Mutasi butuh peran `admin` ke atas — ditegakkan di SERVER (roles.ts).
  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  try {
    const numericId = await parseId(params)
    if (numericId === null) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validateAppInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const app = await updateApp(numericId, parsed.value)
    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'update',
      entityType: 'app',
      entityName: app.name,
      entityId: app.id,
    })
    revalidateKatalog()
    return NextResponse.json({ app })
  } catch (e) {
    const message = (e as Error)?.message
    if (message === 'DATABASE_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'Database belum dikonfigurasi' },
        { status: 503 }
      )
    }
    if (message === 'APP_NOT_FOUND') {
      return NextResponse.json({ error: 'Aplikasi tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }

  // Mutasi butuh peran `admin` ke atas — ditegakkan di SERVER (roles.ts).
  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  try {
    const numericId = await parseId(params)
    if (numericId === null) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    // Ambil nama sebelum dihapus agar tercatat di log.
    const { data: existing } = await supabaseAdmin
      .from('apps')
      .select('name')
      .eq('id', numericId)
      .maybeSingle()

    await deleteApp(numericId)
    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'delete',
      entityType: 'app',
      entityName: existing?.name ?? `aplikasi #${numericId}`,
      entityId: numericId,
    })
    revalidateKatalog()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
