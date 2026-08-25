import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from '@/components/ClientLayout';
import { plusJakartaSans } from './fonts';
import { getAppCount } from '@/lib/apps';
import { APP_NAME, GOV_NAME, REGION_NAME, SITE_URL } from '@/lib/branding';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${APP_NAME} | ${REGION_NAME}`,
  description:
    `${APP_NAME} ${GOV_NAME} — jelajahi dan kelola daftar aplikasi daerah dengan mudah.`,
  openGraph: {
    title: `${APP_NAME} | ${REGION_NAME}`,
    description: `Jelajahi daftar aplikasi ${GOV_NAME}.`,
    type: "website",
    locale: "id_ID",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Hanya JUMLAH aplikasi yang dibutuhkan (badge sidebar), bukan seluruh
  // barisnya. Dulu di sini `getAllApps()` — satu pembacaan tabel penuh plus
  // SELURUH relasi tech pada SETIAP request. Sejak beranda & katalog terbuka
  // untuk publik, itu akan berjalan untuk setiap pengunjung.
  const appCount = await getAppCount();
  return (
    // suppressHydrationWarning pada <html>/<body>: React tidak mengklaim penuh
    // atribut kedua elemen ini, sehingga mutasi dari luar (inline script tema di
    // bawah, atau ekstensi browser yang menambah class/style sebelum hidrasi)
    // tidak memicu error hidrasi.
    <html lang="id" suppressHydrationWarning className={`h-full antialiased ${plusJakartaSans.variable}`}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
        {/* Inisialisasi tema SEBELUM paint (anti-FOUC): baca preferensi dari
            localStorage dan set class `dark` di <html> sebelum React hidrasi.
            Hanya menyentuh elemen <html> (bukan konten React), jadi aman. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('app_dark_mode')==='true'){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans text-slate-800 dark:text-slate-200" style={{ fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif" }}>
        <ClientLayout appCount={appCount} appEnv={process.env.NODE_ENV}>{children}</ClientLayout>
        {/* Mount point resmi untuk ekstensi browser. Elemen ini statis dan tidak
            pernah di-render ulang oleh React, jadi node yang disuntik ekstensi
            DI SINI (setelah hidrasi) akan bertahan. Ekstensi WAJIB memakai wadah
            ini — jangan menyuntik ke <main>/<body>/list React — supaya pohon
            React tidak rusak saat hidrasi. */}
        <div id="ext-root" aria-hidden="true" />
      </body>
    </html>
  );
}
