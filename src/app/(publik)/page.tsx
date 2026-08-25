import type { Metadata } from "next";
import Link from "next/link";
import { getPublicApps, getPublicCategories } from "@/lib/public";
import {
  AGENCY_NAME,
  APP_NAME,
  GOV_NAME,
  REGION_NAME,
  absoluteUrl,
} from "@/lib/branding";
import { getInitials } from "@/lib/appMeta";
import PublicAppCard from "@/components/publik/PublicAppCard";
import HeroMedia from "@/components/publik/HeroMedia";

/** Beranda portal publik — menggantikan redirect lama ke /dashboard. */
export const revalidate = 300;

/**
 * Video hero, dimainkan berurutan lalu berulang.
 *
 * Berkasnya ada di `public/video/`. Menambah video = taruh `hero-3.mp4` di
 * folder itu lalu tambahkan barisnya di sini; urutan daftar ini menentukan
 * urutan main. Bila sebuah berkas tidak ada, `HeroMedia` melewatinya dan
 * jatuh ke poster foto — jadi daftar ini aman diubah kapan saja.
 *
 * Spesifikasi & tips kompresi: lihat `public/video/README.md`.
 */
const HERO_VIDEOS = ["/video/hero-1.mp4", "/video/hero-2.mp4"];

/**
 * Inset jendela tajam di hero — VERTIKAL jauh lebih masuk daripada horizontal.
 * Dipakai bertiga sekaligus (jendela video, offset pembatalnya, dan garis
 * bingkai) supaya ketiganya MUSTAHIL tidak sinkron.
 */
const HERO_WINDOW =
  "inset-y-8 inset-x-4 sm:inset-y-14 sm:inset-x-6 lg:inset-y-20 lg:inset-x-8";
const HERO_WINDOW_OFFSET =
  "-inset-y-8 -inset-x-4 sm:-inset-y-14 sm:-inset-x-6 lg:-inset-y-20 lg:-inset-x-8";
const HERO_RADIUS = "rounded-[1.75rem] sm:rounded-[2.5rem] lg:rounded-[7rem]";

export const metadata: Metadata = {
  title: `${APP_NAME} | ${REGION_NAME}`,
  description: `Jelajahi daftar aplikasi milik ${GOV_NAME} — cari layanan digital berdasarkan nama, kategori, atau teknologi.`,
  alternates: { canonical: absoluteUrl("/") },
};

/**
 * Kartu statistik: blok warna pekat, angka besar.
 *
 * Sebelumnya kartu putih dengan "pil" bulat melayang di tepi atas — bentuk
 * yang diambil dari situs acuan tapi terbaca lemah dan generik. Diganti blok
 * warna penuh: kontrasnya tinggi, empat angka langsung terbaca sebagai empat
 * hal berbeda, dan tidak ada elemen mengambang.
 */
function StatTile({
  href,
  label,
  value,
  icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  icon: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-xl p-5 text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${tone}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
          {label}
        </span>
        <i className={`${icon} text-white/50 text-sm`}></i>
      </div>
      <div className="mt-3 text-4xl sm:text-5xl font-bold tabular-nums leading-none tracking-tight">
        {value}
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/80 group-hover:text-white transition-colors">
        Lihat
        <i className="fas fa-arrow-right text-[9px] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"></i>
      </span>
    </Link>
  );
}

/**
 * Satu poin "tentang portal": ikon di blok warna persegi + garis aksen.
 * Ikon dipakai (bukan gambar) karena empat gambar lagi di halaman ini tidak
 * menambah informasi apa pun, sedangkan ikon menerangkan isinya.
 */
function AboutPoint({
  icon,
  title,
  children,
  accent,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="group border-t-2 border-slate-200 dark:border-slate-700 pt-4 transition-colors hover:border-slate-900 dark:hover:border-slate-100 motion-reduce:transition-none">
      <div
        className={`w-9 h-9 flex items-center justify-center text-white ${accent}`}
      >
        <i className={`${icon} text-sm`}></i>
      </div>
      <h3 className="mt-3.5 text-sm font-bold text-slate-900 dark:text-slate-50">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        {children}
      </p>
    </div>
  );
}

