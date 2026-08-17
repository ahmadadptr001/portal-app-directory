import SettingsPage from '@/components/SettingsPage';

export default function Page() {
  return <SettingsPage appEnv={process.env.NODE_ENV} />;
}
