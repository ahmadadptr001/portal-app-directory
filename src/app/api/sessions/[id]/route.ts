import { NextRequest, NextResponse } from 'next/server'
import { listActiveSessions, revokeSession } from '@/lib/admins'
import { logActivity } from '@/lib/apps'
import { requireRole } from '@/lib/roles'
import { assertSameOrigin } from '@/lib/security'

/** Cabut satu sesi aktif. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }

  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  try {
    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const sessionId = Number(id)

    const currentToken = request.cookies.get('admin_session')?.value
    const sessions = await listActiveSessions(currentToken)
    const target = sessions.find((s) => s.id === sessionId)
    if (!target) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    }

    // Mencabut sesi sendiri = keluar dari portal saat ini. Ditolak supaya
    // tidak terjadi karena salah klik; untuk itu sudah ada tombol "Keluar".
    if (target.current) {
      return NextResponse.json(
        { error: 'Ini sesi Anda saat ini — pakai tombol Keluar untuk mengakhirinya' },
        { status: 409 }
      )
    }

    await revokeSession(sessionId)

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'delete',
      entityType: 'system',
      entityName: `sesi ${target.username}`,
      entityId: sessionId,
      details: 'Sesi dicabut oleh superadmin',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
