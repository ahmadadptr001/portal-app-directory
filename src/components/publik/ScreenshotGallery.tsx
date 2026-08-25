"use client";

/* Galeri screenshot dengan lightbox.
 *
 * Di codebase ini baru DetailDrawer yang menangani tombol Escape, dan tidak
 * ada satu pun overlay yang mengunci scroll. Overlay baru sebaiknya tidak
 * menambah utang aksesibilitas, jadi di sini: Escape menutup, panah
 * kiri/kanan berpindah gambar, scroll body dikunci selama terbuka, dan fokus
 * kembali ke thumbnail yang tadi diklik saat ditutup.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Screenshot } from '@/types';

export default function ScreenshotGallery({ screenshots }: { screenshots: Screenshot[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isOpen = openIndex !== null;

  const close = useCallback(() => {
    setOpenIndex((current) => {
      if (current !== null) triggerRefs.current[current]?.focus();
      return null;
    });
  }, []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        return (current + delta + screenshots.length) % screenshots.length;
      });
    },
    [screenshots.length]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);

    // Kunci scroll body selama lightbox terbuka, lalu pulihkan nilai
    // sebelumnya (bukan dipaksa jadi '') agar tidak menimpa gaya lain.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, close, step]);

  if (screenshots.length === 0) return null;

  const active = openIndex !== null ? screenshots[openIndex] : null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
        Tampilan Aplikasi
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {screenshots.map((s, i) => (
          <button
            key={`${s.url}-${i}`}
            type="button"
            ref={(el) => {
              triggerRefs.current[i] = el;
            }}
            onClick={() => setOpenIndex(i)}
            className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={s.caption ? `Perbesar: ${s.caption}` : `Perbesar screenshot ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL remote dari admin: host sembarang, tidak bisa didaftarkan di images.remotePatterns */}
            <img
              src={s.url}
              alt={s.caption || `Tampilan aplikasi ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
            {s.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[11px] text-white text-left line-clamp-1">
                {s.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption || 'Tampilan aplikasi'}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={close}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL remote dari admin */}
            <img
              src={active.url}
              alt={active.caption || 'Tampilan aplikasi'}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            {active.caption && (
              <p className="mt-3 text-center text-sm text-white/80">{active.caption}</p>
            )}
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Tutup"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <i className="fas fa-xmark"></i>
          </button>

          {screenshots.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Gambar sebelumnya"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Gambar berikutnya"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70 tabular-nums">
                {(openIndex ?? 0) + 1} / {screenshots.length}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
