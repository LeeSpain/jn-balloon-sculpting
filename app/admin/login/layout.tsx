import type { Metadata } from "next";

// The login page itself is a client component, so its tab title/robots are set
// here in a server layout.
export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
