import DashboardPage from '@/components/DashboardPage';
import { getAllApps } from '@/lib/apps';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const apps = await getAllApps();
  return <DashboardPage apps={apps} />;
}
