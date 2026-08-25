import SystemPage from '@/components/SystemPage';
import { getSystemHealth, type SystemHealth } from '@/lib/system';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Metrik awal diambil di server supaya halaman langsung berisi; klien
  // memperbaruinya berkala. Kegagalan di sini tidak boleh membuat halaman
  // blank — komponennya sudah punya keadaan "tidak tersedia".
  let initial: SystemHealth | null = null;
  try {
    initial = await getSystemHealth();
  } catch (e) {
    console.error('[system] Gagal mengambil metrik awal:', e);
  }
  return <SystemPage initial={initial} />;
}
