import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { SESSION_COOKIE, getSessionAdminId, logActivity } from '@/lib/apps'
import { revokeOtherSessions } from '@/lib/admins'
import { validatePasswordChange } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  const adminId = await getSessionAdminId(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validatePasswordChange(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { currentPassword, newPassword } = parsed.value

    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('username, password_hash')
      .eq('id', adminId)
      .single()
    if (error || !admin) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
    }

    if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('admins')
      .update({
        password_hash: bcrypt.hashSync(newPassword, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId)
    if (updateError) {
      return NextResponse.json({ error: 'Gagal memperbarui password' }, { status: 500 })
    }

    // Kata sandi baru harus berarti sesi lama mati: pencuri yang sudah
    // menyimpan token (XSS, perangkat hilang) terlempar otomatis. Sesi
    // PEMINTA dipertahankan supaya ia tidak ter-log-out sendiri.
    const currentToken = request.cookies.get(SESSION_COOKIE)?.value ?? null
    try {
      await revokeOtherSessions(adminId, currentToken)
    } catch (e) {
      // Best-effort — kegagalan pencabutan tidak boleh membuat klien mengira
      // ganti sandi gagal dan mencobanya lagi dengan sandi lama.
      console.error('[profile/password] Gagal mencabut sesi lain:', e)
    }

    await logActivity({
      adminId,
      username: admin.username,
      action: 'update',
      entityType: 'system',
      entityName: 'kata sandi',
      details: 'Kata sandi diubah; sesi perangkat lain dicabut',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
