import { NextRequest, NextResponse } from 'next/server'
import { logActivity } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { deleteChangelog, updateChangelog } from '@/lib/changelogs'
import { revalidateKatalog } from '@/lib/public'
import { validateChangelogInput } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params
  return /^\d+$/.test(id) ? Number(id) : null
}

/** Perbarui satu entri riwayat versi — peran `admin` ke atas. */
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

    const parsed = validateChangelogInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    await updateChangelog(numericId, parsed.value)

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'update',
      entityType: 'changelog',
      entityName: `versi ${parsed.value.version}`,
      entityId: numericId,
    })
    revalidateKatalog()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** Hapus satu entri riwayat versi — peran `admin` ke atas. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }

  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  try {
    const numericId = await parseId(params)
    if (numericId === null) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    await deleteChangelog(numericId)

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'delete',
      entityType: 'changelog',
      entityName: `entri riwayat #${numericId}`,
      entityId: numericId,
    })
    revalidateKatalog()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
