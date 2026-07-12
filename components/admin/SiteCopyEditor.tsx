"use client";

import type { Store, SiteCopy } from "@/lib/types";

const card = "bg-white rounded-2xl shadow-card";
const fieldLabel = "flex flex-col gap-1 text-[11.5px] font-extrabold text-gold-ink";
const inp = "rounded-lg bg-cream border-2 border-blush font-sans text-plum text-[13.5px]";

// Module-scoped so the inputs keep focus across keystrokes (a component defined
// inside render would remount every change).
function Field({
  label,
  value,
  onChange,
  area,
  ph,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  ph?: string;
  full?: boolean;
}) {
  return (
    <label className={fieldLabel} style={{ letterSpacing: "0.5px", gridColumn: full ? "1 / -1" : undefined }}>
      {label}
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={ph} className={`${inp} w-full`} style={{ padding: "9px 11px", resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className={inp} style={{ padding: "9px 11px" }} />
      )}
    </label>
  );
}

// Every marketing string on the public homepage, editable here so nothing
// customer-visible needs a code change. Grouped by the section it appears in.
export default function SiteCopyEditor({
  store,
  commit,
}: {
  store: Store;
  commit: (m: (d: Store) => void) => void;
}) {
  const copy = store.copy;
  const set = (key: keyof SiteCopy) => (value: string) => commit((d) => { d.copy[key] = value; });
  const grid = "grid gap-2.5 mb-4";
  const gridStyle = { gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };

  return (
    <div className={card} style={{ padding: "18px 20px", marginBottom: 28 }}>
      <h2 className="font-display m-0 mb-1.5" style={{ fontSize: 22 }}>Words on the site</h2>
      <p className="m-0 mb-4 text-plum-soft text-[13px]">
        Every headline, paragraph, button and contact detail on the homepage — edit here and it updates on the next refresh.
      </p>

      <p className="m-0 mb-2 text-[11px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>HERO (TOP OF PAGE)</p>
      <div className={grid} style={gridStyle}>
        <Field label="Kicker (small caps)" value={copy.heroKicker} onChange={set("heroKicker")} />
        <Field label="Headline" value={copy.heroTitle} onChange={set("heroTitle")} />
        <Field label="Primary button" value={copy.heroCtaPrimary} onChange={set("heroCtaPrimary")} />
        <Field label="Secondary button" value={copy.heroCtaSecondary} onChange={set("heroCtaSecondary")} />
        <Field label="Subtitle" value={copy.heroSubtitle} onChange={set("heroSubtitle")} area full />
      </div>

      <p className="m-0 mb-2 text-[11px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>GALLERY &amp; QUOTE BUILDER</p>
      <div className={grid} style={gridStyle}>
        <Field label="Gallery heading" value={copy.galleryTitle} onChange={set("galleryTitle")} />
        <Field label="Gallery subtitle" value={copy.gallerySubtitle} onChange={set("gallerySubtitle")} area full />
        <Field label="Quote kicker" value={copy.quoteKicker} onChange={set("quoteKicker")} />
        <Field label="Quote heading" value={copy.quoteTitle} onChange={set("quoteTitle")} />
        <Field label="Quote subtitle" value={copy.quoteSubtitle} onChange={set("quoteSubtitle")} area full />
        <Field label="Reviews heading" value={copy.reviewsTitle} onChange={set("reviewsTitle")} />
      </div>

      <p className="m-0 mb-2 text-[11px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>ABOUT</p>
      <div className={grid} style={gridStyle}>
        <Field label="Kicker (small caps)" value={copy.aboutKicker} onChange={set("aboutKicker")} />
        <Field label="Heading" value={copy.aboutTitle} onChange={set("aboutTitle")} />
        <Field label="Paragraph 1" value={copy.aboutBody1} onChange={set("aboutBody1")} area full />
        <Field label="Paragraph 2" value={copy.aboutBody2} onChange={set("aboutBody2")} area full />
      </div>

      <p className="m-0 mb-2 text-[11px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>FOOTER &amp; CONTACT</p>
      <div className={grid} style={gridStyle}>
        <Field label="Contact email" value={copy.contactEmail} onChange={set("contactEmail")} ph="hello@jnballoons.co.uk" />
        <Field label="Footer tagline" value={copy.footerTagline} onChange={set("footerTagline")} area full />
      </div>

      <p className="m-0 mb-2 text-[11px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>CONTACT PAGE</p>
      <div className="grid gap-2.5" style={gridStyle}>
        <Field label="Heading" value={copy.contactTitle} onChange={set("contactTitle")} />
        <Field label="Response time (e.g. within 24 hours)" value={copy.contactResponseTime} onChange={set("contactResponseTime")} />
        <Field label="Intro paragraph" value={copy.contactIntro} onChange={set("contactIntro")} area full />
      </div>
    </div>
  );
}
