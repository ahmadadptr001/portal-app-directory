import { NextRequest, NextResponse } from 'next/server'
import { getSystemHealth } from '@/lib/system'
import { requireRole } from '@/lib/roles'

// Metrik selalu segar — jangan pernah di-cache.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Metrik host (CPU, memori, hostname) adalah informasi infrastruktur.
  // Cukup peran `admin`; `viewer` pun tidak boleh melihatnya.
  const gate = await requireRole(request, 'admin')
  if (!gate.ok) return gate.response

  try {
    const health = await getSystemHealth()
    return NextResponse.json({ health }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
