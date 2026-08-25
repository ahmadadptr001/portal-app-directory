"use client";

/* Halaman Kesehatan Sistem — CPU, memori, database, uptime.
 *
 * Data diperbarui berkala dari /api/system. Refresh-nya bisa dimatikan:
 * setiap pengambilan mengukur CPU dengan jeda sampling, jadi polling terus
 * -menerus di tab yang ditinggalkan tidak ada gunanya.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SystemHealth } from "@/lib/system";
import { formatBytes, formatUptime } from "@/lib/system";

const REFRESH_MS = 5000;

/** Warna ambang: hijau < 60%, kuning < 85%, merah di atasnya. */
function toneFor(percent: number) {
  if (percent < 60)
    return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (percent < 85)
    return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
}

function Card({
  title,
  icon,
  children,
  hint,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
        <i className={`${icon} text-slate-400 text-sm`}></i>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
          {title}
        </h2>
        {hint && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Meter({ percent, label }: { percent: number; label?: string }) {
  const tone = toneFor(percent);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className={`text-3xl font-bold tabular-nums ${tone.text}`}>
          {percent.toFixed(1)}
          <span className="text-base font-semibold">%</span>
        </span>
        {label && (
          <span className="text-xs text-slate-500 dark:text-slate-400 text-right">{label}</span>
        )}
      </div>
      <div
        className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden"
        role="meter"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${tone.bar}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        ></div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-slate-50 dark:border-slate-700/40 last:border-0">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right break-all">
        {value}
      </span>
    </div>
  );
}

export default function SystemPage({ initial }: { initial: SystemHealth | null }) {
  const [health, setHealth] = useState<SystemHealth | null>(initial);
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Jam hanya dirender setelah mount: teks waktu berbeda antara server dan
  // klien akan memicu mismatch hidrasi (aturan CLAUDE.md:28).
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Gagal memuat (HTTP ${res.status})`);
      }
      const data = await res.json();
      setHealth(data.health);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(load, REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [auto, load]);

  if (!health) {
    return (
      <div className="space-y-6">
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          <i className="fas fa-circle-exclamation mt-0.5"></i>
          <span>{error ?? "Metrik sistem tidak tersedia."}</span>
        </div>
        <button
          onClick={load}
          className="h-10 bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 text-sm font-medium"
        >
          <i className="fas fa-rotate text-xs"></i> Coba lagi
        </button>
      </div>
    );
  }

  const { cpu, memory, db, uptime, host, load: sysLoad, node } = health;

  return (
    <div className="space-y-6">
      {/* Kendali refresh */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setAuto((v) => !v)}
          role="switch"
          aria-checked={auto}
          className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
        >
          <span
            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors ${auto ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${auto ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </span>
          Perbarui otomatis tiap {REFRESH_MS / 1000}s
        </button>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 transition-colors disabled:opacity-60"
        >
          <i className={`fas fa-rotate text-[10px] ${loading ? "fa-spin" : ""}`}></i>
          Perbarui sekarang
        </button>

        <span className="text-[11px] text-slate-400 dark:text-slate-500" suppressHydrationWarning>
          {mounted ? `Diambil ${new Date(health.takenAt).toLocaleTimeString("id-ID")}` : ""}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          <i className="fas fa-triangle-exclamation mt-0.5"></i>
          <span>Pembaruan terakhir gagal: {error}. Angka di bawah mungkin sudah lama.</span>
        </div>
      )}

      {/* Kartu utama */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="CPU" icon="fas fa-microchip" hint={`${cpu.cores} inti`}>
          <Meter
            percent={cpu.usagePercent}
            label={cpu.speedMhz ? `${(cpu.speedMhz / 1000).toFixed(1)} GHz` : undefined}
          />
          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2">
            {cpu.model}
          </p>
        </Card>

        <Card title="Memori" icon="fas fa-memory" hint={formatBytes(memory.totalBytes)}>
          <Meter
            percent={memory.usedPercent}
            label={`${formatBytes(memory.usedBytes)} terpakai`}
          />
          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
            Sisa {formatBytes(memory.freeBytes)}
          </p>
        </Card>

        <Card title="Database" icon="fas fa-database">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !db.configured
                  ? "bg-slate-400"
                  : db.reachable
                    ? "bg-emerald-500"
                    : "bg-rose-500"
              }`}
            ></span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {!db.configured
                ? "Belum dikonfigurasi"
                : db.reachable
                  ? "Terhubung"
                  : "Tidak terjangkau"}
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {db.latencyMs !== null ? `${db.latencyMs} ms` : "-"}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Latensi kueri</p>
          {db.error && (
            <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 break-all">
              {db.error}
            </p>
          )}
        </Card>

        <Card title="Uptime" icon="fas fa-clock">
          <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {formatUptime(uptime.processSeconds)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Proses portal</p>
          <p className="mt-3 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
            {formatUptime(uptime.systemSeconds)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Server</p>
        </Card>
      </div>

      {/* Per inti + detail */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pemakaian per Inti" icon="fas fa-grip" hint={`${cpu.perCore.length} inti`}>
          <div className="space-y-2.5">
            {cpu.perCore.map((p, i) => {
              const tone = toneFor(p);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 w-10 shrink-0 tabular-nums">
                    #{i + 1}
                  </span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${tone.bar}`}
                      style={{ width: `${p}%` }}
                    ></div>
                  </div>
                  <span
                    className={`text-[11px] font-medium tabular-nums w-12 text-right ${tone.text}`}
                  >
                    {p.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Detail Server" icon="fas fa-server">
          <div className="space-y-0">
            <Row label="Hostname" value={host.hostname} />
            <Row label="Platform" value={`${host.platform} ${host.release}`} />
            <Row label="Arsitektur" value={host.arch} />
            <Row label="Node.js" value={node.version} />
            <Row label="Mode" value={node.env} />
            <Row label="Memori proses (RSS)" value={formatBytes(memory.processRssBytes)} />
            <Row
              label="Heap terpakai"
              value={`${formatBytes(memory.processHeapUsedBytes)} / ${formatBytes(memory.processHeapTotalBytes)}`}
            />
            <Row
              label="Load average"
              value={
                sysLoad.available ? (
                  `${sysLoad.avg1} · ${sysLoad.avg5} · ${sysLoad.avg15}`
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">
                    Tidak tersedia di Windows
                  </span>
                )
              }
            />
          </div>
        </Card>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Angka CPU diukur dari selisih dua sampel waktu prosesor, bukan nilai sesaat —
        karena itu tiap pembaruan memakan jeda pengukuran singkat.
      </p>
    </div>
  );
}
