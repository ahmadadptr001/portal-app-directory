"use client";

/* Media hero: video berurutan dengan transisi silang, dirender DUA LAPIS.
 *
 * ── Kenapa dua lapis ───────────────────────────────────────────────────────
 * Yang diinginkan: satu video yang mengisi SELURUH kartu hero, tajam di dalam
 * bingkai putih dan blur di luarnya — jadi videonya terasa menerus, tidak
 * terpenjara di dalam kotak.
 *
 * Itu tidak bisa dicapai dengan satu elemen video: CSS tidak bisa membuat satu
 * elemen tajam di satu wilayah dan blur di wilayah lain. Empat bilah
 * `backdrop-blur` juga gagal — `backdrop-filter` hanya menyampel backdrop di
 * dalam kotak elemennya sendiri, sehingga blur melemah di tepi tiap bilah dan
 * meninggalkan jahitan yang paling kentara di sudut.
 *
 * Jadi: dua tumpukan video dari sumber yang SAMA.
 *   Lapis 1 (blur)  — mengisi seluruh kartu, diberi `blur-*`.
 *   Lapis 2 (tajam) — dipotong ke jendela membulat.
 * Keduanya digerakkan SATU state `index`, jadi selalu memutar video yang sama
 * dan tidak pernah tampak dua adegan berbeda di dalam dan luar bingkai.
 *
 * Agar gambarnya menerus melintasi garis bingkai, tumpukan tajam dibungkus
 * wadah ber-offset NEGATIF sebesar inset jendela — dengan begitu kotak
 * videonya sama besar dengan kartu, sehingga `object-cover` menghitung
 * pemotongan yang identik dengan lapis blur.
 *
 * Biaya: dua elemen video per sumber. URL-nya sama, jadi unduhannya dilayani
 * dari cache HTTP; yang bertambah hanya dekode. Hanya indeks aktif yang
 * diputar, sisanya `preload="none"`.
 *
 * ── Hal lain yang ditangani ────────────────────────────────────────────────
 * 1. AMAN TANPA BERKAS — bila video gagal dimuat, poster foto yang tampil.
 * 2. HIDRASI — render server & render klien pertama hanya poster; <video>
 *    dipasang setelah mount (aturan emas CLAUDE.md:27).
 * 3. prefers-reduced-motion — tidak ada video sama sekali, cukup poster.
 * 4. `muted` dipasang lewat properti DOM, bukan cuma prop JSX: React tidak
 *    selalu memasang atributnya dan browser MENOLAK autoplay video tak
 *    ter-mute — gejalanya "video tidak jalan" tanpa error di konsol.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  /** Daftar sumber video, dimainkan berurutan lalu berulang. */
  sources: string[];
  /** Gambar diam: tampil sebelum video siap, dan jadi cadangan bila gagal. */
  poster: string;
  /** Kelas posisi + radius untuk jendela TAJAM (mis. inset-y-8 inset-x-4 rounded-3xl). */
  windowClass: string;
  /** Offset NEGATIF yang membatalkan inset jendela (mis. -inset-y-8 -inset-x-4). */
  windowOffsetClass: string;
  /** Tingkat blur lapis luar. Cukup lembut supaya videonya masih terbaca. */
  blurClass?: string;
  /** Durasi transisi silang (ms). */
  fadeMs?: number;
}

export default function HeroMedia({
  sources,
  poster,
  windowClass,
  windowOffsetClass,
  blurClass = "blur-sm scale-110",
  fadeMs = 900,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  // Satu array ref per lapis; keduanya diputar bersamaan.
  const blurRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const sharpRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    if (sources.length === 0) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setEnabled(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [sources.length]);

  const allFailed = sources.length > 0 && failed.size >= sources.length;
  const showVideo = enabled && !allFailed;

  const advance = useCallback(() => {
    setIndex((current) => {
      for (let step = 1; step <= sources.length; step++) {
        const next = (current + step) % sources.length;
        if (!failed.has(next)) return next;
      }
      return current;
    });
  }, [failed, sources.length]);

  useEffect(() => {
    if (!showVideo) return;
    for (const list of [blurRefs.current, sharpRefs.current]) {
      list.forEach((v, i) => {
        if (!v) return;
        if (i === index) {
          v.muted = true;
          v.play().catch(() => {
            setFailed((prev) => new Set(prev).add(i));
          });
        } else {
          v.pause();
          try {
            v.currentTime = 0;
          } catch {
            // metadata belum siap — abaikan
          }
        }
      });
    }
  }, [showVideo, index]);

  /** Satu tumpukan media: poster sebagai dasar + video bertumpuk. */
  const stack = (refs: React.RefObject<(HTMLVideoElement | null)[]>) => (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- lapisan latar dekoratif di belakang video */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {showVideo &&
        sources.map((src, i) => (
          <video
            key={src}
            ref={(el) => {
              refs.current[i] = el;
            }}
            muted
            playsInline
            preload={i === 0 ? "auto" : "none"}
            aria-hidden="true"
            tabIndex={-1}
            onEnded={advance}
            onError={() => setFailed((prev) => new Set(prev).add(i))}
            style={{ transitionDuration: `${fadeMs}ms` }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out motion-reduce:transition-none ${
              i === index && !failed.has(i) ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src={src} />
          </video>
        ))}
    </>
  );

  return (
    <>
      {/* Lapis 1 — VIDEO yang diblur, mengisi seluruh kartu (termasuk sudut). */}
      <div aria-hidden="true" className={`absolute inset-0 ${blurClass}`}>
        {stack(blurRefs)}
      </div>

      {/* Lapis 2 — VIDEO tajam, dipotong ke jendela membulat. Wadah dalamnya
          ber-offset negatif supaya kotak videonya sama besar dengan kartu,
          jadi gambarnya menerus melintasi garis bingkai. */}
      <div className={`absolute overflow-hidden ${windowClass}`}>
        <div className={`absolute ${windowOffsetClass}`}>
          {stack(sharpRefs)}
        </div>
      </div>
    </>
  );
}
