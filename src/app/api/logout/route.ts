import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie, destroySession } from '@/lib/apps'
import { assertSameOrigin } from '@/lib/security'

export async function POST(request: NextRequest) {
  // Tanpa cek origin, situs lain bisa memaksa logout korban (responsnya
  // menghapus cookie sesi). Tolak permintaan lintas-situs.
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }

  try {
    await destroySession(request)
  } catch {
    // Gagal menghapus sesi di DB bukan halangan untuk logout di sisi klien.
  }
  const response = NextResponse.json({ success: true })
  clearSessionCookie(response)
  return response
}
