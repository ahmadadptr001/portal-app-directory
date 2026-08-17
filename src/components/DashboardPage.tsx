"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { App } from "@/types";
import { useRealtime } from "@/hooks/useRealtime";
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface DashboardPageProps {
  apps: App[];
}

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  maintenance: "Pemeliharaan",
  inactive: "Nonaktif",
  deprecated: "Dihentikan",
};

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f8fafc",
};

function RingProgress({
  value,
  label,
  color,
  trackColor,
}: {
  value: number;
  label: string;
  color: string;
  trackColor?: string;
}) {
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90 text-slate-200 dark:text-slate-700">
        <circle
          stroke={trackColor || "currentColor"}
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="text-2xl font-bold mt-2 text-slate-800 dark:text-slate-100">{value}%</span>
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center">{label}</span>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/80 dark:bg-slate-800 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 p-6 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <i className={`${icon} text-slate-400 dark:text-slate-500`}></i> {title}
      </h3>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

// Tooltip Distribusi Progress: saat hover pada sebuah rentang persentase,
// tampilkan rentang + jumlah aplikasi di dalamnya + porsinya dari total.
function ProgressBarTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name?: string; count?: number } }>;
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const count = d.count ?? 0;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-slate-100">Rentang {d.name}</p>
      <p className="mt-1 text-slate-300">
        <span className="font-bold text-white tabular-nums">{count}</span> aplikasi
        <span className="text-slate-400"> ({pct}% dari {total})</span>
      </p>
    </div>
  );
}

