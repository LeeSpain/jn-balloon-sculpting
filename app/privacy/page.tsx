import type { Metadata } from "next";
import { LegalPage, LegalH2 } from "@/components/LegalPage";

// UK GDPR privacy notice for a small sole-trader business taking bookings.
// Drafted for launch — Jade & Nicole should read it once and confirm the
// details (especially the business/contact identity) before going live.
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How J&N Balloon Sculpting collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="11 July 2026">
      <p>
        J&amp;N Balloon Sculpting (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is run by Jade &amp; Nicole in
        Cambridgeshire, UK. We are the data controller for the personal information collected through
        this website. You can contact us about anything in this notice at{" "}
        <a href="mailto:hello@jnballoons.co.uk">hello@jnballoons.co.uk</a>.
      </p>

      <LegalH2>What we collect</LegalH2>
      <p>When you request a quote or place a booking, we collect:</p>
      <ul>
        <li>Your name and contact details (mobile number and/or email address)</li>
        <li>Your delivery postcode and, once a booking is confirmed, your delivery address</li>
        <li>Your event date and the details of what you ordered</li>
      </ul>
      <p>
        We do <strong>not</strong> see or store your card details. Payments are handled entirely by{" "}
        <a href="https://stripe.com/gb/privacy" rel="noopener noreferrer" target="_blank">Stripe</a>,
        a regulated payment provider — card numbers go directly to Stripe and never touch our systems.
      </p>

      <LegalH2>Why we collect it (lawful basis)</LegalH2>
      <ul>
        <li>
          <strong>To fulfil your booking</strong> — building your piece, taking payment, arranging
          delivery and contacting you about your order (performance of a contract).
        </li>
        <li>
          <strong>To respond to enquiries</strong> — replying to custom quote requests (legitimate
          interest).
        </li>
        <li>
          <strong>To keep financial records</strong> — retaining order and payment records as required
          by UK tax law (legal obligation).
        </li>
      </ul>
      <p>We do not send marketing emails, and we never sell or share your data for advertising.</p>

      <LegalH2>Who we share it with</LegalH2>
      <p>Only the service providers needed to run the site and fulfil orders:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing</li>
        <li><strong>Vercel</strong> — website hosting and database</li>
        <li><strong>Resend</strong> — sends us the email notification when you book</li>
      </ul>
      <p>Each processes data under their own GDPR-compliant terms. We share nothing else with anyone.</p>

      <LegalH2>How long we keep it</LegalH2>
      <p>
        Order records (including your name and contact details) are kept for up to 6 years to meet HMRC
        record-keeping requirements, then deleted. Enquiries that don&rsquo;t become bookings are
        deleted within 12 months.
      </p>

      <LegalH2>Cookies</LegalH2>
      <p>
        This site uses <strong>no tracking or analytics cookies</strong>. The only cookie set is an
        essential session cookie used by us (Jade &amp; Nicole) to log in to our own admin dashboard —
        it is never set on customers&rsquo; browsers. That&rsquo;s why there&rsquo;s no cookie banner:
        there&rsquo;s nothing to consent to.
      </p>

      <LegalH2>Your rights</LegalH2>
      <p>Under UK GDPR you can ask us at any time to:</p>
      <ul>
        <li>See a copy of the information we hold about you</li>
        <li>Correct anything that&rsquo;s wrong</li>
        <li>Delete your information (where we&rsquo;re not legally required to keep it)</li>
        <li>Object to or restrict how we use it</li>
      </ul>
      <p>
        Email <a href="mailto:hello@jnballoons.co.uk">hello@jnballoons.co.uk</a> and we&rsquo;ll respond
        within one month. If you&rsquo;re unhappy with how we handle your data, you can complain to the
        Information Commissioner&rsquo;s Office at{" "}
        <a href="https://ico.org.uk" rel="noopener noreferrer" target="_blank">ico.org.uk</a>.
      </p>

      <LegalH2>Changes</LegalH2>
      <p>
        If we change this notice we&rsquo;ll update it here with a new &ldquo;last updated&rdquo; date.
      </p>
    </LegalPage>
  );
}
