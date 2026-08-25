/**
 * Peta tampilan status aplikasi — satu sumber untuk sisi admin DAN publik.
 *
 * Sebelumnya peta ini ditulis ulang di beberapa tempat: `AppsPage.tsx`
 * (STATUS_DOT / STATUS_LABEL / statusStyle), `DashboardPage.tsx`
 * (STATUS_LABEL), dan versi hijau/slate inline di `DetailDrawer.tsx`.
 * Menambah kartu katalog publik akan menjadikannya salinan keempat, jadi
 * semuanya dipindahkan ke sini.
 *
 * Modul ini murni data + fungsi tanpa efek samping, jadi aman diimpor
 * baik dari Server Component maupun Client Component.
 */
import type { AppStatus } from '@/types'

/** Label status dalam bahasa Indonesia (dipakai admin & publik). */
export const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  maintenance: 'Pemeliharaan',
  inactive: 'Nonaktif',
  deprecated: 'Dihentikan',
}

/** Warna titik penanda status. */
export const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  maintenance: 'bg-amber-500',
  inactive: 'bg-slate-400 dark:bg-slate-500',
  deprecated: 'bg-rose-500',
}

export interface StatusStyle {
  /** Garis/aksen padat. */
  rule: string
  /** Warna teks. */
  text: string
  /** Latar transparan untuk area fill. */
  fill: string
  /** Pil badge lengkap (latar + teks) — dipakai kartu publik & drawer. */
  pill: string
}

/**
 * Warna kartu mengikuti STATUS (bukan progres); tinggi fill di kartu admin
 * mengikuti persentase progres.
 */
export function statusStyle(status: string): StatusStyle {
  switch (status) {
    case 'active':
      return {
        rule: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
        fill: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      }
    case 'maintenance':
      return {
        rule: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        fill: 'bg-amber-500/10 dark:bg-amber-500/15',
        pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      }
    case 'deprecated':
      return {
        rule: 'bg-rose-500',
        text: 'text-rose-600 dark:text-rose-400',
        fill: 'bg-rose-500/10 dark:bg-rose-500/15',
        pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      }
    default: // inactive / status tak dikenal
      return {
        rule: 'bg-slate-400',
        text: 'text-slate-500 dark:text-slate-400',
        fill: 'bg-slate-400/10 dark:bg-slate-400/15',
        pill: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
      }
  }
}

/** Label status yang aman dipakai walau nilainya di luar daftar. */
export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

/**
 * Inisial nama aplikasi untuk kartu tanpa logo (maks. 2 huruf).
 * Dipindahkan dari `AppsPage.tsx` supaya kartu publik memakai fallback
 * yang sama persis.
 */
export function getInitials(name: string): string {
  return String(name ?? '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

/** Opsi filter status (dipakai chip filter admin & publik). */
export const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'maintenance', label: 'Pemeliharaan' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'deprecated', label: 'Dihentikan' },
] as const

/** Status yang wajar ditawarkan sebagai filter di katalog publik. */
export const PUBLIC_STATUS_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'maintenance', label: 'Pemeliharaan' },
] as const satisfies readonly { value: 'all' | AppStatus; label: string }[]