export default function DashboardPage({ apps: initialApps }: DashboardPageProps) {
  // Data LIVE dari database; useRealtime membuat dashboard ikut memperbarui
  // sendiri saat aplikasi/kategori berubah (mis. admin lain menambah aplikasi).
  const [localApps, setLocalApps] = useState<App[]>(initialApps);

  const refreshFromServer = useCallback(async () => {
    try {
      const res = await fetch('/api/apps');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.apps)) setLocalApps(data.apps);
    } catch {
      // Biarkan data saat ini bila gagal.
    }
  }, []);

  // Perubahan database tampil otomatis (SSE + polling pengaman).
  useRealtime(refreshFromServer);

  useEffect(() => {
    const t = window.setTimeout(() => refreshFromServer(), 0);
    return () => window.clearTimeout(t);
  }, [refreshFromServer]);

  const totalApps = localApps.length;
  const activeApps = localApps.filter((a) => a.status === "active").length;
  const productionApps = localApps.filter((a) => a.env === "production").length;
  const maintenanceApps = localApps.filter((a) => a.status === "maintenance").length;
  const inactiveApps = localApps.filter((a) => a.status === "inactive" || a.status === "deprecated").length;
  const avgProgress = totalApps > 0 ? Math.round(localApps.reduce((s, a) => s + a.progress, 0) / totalApps) : 0;
  const activeRate = totalApps > 0 ? Math.round((activeApps / totalApps) * 100) : 0;
  const productionRate = totalApps > 0 ? Math.round((productionApps / totalApps) * 100) : 0;

  const ringCards = [
    { value: activeRate, label: "Aplikasi Aktif", color: "#22c55e", track: "#dcfce7" },
    { value: productionRate, label: "Berjalan di Produksi", color: "#6366f1", track: "#e0e7ff" },
    { value: avgProgress, label: "Rata-rata Progress", color: "#f59e0b", track: "#fef3c7" },
  ];

  const heroStats = [
    { label: "Total Aplikasi", value: String(totalApps) },
    { label: "Aktif", value: String(activeApps) },
    { label: "Produksi", value: String(productionApps) },
    { label: "Rata-rata Progress", value: `${avgProgress}%` },
  ];

  // Tren aktivitas bulanan (data contoh/statis).
  const bandData = [
    { bulan: "Jan", min: 3, rentang: 4, nilai: 5 },
    { bulan: "Feb", min: 4, rentang: 4, nilai: 6 },
    { bulan: "Mar", min: 5, rentang: 5, nilai: 8 },
    { bulan: "Apr", min: 5, rentang: 4, nilai: 7 },
    { bulan: "Mei", min: 6, rentang: 5, nilai: 9 },
    { bulan: "Jun", min: 7, rentang: 5, nilai: 10 },
    { bulan: "Jul", min: 8, rentang: 5, nilai: 11 },
    { bulan: "Agu", min: 9, rentang: 6, nilai: 12 },
  ];

  // Distribusi progress (dari data aplikasi nyata).
  const progressData = [
    { name: "0–24%", count: localApps.filter((a) => a.progress < 25).length },
    { name: "25–49%", count: localApps.filter((a) => a.progress >= 25 && a.progress < 50).length },
    { name: "50–74%", count: localApps.filter((a) => a.progress >= 50 && a.progress < 75).length },
    { name: "75–100%", count: localApps.filter((a) => a.progress >= 75).length },
  ];
  const progressBarColors = ["#f43f5e", "#f59e0b", "#10b981", "#6366f1"];

  const statusPie = [
    { name: "Aktif", value: activeApps, color: "#22c55e" },
    { name: "Pemeliharaan", value: maintenanceApps, color: "#f59e0b" },
    { name: "Nonaktif / Dihentikan", value: inactiveApps, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const categoryMap = localApps.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});
  const categoryBar = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const recentApps = [...localApps].sort((a, b) => b.id - a.id).slice(0, 5);
  const topProgressApps = [...localApps].sort((a, b) => b.progress - a.progress).slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Hero — foto Teluk Kendari (domain publik) + statistik nyata */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
        <Image
          src="/img/kendari-bridge.jpg"
          alt="Jembatan Teluk Kendari, Sulawesi Tenggara"
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1280px) 100vw, 1280px"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-slate-950/25"></div>
        <div className="relative p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Portal Direktori Aplikasi</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">Ringkasan Sistem</h1>
          <p className="mt-1 text-sm text-slate-300 max-w-xl">Metrik aplikasi yang dikelola di lingkungan Kominfo Provinsi Sulawesi Tenggara.</p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
            {heroStats.map((s) => (
              <div key={s.label} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-2.5">
                <p className="text-lg sm:text-xl font-bold text-white tabular-nums leading-tight">{s.value}</p>
                <p className="text-[11px] text-white/70 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: metrik ring (nilai nyata) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {ringCards.map((card, i) => (
          <Card key={i} className="p-5">
            <div className="flex flex-col items-center gap-3">
              <RingProgress value={card.value} label={card.label} color={card.color} trackColor={card.track} />
            </div>
          </Card>
        ))}
      </div>

      {/* Row 2: tren aktivitas + distribusi status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardTitle icon="fas fa-chart-area" title="Tren Aktivitas Aplikasi" subtitle="Gambaran tren rentang dan nilai bulanan" />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={bandData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#475569" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#475569" }} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
                  <Area type="monotone" dataKey="min" stackId="band" stroke="none" fill="transparent" legendType="none" tooltipType="none" />
                  <Area type="monotone" dataKey="rentang" name="Rentang" stackId="band" stroke="#818cf8" strokeOpacity={0.6} fill="url(#bandFill)" />
                  <Line type="monotone" dataKey="nilai" name="Aktual" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle icon="fas fa-chart-pie" title="Distribusi Status" subtitle="Komposisi status aplikasi" />
          <div className="h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value" nameKey="name" stroke="none">
                  {statusPie.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {statusPie.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></span>
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3: distribusi progress + kategori */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardTitle icon="fas fa-chart-column" title="Distribusi Progress" subtitle="Jumlah aplikasi per rentang progress" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#475569" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#475569" }} tickLine={false} />
                  <Tooltip content={<ProgressBarTooltip total={totalApps} />} cursor={{ fill: "#94a3b8", opacity: 0.12 }} />
                  <Bar dataKey="count" name="Aplikasi" radius={[6, 6, 0, 0]} barSize={44}>
                    {progressData.map((d, idx) => (
                      <Cell key={d.name} fill={progressBarColors[idx]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle icon="fas fa-tags" title="Kategori" subtitle="Distribusi aplikasi per kategori" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBar} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#94a3b8", opacity: 0.12 }} />
                <Bar dataKey="value" name="Jumlah" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 4: aplikasi terbaru + progress pengembangan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardTitle icon="fas fa-clock" title="Aplikasi Terbaru" subtitle="Lima aplikasi terakhir terdaftar" />
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentApps.map((app) => (
                <li key={app.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {app.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{app.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{app.category}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0 ml-2 ${app.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                    {STATUS_LABEL[app.status] ?? app.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card>
          <CardTitle icon="fas fa-tasks" title="Progress Pengembangan" subtitle="Aplikasi dengan progress tertinggi" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-6">
            {topProgressApps.map((app) => (
              <div key={app.id}>
                <div className="flex justify-between text-sm font-medium mb-1.5">
                  <span className="text-slate-700 dark:text-slate-200 truncate mr-3">{app.name}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">{app.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                  <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${app.progress}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
