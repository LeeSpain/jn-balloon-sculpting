// J&N Balloon Sculpting — default seed data (from the design bundle's engine.js DEFAULTS)
import type { Store, SiteImages, Order } from "./types";
import { offsetDate } from "./pricing";

// Demo orders + reviews are DEV-ONLY. In production the store seeds empty:
// fake testimonials on a live site are illegal under the UK DMCC Act (and
// they'd also be emitted as schema.org Review markup), and fake orders would
// pollute the real pipeline & finance figures. Real reviews are added in
// Admin → Site content; real orders arrive via the booking form.
const includeDemoData = process.env.NODE_ENV !== "production";

// Built-in image defaults. "Reset to default" in the admin restores these.
// Empty string = use the code-level default (text logo, generated favicon/OG).
export const DEFAULT_IMAGES: SiteImages = {
  hero: "images/hero-arch.png",
  aboutJade: "images/about-jade.png",
  aboutNicole: "images/about-nicole.png",
  logo: "",
  favicon: "",
  ogImage: "",
};

export function seedStore(): Store {
  return {
    settings: {
      labourRate: 20,
      markupPct: 50,
      leadDays: 7,
      depositType: "full", // pay in full to confirm (change in Admin → Settings)
      depositValue: 50, // only used if deposit type is switched to fixed/percent
      refundDays: 5,
      taxRatePct: 20,
      vatRegistered: false,
      vatRatePct: 20,
      deliveryCostPct: 50,
      stripePublishable: "",
      stripeSecret: "",
      stripeWebhookSecret: "",
      stripeMode: "",
      stripeConnected: false,
      acceptCardPayments: false,
      emailTemplate:
        "Hi {name},\n\nThank you again for choosing J&N Balloon Sculpting for your {occasion}! We loved making it for you. If you've got another celebration coming up, we'd be delighted to help.\n\nWarm wishes,\nJade & Nicole",
      whatsappTemplate:
        "Hi {name}! It's Jade & Nicole from J&N Balloon Sculpting 🎈 Hope you enjoyed your {occasion}! Let us know if we can help with your next celebration.",
      maxDeliveriesPerDay: 3,
      workDayStart: "09:00",
      workDayEnd: "17:00",
      calendarToken: "",
      instagram: "",
      facebook: "",
      tiktok: "",
    },
    materials: [
      { id: "latex", name: "Latex balloons", unit: "pack", cost: 8, packSize: 100, unitLabel: "balloon", stock: 600, lowAt: 150 },
      { id: "foil", name: "Foil number balloon", unit: "each", cost: 4.5, unitLabel: "balloon", stock: 20, lowAt: 5 },
      { id: "helium", name: "Helium canister", unit: "canister", cost: 38, stock: 2, lowAt: 1 },
      { id: "ribbon", name: "Ribbon (roll)", unit: "roll", cost: 2.5, stock: 8, lowAt: 2 },
      { id: "weight", name: "Balloon weight", unit: "each", cost: 1.0, stock: 30, lowAt: 8 },
      { id: "strip", name: "Arch strip / frame (5m)", unit: "each", cost: 4.8, stock: 6, lowAt: 2 },
      { id: "glue", name: "Glue dots & fixings", unit: "pack", cost: 3.0, stock: 5, lowAt: 2 },
      { id: "floral", name: "Decorative florals (set)", unit: "set", cost: 6.5, stock: 6, lowAt: 2 },
    ],
    products: [
      { id: "arch", name: "Birthday Arch", fill: "air", buildHours: 1.5, desc: "A full colour arch, built ahead and delivered ready to place.", recipe: { latex: 100, strip: 1, glue: 1, ribbon: 1 } },
      { id: "garland", name: "Balloon Garland", fill: "air", buildHours: 1.25, desc: "Organic garland for tables, doorways and backdrops.", recipe: { latex: 80, strip: 0.5, glue: 1, ribbon: 1 } },
      { id: "wedding", name: "Wedding Centrepiece", fill: "air", buildHours: 0.75, desc: "Elegant table piece in soft tones with floral detail.", recipe: { latex: 20, weight: 2, floral: 1, ribbon: 0.5 } },
      { id: "grad", name: "Graduation Display", fill: "air", buildHours: 1, desc: "Celebrate results day with a personalised display.", recipe: { latex: 50, foil: 2, weight: 2, glue: 0.5 } },
      { id: "number", name: "Number Display", fill: "air", buildHours: 0.75, desc: "Big foil numbers dressed with a balloon cluster.", recipe: { foil: 2, latex: 25, weight: 2, ribbon: 0.5 } },
      { id: "helium9", name: "Helium Bouquet (9)", fill: "helium", buildHours: 0.4, desc: "Nine helium balloons, ribboned and weighted. Same-day delivery.", recipe: { latex: 9, helium: 0.3, ribbon: 1, weight: 1 } },
    ],
    sizes: [
      { id: "petite", name: "Petite", mult: 0.7 },
      { id: "standard", name: "Standard", mult: 1 },
      { id: "grand", name: "Grand", mult: 1.4 },
    ],
    themes: ["Blush & gold", "Pastel rainbow", "Bright party", "Ivory & sage", "Custom colours"],
    images: { ...DEFAULT_IMAGES },
    gallery: [
      // productId links each creation to an orderable piece — the popup's
      // "Order this piece" button pre-selects it in the quote builder.
      { id: "g1", title: "Pastel birthday arch", src: "images/gallery-pastel-arch.png", productId: "arch" },
      { id: "g2", title: "Ivory wedding centrepiece", src: "images/gallery-wedding.png", productId: "wedding" },
      { id: "g3", title: "Graduation display", src: "images/gallery-graduation.png", productId: "grad" },
      { id: "g4", title: "Coral party garland", src: "images/gallery-garland.png", productId: "garland" },
      { id: "g5", title: "Number 30 display", src: "images/gallery-number30.png", productId: "number" },
      { id: "g6", title: "Baby shower set", src: "images/gallery-babyshower.png", productId: "garland" },
    ],
    galleryImages: [
      "images/gallery-pastel-arch.png",
      "images/gallery-wedding.png",
      "images/gallery-graduation.png",
      "images/gallery-garland.png",
      "images/gallery-number30.png",
      "images/gallery-babyshower.png",
      "images/hero-arch.png",
    ],
    reviews: includeDemoData
      ? [
          { id: "r1", text: "The arch was even better than the photos — my daughter cried happy tears. Delivered right on time.", name: "Sophie T.", event: "5th birthday, Huntingdon" },
          { id: "r2", text: "Elegant, not naff — exactly what we wanted for the wedding. Guests kept asking who made them.", name: "Mark & Elena", event: "Wedding, Ely" },
          { id: "r3", text: "Ordered on Instagram, quoted instantly, delivered to St Neots. Couldn’t be easier.", name: "Priya S.", event: "Graduation party" },
        ]
      : [],
    zones: [
      { id: "z1", name: "Zone 1", range: "0–10 miles", fee: 5, areas: "Huntingdon, St Ives, Sawtry, Ramsey", districts: ["PE26", "PE27", "PE28", "PE29"] },
      { id: "z2", name: "Zone 2", range: "10–20 miles", fee: 12, areas: "Peterborough, St Neots, Chatteris", districts: ["PE1", "PE2", "PE3", "PE4", "PE5", "PE6", "PE7", "PE8", "PE16", "PE19"] },
      { id: "z3", name: "Zone 3", range: "20–30 miles", fee: 20, areas: "Cambridge, Ely", districts: ["CB1", "CB2", "CB3", "CB4", "CB5", "CB6", "CB7", "CB23", "CB24", "CB25"] },
    ],
    orders: includeDemoData
      ? ([
          { id: "JN-1041", customer: "Sophie Turner", phone: "07700 900123", product: "arch", size: "grand", theme: "Pastel rainbow", postcode: "PE29 3AB", address: "14 Ouse Walk, Huntingdon", date: offsetDate(2), price: 98, delivery: 5, status: "In progress", acknowledged: true, maker: "Jade", deliverer: "Nicole" },
          { id: "JN-1042", customer: "Mark Ellis", phone: "07700 900456", product: "wedding", size: "standard", theme: "Ivory & sage", postcode: "CB6 1AA", address: "The Old Barn, Ely", date: offsetDate(5), price: 62, delivery: 20, status: "Materials purchased", acknowledged: true, maker: "Both", deliverer: "Jade" },
          { id: "JN-1043", customer: "Priya Shah", phone: "07700 900789", email: "priya@example.com", notes: "It's for my daughter's 5th — pinks and golds if possible. Please ring when you arrive, the bell doesn't work!", product: "number", size: "standard", theme: "Blush & gold", postcode: "PE19 2FF", address: "3 Mill Lane, St Neots", date: offsetDate(8), price: 55, delivery: 12, status: "Order received", acknowledged: false, createdAt: offsetDate(-1) + "T09:00:00.000Z" },
          { id: "JN-1040", customer: "Dawn Whitfield", phone: "07700 900321", product: "garland", size: "standard", theme: "Bright party", postcode: "PE27 5QQ", address: "8 Priory Road, St Ives", date: offsetDate(-1), price: 58, delivery: 5, status: "Delivered", acknowledged: true, maker: "Nicole", deliverer: "Nicole" },
        ] as Order[])
      : [],
    contacts: [],
    blocks: [],
    enquiries: [],
    copy: {
      heroKicker: "CAMBRIDGESHIRE BASED",
      heroTitle: "Handcrafted balloon art, delivered to your door",
      heroSubtitle:
        "Arches, garlands and centrepieces for birthdays, weddings and every celebration in between — made by hand by Jade & Nicole, and delivered ready to wow.",
      heroCtaPrimary: "Get an instant quote",
      heroCtaSecondary: "See our work",
      galleryTitle: "Recent creations",
      gallerySubtitle: "Every piece is handmade to order — tap any favourite to take a closer look.",
      quoteKicker: "INSTANT QUOTE",
      quoteTitle: "Build your quote in seconds",
      quoteSubtitle: "Pick a piece, choose your colours, tell us where — your price appears instantly.",
      reviewsTitle: "Kind words",
      aboutKicker: "MEET JADE & NICOLE",
      aboutTitle: "Two local mums, one big idea",
      aboutBody1:
        "We're Jade and Nicole — friends, single mums, and the hands behind every balloon we deliver. What started as decorating our own children's parties in Huntingdon and Stilton became the thing people kept asking us to do for theirs.",
      aboutBody2:
        "Every piece is built by us, in advance, with care — then delivered to your door anywhere in Cambridgeshire so all you have to do is enjoy the party.",
      footerTagline:
        "Handcrafted balloon art, delivered across Cambridgeshire. Huntingdon · Stilton · and everywhere in between.",
      contactEmail: "hello@jnballoons.co.uk",
      contactTitle: "Say hello",
      contactIntro:
        "Got a question, a date in mind, or something a bit different in mind? Drop us a message — it comes straight to Jade & Nicole and we'll get back to you personally.",
      contactResponseTime: "within 24 hours",
    },
  };
}
