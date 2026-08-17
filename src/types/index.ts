export type AppStatus = 'active' | 'inactive' | 'maintenance' | 'deprecated';
export type AppEnv = 'production' | 'staging' | 'development';

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
}
