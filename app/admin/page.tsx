import { getRepository } from "@/lib/store";
import AdminApp from "@/components/admin/AdminApp";
import { serverStripeEnabled } from "@/lib/publicData";
import { sanitizeStoreForClient } from "@/lib/adminStore";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const store = await getRepository().read();
  return (
    <AdminApp
      initialStore={sanitizeStoreForClient(store)}
      stripeEnvConnected={serverStripeEnabled()}
    />
  );
}
