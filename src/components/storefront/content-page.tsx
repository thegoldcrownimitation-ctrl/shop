import { Link } from "@tanstack/react-router";
import { Instagram, ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { brand } from "@/data/store";
import { isShopifyConfigured } from "@/lib/shopify";

export type ContentKind =
  "about" | "contact" | "faq" | "shipping" | "returns" | "privacy" | "terms";

export const contentTitles: Record<ContentKind, string> = {
  about: "Our Story",
  contact: "Let's Connect",
  faq: "Frequently Asked Questions",
  shipping: "Shipping Information",
  returns: "Returns & Exchanges",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

const faqs = [
  [
    "Can I place an order?",
    isShopifyConfigured
      ? "Yes! Browse our collection, choose your pieces, add them to your bag and proceed to checkout. Our checkout is powered by Shopify and supports all major payment methods."
      : "Not yet. This website is in demo mode. You can explore the sample collection and try the shopping bag, but checkout and payments are unavailable until Shopify is connected.",
  ],
  [
    "Are the products and prices accurate?",
    isShopifyConfigured
      ? "Yes. All products, prices and availability shown are pulled directly from our Shopify store in real time."
      : "No. Demo listings use illustrative images, sample names and prices. Approved photographs and current prices will replace these before sales begin.",
  ],
  [
    "Where is The Gold Crown based?",
    `The Gold Crown is based in Chandkheda, Ahmedabad, Gujarat. Our address is: ${brand.address}.`,
  ],
  [
    "How do I enquire about a piece?",
    "Message us on Instagram @thegoldcrownimitation or use our contact page. We're happy to help with any questions.",
  ],
  [
    "What are your shipping and return policies?",
    isShopifyConfigured
      ? "We ship across India. Shipping rates and estimated delivery times are shown at checkout. For returns and exchanges, please see our returns policy."
      : "Delivery areas, shipping charges and return eligibility will be published before live checkout becomes available.",
  ],
  [
    "What payment methods do you accept?",
    isShopifyConfigured
      ? "We accept all major credit and debit cards, UPI, net banking, and other payment methods available through Shopify Payments at checkout."
      : "Payment methods will be configured on Shopify before orders are accepted.",
  ],
  [
    "How should I care for imitation jewellery?",
    "Keep jewellery dry and store pieces separately to avoid scratching. Avoid direct contact with perfumes, hairsprays or cleaning chemicals. Wipe gently with a soft dry cloth after use.",
  ],
  [
    "How do I track my order?",
    isShopifyConfigured
      ? "Once your order is dispatched, you will receive a confirmation email with tracking details. You can also log in to your Customer Account dashboard on this site to view live tracking and shipment updates."
      : "Order tracking will be available in your customer account once your Shopify store is live.",
  ],
];

export function ContentPage({ kind }: { kind: ContentKind }) {
  return (
    <div className="page-width content-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>{contentTitles[kind]}</span>
      </div>
      <p className="eyebrow text-primary">THE GOLD CROWN</p>
      <h1>{contentTitles[kind]}</h1>
      {kind === "about" ? (
        <>
          <h2>Where Every Look Deserves a Crown.</h2>
          <p>
            The Gold Crown is an imitation jewellery brand based in Chandkheda, Ahmedabad, Gujarat.
            Our world brings together necklace sets, earrings, bangles and jewellery for dressing up
            and celebrating.
          </p>
          <p>
            A finishing touch can carry so much meaning: the joy of a festival, the anticipation of
            a special occasion, or simply a moment for yourself. That is the spirit behind The Gold
            Crown.
          </p>
          <h2>Our collection, your expression</h2>
          <p>
            Browse our full collection online or follow our Instagram for the latest arrivals and
            inspiration. Every piece is chosen with care to help you find the look that feels
            perfectly you.
          </p>
          <Link className="text-link" to="/shop">
            Explore the collection <ArrowUpRight size={16} />
          </Link>
        </>
      ) : kind === "contact" ? (
        <>
          <p>
            We'd love to hear from you. Reach out on Instagram or visit us at our store in
            Chandkheda, Ahmedabad.
          </p>
          <a
            className="contact-action text-primary"
            href={brand.instagram}
            target="_blank"
            rel="noreferrer"
          >
            <Instagram size={20} />
            @thegoldcrownimitation
            <ArrowUpRight size={17} />
          </a>
          <div className="contact-details">
            <div className="contact-detail-item">
              <MapPin size={18} />
              <div>
                <h3>Visit us</h3>
                <p>{brand.address}</p>
              </div>
            </div>
            <div className="contact-detail-item">
              <Mail size={18} />
              <div>
                <h3>Email us</h3>
                <p>
                  Message us on Instagram for the fastest response, or use the contact form on our
                  social profiles.
                </p>
              </div>
            </div>
          </div>
          <h2>Find us in Chandkheda</h2>
          <p>
            We are located in Chandkheda, Ahmedabad — a vibrant neighbourhood in Gujarat. Please
            confirm opening hours on our Instagram before visiting.
          </p>
        </>
      ) : kind === "faq" ? (
        faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))
      ) : (
        <Policy kind={kind} />
      )}
    </div>
  );
}

