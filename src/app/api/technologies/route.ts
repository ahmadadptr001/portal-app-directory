import { NextRequest, NextResponse } from 'next/server'
import { getAllTechnologies, getSessionAdminId } from '@/lib/apps'

export async function GET(request: NextRequest) {
  if (!(await getSessionAdminId(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const technologies = await getAllTechnologies()
    return NextResponse.json({ technologies })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
