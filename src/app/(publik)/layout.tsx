/**
 * Layout route group (publik) — kerangka untuk semua halaman tanpa login.
 *
 * Catatan struktur: `ClientLayout` di root layout memakai daftar-izin
 * `isAppPage` (ClientLayout.tsx:55) yang TIDAK memuat rute publik, jadi
 * halaman ini otomatis jatuh ke pembungkus telanjangnya
 * (`min-h-screen bg-slate-50 dark:bg-slate-950`) — lengkap dengan dukungan
 * tema gelap yang sudah berjalan. Karena itu rute admin tidak perlu
 * dipindahkan sama sekali untuk membuka katalog publik.
 *
 * Tipe props ditulis eksplisit (bukan `LayoutProps<...>` hasil typegen)
 * karena layout ini melayani beberapa path sekaligus.
 */
import PublicHeader from '@/components/publik/PublicHeader';
import PublicFooter from '@/components/publik/PublicFooter';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
