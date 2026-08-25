import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '@/lib/apps'
import { recordLogin } from '@/lib/admins'
import { clientUserAgent, hashClientIp } from '@/lib/requestIdentity'
import {
  clearLoginFailures,
  loginThrottleStatus,
  recordLoginFailure,
} from '@/lib/rateLimit'
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

  // Identitas permintaan untuk jejak login & metadata sesi. IP disimpan
  // sebagai HASH, bukan mentah (UU PDP 27/2022) — lihat requestIdentity.ts.
  const ipHash = hashClientIp(request)
  const userAgent = clientUserAgent(request)

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const parsed = validateLoginInput(body)
    if (!parsed.ok) {
      await recordLogin({
        username: '(tidak valid)',
        success: false,
        reason: 'invalid_input',
        ipHash,
        userAgent,
      })
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { username, password } = parsed.value

    // Rate limit SEBELUM menyentuh database: brute force dihentikan murah,
    // dan lonjakan percobaan tetap tercatat di jejak login.
    const throttle = loginThrottleStatus(ipHash, username)
    if (throttle.blocked) {
      await recordLogin({
        username,
        success: false,
        reason: 'rate_limited',
        ipHash,
        userAgent,
      })
      return NextResponse.json(
        { error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${throttle.retryAfterSec} detik.` },
        {
          status: 429,
          headers: { 'Retry-After': String(throttle.retryAfterSec) },
        }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, password_hash')
      .eq('username', username)
      .single()

    if (error || !data) {
      // Percobaan dengan username tak dikenal TETAP dicatat — justru pola
      // inilah yang menandakan percobaan masuk paksa.
      recordLoginFailure(ipHash, username)
      await recordLogin({
        username,
        success: false,
        reason: 'user_not_found',
        ipHash,
        userAgent,
      })
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Bandingkan terhadap hash admin bila ada, atau hash dummy bila akun tidak
    // ditemukan — hasil akhirnya sama (401) tapi waktunya konsisten.
    const isValid = bcrypt.compareSync(password, data?.password_hash ?? DUMMY_HASH)
    if (!isValid) {
      recordLoginFailure(ipHash, username)
      await recordLogin({
        adminId: data.id,
        username,
        success: false,
        reason: 'wrong_password',
        ipHash,
        userAgent,
      })
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Sesi tersimpan di tabel `sessions`; cookie hanya memuat token acak.
    const token = await createSession(data.id, { userAgent, ipHash })
    clearLoginFailures(ipHash, username)
    await recordLogin({ adminId: data.id, username, success: true, ipHash, userAgent })

    const response = NextResponse.json({ success: true, user: { id: data.id, username: data.username } })
    setSessionCookie(response, token)

    return response
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
