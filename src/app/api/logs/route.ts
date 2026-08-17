import { NextRequest, NextResponse } from 'next/server'
import { getActivityLogs, getSessionAdminId } from '@/lib/apps'

export async function GET(request: NextRequest) {
  if (!(await getSessionAdminId(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sp = request.nextUrl.searchParams
    const result = await getActivityLogs({
      action: sp.get('action') || undefined,
      entityType: sp.get('entityType') || undefined,
      search: sp.get('search') || undefined,
      limit: Number(sp.get('limit')) || undefined,
      offset: Number(sp.get('offset')) || undefined,
    })
    return NextResponse.json({ logs: result.logs, total: result.total })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
