"use client";

import React from "react";

/* Hallmark · component: skeletons · genre: modern-minimal · accent: blue
 * states: default · reduced-motion (motion-reduce:animate-none)
 * responsive: 320/375/414/768 · contrast: pass
 * pre-emit critique: P4 H4 E4 S4 R5 V4
 */

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-slate-200/80 dark:bg-slate-700/40 ${className}`}
    />
  );
}

/* ==================== Halaman Aplikasi ==================== */

export function AppsPageSkeleton() {
  return (
    <div role="status" aria-label="Memuat daftar aplikasi" className="space-y-5">
      <span className="sr-only">Memuat…</span>
      {/* Baris pencarian + kontrol tampilan + tombol tambah */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Skeleton className="h-10 flex-1 min-w-[200px] rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      {/* Baris filter: Kategori | Status & Lingkungan */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-3 w-14 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-lg shrink-0" />
            <div className="flex gap-2 overflow-hidden flex-1 min-w-0">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-lg shrink-0" />
              ))}
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="hidden lg:block self-stretch w-px bg-slate-200 dark:bg-slate-700/60"></div>
        <div className="shrink-0">
          <Skeleton className="h-3 w-36 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-72 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Grid kartu aplikasi */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden"
          >
            <div className="h-0.5 bg-slate-100 dark:bg-slate-700/50" />
            <div className="p-5 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="space-y-2 min-w-0 flex-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-16 shrink-0 mt-1" />
              </div>
              <Skeleton className="h-3 w-full mt-4" />
              <Skeleton className="h-3 w-3/4 mt-2" />
              <Skeleton className="h-3 w-24 mt-4" />
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== Halaman Kategori ==================== */

export function CategoriesPageSkeleton() {
  return (
    <div role="status" aria-label="Memuat kategori" className="space-y-6">
      <span className="sr-only">Memuat…</span>
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="w-11 h-11 rounded-xl" />
              <div className="flex gap-1">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="w-7 h-7 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16 mt-1.5" />
            <div className="mt-3 space-y-1.5">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton className="w-6 h-6 rounded-md" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-32 mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== Halaman Dashboard ==================== */

export function DashboardPageSkeleton() {
  return (
    <div role="status" aria-label="Memuat dashboard" className="space-y-6 max-w-7xl mx-auto pb-12">
      <span className="sr-only">Memuat…</span>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-80" />
      </div>

      {/* Row 1: kartu ring progress */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white/80 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-5"
          >
            <div className="h-1 rounded-t-2xl bg-slate-100 dark:bg-slate-700/50" />
            <div className="flex items-center justify-around mt-4">
              <Skeleton className="w-24 h-24 rounded-full" />
              <div className="space-y-2 flex-1 ml-6">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: area chart + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64 mt-1.5" />
          <Skeleton className="h-72 w-full mt-4 rounded-xl" />
        </div>
        <div className="bg-white/80 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48 mt-1.5" />
          <Skeleton className="h-56 w-full mt-4 rounded-full" />
          <div className="flex justify-center gap-3 mt-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-1.5">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: bar kategori + aplikasi terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white/80 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-44 mt-1.5" />
          <Skeleton className="h-56 w-full mt-4 rounded-xl" />
        </div>
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6">
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: progress pengembangan */}
      <div className="bg-white/80 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64 mt-1.5" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {[0, 1, 2, 3].map((j) => (
            <div key={j}>
              <div className="flex justify-between mb-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3.5 w-8" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== Halaman Pengaturan ==================== */

export function SettingsPageSkeleton() {
  return (
    <div role="status" aria-label="Memuat pengaturan" className="space-y-6">
      <span className="sr-only">Memuat…</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      {/* Profil Admin */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1.5" />
            <div className="flex items-start gap-2">
              <Skeleton className="h-9 flex-1 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg shrink-0" />
            </div>
          </div>
          <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
          <div>
            <Skeleton className="h-3 w-28 mb-1.5" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-44 rounded-lg mt-2" />
          </div>
        </div>
      </section>

      {/* Preferensi Tampilan */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="p-6 divide-y divide-slate-100 dark:divide-slate-700">
          {[0, 1].map((i) => (
            <div key={i} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <Skeleton className="w-5 h-5" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Manajemen Data */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="p-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* Info Sistem */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2.5">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ==================== Halaman Login ==================== */

export function LoginPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Memuat halaman masuk"
      className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4"
    >
      <span className="sr-only">Memuat…</span>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Skeleton className="w-14 h-14 rounded-2xl mx-auto mb-4" />
          <Skeleton className="h-6 w-52 mx-auto" />
          <Skeleton className="h-3.5 w-40 mx-auto mt-2" />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-4">
          <div>
            <Skeleton className="h-3 w-16 mb-1.5" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1.5" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-3 w-36 mx-auto mt-4" />
      </div>
    </div>
  );
}

/* ==================== Halaman Bantuan ==================== */

export function HelpPageSkeleton() {
  return (
    <div role="status" aria-label="Memuat pusat bantuan" className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <span className="sr-only">Memuat…</span>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>

      {/* Hero */}
      <section className="px-6 py-12 text-center">
        <Skeleton className="h-8 w-80 mx-auto" />
        <Skeleton className="h-3.5 w-72 mx-auto mt-3 mb-6" />
        <div className="max-w-xl mx-auto">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </section>

      {/* Kartu kategori */}
      <section className="px-6 pb-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <Skeleton className="w-12 h-12 rounded-lg mb-4" />
              <Skeleton className="h-3.5 w-28 mb-1.5" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-6 w-72 mb-1.5" />
          <Skeleton className="h-3.5 w-56 mb-6" />
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
                  <Skeleton className="h-3.5 w-64" />
                  <Skeleton className="w-3 h-3 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl p-8 text-center">
          <Skeleton className="w-14 h-14 rounded-full mx-auto mb-4" />
          <Skeleton className="h-5 w-48 mx-auto mb-2" />
          <Skeleton className="h-3.5 w-64 mx-auto mb-6" />
          <Skeleton className="h-10 w-52 rounded-lg mx-auto" />
        </div>
      </section>
    </div>
  );
}

/* ==================== Katalog Publik ==================== */

export function CatalogPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Memuat katalog aplikasi"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-5"
    >
      <span className="sr-only">Memuat…</span>

      {/* Judul halaman */}
      <div className="mb-2">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      {/* Pencarian + jumlah hasil */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Skeleton className="h-10 w-full lg:max-w-md rounded-lg" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Chip kategori */}
      <div className="flex items-center gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg shrink-0" />
        ))}
      </div>

      {/* Select status + teknologi */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Grid kartu — struktur sama dengan PublicAppCard */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-3 w-14 shrink-0" />
              </div>
              <div className="mt-3 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <Skeleton className="mt-4 h-3 w-2/3" />
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
