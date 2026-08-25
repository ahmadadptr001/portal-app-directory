export type AppStatus = 'active' | 'inactive' | 'maintenance' | 'deprecated';
export type AppEnv = 'production' | 'staging' | 'development';

/** Jenis entri riwayat versi (tabel `app_changelogs`, migrasi 08). */
export type ChangelogKind = 'feature' | 'fix' | 'security' | 'other';

/**
 * Satu entri riwayat versi aplikasi (changelog).
 *
 * Entri dengan `isPublic: false` adalah catatan internal — tersimpan tapi
 * tidak pernah dikirim ke halaman publik (pola yang sama dengan
 * `apps.is_public` di migrasi 07).
 */
export interface AppChangelog {
  id: number;
  appId: number;
  version: string;
  /** Tanggal rilis versi, format YYYY-MM-DD; null bila belum ditetapkan. */
  releasedAt: string | null;
  kind: ChangelogKind;
  notes: string | null;
  isPublic: boolean;
  createdAt?: string | null;
}

/** Tangkapan layar aplikasi (relasi `app_screenshots`). */
export interface Screenshot {
  url: string;
  caption?: string | null;
}

export interface App {
  id: number;
  name: string;
  category: string;
  status: AppStatus;
  env: AppEnv;
  url: string;
  owner: string;
  version: string;
  progress: number;
  description: string;
  tech: string[];
  server: string;
  database: string;
  /** Waktu input aplikasi (dari DB created_at; data fallback memakai tanggal relatif). */
  createdAt?: string;

  // --- Field katalog publik (migrasi 07) ---
  // Semuanya OPSIONAL secara sengaja: `App` juga dipakai oleh data contoh
  // `src/data/initialData.ts` dan oleh form admin, dan halaman admin harus
  // tetap berjalan pada database yang belum menjalankan migrasi 07.
  // Untuk data yang benar-benar dikirim ke publik, pakai `PublicApp` di
  // bawah — di sana field-nya wajib.
  /** URL publik: /katalog/<slug>. Stabil walau nama aplikasi berubah. */
  slug?: string;
  /** Penentu tunggal apakah aplikasi tampil di katalog publik. */
  isPublic?: boolean;
  logoUrl?: string | null;
  /** Tanggal mulai beroperasi, format YYYY-MM-DD. */
  goLiveDate?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  screenshots?: Screenshot[];
}

/**
 * Bentuk aplikasi yang boleh dilihat publik.
 *
 * PENTING — ini adalah batas keamanan, bukan sekadar tipe bantu.
 * `server`, `database`, `env`, dan `progress` sengaja TIDAK ADA di sini:
 * nama server dan versi database adalah informasi infrastruktur, dan
 * env/progress adalah informasi internal proyek. Menyembunyikannya di JSX
 * mudah terlupa; menghilangkannya dari tipe membuat kebocoran gagal saat
 * `tsc` — bukan saat sudah tayang.
 *
 * Satu-satunya cara membuat nilai ini adalah `toPublicApp()` di
 * `src/lib/public.ts`. Jangan pernah merakitnya manual di komponen.
 */
export interface PublicApp {
  id: number;
  slug: string;
  name: string;
  category: string;
  status: AppStatus;
  description: string;
  /** null bila belum ada URL produksi (sentinel '#' sudah dinormalkan). */
  url: string | null;
  /** Unit kerja / OPD pemilik. null bila belum ditentukan. */
  owner: string | null;
  version: string | null;
  logoUrl: string | null;
  goLiveDate: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  tech: string[];
  screenshots: Screenshot[];
  createdAt: string | null;
  updatedAt: string | null;
}
