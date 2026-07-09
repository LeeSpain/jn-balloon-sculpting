// J&N Balloon Sculpting — default seed data (from the design bundle's engine.js DEFAULTS)
import type { Store } from "./types";
import { offsetDate } from "./pricing";

export function seedStore(): Store {
  return {
    settings: {
      labourRate: 20,
      markupPct: 50,
      leadDays: 7,
      depositType: "percent",
      depositValue: 50,
      refundDays: 5,
      stripePublishable: "",
      stripeSecret: "",
      instagram: "",
      facebook: "",
      tiktok: "",
    },
    materials: [
      { id: "latex", name: "Latex balloons (pack of 100)", unit: "pack", cost: 6.5 },
      { id: "foil", name: "Foil number balloon", unit: "each", cost: 4.2 },
      { id: "helium", name: "Helium canister", unit: "canister", cost: 32, stock: 2, lowAt: 1 },
      { id: "ribbon", name: "Ribbon (roll)", unit: "roll", cost: 2.5, stock: 8, lowAt: 2 },
      { id: "weight", name: "Balloon weight", unit: "each", cost: 1.2, stock: 14, lowAt: 5 },
      { id: "strip", name: "Arch strip / frame (5m)", unit: "each", cost: 4.8, stock: 6, lowAt: 2 },
      { id: "glue", name: "Glue dots & fixings", unit: "pack", cost: 3.0, stock: 5, lowAt: 2 },
      { id: "floral", name: "Decorative florals (set)", unit: "set", cost: 5.5, stock: 4, lowAt: 1 },
    ],
    products: [
      { id: "arch", name: "Birthday Arch", fill: "air", buildHours: 1.25, desc: "A full colour arch, built ahead and delivered ready to place.", recipe: { latex: 2, strip: 1, glue: 1, ribbon: 0.5 } },
      { id: "garland", name: "Balloon Garland", fill: "air", buildHours: 1, desc: "Organic garland for tables, doorways and backdrops.", recipe: { latex: 1.5, strip: 0.5, glue: 1, ribbon: 0.5 } },
      { id: "wedding", name: "Wedding Centrepiece", fill: "air", buildHours: 0.75, desc: "Elegant table piece in soft tones with floral detail.", recipe: { latex: 0.5, weight: 2, floral: 1, ribbon: 0.5 } },
      { id: "grad", name: "Graduation Display", fill: "air", buildHours: 1, desc: "Celebrate results day with a personalised display.", recipe: { latex: 1, foil: 2, weight: 2, glue: 0.5 } },
      { id: "number", name: "Number Display", fill: "air", buildHours: 0.75, desc: "Big foil numbers dressed with a balloon cluster.", recipe: { foil: 2, latex: 0.5, weight: 2, ribbon: 0.5 } },
      { id: "helium9", name: "Helium Bouquet (9)", fill: "helium", buildHours: 0.5, desc: "Nine helium balloons, ribboned and weighted. Same-day delivery.", recipe: { latex: 0.15, helium: 0.3, ribbon: 1, weight: 1 } },
    ],
    sizes: [
      { id: "petite", name: "Petite", mult: 0.7 },
      { id: "standard", name: "Standard", mult: 1 },
      { id: "grand", name: "Grand", mult: 1.4 },
    ],
    themes: ["Blush & gold", "Pastel rainbow", "Bright party", "Ivory & sage", "Custom colours"],
    gallery: [
      { id: "g1", title: "Pastel birthday arch", src: "images/gallery-pastel-arch.png" },
      { id: "g2", title: "Ivory wedding centrepiece", src: "images/gallery-wedding.png" },
      { id: "g3", title: "Graduation display", src: "images/gallery-graduation.png" },
      { id: "g4", title: "Coral party garland", src: "images/gallery-garland.png" },
      { id: "g5", title: "Number 30 display", src: "images/gallery-number30.png" },
      { id: "g6", title: "Baby shower set", src: "images/gallery-babyshower.png" },
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
    reviews: [
      { id: "r1", text: "The arch was even better than the photos — my daughter cried happy tears. Delivered right on time.", name: "Sophie T.", event: "5th birthday, Huntingdon" },
      { id: "r2", text: "Elegant, not naff — exactly what we wanted for the wedding. Guests kept asking who made them.", name: "Mark & Elena", event: "Wedding, Ely" },
      { id: "r3", text: "Ordered on Instagram, quoted instantly, delivered to St Neots. Couldn’t be easier.", name: "Priya S.", event: "Graduation party" },
    ],
    zones: [
      { id: "z1", name: "Zone 1", range: "0–10 miles", fee: 5, areas: "Huntingdon, St Ives, Sawtry, Ramsey", districts: ["PE26", "PE27", "PE28", "PE29"] },
      { id: "z2", name: "Zone 2", range: "10–20 miles", fee: 12, areas: "Peterborough, St Neots, Chatteris", districts: ["PE1", "PE2", "PE3", "PE4", "PE5", "PE6", "PE7", "PE8", "PE16", "PE19"] },
      { id: "z3", name: "Zone 3", range: "20–30 miles", fee: 20, areas: "Cambridge, Ely", districts: ["CB1", "CB2", "CB3", "CB4", "CB5", "CB6", "CB7", "CB23", "CB24", "CB25"] },
    ],
    orders: [
      { id: "JN-1041", customer: "Sophie Turner", phone: "07700 900123", product: "arch", size: "grand", theme: "Pastel rainbow", postcode: "PE29 3AB", address: "14 Ouse Walk, Huntingdon", date: offsetDate(2), price: 98, delivery: 5, status: "In progress" },
      { id: "JN-1042", customer: "Mark Ellis", phone: "07700 900456", product: "wedding", size: "standard", theme: "Ivory & sage", postcode: "CB6 1AA", address: "The Old Barn, Ely", date: offsetDate(5), price: 62, delivery: 20, status: "Materials purchased" },
      { id: "JN-1043", customer: "Priya Shah", phone: "07700 900789", product: "number", size: "standard", theme: "Blush & gold", postcode: "PE19 2FF", address: "3 Mill Lane, St Neots", date: offsetDate(8), price: 55, delivery: 12, status: "Order received" },
      { id: "JN-1040", customer: "Dawn Whitfield", phone: "07700 900321", product: "garland", size: "standard", theme: "Bright party", postcode: "PE27 5QQ", address: "8 Priory Road, St Ives", date: offsetDate(-1), price: 58, delivery: 5, status: "Delivered" },
    ],
  };
}