function Policy({ kind }: { kind: "shipping" | "returns" | "privacy" | "terms" }) {
  return (
    <>
      {!isShopifyConfigured && (
        <p className="demo-note">
          Pre-launch information. Live orders are not yet accepted. This policy will be updated
          before checkout is enabled.
        </p>
      )}
      {kind === "shipping" ? (
        <>
          <h2>Delivery coverage</h2>
          <p>
            {isShopifyConfigured
              ? "We ship across India. Delivery availability and shipping rates are shown at checkout based on your delivery address."
              : "Delivery destinations and shipping charges will be confirmed before live orders are accepted."}
          </p>
          <h2>Dispatch &amp; tracking</h2>
          <p>
            {isShopifyConfigured
              ? "Orders are typically processed within 1–3 business days. You will receive a tracking link by email once your order is dispatched."
              : "Processing times and tracking will be published once fulfilment is configured."}
          </p>
          <h2>Shipping charges</h2>
          <p>
            {isShopifyConfigured
              ? "Shipping charges are calculated at checkout based on your delivery location and order weight. Free shipping thresholds may apply — check at checkout."
              : "Shipping rates will be set in Shopify before checkout opens."}
          </p>
          <h2>Questions?</h2>
          <p>
            If you have any questions about your order, please{" "}
            <Link to="/contact" className="underline">contact us</Link>.
          </p>
        </>
      ) : kind === "returns" ? (
        <>
          <h2>Return eligibility</h2>
          <p>
            {isShopifyConfigured
              ? "If you receive a damaged or incorrect item, please contact us within 7 days of delivery with photographs of the item. We will arrange an exchange or refund as appropriate."
              : "The return window, exchange conditions and refund process are being finalised."}
          </p>
          <h2>How to request a return</h2>
          <p>
            Contact us via Instagram or our{" "}
            <Link to="/contact" className="underline">contact page</Link> with your order number
            and a description of the issue. We will guide you through the return process.
          </p>
          <h2>Non-returnable items</h2>
          <p>
            For hygiene reasons, certain jewellery items (particularly earrings) may not be
            eligible for return unless damaged or faulty. Contact us to confirm before returning.
          </p>
          <h2>Questions?</h2>
          <p>
            Visit our{" "}
            <Link to="/contact" className="underline">contact page</Link> for available contact
            channels.
          </p>
        </>
      ) : kind === "privacy" ? (
        <>
          <h2>Information we collect</h2>
          <p>
            {isShopifyConfigured
              ? "When you place an order or create an account, we collect the information necessary to fulfil your order — such as your name, address and email. This data is processed through Shopify's secure platform."
              : "The demo shopping bag is held in temporary application memory. No personal data or payment information is collected."}
          </p>
          <h2>How we use your information</h2>
          <p>
            {isShopifyConfigured
              ? "Your information is used to process your order, communicate order status, and provide customer support. We do not sell your personal data to third parties."
              : "No personal data is collected or processed in demo mode."}
          </p>
          <h2>Cookies &amp; analytics</h2>
          <p>
            This website may use cookies to improve your browsing experience. By using our site,
            you consent to the use of cookies in accordance with this policy.
          </p>
          <h2>Third-party services</h2>
          <p>
            Our checkout is powered by Shopify, which has its own privacy policy. Instagram links
            take you to a separate website governed by Meta's privacy practices.
          </p>
          <h2>Your rights</h2>
          <p>
            You have the right to access, correct or delete your personal data. Please{" "}
            <Link to="/contact" className="underline">contact us</Link> to exercise these rights.
          </p>
          <h2>Questions?</h2>
          <p>
            Visit our{" "}
            <Link to="/contact" className="underline">contact page</Link> or contact us through
            Instagram.
          </p>
        </>
      ) : (
        <>
          <h2>Use of this website</h2>
          <p>
            By using The Gold Crown website, you agree to these terms. This site is operated by
            The Gold Crown imitation jewellery, based in Chandkheda, Ahmedabad, Gujarat, India.
          </p>
          <h2>Products &amp; pricing</h2>
          <p>
            {isShopifyConfigured
              ? "All products and prices are subject to availability. We reserve the right to change prices at any time. Images are representative; slight variations in colour or finish may occur."
              : "Products and prices shown are for preview purposes only and are not offers for sale."}
          </p>
          <h2>Orders &amp; payment</h2>
          <p>
            {isShopifyConfigured
              ? "By placing an order you agree to purchase the selected items at the prices shown. Payment is processed securely through Shopify. Your order is confirmed once payment is successfully processed."
              : "No orders or payments can be placed in demo mode."}
          </p>
          <h2>Intellectual property</h2>
          <p>
            All content on this website — including images, text and brand elements — is owned
            by The Gold Crown and may not be reproduced without permission.
          </p>
          <h2>Questions?</h2>
          <p>
            Visit our{" "}
            <Link to="/contact" className="underline">contact page</Link> for available contact
            channels.
          </p>
        </>
      )}
    </>
  );
}
