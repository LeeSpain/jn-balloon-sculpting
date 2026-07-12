import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { loadStore } from '@/lib/db/store';
import AdminApp from './AdminApp';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const store = await loadStore();
  return <AdminApp initialStore={store} />;
}
