import AppsPage from '@/components/AppsPage';
import { getAllApps, getAllCategories, getAllTechnologies } from '@/lib/apps';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { app } = await searchParams;
  const initialAppId =
    typeof app === 'string' && /^\d+$/.test(app) ? Number(app) : null;
  const [apps, categories, technologies] = await Promise.all([
    getAllApps(),
    getAllCategories(),
    getAllTechnologies(),
  ]);
  return <AppsPage apps={apps} categories={categories} technologies={technologies} initialAppId={initialAppId} />;
}
