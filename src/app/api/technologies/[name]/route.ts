import { NextRequest, NextResponse } from 'next/server'
import { deleteTechnology, logActivity, updateTechnology } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { revalidateKatalog } from '@/lib/public'
import { supabaseAdmin } from '@/lib/supabase'
import { validateTechnologyName } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
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
    const { name } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validateTechnologyName((body as Record<string, unknown>)?.name)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const newName = parsed.value

    // Cegah bentrok dengan teknologi lain yang sudah pakai nama baru.
    // (daftar teknologi = nama unik di relasi app_tech)
    const { data: existing } = await supabaseAdmin
      .from('app_tech')
      .select('tech')
      .eq('tech', newName)
      .neq('tech', name)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Nama teknologi sudah digunakan' },
        { status: 409 }
      )
    }

    await updateTechnology(name, newName)
    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'update',
      entityType: 'technology',
      entityName: newName,
      details: `Ganti nama dari "${name}"`,
    })
    revalidateKatalog()
    return NextResponse.json({ success: true, name: newName })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }

  // Mutasi butuh peran `admin` ke atas — ditegakkan di SERVER (roles.ts).
  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  try {
    const { name } = await params
    await deleteTechnology(name)
    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'delete',
      entityType: 'technology',
      entityName: name,
    })
    revalidateKatalog()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
