import CategoriesPage from '@/components/CategoriesPage';
import { getAllApps } from '@/lib/apps';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const apps = await getAllApps();
  return <CategoriesPage apps={apps} />;
}
