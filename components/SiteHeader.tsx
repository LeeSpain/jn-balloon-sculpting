import { assetUrl } from "@/lib/assets";

// Shared site header (homepage + contact page). Section links point at "/#…" so
// they work from any page; on the homepage the browser just scrolls.
export default function SiteHeader({ logo, current }: { logo: string; current?: "home" | "contact" }) {
  const homeTop = current === "home" ? "#top" : "/#top";
  return (
    <header
      className="sticky top-0 z-20"
      style={{ background: "rgba(251,247,242,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #F3C6C6" }}
    >
      <div className="max-w-site mx-auto flex items-center justify-between gap-x-4" style={{ padding: "14px 20px" }}>
        <a href={homeTop} className="no-underline flex flex-col leading-none">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-managed logo (Blob/uploads URL)
            <img src={assetUrl(logo)} alt="J&N Balloon Sculpting" style={{ height: 44, width: "auto", display: "block" }} />
          ) : (
            <>
              <span className="font-display text-[26px] font-bold">
                J<span className="text-gold">&amp;</span>N
              </span>
              <span className="text-[9px] font-bold mt-[3px]" style={{ letterSpacing: "3.5px" }}>
                BALLOON SCULPTING
              </span>
            </>
          )}
        </a>
        <nav className="flex gap-x-4 items-center justify-end font-bold text-sm">
          <a href="/#gallery" className="no-underline hidden sm:inline-flex items-center min-h-[44px] px-1">Gallery</a>
          <a href="/#quote" className="no-underline hidden sm:inline-flex items-center min-h-[44px] px-1">Get a quote</a>
          <a
            href="/contact"
            className="no-underline inline-flex items-center min-h-[44px] px-1"
            style={{ color: current === "contact" ? "#c9402f" : undefined }}
            aria-current={current === "contact" ? "page" : undefined}
          >
            Contact
          </a>
          <a
            href="/#quote"
            className="no-underline inline-flex items-center bg-coral-deep text-white rounded-full"
            style={{ padding: "10px 18px", minHeight: 44 }}
          >
            Book now
          </a>
        </nav>
      </div>
    </header>
  );
}
