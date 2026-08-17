import type { NextRequest } from 'next/server'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSessionAdminId } from '@/lib/apps'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const WATCHED_TABLES = ['apps', 'app_tech', 'categories', 'activity_logs'] as const

// Server-Sent Events: aliran perubahan database (postgres_changes) menuju browser.
// Koneksi dibuat per tab admin; event hanya sinyal — klien memanggil ulang
// GET /api/apps (atau /api/categories) untuk mengambil data terbaru.
export async function GET(request: NextRequest) {
  if (!(await getSessionAdminId(request))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()
  let channel: RealtimeChannel | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // koneksi sudah ditutup
        }
      }

      channel = supabaseAdmin.channel(
        `db-changes-${Date.now()}-${Math.random().toString(36).slice(2)}`
      )
      for (const table of WATCHED_TABLES) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => send({ table, event: payload.eventType })
        )
      }
      channel.subscribe()

      // Ping berkala agar koneksi tidak diputus proxy/load balancer.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          // ignore
        }
      }, 25000)
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = null
      }
      if (channel) {
        supabaseAdmin.removeChannel(channel)
        channel = null
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
