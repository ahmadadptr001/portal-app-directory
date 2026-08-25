import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import UsersPage from '@/components/UsersPage';
import { SESSION_COOKIE, getSessionAdminByToken } from '@/lib/apps';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Peran dibaca di SERVER, bukan ditebak dari klien: kalau `currentRole`
  // dikirim dari browser, siapa pun bisa menyetelnya menjadi 'superadmin' dan
  // membuat seluruh tombol tampil. (Yang menahannya tetap `requireRole` di
  // setiap route — ini hanya agar tampilannya jujur sejak render pertama.)
  const store = await cookies();
  const admin = await getSessionAdminByToken(store.get(SESSION_COOKIE)?.value);

  // Proxy sudah menjaga rute ini, tapi sesi bisa kedaluwarsa antara pemeriksaan
  // proxy dan render. Tanpa penjagaan ini halaman akan crash saat membaca
  // `admin.role`.
  if (!admin) redirect('/login');

  return <UsersPage currentRole={admin.role} currentAdminId={admin.id} />;
}
