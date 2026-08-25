import { NextRequest, NextResponse } from 'next/server'
import { getSessionAdminId } from '@/lib/apps'
import { sanitizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase'
import { validateUsername } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    const adminId = await getSessionAdminId(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Kolom `role` ada sejak migrasi 08. Dulu nilainya DI-HARDCODE
    // 'Administrator' di sini — semua akun (termasuk viewer) tampil sebagai
    // administrator. Sekarang peran asli dibaca dari DB.
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, role, created_at')
      .eq('id', adminId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      username: data.username,
      role: sanitizeRole((data as { role?: unknown }).role),
      createdAt: data.created_at
    })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  try {
    const adminId = await getSessionAdminId(request)
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validateUsername((body as Record<string, unknown>)?.username)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const username = parsed.value

    const { data: existing, error: checkError } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('username', username)
      .neq('id', adminId)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: 'Gagal memeriksa username' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
    }

    const { error } = await supabaseAdmin
      .from('admins')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', adminId)

    if (error) {
      return NextResponse.json({ error: 'Gagal memperbarui profil' }, { status: 500 })
    }

    return NextResponse.json({ success: true, username })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
