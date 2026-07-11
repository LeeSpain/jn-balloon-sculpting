import type { Metadata } from "next";
import { LegalPage, LegalH2 } from "@/components/LegalPage";

// Terms of sale for bespoke balloon pieces. Drafted for launch — Jade & Nicole
// should read once and confirm the refund window and business details match how
// they actually operate (the refund window is also configurable in Admin →
// Settings; keep the two in sync).
export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Booking, payment, delivery and cancellation terms for J&N Balloon Sculpting.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms &amp; Conditions" updated="11 July 2026">
      <p>
        These terms apply when you book a balloon piece from J&amp;N Balloon Sculpting
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;) — run by Jade &amp; Nicole in Cambridgeshire, UK. By
        placing a booking you agree to them. Contact us any time at{" "}
        <a href="mailto:hello@jnballoons.co.uk">hello@jnballoons.co.uk</a>.
      </p>

      <LegalH2>1. Quotes &amp; bookings</LegalH2>
      <ul>
        <li>
          Prices shown by the online quote builder are calculated from your chosen piece, size, theme
          and delivery postcode, and are confirmed at the point of booking.
        </li>
        <li>
          A booking request is not confirmed until we accept it — we&rsquo;ll confirm within 24 hours.
          If we can&rsquo;t fulfil a request (e.g. the date is fully booked), any payment taken is
          refunded in full.
        </li>
        <li>Custom enquiries are quoted individually and confirmed by reply.</li>
      </ul>

      <LegalH2>2. Payment</LegalH2>
      <ul>
        <li>
          Payment (in full, or a deposit where offered) is taken securely by card via Stripe at the
          time of booking, or arranged with us directly on confirmation.
        </li>
        <li>Your date is secured once payment has been received and we&rsquo;ve confirmed the booking.</li>
        <li>Any remaining balance is due before or on delivery.</li>
      </ul>

      <LegalH2>3. Delivery</LegalH2>
      <ul>
        <li>
          We deliver across Cambridgeshire. The delivery fee depends on your postcode zone and is shown
          in your quote before you book.
        </li>
        <li>
          Please make sure someone is available to receive the piece at the agreed time and that
          there&rsquo;s suitable access and space. If we can&rsquo;t deliver because no one is
          available, we&rsquo;ll try to rearrange, but a re-delivery fee may apply.
        </li>
        <li>
          Once delivered and placed, the piece is in your care — we can&rsquo;t be responsible for
          damage caused afterwards by weather, handling or the venue.
        </li>
      </ul>

      <LegalH2>4. Cancellations &amp; refunds</LegalH2>
      <ul>
        <li>
          <strong>Cancel 5 or more days before your delivery date:</strong> full refund of everything
          you&rsquo;ve paid.
        </li>
        <li>
          <strong>Cancel less than 5 days before:</strong> because every piece is made to order and
          materials are bought in advance, we may retain some or all of the payment to cover costs
          already incurred. We&rsquo;ll always be fair and tell you exactly what&rsquo;s refundable.
        </li>
        <li>
          <strong>If we cancel</strong> (illness, emergency, or anything on our side): full refund,
          always.
        </li>
        <li>
          As our pieces are made to your specification, the usual 14-day online cancellation right
          under the Consumer Contracts Regulations 2013 does not apply to bespoke goods — but the
          refund terms above do, and nothing in these terms affects your statutory rights, including
          your rights under the Consumer Rights Act 2015 if a piece is faulty or not as described.
        </li>
      </ul>

      <LegalH2>5. Our pieces &amp; safety</LegalH2>
      <ul>
        <li>
          Balloons are handmade natural products — minor variations in shade and shape from photos are
          normal and part of the charm.
        </li>
        <li>
          Latex balloons can pose a <strong>choking hazard</strong>: keep uninflated or burst balloons
          away from children under 8, and supervise young children around balloon displays. Some people
          are allergic to latex — tell us in advance and we can advise.
        </li>
        <li>Helium balloons must not be inhaled and float time varies with conditions.</li>
        <li>Please dispose of balloons responsibly — never release them outdoors.</li>
      </ul>

      <LegalH2>6. Liability</LegalH2>
      <p>
        Our liability for any booking is limited to the amount you paid for it, except where the law
        doesn&rsquo;t allow liability to be limited (such as for death or personal injury caused by our
        negligence). We are not liable for events outside our reasonable control.
      </p>

      <LegalH2>7. These terms</LegalH2>
      <p>
        These terms are governed by the law of England and Wales. If we update them, the version on
        this page at the time you book is the one that applies to your booking.
      </p>
    </LegalPage>
  );
}
