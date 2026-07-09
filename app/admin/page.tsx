import { getRepository } from "@/lib/store";
import AdminApp from "@/components/admin/AdminApp";
import { serverStripeEnabled } from "@/lib/publicData";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const store = await getRepository().read();
  return <AdminApp initialStore={store} stripeEnvConnected={serverStripeEnabled()} />;
}
