"use client";

// "Recent creations" grid — every card opens a popup with the creation's
// photo(s), description and, when the piece is linked to a product in the
// admin, an "Order this piece" button that pre-selects it in the quote builder.
import { useEffect, useState } from "react";
import type { PublicData } from "@/lib/publicData";
import { assetUrl } from "@/lib/assets";

type Creation = PublicData["gallery"][number];

function gbp(n: number): string {
  return "£" + (Number.isInteger(n) ? n : n.toFixed(2));
}

export default function GalleryShowcase({ data }: { data: PublicData }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  const open = data.gallery.find((g) => g.id === openId) || null;
  const product = open?.productId ? data.products.find((p) => p.id === open.productId) : undefined;

  function show(g: Creation) {
    setOpenId(g.id);
    setImgIdx(0);
  }
  function close() {
    setOpenId(null);
  }
  function orderThis() {
    // Pre-select the linked piece in the quote builder, then scroll to it.
    if (product) {
      window.dispatchEvent(new CustomEvent("jn:order", { detail: { productId: product.id } }));
    }
    close();
    // Defer past the modal unmount — its effect cleanup releases the body
    // scroll-lock, and scrolling before that is silently ignored. Instant
    // (non-smooth) scroll: smooth scrolling silently no-ops in some
    // environments (e.g. reduced-motion), and reliably landing on the quote
    // matters more than the animation.
    setTimeout(() => {
      document.getElementById("quote")?.scrollIntoView();
    }, 50);
  }

  // Esc closes; arrow keys flick through photos; lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const count = open.images.length;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && count > 1) setImgIdx((i) => (i + 1) % count);
      else if (e.key === "ArrowLeft" && count > 1) setImgIdx((i) => (i - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {data.gallery.map((g) => (
          <button
            key={g.id}
            onClick={() => show(g)}
            className="cursor-pointer text-left p-0 border-0 m-0 rounded-[18px] overflow-hidden bg-white shadow-card font-sans"
            aria-haspopup="dialog"
            aria-label={`View ${g.title}`}
          >
            <div className="relative" style={{ aspectRatio: "1", backgroundColor: "#F8EDE9", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- gallery photos may be uploaded data: URLs, which next/image can't optimise */}
              <img
                src={assetUrl(g.src)}
                alt={g.title}
                loading="lazy"
                className="w-full h-full object-cover block"
              />
              {g.images.length > 1 && (
                <span
                  className="absolute font-extrabold text-xs rounded-full bg-white text-plum"
                  style={{ top: 10, right: 10, padding: "4px 10px", boxShadow: "0 2px 8px rgba(74,44,77,0.18)" }}
                >
                  {g.images.length} photos
                </span>
              )}
            </div>
            <span className="flex items-center justify-between gap-2" style={{ padding: "12px 14px" }}>
              <span className="font-bold text-sm text-plum">{g.title}</span>
              <span
                className="inline-flex items-center bg-cream text-gold-ink font-extrabold text-xs rounded-full"
                style={{ padding: "8px 14px", minHeight: 36 }}
              >
                View
              </span>
            </span>
          </button>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(74,44,77,0.55)", padding: 16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="bg-cream rounded-3xl overflow-hidden shadow-panel w-full flex flex-col"
            style={{ maxWidth: 720, maxHeight: "92dvh" }}
          >
            {/* Main photo + navigation */}
            <div className="relative" style={{ background: "#F8EDE9" }}>
              <div style={{ aspectRatio: "4/3", maxHeight: "58dvh", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo URLs */}
                <img
                  src={assetUrl(open.images[imgIdx] ?? open.src)}
                  alt={`${open.title} — photo ${imgIdx + 1} of ${open.images.length}`}
                  className="w-full h-full object-cover block"
                />
              </div>
              <button
                onClick={close}
                autoFocus
                aria-label="Close"
                className="cursor-pointer absolute border-0 rounded-full bg-white text-plum font-extrabold"
                style={{ top: 12, right: 12, width: 44, height: 44, fontSize: 18, boxShadow: "0 2px 10px rgba(74,44,77,0.25)" }}
              >
                ✕
              </button>
              {open.images.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIdx((imgIdx - 1 + open.images.length) % open.images.length)}
                    aria-label="Previous photo"
                    className="cursor-pointer absolute border-0 rounded-full bg-white text-plum font-extrabold"
                    style={{ left: 12, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, fontSize: 18, boxShadow: "0 2px 10px rgba(74,44,77,0.25)" }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setImgIdx((imgIdx + 1) % open.images.length)}
                    aria-label="Next photo"
                    className="cursor-pointer absolute border-0 rounded-full bg-white text-plum font-extrabold"
                    style={{ right: 12, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, fontSize: 18, boxShadow: "0 2px 10px rgba(74,44,77,0.25)" }}
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {open.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto" style={{ padding: "10px 16px 0" }}>
                {open.images.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setImgIdx(i)}
                    aria-label={`Photo ${i + 1}`}
                    aria-pressed={i === imgIdx}
                    className="cursor-pointer p-0 rounded-xl overflow-hidden shrink-0"
                    style={{
                      width: 58,
                      height: 58,
                      border: i === imgIdx ? "3px solid #c9402f" : "3px solid transparent",
                      background: "#F8EDE9",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of uploaded photos */}
                    <img src={assetUrl(src)} alt="" className="w-full h-full object-cover block" />
                  </button>
                ))}
              </div>
            )}

            {/* Details + order */}
            <div style={{ padding: "16px 20px 20px" }}>
              <h3 className="font-display text-plum m-0 mb-1" style={{ fontSize: 24 }}>
                {open.title}
              </h3>
              {open.desc && (
                <p className="m-0 mb-3 text-[14.5px] text-plum" style={{ lineHeight: 1.6 }}>
                  {open.desc}
                </p>
              )}
              <div className="flex items-center gap-3.5 flex-wrap" style={{ marginTop: 6 }}>
                <button
                  onClick={orderThis}
                  className="cursor-pointer border-0 bg-coral-deep text-white font-sans font-extrabold text-[15px] rounded-full"
                  style={{ padding: "13px 26px", minHeight: 48, boxShadow: "0 4px 14px rgba(201,64,47,0.35)" }}
                >
                  {product ? `Order this piece — from ${gbp(product.fromPrice)}` : "Get a quote for something like this"}
                </button>
                {product && (
                  <span className="text-[13px] text-plum-soft font-bold">
                    {product.name} · sized &amp; themed your way
                  </span>
                )}
              </div>
              {/* Questions? Ask us first — pre-fills the contact form with this piece. */}
              <p className="m-0" style={{ marginTop: 12, fontSize: 13.5 }}>
                <a
                  href={product ? `/contact?product=${encodeURIComponent(product.id)}` : `/contact?piece=${encodeURIComponent(open.title)}`}
                  className="font-extrabold no-underline"
                  style={{ color: "#c9402f" }}
                >
                  Questions? Ask us first →
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
