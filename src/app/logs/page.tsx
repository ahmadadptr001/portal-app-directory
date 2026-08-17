import LogsPage from '@/components/LogsPage';
import { getActivityLogs } from '@/lib/apps';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { logs, total } = await getActivityLogs({ limit: 20 });
  return <LogsPage logs={logs} total={total} />;
}
