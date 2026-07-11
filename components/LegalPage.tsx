import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell for the legal pages (/privacy, /terms) — brand header, readable
// measure, plum footer matching the homepage.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="bg-cream" style={{ borderBottom: "1px solid rgba(74,44,77,0.1)" }}>
        <div className="max-w-site mx-auto flex items-center justify-between" style={{ padding: "14px 20px" }}>
          <Link href="/" className="no-underline flex flex-col leading-none">
            <span className="font-display text-[22px] font-bold text-plum">
              J<span className="text-gold">&amp;</span>N
            </span>
            <span className="text-[8px] font-extrabold text-gold-ink" style={{ letterSpacing: "3px" }}>
              BALLOON SCULPTING
            </span>
          </Link>
          <Link
            href="/#quote"
            className="no-underline bg-coral-deep text-white font-extrabold text-[13.5px] rounded-full inline-flex items-center"
            style={{ padding: "10px 18px", minHeight: 44 }}
          >
            Get a quote
          </Link>
        </div>
      </header>

      <main className="bg-cream">
        <article className="max-w-site mx-auto" style={{ padding: "48px 20px 72px", maxWidth: 760 }}>
          <h1 className="font-display text-plum m-0 mb-2" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
            {title}
          </h1>
          <p className="text-plum-soft text-[13.5px] font-semibold m-0 mb-8">Last updated: {updated}</p>
          <div className="legal-body text-plum text-[15.5px]" style={{ lineHeight: 1.75 }}>
            {children}
          </div>
        </article>
      </main>

      <footer style={{ background: "#4A2C4D", color: "#FBF7F2" }}>
        <div className="text-center text-xs" style={{ padding: 14, opacity: 0.7 }}>
          © 2026 J&amp;N Balloon Sculpting · <Link href="/privacy" className="text-gold no-underline">Privacy</Link> ·{" "}
          <Link href="/terms" className="text-gold no-underline">Terms</Link> ·{" "}
          <Link href="/" className="text-gold no-underline">Home</Link>
        </div>
      </footer>
    </>
  );
}

/** Section heading used inside legal copy. */
export function LegalH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-plum" style={{ fontSize: 22, margin: "32px 0 10px" }}>
      {children}
    </h2>
  );
}
