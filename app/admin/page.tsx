import { getRepository, hasDatabase } from "@/lib/store";
import AdminApp from "@/components/admin/AdminApp";
import { resolveStripeConfig } from "@/lib/stripeConfig";
import { sanitizeStoreForClient } from "@/lib/adminStore";
import { hasBlobStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const store = await getRepository().read();
  const cfg = resolveStripeConfig(store);
  return (
    <AdminApp
      initialStore={sanitizeStoreForClient(store)}
      dbConnected={hasDatabase()}
      blobConnected={hasBlobStorage()}
      bookingsLive={cfg.acceptCard}
    />
  );
}
