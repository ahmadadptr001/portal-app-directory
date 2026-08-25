import { NextRequest, NextResponse } from 'next/server'
import { getLoginLogs } from '@/lib/admins'
import { requireRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Jejak login memuat username & hash IP — hanya superadmin.
  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  try {
    const sp = request.nextUrl.searchParams
    const success = sp.get('success')
    const result = await getLoginLogs({
      success: success === 'true' || success === 'false' ? success : undefined,
      search: sp.get('search') || undefined,
      limit: Number(sp.get('limit')) || undefined,
      offset: Number(sp.get('offset')) || undefined,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
