import { getPublicStore } from '@/lib/db/store';
import SiteApp from './site/SiteApp';

// Always read the current DB state so admin cost/content changes are reflected.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const store = await getPublicStore();
  return <SiteApp initialStore={store} />;
}
