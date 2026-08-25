import { NextRequest, NextResponse } from 'next/server'
import {
  countSuperadmins,
  deleteAdmin,
  getAdminById,
  revokeSessionsOfAdmin,
  updateAdminRole,
} from '@/lib/admins'
import { logActivity } from '@/lib/apps'
import { requireRole, sanitizeRole, ROLE_LABEL } from '@/lib/roles'
import { assertSameOrigin, isBodyTooLarge } from '@/lib/security'

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params
  return /^\d+$/.test(id) ? Number(id) : null
}

/** Ubah peran akun. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Permintaan lintas-situs ditolak' }, { status: 403 })
  }
  if (isBodyTooLarge(request)) {
    return NextResponse.json({ error: 'Ukuran body terlalu besar' }, { status: 413 })
  }

  const gate = await requireRole(request, 'superadmin')
  if (!gate.ok) return gate.response

  try {
    const id = await parseId(params)
    if (id === null) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
    }

    const target = await getAdminById(id)
    if (!target) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
    }

    const role = sanitizeRole((body as Record<string, unknown>)?.role)

    // PENJAGA 1: jangan sampai superadmin terakhir turun peran — portal akan
    // kehilangan satu-satunya akun yang bisa mengelola akun lain.
    if (target.role === 'superadmin' && role !== 'superadmin') {
      const remaining = await countSuperadmins()
      if (remaining <= 1) {
        return NextResponse.json(
          { error: 'Tidak bisa menurunkan superadmin terakhir' },
          { status: 409 }
        )
      }
    }

    // PENJAGA 2: jangan biarkan seseorang menurunkan perannya sendiri tanpa
    // sadar dan langsung terkunci dari halaman ini.
    if (target.id === gate.admin.id && role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Tidak bisa menurunkan peran akun Anda sendiri' },
        { status: 409 }
      )
    }

    await updateAdminRole(id, role)

    // Turun peran = wewenang berkurang. Sesi lama harus dicabut, kalau tidak
    // tab yang masih terbuka tetap memakai wewenang lamanya sampai kedaluwarsa.
    if (role !== target.role) {
      await revokeSessionsOfAdmin(id)
    }

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'update',
      entityType: 'system',
      entityName: `akun ${target.username}`,
      entityId: id,
      details: `Peran: ${ROLE_LABEL[target.role]} → ${ROLE_LABEL[role]}`,
    })

    return NextResponse.json({ success: true, role })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/** Hapus akun. */
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
    const id = await parseId(params)
    if (id === null) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const target = await getAdminById(id)
    if (!target) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
    }

    // PENJAGA 1: jangan hapus diri sendiri — pengguna akan langsung terlempar
    // keluar tanpa cara masuk kembali bila ia satu-satunya superadmin.
    if (target.id === gate.admin.id) {
      return NextResponse.json(
        { error: 'Tidak bisa menghapus akun Anda sendiri' },
        { status: 409 }
      )
    }

    // PENJAGA 2: jangan hapus superadmin terakhir.
    if (target.role === 'superadmin') {
      const remaining = await countSuperadmins()
      if (remaining <= 1) {
        return NextResponse.json(
          { error: 'Tidak bisa menghapus superadmin terakhir' },
          { status: 409 }
        )
      }
    }

    await deleteAdmin(id)

    await logActivity({
      adminId: gate.admin.id,
      username: gate.admin.username,
      action: 'delete',
      entityType: 'system',
      entityName: `akun ${target.username}`,
      entityId: id,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
