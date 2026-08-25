import { NextRequest, NextResponse } from 'next/server'
import { createCategory, getAllCategories, getSessionAdminId, logActivity } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { revalidateKatalog } from '@/lib/public'
import { validateCategoryName } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

export async function GET(request: NextRequest) {
  if (!(await getSessionAdminId(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const categories = await getAllCategories()
    return NextResponse.json({ categories })
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

  // Mutasi butuh peran `admin` ke atas — ditegakkan di SERVER (roles.ts).
  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  try {
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

    const category = await createCategory(parsed.value)
    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'create',
      entityType: 'category',
      entityName: category.name,
      entityId: category.id,
    })
    revalidateKatalog()
    return NextResponse.json({ category }, { status: 201 })
  } catch (e) {
    const message = (e as Error)?.message ?? ''
    if (message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: 'Nama kategori sudah digunakan' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
