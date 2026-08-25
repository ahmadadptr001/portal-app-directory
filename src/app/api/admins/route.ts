import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdmin, listAdmins } from '@/lib/admins'
import { logActivity } from '@/lib/apps'
import { requireRole, sanitizeRole, ROLE_LABEL } from '@/lib/roles'
import { LIMITS, validateUsername } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  try {
    const admins = await listAdmins()
    return NextResponse.json({ admins })
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

  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const raw = (body ?? {}) as Record<string, unknown>

    const parsedName = validateUsername(raw.username)
    if (!parsedName.ok) {
      return NextResponse.json({ error: parsedName.error }, { status: 400 })
    }
    const username = parsedName.value

    const password = String(raw.password ?? '')
    if (password.length < LIMITS.passwordMin) {
      return NextResponse.json(
        { error: `Password minimal ${LIMITS.passwordMin} karakter` },
        { status: 400 }
      )
    }
    if (password.length > LIMITS.passwordMax) {
      return NextResponse.json(
        { error: `Password maksimal ${LIMITS.passwordMax} karakter` },
        { status: 400 }
      )
    }

    const role = sanitizeRole(raw.role)

    // Cek duplikat lebih dulu agar pesannya jelas (bukan 500 dari unique key).
    const { data: existing } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
    }

    const account = await createAdmin({
      username,
      passwordHash: bcrypt.hashSync(password, 10),
      role,
    })

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'create',
      entityType: 'system',
      entityName: `akun ${account.username}`,
      entityId: account.id,
      details: `Peran: ${ROLE_LABEL[role]}`,
    })

    return NextResponse.json({ admin: account }, { status: 201 })
  } catch (e) {
    const message = (e as Error)?.message ?? ''
    if (message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
    }
    // Kolom `role` belum ada → migrasi 08 belum dijalankan.
    if (message.toLowerCase().includes('role')) {
      return NextResponse.json(
        { error: 'Fitur peran butuh migrasi 08 dijalankan lebih dulu' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
