import TechnologiesPage from '@/components/TechnologiesPage';
import { getAllApps, getAllTechnologies } from '@/lib/apps';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [apps, technologies] = await Promise.all([getAllApps(), getAllTechnologies()]);
  return <TechnologiesPage apps={apps} technologies={technologies} />;
}
