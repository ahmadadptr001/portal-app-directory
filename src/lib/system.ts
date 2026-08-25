/**
 * Metrik kesehatan sistem: CPU, memori, proses Node, dan latensi database.
 *
 * Server-only (memakai modul `os`/`process`) — jangan pernah diimpor dari
 * Client Component.
 *
 * ── Cara CPU dihitung ──────────────────────────────────────────────────────
 * `os.cpus()` memberi akumulator waktu SEJAK BOOT, bukan persentase. Satu
 * kali baca tidak berarti apa-apa. Jadi dibaca DUA KALI dengan jeda pendek,
 * lalu selisihnya dibagi total — itulah pemakaian sebenarnya selama jeda.
 *
 * `os.loadavg()` sengaja tidak dipakai sebagai ukuran utama: di Windows ia
 * selalu mengembalikan [0, 0, 0]. Nilainya tetap disertakan untuk Linux,
 * tapi ditandai `available` agar UI tidak menampilkan nol yang menyesatkan.
 */
import os from 'os'
import { supabaseAdmin } from '@/lib/supabase'

// Sengaja TIDAK mengimpor `isSupabaseConfigured` dari '@/lib/apps': modul itu
// kini menyeret dependensi Node (fs via media.ts), sedangkan fungsi murni di
// berkas ini (formatBytes/formatUptime) dipakai Client Component (SystemPage).
function sbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export interface CpuInfo {
  model: string
  cores: number
  /** Pemakaian keseluruhan 0–100 selama jendela sampling. */
  usagePercent: number
  /** Pemakaian per inti 0–100. */
  perCore: number[]
  speedMhz: number
}

export interface MemoryInfo {
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usedPercent: number
  /** Memori yang dipakai proses Node ini sendiri. */
  processRssBytes: number
  processHeapUsedBytes: number
  processHeapTotalBytes: number
}

export interface LoadInfo {
  available: boolean
  avg1: number
  avg5: number
  avg15: number
}

export interface DbHealth {
  configured: boolean
  reachable: boolean
  latencyMs: number | null
  error: string | null
}

export interface SystemHealth {
  takenAt: string
  host: { platform: string; release: string; arch: string; hostname: string }
  uptime: { systemSeconds: number; processSeconds: number }
  cpu: CpuInfo
  memory: MemoryInfo
  load: LoadInfo
  db: DbHealth
  node: { version: string; env: string }
}

function cpuSnapshot() {
  return os.cpus().map((c) => {
    const times = c.times
    const idle = times.idle
    const total = times.user + times.nice + times.sys + times.irq + times.idle
    return { idle, total }
  })
}

/**
 * Pemakaian CPU selama `sampleMs`.
 *
 * Jeda dijaga pendek (default 120 ms): cukup untuk mendapat selisih yang
 * bermakna, tapi tidak membuat permintaan API terasa lambat. Halaman
 * kesehatan me-refresh berkala, jadi tren tetap terlihat.
 */
async function measureCpu(sampleMs = 120): Promise<CpuInfo> {
  const before = cpuSnapshot()
  await new Promise((r) => setTimeout(r, sampleMs))
  const after = cpuSnapshot()

  const perCore = before.map((b, i) => {
    const a = after[i] ?? b
    const dTotal = a.total - b.total
    const dIdle = a.idle - b.idle
    if (dTotal <= 0) return 0
    const used = (1 - dIdle / dTotal) * 100
    return Math.max(0, Math.min(100, Math.round(used * 10) / 10))
  })

  const usagePercent =
    perCore.length === 0
      ? 0
      : Math.round((perCore.reduce((s, v) => s + v, 0) / perCore.length) * 10) / 10

  const first = os.cpus()[0]
  return {
    model: first?.model?.trim() ?? 'Tidak diketahui',
    cores: os.cpus().length,
    usagePercent,
    perCore,
    speedMhz: first?.speed ?? 0,
  }
}

function readMemory(): MemoryInfo {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  const mu = process.memoryUsage()
  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usedPercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
    processRssBytes: mu.rss,
    processHeapUsedBytes: mu.heapUsed,
    processHeapTotalBytes: mu.heapTotal,
  }
}

function readLoad(): LoadInfo {
  const [a1, a5, a15] = os.loadavg()
  // Windows selalu memberi 0,0,0 — tandai tidak tersedia agar UI tidak
  // menampilkan angka nol yang seolah-olah berarti "beban nol".
  const available = !(a1 === 0 && a5 === 0 && a15 === 0) || os.platform() !== 'win32'
  return {
    available: os.platform() !== 'win32' && available,
    avg1: Math.round(a1 * 100) / 100,
    avg5: Math.round(a5 * 100) / 100,
    avg15: Math.round(a15 * 100) / 100,
  }
}

/** Ping database dengan query paling murah + ukur latensinya. */
async function checkDb(): Promise<DbHealth> {
  if (!sbConfigured()) {
    return { configured: false, reachable: false, latencyMs: null, error: 'Belum dikonfigurasi' }
  }
  const started = Date.now()
  try {
    // COUNT head-only: tidak menarik satu baris pun.
    const { error } = await supabaseAdmin
      .from('apps')
      .select('*', { count: 'exact', head: true })
    const latencyMs = Date.now() - started
    if (error) throw error
    return { configured: true, reachable: true, latencyMs, error: null }
  } catch (e) {
    return {
      configured: true,
      reachable: false,
      latencyMs: Date.now() - started,
      error: (e as Error)?.message?.slice(0, 200) ?? 'Gagal terhubung',
    }
  }
}

export async function getSystemHealth(): Promise<SystemHealth> {
  // CPU & DB diukur bersamaan supaya jeda sampling CPU tidak menambah
  // waktu tunggu di atas latensi database.
  const [cpu, db] = await Promise.all([measureCpu(), checkDb()])

  return {
    takenAt: new Date().toISOString(),
    host: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    uptime: {
      systemSeconds: Math.round(os.uptime()),
      processSeconds: Math.round(process.uptime()),
    },
    cpu,
    memory: readMemory(),
    load: readLoad(),
    db,
    node: { version: process.version, env: process.env.NODE_ENV ?? 'unknown' },
  }
}

/** Format byte menjadi satuan yang mudah dibaca (dipakai server & klien). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`
}

/** Format durasi detik menjadi "3h 12j 5m" ala Indonesia. */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}h`)
  if (h > 0) parts.push(`${h}j`)
  parts.push(`${m}m`)
  return parts.join(' ')
}
