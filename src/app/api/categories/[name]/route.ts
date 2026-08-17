import { NextRequest, NextResponse } from 'next/server'
import { deleteCategory, getSessionAdmin, logActivity, updateCategory } from '@/lib/apps'
import { supabaseAdmin } from '@/lib/supabase'
import { validateCategoryName } from '@/lib/validate'
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

  const admin = await getSessionAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validateCategoryName((body as Record<string, unknown>)?.name)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const newName = parsed.value

    // Cegah bentrok dengan kategori lain yang sudah pakai nama baru.
    const { data: existing } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('name', newName)
      .neq('name', name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Nama kategori sudah digunakan' },
        { status: 409 }
      )
    }

    await updateCategory(name, newName)
    await logActivity({
      adminId: admin.id,
      username: admin.username,
      action: 'update',
      entityType: 'category',
      entityName: newName,
      details: `Ganti nama dari "${name}"`,
    })
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

  const admin = await getSessionAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await params
    await deleteCategory(name)
    await logActivity({
      adminId: admin.id,
      username: admin.username,
      action: 'delete',
      entityType: 'category',
      entityName: name,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
