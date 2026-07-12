import { getRepository } from "@/lib/store";
import { buildPublicData } from "@/lib/publicData";
import { assetUrl } from "@/lib/assets";
import QuoteBuilder from "@/components/QuoteBuilder";
import GalleryShowcase from "@/components/GalleryShowcase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { booked?: string; cancelled?: string };
}) {
  const store = await getRepository().read();
  const data = buildPublicData(store);
  const img = data.images; // all site images come from the store (admin-managed)
  const copy = data.copy; // all marketing copy comes from the store (admin-managed)
  const socials = [
    { name: "Instagram", url: data.settings.instagram },
    { name: "Facebook", url: data.settings.facebook },
    { name: "TikTok", url: data.settings.tiktok },
  ].filter((x) => x.url);

  // LocalBusiness + Review structured data — helps Google show rich results and
  // map/review eligibility for this Cambridgeshire delivery business.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jnballoons.co.uk";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "J&N Balloon Sculpting",
    description:
      "Handcrafted balloon arches, garlands and centrepieces, delivered across Cambridgeshire by Jade & Nicole.",
    image: `${siteUrl}/opengraph-image`,
    url: siteUrl,
    email: copy.contactEmail,
    areaServed: "Cambridgeshire, UK",
    address: { "@type": "PostalAddress", addressRegion: "Cambridgeshire", addressCountry: "GB" },
    ...(socials.length ? { sameAs: socials.map((s) => s.url) } : {}),
    ...(data.reviews.length
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "5",
            reviewCount: String(data.reviews.length),
          },
          review: data.reviews.map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
            author: { "@type": "Person", name: r.name },
            reviewBody: r.text,
          })),
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <SiteHeader logo={img.logo} current="home" />

      {/* Hero — 50/50 on desktop (text left, image right), stacks on mobile.
          Fixed 2-col grid instead of auto-fit so the image can't collapse into a
          narrow third column with dead space beside it. */}
      <section
        id="top"
        className="max-w-site mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-9"
        style={{ padding: "64px 20px 48px" }}
      >
        <div>
          <p className="m-0 mb-3.5 text-xs font-extrabold text-gold-ink" style={{ letterSpacing: "3px" }}>
            {copy.heroKicker}
          </p>
          <h1 className="font-display font-bold m-0 mb-[18px]" style={{ fontSize: "clamp(34px, 5vw, 52px)", lineHeight: 1.12 }}>
            {copy.heroTitle}
          </h1>
          <p className="text-[17px] m-0 mb-[26px]" style={{ lineHeight: 1.6, maxWidth: "46ch" }}>
            {copy.heroSubtitle}
          </p>
          <div className="flex gap-3.5 flex-wrap items-center">
            <a
              href="#quote"
              className="no-underline inline-flex items-center bg-coral-deep text-white font-extrabold text-base rounded-full"
              style={{ padding: "14px 28px", minHeight: 48, boxShadow: "0 4px 14px rgba(201,64,47,0.35)" }}
            >
              {copy.heroCtaPrimary}
            </a>
            <a href="#gallery" className="no-underline inline-flex items-center font-bold text-[15px]" style={{ minHeight: 44, borderBottom: "2px solid #D4AF7A", paddingBottom: "2px" }}>
              {copy.heroCtaSecondary}
            </a>
          </div>
        </div>
        <div
          className="rounded-3xl overflow-hidden relative w-full aspect-[4/3]"
          style={{ boxShadow: "0 10px 30px rgba(74,44,77,0.12)", maxHeight: "460px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed hero image (Blob/uploads URL) */}
          <img
            src={assetUrl(img.hero)}
            alt="Handcrafted balloon garland in blush, rose and gold by J&N"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "45% 50%" }}
          />
        </div>
      </section>

      {/* Gallery — cards open a popup; "Order this piece" jumps to the quote below */}
      <section id="gallery" className="max-w-site mx-auto" style={{ padding: "24px 20px 48px", scrollMarginTop: "80px" }}>
        <h2 className="font-display m-0 mb-1.5" style={{ fontSize: "clamp(26px, 3.5vw, 36px)" }}>
          {copy.galleryTitle}
        </h2>
        <p className="m-0 mb-6 text-[15px] text-plum-soft">
          {copy.gallerySubtitle}
        </p>
        <GalleryShowcase data={data} />
      </section>

      {/* Quote builder */}
      <section id="quote" className="max-w-site mx-auto" style={{ padding: "24px 20px 64px", scrollMarginTop: "80px" }}>
        {searchParams?.booked && (
          <div
            className="mb-5 rounded-2xl text-[14.5px] font-bold"
            style={{ background: "#F0F7F0", border: "2px solid #9DC49D", padding: "18px 20px", color: "#3c5a3c" }}
          >
            Payment successful — booking {searchParams.booked} confirmed! Your payment has been received and your
            date is secured. A confirmation is on its way to you.
          </div>
        )}
        {searchParams?.cancelled && (
          <div
            className="mb-5 rounded-2xl text-[14.5px] font-bold"
            style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "18px 20px", color: "#c14a3e" }}
          >
            Payment cancelled — no charge was made. Your booking {searchParams.cancelled} is saved as an enquiry;
            complete the deposit any time to secure your date.
          </div>
        )}
        <QuoteBuilder data={data} />
        {/* Not a price question? Steer to the contact form. */}
        <p className="text-center m-0" style={{ marginTop: 20, fontSize: 14.5 }}>
          <span className="text-plum-soft">Something bespoke, or a question the quote doesn’t cover? </span>
          <a href="/contact" className="font-extrabold no-underline" style={{ color: "#c9402f", borderBottom: "2px solid #D4AF7A", paddingBottom: 1 }}>
            Ask us first →
          </a>
        </p>
      </section>

      {/* Reviews — hidden until real reviews are added in Admin → Site content */}
      {data.reviews.length > 0 && (
        <section style={{ background: "#F3C6C6" }}>
          <div className="max-w-site mx-auto" style={{ padding: "56px 20px" }}>
            <h2 className="font-display m-0 mb-6" style={{ fontSize: "clamp(26px, 3.5vw, 36px)" }}>
              {copy.reviewsTitle}
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
              {data.reviews.map((r) => (
                <blockquote key={r.id} className="m-0 bg-cream rounded-[18px] shadow-card" style={{ padding: 22 }}>
                  <p className="m-0 mb-3.5 text-[15px] italic" style={{ lineHeight: 1.6 }}>
                    “{r.text}”
                  </p>
                  <footer className="font-extrabold text-[13.5px] text-plum">
                    {r.name} <span className="text-plum-soft font-semibold">· {r.event}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      <section
        id="about"
        className="max-w-site mx-auto grid items-center"
        style={{ padding: "64px 20px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "36px", scrollMarginTop: "80px" }}
      >
        <div className="flex gap-3.5">
          <div className="flex-1 rounded-[18px] overflow-hidden relative" style={{ aspectRatio: "3/4" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed photo */}
            <img src={assetUrl(img.aboutJade)} alt="Jade, co-founder of J&N Balloon Sculpting" className="absolute inset-0 w-full h-full object-cover" />
            <span
              className="absolute font-extrabold text-xs rounded-full"
              style={{ bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(251,247,242,0.92)", padding: "5px 12px" }}
            >
              Jade
            </span>
          </div>
          <div className="flex-1 rounded-[18px] overflow-hidden relative" style={{ aspectRatio: "3/4", marginTop: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-managed photo */}
            <img src={assetUrl(img.aboutNicole)} alt="Nicole, co-founder of J&N Balloon Sculpting" className="absolute inset-0 w-full h-full object-cover" />
            <span
              className="absolute font-extrabold text-xs rounded-full"
              style={{ bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(251,247,242,0.92)", padding: "5px 12px" }}
            >
              Nicole
            </span>
          </div>
        </div>
        <div>
          <p className="m-0 mb-2.5 text-xs font-extrabold text-gold-ink" style={{ letterSpacing: "3px" }}>
            {copy.aboutKicker}
          </p>
          <h2 className="font-display m-0 mb-4" style={{ fontSize: "clamp(26px, 3.5vw, 36px)" }}>
            {copy.aboutTitle}
          </h2>
          <p className="text-[15.5px] m-0 mb-3.5" style={{ lineHeight: 1.7 }}>
            {copy.aboutBody1}
          </p>
          <p className="text-[15.5px] m-0" style={{ lineHeight: 1.7 }}>
            {copy.aboutBody2}
          </p>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter copy={copy} socials={socials} />
    </>
  );
}
