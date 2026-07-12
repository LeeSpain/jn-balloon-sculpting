'use client';

import { useState } from 'react';
import { css } from '@/lib/css';
import { priceProduct, zoneForPostcode, minDate, depositFor, round2, gbp } from '@/lib/engine';
import type { PublicStore, Product, Size } from '@/lib/types';

const img = (s: string) => (s && !/^(https?:|\/)/.test(s) ? '/' + s : s);

function prettyDate(iso: string): string {
  return new Date(iso + 'T12:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

interface Pending {
  product: Product;
  size: Size;
  price: number;
  zoneFee: number;
  total: number;
  deposit: number;
}

export default function SiteApp({ initialStore }: { initialStore: PublicStore }) {
  const store = initialStore;

  const [productId, setProductId] = useState('arch');
  const [sizeId, setSizeId] = useState('standard');
  const [theme, setTheme] = useState(store.themes[0] || 'Blush & gold');
  const [postcode, setPostcode] = useState('');
  const [date, setDate] = useState('');
  const [custName, setCustName] = useState('');
  const [custContact, setCustContact] = useState('');

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);
  const [bookedMsg, setBookedMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sel = (on: boolean) =>
    on ? { border: '#FF6F61', bg: '#FFF3F1' } : { border: '#F3C6C6', bg: '#fff' };

  const product = store.products.find((p) => p.id === productId) || store.products[0];
  const size = store.sizes.find((s) => s.id === sizeId) || store.sizes[1];

  const productCards = store.products.map((p) => {
    const q = priceProduct(store, p, 0.7); // cheapest size for "from"
    const s = sel(p.id === productId);
    return {
      id: p.id,
      name: p.name,
      desc: p.desc,
      fromPrice: 'from ' + gbp(q.price),
      helium: p.fill === 'helium',
      border: s.border,
      bg: s.bg,
    };
  });

  const sizeChips = store.sizes.map((s) => {
    const q = priceProduct(store, product, s.mult);
    const c = sel(s.id === sizeId);
    return { id: s.id, name: s.name, priceLabel: gbp(q.price), border: c.border, bg: c.bg };
  });

  const themeChips = store.themes.map((t) => {
    const c = sel(t === theme);
    return { name: t, border: c.border, bg: c.bg };
  });

  // delivery
  const zone = postcode.trim() ? zoneForPostcode(store, postcode) : null;
  let zoneMsg = 'Minimum ' + store.settings.leadDays + ' days’ notice. We deliver up to 30 miles from Huntingdon.';
  let outside = false;
  if (postcode.trim()) {
    if (!zone) {
      zoneMsg = 'Hmm, that doesn’t look like a UK postcode — try e.g. PE29 3AB.';
    } else if (zone.fee == null) {
      zoneMsg = 'That’s beyond our 30-mile delivery area — send it as a custom enquiry and we’ll quote delivery personally.';
      outside = true;
    } else {
      zoneMsg = zone.name + ' (' + zone.range + ') — delivery ' + gbp(zone.fee) + '. Covers ' + zone.areas + '.';
    }
  }

  const dateMin = minDate(store);
  const priced = priceProduct(store, product, size.mult);
  const zoneOk = !!zone && zone.fee != null;
  const dateOk = !!date && date >= dateMin;
  const quoteReady = zoneOk && dateOk;
  const total = quoteReady && zone ? priced.price + (zone.fee as number) : priced.price;
  const deposit = depositFor(store, total);
  const s2 = store.settings;
  const stripeOn = s2.stripeConnected;
  const depositLine =
    s2.depositType === 'full'
      ? 'Pay in full today — your date is locked in instantly'
      : gbp(deposit) + ' deposit to confirm · balance before delivery';

  let blockedMsg: string | null = null;
  if (postcode.trim() && outside) {
    blockedMsg = 'Beyond 30 miles we quote delivery personally — tap “Request custom quote” below and we’ll come back within 24 hours.';
  } else if (zoneOk && date && !dateOk) {
    blockedMsg = 'We need at least ' + s2.leadDays + ' days’ notice to build your piece — the earliest date we can deliver is ' + prettyDate(dateMin) + '.';
  } else if (!quoteReady) {
    blockedMsg = 'Add your postcode and a delivery date to see your price' + (date || postcode ? '.' : ' — e.g. PE29 3AB.');
  }

  const socials = [
    { name: 'Instagram', url: s2.instagram },
    { name: 'Facebook', url: s2.facebook },
    { name: 'TikTok', url: s2.tiktok },
  ].filter((x) => x.url);

  const galleryItems = store.gallery;
  const reviews = store.reviews;

  // --- actions ---
  function validDetails(): boolean {
    if (!custName.trim() || !custContact.trim()) {
      setWarnMsg('Please add your name and a mobile number or email (step 5) so we can confirm your booking.');
      setBookedMsg(null);
      return false;
    }
    return true;
  }

  function openCheckout() {
    if (!validDetails()) return;
    setPending({
      product,
      size,
      price: priced.price,
      zoneFee: (zone?.fee as number) ?? 0,
      total,
      deposit,
    });
    setCheckoutOpen(true);
    setPayError(null);
    setBookedMsg(null);
  }

  async function submitOrder(kind: 'book' | 'custom', paid: boolean) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind,
        productId: product.id,
        sizeId: size.id,
        theme,
        postcode,
        date,
        name: custName.trim(),
        contact: custContact.trim(),
        paid,
      }),
    });
    return res.ok ? ((await res.json()) as { order: { id: string }; total: number; deposit: number }) : null;
  }

  async function payNow() {
    if (processing) return;
    const digits = cardNum.replace(/\D/g, '');
    if (digits.length < 12) return setPayError('Please enter a valid card number.');
    if (!/^\d{2}\s*\/?\s*\d{2}$/.test(cardExp.trim())) return setPayError('Expiry should be MM/YY.');
    if (cardCvc.replace(/\D/g, '').length < 3) return setPayError('Please enter your card’s CVC.');
    setProcessing(true);
    setPayError(null);
    // Simulated authorisation delay (real Stripe charge needs a live backend at launch).
    setTimeout(() => void finishOrder(true), 900);
  }

  async function finishOrder(paid: boolean) {
    const r = await submitOrder('book', paid);
    setProcessing(false);
    setCheckoutOpen(false);
    setCardNum('');
    setCardExp('');
    setCardCvc('');
    if (!r) {
      setWarnMsg('Something went wrong saving your booking — please try again.');
      return;
    }
    const depTxt = gbp(r.deposit);
    setWarnMsg(null);
    setBookedMsg(
      paid
        ? 'Payment successful — order ' + r.order.id + ' confirmed! ' +
          (r.deposit >= r.total
            ? 'Paid in full (' + depTxt + ').'
            : 'Your ' + depTxt + ' deposit is paid; the balance of ' + gbp(round2(r.total - r.deposit)) + ' is due before delivery.') +
          ' See you on ' + prettyDate(date) + '!'
        : 'Booking request ' + r.order.id + ' received! We’ll confirm within 24 hours and take payment (' + depTxt + ') to lock in your date.'
    );
  }

  async function requestCustom() {
    if (!validDetails()) return;
    const r = await submitOrder('custom', false);
    if (!r) {
      setWarnMsg('Something went wrong sending your request — please try again.');
      return;
    }
    setWarnMsg(null);
    setBookedMsg('Custom quote request ' + r.order.id + ' sent — Jade & Nicole will reply within 24 hours with a personal price.');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0] + '#quote');
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const co = pending;
  const coRefundDays = s2.refundDays;

  return (
    <>
      <header style={css('position: sticky; top: 0; z-index: 20; background: rgba(251,247,242,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid #F3C6C6;')}>
        <div style={css('max-width: 1060px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px;')}>
          <a href="#top" style={css('text-decoration: none; display: flex; flex-direction: column; line-height: 1;')}>
            <span style={css("font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700;")}>
              J<span style={css('color: #D4AF7A;')}>&amp;</span>N
            </span>
            <span style={css('font-size: 9px; letter-spacing: 3.5px; font-weight: 700; margin-top: 3px;')}>BALLOON SCULPTING</span>
          </a>
          <nav style={css('display: flex; gap: 22px; align-items: center; font-weight: 700; font-size: 14px;')}>
            <a href="#quote" style={css('text-decoration: none;')}>Price &amp; book</a>
            <a href="#gallery" style={css('text-decoration: none;')}>Gallery</a>
            <a href="#about" style={css('text-decoration: none;')}>About</a>
            <a href="#quote" className="cta-coral" style={css('text-decoration: none; background: #FF6F61; color: #fff; padding: 9px 18px; border-radius: 999px; box-shadow: 0 2px 8px rgba(255,111,97,0.35);')}>Book now</a>
          </nav>
        </div>
      </header>

      <section id="top" style={css('max-width: 1060px; margin: 0 auto; padding: 64px 20px 48px; display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 36px; align-items: center;')}>
        <div>
          <p style={css('margin: 0 0 14px; font-size: 12px; letter-spacing: 3px; font-weight: 800; color: #D4AF7A;')}>CAMBRIDGESHIRE BASED</p>
          <h1 style={css("font-family: 'Playfair Display', serif; font-size: clamp(34px, 5vw, 52px); line-height: 1.12; margin: 0 0 18px; font-weight: 700;")}>Handcrafted balloon art, delivered to your door</h1>
          <p style={css('font-size: 17px; line-height: 1.6; margin: 0 0 26px; max-width: 46ch;')}>Arches, garlands and centrepieces for birthdays, weddings and every celebration in between — made by hand by Jade &amp; Nicole, and delivered ready to wow.</p>
          <div style={css('display: flex; gap: 14px; flex-wrap: wrap; align-items: center;')}>
            <a href="#quote" className="cta-coral" style={css('text-decoration: none; background: #FF6F61; color: #fff; font-weight: 800; font-size: 16px; padding: 14px 28px; border-radius: 999px; box-shadow: 0 4px 14px rgba(255,111,97,0.4);')}>See your price &amp; book</a>
            <a href="#gallery" style={css('text-decoration: none; font-weight: 700; font-size: 15px; border-bottom: 2px solid #D4AF7A; padding-bottom: 2px;')}>See our work</a>
          </div>
        </div>
        <div style={css('border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(74,44,77,0.12); aspect-ratio: 4/5; max-height: 440px;')}>
          <img src={img('images/hero-arch.png')} alt="Blush and gold balloon arch" style={css('width: 100%; height: 100%; object-fit: cover; display: block;')} />
        </div>
      </section>

      <section id="quote" style={css('max-width: 1060px; margin: 0 auto; padding: 24px 20px 64px; scroll-margin-top: 80px;')}>
        <div style={css('background: #fff; border-radius: 24px; box-shadow: 0 8px 28px rgba(74,44,77,0.10); padding: clamp(22px, 4vw, 40px);')}>
          <p style={css('margin: 0 0 6px; font-size: 12px; letter-spacing: 3px; font-weight: 800; color: #D4AF7A;')}>PRICE &amp; BOOK</p>
          <h2 style={css("font-family: 'Playfair Display', serif; font-size: clamp(26px, 3.5vw, 36px); margin: 0 0 8px;")}>Book your piece in seconds</h2>
          <p style={css('margin: 0 0 28px; font-size: 15px; color: #7a5f7d;')}>Pick a piece, choose your colours, tell us where — see your price and pay in full to lock in your date instantly.</p>

          <h3 style={css('font-size: 14px; font-weight: 800; margin: 0 0 12px;')}><span style={css('color: #FF6F61;')}>1.</span> Choose your piece</h3>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 28px;')}>
            {productCards.map((p) => (
              <button key={p.id} onClick={() => { setProductId(p.id); setBookedMsg(null); }} style={css(`text-align: left; cursor: pointer; border-radius: 16px; padding: 14px; border: 2px solid ${p.border}; background: ${p.bg}; display: flex; flex-direction: column; gap: 6px; min-height: 44px; font-family: 'Nunito', sans-serif; color: #4A2C4D;`)}>
                <span style={css('font-weight: 800; font-size: 15px;')}>{p.name}</span>
                <span style={css('font-size: 12.5px; line-height: 1.45; color: #7a5f7d;')}>{p.desc}</span>
                <span style={css('display: flex; gap: 6px; align-items: center; margin-top: auto;')}>
                  <span style={css('font-weight: 800; font-size: 14px; color: #FF6F61;')}>{p.fromPrice}</span>
                  {p.helium && (
                    <span style={css('font-size: 10px; font-weight: 800; letter-spacing: 1px; background: #F3C6C6; padding: 3px 8px; border-radius: 999px;')}>SAME-DAY</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <h3 style={css('font-size: 14px; font-weight: 800; margin: 0 0 12px;')}><span style={css('color: #FF6F61;')}>2.</span> Pick a size</h3>
          <div style={css('display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 28px;')}>
            {sizeChips.map((s) => (
              <button key={s.id} onClick={() => { setSizeId(s.id); setBookedMsg(null); }} style={css(`cursor: pointer; border-radius: 999px; padding: 11px 20px; border: 2px solid ${s.border}; background: ${s.bg}; font-family: 'Nunito', sans-serif; color: #4A2C4D; font-weight: 700; font-size: 14px; min-height: 44px;`)}>
                {s.name} · <span style={css('color: #FF6F61; font-weight: 800;')}>{s.priceLabel}</span>
              </button>
            ))}
          </div>

          <h3 style={css('font-size: 14px; font-weight: 800; margin: 0 0 12px;')}><span style={css('color: #FF6F61;')}>3.</span> Colours &amp; theme</h3>
          <div style={css('display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 28px;')}>
            {themeChips.map((t) => (
              <button key={t.name} onClick={() => setTheme(t.name)} style={css(`cursor: pointer; border-radius: 999px; padding: 11px 20px; border: 2px solid ${t.border}; background: ${t.bg}; font-family: 'Nunito', sans-serif; color: #4A2C4D; font-weight: 700; font-size: 14px; min-height: 44px;`)}>
                {t.name}
              </button>
            ))}
          </div>

          <h3 style={css('font-size: 14px; font-weight: 800; margin: 0 0 12px;')}><span style={css('color: #FF6F61;')}>4.</span> Delivery</h3>
          <div style={css('display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 10px;')}>
            <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; flex: 1 1 180px;')}>Delivery postcode
              <input value={postcode} onChange={(e) => { setPostcode(e.target.value); setBookedMsg(null); }} placeholder="e.g. PE29 3AB" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2; color: #4A2C4D; outline-color: #D4AF7A;')} />
            </label>
            <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; flex: 1 1 180px;')}>Delivery date
              <input type="date" value={date} min={dateMin} onChange={(e) => { setDate(e.target.value); setBookedMsg(null); }} style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2; color: #4A2C4D; outline-color: #D4AF7A;')} />
            </label>
          </div>
          <p style={css('margin: 0 0 24px; font-size: 13px; color: #7a5f7d;')}>{zoneMsg}</p>

          <h3 style={css('font-size: 14px; font-weight: 800; margin: 0 0 12px;')}><span style={css('color: #FF6F61;')}>5.</span> Your details</h3>
          <div style={css('display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 24px;')}>
            <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; flex: 1 1 180px;')}>Your name
              <input value={custName} onChange={(e) => { setCustName(e.target.value); setWarnMsg(null); }} placeholder="e.g. Sophie Turner" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2; color: #4A2C4D; outline-color: #D4AF7A;')} />
            </label>
            <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; flex: 1 1 180px;')}>Mobile or email
              <input value={custContact} onChange={(e) => { setCustContact(e.target.value); setWarnMsg(null); }} placeholder="07700 900123" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2; color: #4A2C4D; outline-color: #D4AF7A;')} />
            </label>
          </div>

          {quoteReady && (
            <div style={css('border-radius: 20px; background: linear-gradient(135deg, #FF6F61, #ff8a7d); color: #fff; padding: clamp(20px, 3vw, 30px); display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between; box-shadow: 0 8px 24px rgba(255,111,97,0.35);')}>
              <div>
                <p style={css('margin: 0 0 4px; font-size: 12px; letter-spacing: 2px; font-weight: 800; opacity: 0.85;')}>YOUR PRICE</p>
                <p style={css("margin: 0; font-family: 'Playfair Display', serif; font-size: clamp(34px, 5vw, 46px); font-weight: 700; line-height: 1;")}>{gbp(total)}</p>
                <p style={css('margin: 8px 0 0; font-size: 13.5px; font-weight: 600; opacity: 0.95;')}>{product.name} ({size.name}) {gbp(priced.price)} + delivery {zoneOk && zone ? gbp(zone.fee) : '—'}</p>
                <p style={css('margin: 4px 0 0; font-size: 13px; font-weight: 700;')}>{depositLine}</p>
                <p style={css('margin: 4px 0 0; font-size: 12px; font-weight: 600; opacity: 0.9;')}>Free cancellation up to {s2.refundDays} working days before delivery</p>
              </div>
              <div style={css('display: flex; flex-direction: column; gap: 10px; align-items: stretch;')}>
                <button onClick={openCheckout} style={css("cursor: pointer; background: #fff; color: #FF6F61; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 16px; padding: 14px 30px; border-radius: 999px; min-height: 48px;")}>{stripeOn ? 'Pay ' + gbp(deposit) + ' & book' : 'Book now'}</button>
                <button onClick={requestCustom} style={css("cursor: pointer; background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.7); font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 14px; padding: 10px 22px; border-radius: 999px; min-height: 44px;")}>Request custom quote</button>
              </div>
            </div>
          )}
          {!quoteReady && !!blockedMsg && (
            <div style={css('border-radius: 20px; background: #FBF7F2; border: 2px dashed #D4AF7A; padding: 22px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;')}>
              <span style={css('font-size: 14.5px; font-weight: 600; flex: 1 1 280px;')}>{blockedMsg}</span>
              <button onClick={requestCustom} style={css("cursor: pointer; background: #4A2C4D; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px; padding: 12px 22px; border-radius: 999px; min-height: 44px;")}>Request custom quote</button>
            </div>
          )}
          {!!bookedMsg && (
            <div style={css('margin-top: 16px; border-radius: 16px; background: #F0F7F0; border: 2px solid #9DC49D; padding: 18px 20px; font-size: 14.5px; font-weight: 700; color: #3c5a3c;')}>{bookedMsg}</div>
          )}
          {!!warnMsg && (
            <div style={css('margin-top: 16px; border-radius: 16px; background: #FFF3F1; border: 2px solid #FF6F61; padding: 18px 20px; font-size: 14.5px; font-weight: 700; color: #c14a3e;')}>{warnMsg}</div>
          )}

          {checkoutOpen && co && (
            <div style={css('position: fixed; inset: 0; background: rgba(74,44,77,0.55); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px;')}>
              <div style={css('background: #fff; border-radius: 24px; max-width: 460px; width: 100%; padding: 28px; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(74,44,77,0.35);')}>
                <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px;')}>
                  <h3 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0;")}>Secure checkout</h3>
                  <button onClick={() => { setCheckoutOpen(false); setPayError(null); setProcessing(false); }} style={css('cursor: pointer; border: none; background: #FBF7F2; border-radius: 999px; width: 36px; height: 36px; font-weight: 800; font-size: 15px; color: #4A2C4D;')}>✕</button>
                </div>
                <div style={css('background: #FBF7F2; border-radius: 16px; padding: 16px 18px; margin-bottom: 18px;')}>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 3px 0;')}><span style={css('color: #7a5f7d;')}>{co.product.name} · {co.size.name} · {theme}</span><span style={css('font-weight: 700;')}>{gbp(co.price)}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 3px 0;')}><span style={css('color: #7a5f7d;')}>Delivery · {postcode.toUpperCase()}</span><span style={css('font-weight: 700;')}>{gbp(co.zoneFee)}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 3px 0;')}><span style={css('color: #7a5f7d;')}>Delivery date</span><span style={css('font-weight: 700;')}>{date ? prettyDate(date) : '—'}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 16px; padding: 8px 0 3px; border-top: 1px solid #F3C6C6; margin-top: 8px;')}><span style={css('font-weight: 800;')}>Due today</span><span style={css('font-weight: 800; color: #FF6F61;')}>{gbp(co.deposit)}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 12.5px; padding: 2px 0;')}><span style={css('color: #7a5f7d;')}>{s2.depositType === 'full' ? 'Paid in full — nothing more to pay' : 'Balance of ' + gbp(round2(co.total - co.deposit)) + ' due before delivery'}</span></div>
                </div>

                {stripeOn ? (
                  <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
                    <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700;')}>Card number
                      <input value={cardNum} onChange={(e) => { setCardNum(e.target.value); setPayError(null); }} placeholder="4242 4242 4242 4242" inputMode="numeric" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2; color: #4A2C4D; font-family: monospace;')} />
                    </label>
                    <div style={css('display: flex; gap: 12px;')}>
                      <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; flex: 1;')}>Expiry
                        <input value={cardExp} onChange={(e) => { setCardExp(e.target.value); setPayError(null); }} placeholder="MM/YY" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2; color: #4A2C4D; font-family: monospace;')} />
                      </label>
                      <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; flex: 1;')}>CVC
                        <input value={cardCvc} onChange={(e) => { setCardCvc(e.target.value); setPayError(null); }} placeholder="123" inputMode="numeric" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2; color: #4A2C4D; font-family: monospace;')} />
                      </label>
                    </div>
                    {!!payError && <p style={css('margin: 0; font-size: 13px; font-weight: 700; color: #c14a3e;')}>{payError}</p>}
                    <button onClick={payNow} style={css("cursor: pointer; background: #FF6F61; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 16px; padding: 15px 30px; border-radius: 999px; min-height: 50px; box-shadow: 0 4px 14px rgba(255,111,97,0.4);")}>{processing ? 'Processing…' : 'Pay ' + gbp(co.deposit) + ' now'}</button>
                    <p style={css('margin: 0; text-align: center; font-size: 11.5px; color: #7a5f7d;')}>🔒 Payments secured by Stripe · full refund up to {coRefundDays} working days before delivery</p>
                  </div>
                ) : (
                  <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
                    <p style={css('margin: 0; font-size: 13.5px; color: #7a5f7d; line-height: 1.55;')}>Card payments aren&apos;t switched on yet — send your booking request and we&apos;ll confirm within 24 hours with easy payment options.</p>
                    <button onClick={() => void finishOrder(false)} style={css("cursor: pointer; background: #4A2C4D; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 15px; padding: 14px 28px; border-radius: 999px; min-height: 48px;")}>Send booking request</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="gallery" style={css('max-width: 1060px; margin: 0 auto; padding: 24px 20px 64px; scroll-margin-top: 80px;')}>
        <h2 style={css("font-family: 'Playfair Display', serif; font-size: clamp(26px, 3.5vw, 36px); margin: 0 0 6px;")}>Recent creations</h2>
        <p style={css('margin: 0 0 24px; font-size: 15px; color: #7a5f7d;')}>Every piece is handmade to order — here are a few favourites.</p>
        <div style={css('display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;')}>
          {galleryItems.map((g) => (
            <figure key={g.id} style={css('margin: 0; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 14px rgba(74,44,77,0.08); background: #fff;')}>
              <div style={{ ...css('aspect-ratio: 1; background-color: #F8EDE9; background-size: cover; background-position: center;'), backgroundImage: `url('${img(g.src)}')` }} />
              <figcaption style={css('padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;')}>
                <span style={css('font-weight: 700; font-size: 14px;')}>{g.title}</span>
                <button onClick={copyLink} title="Copy share link" style={css("cursor: pointer; border: none; background: #FBF7F2; color: #D4AF7A; font-weight: 800; font-size: 12px; padding: 8px 12px; border-radius: 999px; font-family: 'Nunito', sans-serif;")}>Share</button>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section style={css('background: #F3C6C6;')}>
        <div style={css('max-width: 1060px; margin: 0 auto; padding: 56px 20px;')}>
          <h2 style={css("font-family: 'Playfair Display', serif; font-size: clamp(26px, 3.5vw, 36px); margin: 0 0 24px;")}>Kind words</h2>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;')}>
            {reviews.map((r) => (
              <blockquote key={r.id} style={css('margin: 0; background: #FBF7F2; border-radius: 18px; padding: 22px; box-shadow: 0 4px 14px rgba(74,44,77,0.08);')}>
                <p style={css('margin: 0 0 14px; font-size: 15px; line-height: 1.6; font-style: italic;')}>“{r.text}”</p>
                <footer style={css('font-weight: 800; font-size: 13.5px; color: #D4AF7A;')}>{r.name} <span style={css('color: #7a5f7d; font-weight: 600;')}>· {r.event}</span></footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section id="about" style={css('max-width: 1060px; margin: 0 auto; padding: 64px 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 36px; align-items: center; scroll-margin-top: 80px;')}>
        <div style={css('display: flex; gap: 14px;')}>
          <div style={css('flex: 1; aspect-ratio: 3/4; border-radius: 18px; overflow: hidden; position: relative;')}>
            <img src={img('images/about-jade.png')} alt="Jade" style={css('width: 100%; height: 100%; object-fit: cover; display: block;')} />
            <span style={css('position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); font-weight: 800; font-size: 12px; background: rgba(251,247,242,0.92); padding: 5px 12px; border-radius: 999px;')}>Jade</span>
          </div>
          <div style={css('flex: 1; aspect-ratio: 3/4; border-radius: 18px; margin-top: 28px; overflow: hidden; position: relative;')}>
            <img src={img('images/about-nicole.png')} alt="Nicole" style={css('width: 100%; height: 100%; object-fit: cover; display: block;')} />
            <span style={css('position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); font-weight: 800; font-size: 12px; background: rgba(251,247,242,0.92); padding: 5px 12px; border-radius: 999px;')}>Nicole</span>
          </div>
        </div>
        <div>
          <p style={css('margin: 0 0 10px; font-size: 12px; letter-spacing: 3px; font-weight: 800; color: #D4AF7A;')}>MEET JADE &amp; NICOLE</p>
          <h2 style={css("font-family: 'Playfair Display', serif; font-size: clamp(26px, 3.5vw, 36px); margin: 0 0 16px;")}>Two local mums, one big idea</h2>
          <p style={css('font-size: 15.5px; line-height: 1.7; margin: 0 0 14px;')}>We&apos;re Jade and Nicole — friends, single mums, and the hands behind every balloon we deliver. What started as decorating our own children&apos;s parties in Huntingdon and Stilton became the thing people kept asking us to do for theirs.</p>
          <p style={css('font-size: 15.5px; line-height: 1.7; margin: 0;')}>Every piece is built by us, in advance, with care — then delivered to your door anywhere in Cambridgeshire so all you have to do is enjoy the party.</p>
        </div>
      </section>

      <footer style={css('background: #4A2C4D; color: #FBF7F2;')}>
        <div style={css('max-width: 1060px; margin: 0 auto; padding: 44px 20px 32px; display: flex; flex-wrap: wrap; gap: 32px; justify-content: space-between;')}>
          <div>
            <p style={css("font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; margin: 0;")}>J<span style={css('color: #D4AF7A;')}>&amp;</span>N</p>
            <p style={css('font-size: 9px; letter-spacing: 3.5px; font-weight: 700; margin: 4px 0 14px;')}>BALLOON SCULPTING</p>
            <p style={css('font-size: 13.5px; margin: 0; opacity: 0.85; max-width: 34ch; line-height: 1.6;')}>Handcrafted balloon art, delivered across Cambridgeshire. Huntingdon · Stilton · and everywhere in between.</p>
          </div>
          <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
            <p style={css('font-weight: 800; font-size: 13px; letter-spacing: 1px; margin: 0;')}>GET IN TOUCH</p>
            <a href="mailto:hello@jnballoons.co.uk" style={css('color: #F3C6C6; font-size: 14px; text-decoration: none;')}>hello@jnballoons.co.uk</a>
            <button onClick={copyLink} style={css("cursor: pointer; align-self: start; background: #FF6F61; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13.5px; padding: 11px 20px; border-radius: 999px; min-height: 44px;")}>{copied ? 'Link copied ✓' : 'Copy booking link'}</button>
            {socials.length > 0 && (
              <div style={css('display: flex; gap: 12px; margin-top: 4px;')}>
                {socials.map((sl) => (
                  <a key={sl.name} href={sl.url} style={css('color: #D4AF7A; font-weight: 800; font-size: 13px; text-decoration: none;')}>{sl.name}</a>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={css('border-top: 1px solid rgba(251,247,242,0.15); text-align: center; padding: 14px; font-size: 12px; opacity: 0.7;')}>
          © 2026 J&amp;N Balloon Sculpting · <a href="/admin" style={css('color: #D4AF7A; text-decoration: none;')}>Admin</a>
        </div>
      </footer>
    </>
  );
}
