import { NextResponse } from 'next/server';
import { loadStore, createOrder } from '@/lib/db/store';
import { priceProduct, zoneForPostcode, minDate, depositFor, round2 } from '@/lib/engine';
import type { Order } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  kind: 'book' | 'custom';
  productId: string;
  sizeId: string;
  theme: string;
  postcode: string;
  date: string;
  name: string;
  contact: string;
  paid?: boolean;
}

// Create a booking or a custom enquiry from the public site. Price and delivery are
// recomputed server-side from the engine — the client's numbers are never trusted.
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  const contact = (body.contact || '').trim();
  if (!name || !contact) {
    return NextResponse.json({ error: 'Name and contact are required.' }, { status: 400 });
  }

  const store = await loadStore();
  const product = store.products.find((p) => p.id === body.productId);
  const size = store.sizes.find((s) => s.id === body.sizeId);
  if (!product || !size) {
    return NextResponse.json({ error: 'Unknown product or size.' }, { status: 400 });
  }

  const theme = store.themes.includes(body.theme) ? body.theme : store.themes[0] || '';
  const priced = priceProduct(store, product, size.mult);
  const postcode = (body.postcode || '').toUpperCase().trim();
  const stripeConnected =
    store.settings.stripePublishable.startsWith('pk_') && store.settings.stripeSecret.length > 4;

  if (body.kind === 'custom') {
    const order = await createOrder({
      customer: name + ' (custom enquiry)',
      phone: contact,
      product: product.id,
      size: size.id,
      theme,
      postcode,
      address: '',
      date: body.date || minDate(store),
      price: 0,
      delivery: 0,
      status: 'Order received',
      depositPaid: 0,
    });
    return NextResponse.json({ order, total: 0, deposit: 0, stripeConnected });
  }

  // Standard booking — validate delivery zone and lead time.
  const zone = zoneForPostcode(store, postcode);
  if (!zone || zone.fee == null) {
    return NextResponse.json({ error: 'Postcode is outside the delivery area.' }, { status: 400 });
  }
  if (!body.date || body.date < minDate(store)) {
    return NextResponse.json({ error: 'Delivery date is inside the minimum notice window.' }, { status: 400 });
  }

  const total = priced.price + zone.fee;
  const deposit = depositFor(store, total);
  const depositPaid = body.paid && stripeConnected ? deposit : 0;

  const order: Order = await createOrder({
    customer: name,
    phone: contact,
    product: product.id,
    size: size.id,
    theme,
    postcode,
    address: '',
    date: body.date,
    price: priced.price,
    delivery: zone.fee,
    status: 'Order received',
    depositPaid,
  });

  return NextResponse.json({ order, total, deposit: round2(deposit), stripeConnected });
}
