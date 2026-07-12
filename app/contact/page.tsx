import type { Metadata } from "next";
import { getRepository } from "@/lib/store";
import { buildPublicData } from "@/lib/publicData";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ContactForm from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getRepository().read();
  return {
    title: `${store.copy.contactTitle} · J&N Balloon Sculpting`,
    description: "Get in touch with Jade & Nicole about balloon arches, garlands and centrepieces across Cambridgeshire.",
  };
}

export default async function ContactPage() {
  const store = await getRepository().read();
  const data = buildPublicData(store);
  const copy = data.copy;
  const socials = [
    { name: "Instagram", url: data.settings.instagram },
    { name: "Facebook", url: data.settings.facebook },
    { name: "TikTok", url: data.settings.tiktok },
  ].filter((x) => x.url);

  return (
    <>
      <SiteHeader logo={data.images.logo} current="contact" />

      <main className="max-w-site mx-auto" style={{ padding: "56px 20px 24px" }}>
        <div className="grid gap-9" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {/* Intro + direct details */}
          <div>
            <p className="m-0 mb-3 text-xs font-extrabold text-gold-ink" style={{ letterSpacing: "3px" }}>
              GET IN TOUCH
            </p>
            <h1 className="font-display font-bold m-0 mb-4" style={{ fontSize: "clamp(30px, 4.5vw, 44px)", lineHeight: 1.15 }}>
              {copy.contactTitle}
            </h1>
            <p className="text-[16px] m-0 mb-6" style={{ lineHeight: 1.65, maxWidth: "44ch" }}>
              {copy.contactIntro}
            </p>

            <div className="rounded-2xl" style={{ background: "#fff", border: "2px solid #F3C6C6", padding: "18px 22px", maxWidth: 420 }}>
              <p className="m-0 mb-1 text-[13px] font-extrabold text-gold-ink" style={{ letterSpacing: "1px" }}>PREFER EMAIL?</p>
              <a href={`mailto:${copy.contactEmail}`} className="font-extrabold text-[16px] no-underline" style={{ color: "#c9402f" }}>
                {copy.contactEmail}
              </a>
              <p className="m-0 mt-3 text-[13.5px] text-plum-soft" style={{ lineHeight: 1.5 }}>
                We&apos;re Jade &amp; Nicole — a small two-person team, so replies come from us personally, usually{" "}
                <strong>{copy.contactResponseTime}</strong>.
              </p>
              {socials.length > 0 && (
                <div className="flex gap-3.5 mt-3">
                  {socials.map((s) => (
                    <a key={s.name} href={s.url} className="font-extrabold text-[13.5px] no-underline" style={{ color: "#8a6a1a" }}>
                      {s.name}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Gently steer price-only questions to the instant quote */}
            <div className="rounded-2xl mt-4" style={{ background: "#FBF7F2", border: "2px dashed #D4AF7A", padding: "16px 20px", maxWidth: 420 }}>
              <p className="m-0 text-[14px]" style={{ lineHeight: 1.55 }}>
                <strong>Just after a price?</strong> You don&apos;t need to wait for us — our{" "}
                <a href="/#quote" className="font-extrabold no-underline" style={{ color: "#c9402f" }}>instant quote</a>{" "}
                gives you a figure in seconds. For anything bespoke, ask away below.
              </p>
            </div>
          </div>

          {/* Form */}
          <ContactForm data={data} />
        </div>
      </main>

      <SiteFooter copy={copy} socials={socials} />
    </>
  );
}
