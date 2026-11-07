import terms from "@/content/bot-terms.md?raw";
import privacy from "@/content/privacy.md?raw";
import subscriptions from "@/content/subscription-terms.md?raw";
import about from "@/content/about.md?raw";
import contact from "@/content/contact.md?raw";
import cookies from "@/content/cookies.md?raw";
import security from "@/content/security.md?raw";

export const LEGAL_DOCS = {
  about: { title: "About Ceyo", description: "Learn about Ceyo, the personal AI agent workspace owned and operated by Megsy LLC.", source: about },
  contact: { title: "Contact", description: "Contact Megsy LLC about Ceyo support, billing, privacy, account requests and security concerns.", source: contact },
  terms: { title: "Terms of Service", description: "Conditions for using Ceyo, AI output, authorized agent actions and account responsibilities with Megsy LLC.", source: terms },
  privacy: { title: "Privacy Policy", description: "How Megsy LLC processes Ceyo account data, conversations, files, recordings and connected services.", source: privacy },
  "subscription-terms": { title: "Subscription Terms", description: "Purchase disclosures, payment verification, renewals, cancellations and consumer rights for Ceyo plans.", source: subscriptions },
  cookies: { title: "Cookies & Local Storage", description: "Browser sessions, preferences, local Vault labels and device-cached recordings used by Ceyo.", source: cookies },
  security: { title: "Security", description: "Ceyo account access, encryption boundaries and reporting security concerns to Megsy LLC.", source: security },
};
export type LegalSlug = keyof typeof LEGAL_DOCS;
export const documentHead = (slug: LegalSlug) => {
  const doc = LEGAL_DOCS[slug];
  const title = `${doc.title} — Ceyo · Megsy LLC`;
  return { meta: [
    { title }, { name: "description", content: doc.description },
    { property: "og:title", content: title }, { property: "og:description", content: doc.description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] };
};