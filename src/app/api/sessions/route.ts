import { NextRequest, NextResponse } from 'next/server'
import { listActiveSessions } from '@/lib/admins'
import { requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  try {
    // Token sesi peminta dipakai HANYA untuk menandai baris "sesi ini" —
    // tokennya sendiri tidak pernah dikirim ke klien.
    const currentToken = request.cookies.get('admin_session')?.value
    const sessions = await listActiveSessions(currentToken)
    return NextResponse.json({ sessions })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
