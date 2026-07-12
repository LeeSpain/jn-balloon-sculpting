import Link from "next/link";
import type { SiteCopy } from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";

// Shared site footer (homepage + contact page).
export default function SiteFooter({ copy, socials }: { copy: SiteCopy; socials: { name: string; url: string }[] }) {
  return (
    <footer style={{ background: "#4A2C4D", color: "#FBF7F2" }}>
      <div className="max-w-site mx-auto flex flex-wrap justify-between" style={{ padding: "44px 20px 32px", gap: "32px" }}>
        <div>
          <p className="font-display text-2xl font-bold m-0">
            J<span className="text-gold">&amp;</span>N
          </p>
          <p className="text-[9px] font-bold" style={{ letterSpacing: "3.5px", margin: "4px 0 14px" }}>
            BALLOON SCULPTING
          </p>
          <p className="text-[13.5px] m-0" style={{ opacity: 0.85, maxWidth: "34ch", lineHeight: 1.6 }}>
            {copy.footerTagline}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="font-extrabold text-[13px] m-0" style={{ letterSpacing: "1px" }}>GET IN TOUCH</p>
          <a href={`mailto:${copy.contactEmail}`} className="text-[14px] no-underline" style={{ color: "#F3C6C6" }}>
            {copy.contactEmail}
          </a>
          <Link href="/contact" className="text-[14px] no-underline" style={{ color: "#F3C6C6" }}>
            Send us a message →
          </Link>
          <CopyButton
            hash="#quote"
            idleLabel="Copy booking link"
            className="cursor-pointer self-start bg-coral-deep text-white border-0 font-sans font-extrabold text-[13.5px] rounded-full"
            style={{ padding: "11px 20px", minHeight: 44 }}
          />
          {socials.length > 0 && (
            <div className="flex gap-3 mt-1">
              {socials.map((sl) => (
                <a key={sl.name} href={sl.url} className="text-gold font-extrabold text-[13px] no-underline">
                  {sl.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="text-center text-xs" style={{ borderTop: "1px solid rgba(251,247,242,0.15)", padding: 14, opacity: 0.7 }}>
        © 2026 J&amp;N Balloon Sculpting · <Link href="/privacy" className="text-gold no-underline">Privacy</Link> ·{" "}
        <Link href="/terms" className="text-gold no-underline">Terms</Link> ·{" "}
        <Link href="/admin" className="text-gold no-underline">Admin</Link>
      </div>
    </footer>
  );
}
