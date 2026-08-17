'use client'

import { useEffect, useRef } from 'react'

const POLL_INTERVAL_MS = 10_000

/**
 * Mendengarkan perubahan database secara realtime lewat SSE (/api/realtime).
 *
 * - Setiap event perubahan memanggil `onChange()` (biasanya refetch data).
 * - Ada polling berkala sebagai jaring pengaman bila realtime belum diaktifkan
 *   di Supabase (tabel belum masuk publikasi `supabase_realtime`), sehingga
 *   data tetap sinkron meski SSE tidak pernah mengirim event.
 */
export function useRealtime(onChange: () => void): void {
  const onChangeRef = useRef(onChange)

  // Simpan callback terbaru (dijalankan setelah render agar aman dari lint).
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    let es: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null

    try {
      es = new EventSource('/api/realtime')
      es.addEventListener('change', () => onChangeRef.current())
      // EventSource otomatis mencoba menyambung ulang saat putus.
    } catch {
      es = null
    }

    poll = setInterval(() => onChangeRef.current(), POLL_INTERVAL_MS)

    return () => {
      if (es) es.close()
      if (poll) clearInterval(poll)
    }
  }, [])
}