export default async function BerandaPage() {
  const [apps, categories] = await Promise.all([
    getPublicApps(),
    getPublicCategories(),
  ]);

  const aktif = apps.filter((a) => a.status === "active").length;
  const unitKerja = new Set(apps.map((a) => a.owner).filter(Boolean)).size;

  // Aplikasi terbaru = yang paling belakangan dibuat. `createdAt` bisa null
  // pada data lama, jadi yang null diletakkan paling akhir.
  const terbaru = [...apps]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 6);

  // Sorotan untuk kartu teaser di hero.
  const sorotan = terbaru[0] ?? null;

  return (
    <>
      {/* ================= HERO =================
          Struktur mengikuti referensi: kartu ber-radius besar yang MENJOROK
          dari tepi halaman (bukan full-bleed), garis bingkai putih di dalamnya
          — tajam di dalam bingkai, blur di luarnya — dan teks duduk di atas
          panel transparan.

          Medianya VIDEO berurutan dengan transisi silang; lihat HeroMedia.
          Foto hanya poster/cadangan bila video gagal dimuat. */}
      <section className="px-3 sm:px-5 lg:px-8 pt-4 sm:pt-6">
        <div className="relative isolate overflow-hidden rounded-3xl sm:rounded-[2rem] min-h-[32rem] lg:min-h-[76svh] flex">
          {/* Media: VIDEO yang sama dirender dua lapis oleh HeroMedia —
              blur mengisi seluruh kartu (termasuk sudut), tajam di dalam
              jendela membulat. Videonya menerus melintasi garis bingkai,
              tidak terpenjara di dalam kotak. */}
          <HeroMedia
            sources={HERO_VIDEOS}
            poster="/img/kendari-bridge.jpg"
            windowClass={`${HERO_WINDOW} ${HERO_RADIUS}`}
            windowOffsetClass={HERO_WINDOW_OFFSET}
          />

          {/* Lapis warna di atas keduanya — menjaga kontras teks tanpa
              menggelapkan berlebihan (versi lama slate-950/90 membuat video
              tidak terlihat sama sekali). */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-blue-950/20 mix-blend-multiply"
          ></div>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/40 to-slate-950/5"
          ></div>

          {/* Garis bingkai — persis di batas area tajam. Inset-nya HARUS sama
              dengan wadah video di atas. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-8 inset-x-4 sm:inset-y-14 sm:inset-x-6 lg:inset-y-20 lg:inset-x-8 rounded-[1.75rem] sm:rounded-[2.5rem] lg:rounded-[7rem] border-2 border-white pointer-events-none"
          ></div>

          {/* Padding isi harus lebih besar dari inset bingkai (y 8/14/20,
              x 4/6/8) supaya teks lega di dalam garis, bukan menempel. */}
          <div className="relative w-full flex flex-col justify-center px-10 py-16 sm:px-14 sm:py-24 lg:px-20 lg:py-32">
            <h1 className="text-[2.1rem] sm:text-5xl lg:text-6xl font-bold text-white max-w-3xl leading-[1.02] tracking-tight">
              Semua aplikasi daerah,
              <br />
              dalam satu direktori.
            </h1>

            {/* Panel pembawa teks & aksi: gradasi putih transparan kiri→kanan,
                tanpa garis tepi, jadi menyatu dengan media.

                Kadar putihnya diturunkan dari 50% ke 15%. Pada 50% di atas
                latar yang kini lebih terang, panel tampak sebagai bercak abu
                dan teks putih di atasnya jatuh di bawah ambang WCAG AA —
                sebelumnya ditambal `text-shadow`, tambalan itu kini tidak
                perlu lagi. Pada 15% ia terbaca sebagai kilau tipis dan teks
                putih tetap kontras. */}
            <div className="mt-7 max-w-xl rounded-2xl bg-gradient-to-r from-white/15 to-transparent backdrop-blur-md p-6 sm:p-7">
              <p className="text-sm sm:text-base text-slate-100 leading-relaxed">
                {apps.length > 0 ? (
                  <>
                    <span className="font-semibold text-white tabular-nums">
                      {apps.length} aplikasi
                    </span>{" "}
                    milik {REGION_NAME} — lengkap dengan unit kerja pengelola,
                    teknologi yang dipakai, dan tautan langsung untuk
                    membukanya. Tanpa perlu akun.
                  </>
                ) : (
                  <>
                    Direktori aplikasi milik {REGION_NAME} — lengkap dengan unit
                    kerja pengelola, teknologi yang dipakai, dan tautan langsung
                    untuk membukanya. Tanpa perlu akun.
                  </>
                )}
              </p>

              {/* Pencarian sungguhan, bukan tombol hiasan: <form> GET biasa,
                  jadi tetap bekerja tanpa JavaScript dan hasilnya URL yang
                  bisa dibagikan (/katalog?q=…). */}
              <form action="/katalog" method="get" className="mt-5 flex gap-2">
                <label htmlFor="hero-q" className="sr-only">
                  Cari aplikasi
                </label>
                <input
                  id="hero-q"
                  name="q"
                  type="search"
                  placeholder="Cari nama aplikasi atau unit kerja…"
                  className="flex-1 min-w-0 h-12 rounded-lg bg-white/95 border border-transparent px-4 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
                />
                <button
                  type="submit"
                  className="h-12 shrink-0 inline-flex items-center gap-2 bg-blue-600 text-white px-5 rounded-lg hover:bg-blue-700 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-blue-300 transition-colors"
                >
                  <i className="fas fa-magnifying-glass text-xs"></i>
                  Cari
                </button>
              </form>
            </div>

            {/* Kartu teaser kiri-bawah — padanan kartu kecil di referensi,
                tapi isinya berguna: aplikasi terbaru yang masuk direktori. */}
            {sorotan && (
              <Link
                href={`/katalog/${sorotan.slug}`}
                className="mt-9 inline-flex items-center gap-3 max-w-sm rounded-2xl bg-white/95 dark:bg-slate-900/95 p-2.5 pr-4 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-white transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                <span className="w-14 h-11 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-300">
                  {sorotan.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL remote dari admin: host sembarang
                    <img
                      src={sorotan.logoUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    getInitials(sorotan.name)
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Terbaru
                  </span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                    {sorotan.name}
                  </span>
                </span>
                <i className="fas fa-arrow-right text-[11px] text-slate-400 ml-auto shrink-0"></i>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ================= KARTU STATISTIK =================
            Angkanya dihitung dari data publik yang sebenarnya, bukan angka
            hiasan; tiap kartu menautkan ke katalog yang sesuai. */}
        <section aria-label="Ringkasan direktori" className="pt-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatTile
              href="/katalog"
              label="Aplikasi"
              value={apps.length}
              icon="fas fa-boxes"
              tone="bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
            />
            <StatTile
              href="/katalog?status=active"
              label="Aktif"
              value={aktif}
              icon="fas fa-circle-check"
              tone="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
            />
            <StatTile
              href="/katalog"
              label="Kategori"
              value={categories.length}
              icon="fas fa-tags"
              tone="bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
            />
            <StatTile
              href="/katalog"
              label="Unit Kerja"
              value={unitKerja}
              icon="fas fa-building"
              tone="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
            />
          </div>
        </section>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-14">
        {/* ================= TENTANG PORTAL =================
            Padanan blok "sambutan" di situs acuan, tapi kolom gambarnya
            diganti tiga poin berikon: gambar keempat di halaman ini tidak
            menambah informasi, sedangkan ikon menjelaskan isi portal. */}
        <section className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200/70 dark:border-slate-700/60 rounded-2xl p-6 sm:p-8">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            <div className="lg:col-span-2">
              <p className="text-[10px]/[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Tentang Portal
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
                Transparansi layanan digital daerah
              </h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 font-light text-justify leading-relaxed">
                {APP_NAME} adalah direktori resmi aplikasi yang dikelola{" "}
                {GOV_NAME}. Portal ini menyajikan informasi aplikasi daerah
                dalam satu tempat, sehingga warga, perangkat daerah, maupun
                mitra pembangunan tahu layanan digital apa saja yang tersedia
                dan kepada siapa harus bertanya.
              </p>
              <Link
                href="/katalog"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mulai jelajahi katalog
                <i className="fas fa-arrow-right text-[10px]"></i>
              </Link>
            </div>

            <div className="lg:col-span-3 grid sm:grid-cols-2 gap-6 lg:gap-7">
              <AboutPoint
                icon="fas fa-unlock-keyhole"
                title="Terbuka tanpa akun"
                accent="bg-blue-600"
              >
                Seluruh katalog bisa dijelajahi, dicari, dan dibagikan tanpa
                login. Akun hanya diperlukan untuk mengelola data.
              </AboutPoint>
              <AboutPoint
                icon="fas fa-building-columns"
                title="Jelas pemiliknya"
                accent="bg-emerald-600"
              >
                Setiap aplikasi mencantumkan unit kerja pengelola dan kontak,
                jadi pertanyaan tidak perlu berputar antar OPD.
              </AboutPoint>
              <AboutPoint
                icon="fas fa-rotate"
                title="Dikelola langsung"
                accent="bg-amber-600"
              >
                Data diperbarui oleh {AGENCY_NAME} sebagai pengelola, dan
                perubahannya langsung tampil di katalog.
              </AboutPoint>
              <AboutPoint
                icon="fas fa-eye-slash"
                title="Hanya yang layak publik"
                accent="bg-rose-600"
              >
                Aplikasi internal dan yang masih dikembangkan tidak ditampilkan
                di sini — hanya yang memang untuk umum.
              </AboutPoint>
            </div>
          </div>
        </section>

        {/* ================= KATEGORI ================= */}
        {categories.length > 0 && (
          <section>
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Telusuri per Kategori
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Pilih bidang layanan untuk mempersempit pencarian.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Link
                  key={c.name}
                  href={`/katalog?kategori=${encodeURIComponent(c.name)}`}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {c.name}
                  <span className="tabular-nums text-slate-400 dark:text-slate-500">
                    {c.count}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ================= APLIKASI TERBARU ================= */}
        <section>
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Aplikasi Terbaru
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Yang paling baru ditambahkan ke direktori.
              </p>
            </div>
            <Link
              href="/katalog"
              className="shrink-0 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
            >
              Lihat semua
              <i className="fas fa-arrow-right text-[10px]"></i>
            </Link>
          </div>

          {terbaru.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-14 px-6 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <i className="fas fa-box-open text-sm"></i>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Belum ada aplikasi yang dipublikasikan
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Katalog akan terisi begitu pengelola menerbitkan aplikasi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {terbaru.map((app) => (
                <PublicAppCard key={app.id} app={app} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
