import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '@/lib/apps'
import { validateLoginInput } from '@/lib/validate'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

// Hash dummy untuk menyamakan waktu respons antara username yang ada dan
// tidak (mengurangi risiko enumerasi akun lewat perbedaan timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10)

export async function POST(request: NextRequest) {
  // Cegah login CSRF (korban ditarik masuk ke akun penyerang) & payload raksasa.
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validateLoginInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { username, password } = parsed.value

    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, password_hash')
      .eq('username', username)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Bandingkan terhadap hash admin bila ada, atau hash dummy bila akun tidak
    // ditemukan — hasil akhirnya sama (401) tapi waktunya konsisten.
    const isValid = bcrypt.compareSync(password, data?.password_hash ?? DUMMY_HASH)
    if (!isValid) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Sesi tersimpan di tabel `sessions`; cookie hanya memuat token acak.
    const token = await createSession(data.id)
    const response = NextResponse.json({ success: true, user: { id: data.id, username: data.username } })
    setSessionCookie(response, token)

    return response
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
