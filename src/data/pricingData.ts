// =====================================================================
// CENTRALIZED PRICING DATA — single source of truth for plans, prices,
// intro offers, services, FAQs and enterprise features.
// Imported by /pricing (desktop + mobile), workspace plans, and the
// support chat knowledge base so they NEVER drift apart.
//
// Pricing model: one paid plan, Pro at $7 for month one then $15/month.
// =====================================================================

export type PlanTier = "starter" | "pro" | "elite" | "business";

/** Monthly Ceyo Credits included with each tier. */
export const PLAN_MONTHLY_CREDITS: Record<PlanTier, number> = {
  starter: 70,
  pro: 1000,
  elite: 600,
  business: 1200,
};

/**
 * Retention offer shown right after the first successful payment:
 * "Take your second month for $7 too" with a Pay now button.
 */
export const SECOND_MONTH_OFFER = {
  enabled: true,
  price: 7,
  /** Hours the offer stays claimable after the first payment. */
  windowHours: 48,
  titleEn: "Your second month for $7",
  bodyEn:
    "You just unlocked Pro. Lock in month two at the same $7 intro price — pay now and you are covered for two full months.",
  ctaEn: "Pay $7 now",
} as const;

export interface PlanCardConfig {
  tier: PlanTier;
  name: string;
  label?: string;
  bg: string;
  text: string;
  subText: string;
  /** Standard recurring monthly price. */
  monthlyPrice: number;
  /** Yearly price = 8 × monthly (4 months free). */
  yearlyPrice: number;
  /** Promotional first-month price. */
  firstMonthPrice?: number;
  monthlyCredits: string;
  yearlyCredits: string;
  features: string[];
  monthlyFeatures?: string[];
  yearlyFeatures?: string[];
  ctaBg: string;
  ctaText: string;
  ctaHover: string;
  bubbleColor: string;
  topBadge?: boolean;
  glow?: string;
  isDark?: boolean;
}

// Specs are written in a fixed order so Pro and Max read as the same list
// with different numbers, and the headline capabilities come first:
// cloud computer → long-running tasks → agents → research → chat →
// images/video → docs & build → workspace → support.
const PRO_FEATURES = [
  "Ceyo — OpenClaw with helper agents for multi-step work",
  "Web search, browsing, coding and Python in one chat",
  "Choose from the available agent catalogue — subscribers only",
  "Live task progress and tool activity in your conversation",
  "1,000 Ceyo Credits every month",
  "Higgsfield image and video generation — subscribers only",
  "Images and videos appear directly in chat, with no separate studio",
  "Media availability depends on the provider's configured agents",
  "Priority support · cancel anytime",
];

const MAX_FEATURES = [
  ...PRO_FEATURES.filter((feature) => !feature.startsWith("1,000")),
  `${PLAN_MONTHLY_CREDITS.elite} Ceyo Credits every month`,
];

/** Yearly = 8 × monthly, i.e. 4 months free. */
export const YEARLY_FREE_MONTHS = 4;

const yearlyIntro = (savings: number, bonus: number) => [
  `Save $${savings} a year — ${YEARLY_FREE_MONTHS} months free`,
  `+${bonus.toLocaleString("en-US")} bonus MC delivered upfront`,
  "Price locked for 12 months",
];

export const PLANS: PlanCardConfig[] = [
  {
    tier: "pro",
    name: "Ceyo Pro",
    label: "",
    bg: "linear-gradient(165deg, #1e64ff 0%, #2563eb 55%, #1d4fd8 100%)",
    text: "#ffffff",
    subText: "rgba(255, 255, 255, 0.78)",
    monthlyPrice: 15,
    yearlyPrice: 120,
    firstMonthPrice: 7,

    monthlyCredits: `${PLAN_MONTHLY_CREDITS.pro} MC / month`,
    yearlyCredits: "12,000 credits / year · save $60",
    features: PRO_FEATURES,
    monthlyFeatures: PRO_FEATURES,
    yearlyFeatures: [...yearlyIntro(60, 0).slice(0, 1), ...PRO_FEATURES],

    ctaBg: "#0b1020",
    ctaText: "#ffffff",
    ctaHover: "#15203f",
    bubbleColor: "rgba(147, 197, 253, 0.45)",
    isDark: true,
  },
  {
    tier: "elite",
    name: "Max",
    bg: "linear-gradient(165deg, #8b5cf6 0%, #7c3aed 55%, #6d28d9 100%)",
    text: "#ffffff",
    subText: "rgba(255, 255, 255, 0.78)",
    monthlyPrice: 40,
    yearlyPrice: 320,
    firstMonthPrice: 17,

    monthlyCredits: `${PLAN_MONTHLY_CREDITS.elite} MC / month`,
    yearlyCredits: "Save $160 + 1,800 bonus MC",
    features: MAX_FEATURES,
    monthlyFeatures: MAX_FEATURES,
    yearlyFeatures: [...yearlyIntro(160, 1800), ...MAX_FEATURES.slice(0, 7)],

    ctaBg: "#0b0420",
    ctaText: "#ffffff",
    ctaHover: "#1a0a3a",
    bubbleColor: "rgba(216, 180, 254, 0.45)",
    topBadge: true,
    isDark: true,
  },
];

/** Short benefit lines used by the compact mobile pricing screen. */
export const PLAN_HIGHLIGHTS: Record<"pro" | "max", string[]> = {
  pro: PRO_FEATURES.slice(0, 5),
  max: MAX_FEATURES.slice(0, 5),
};

/**
 * Retention (save) offer shown when a subscriber starts the cancel flow:
 * 50% off for two months, or pause the subscription instead of cancelling.
 */
export const SAVE_OFFER = {
  enabled: true,
  discountPercent: 50,
  months: 2,
  pauseMonths: [1, 2, 3] as const,
  titleEn: "Before you cancel — keep it for half price",
  bodyEn:
    "Take 50% off your next 2 months, or pause your plan and keep everything exactly where you left it.",
  discountCtaEn: "Claim 50% off for 2 months",
  pauseCtaEn: "Pause instead",
} as const;

/** Half-price amount for the save offer, per plan tier. */
export const saveOfferPrice = (monthlyPrice: number) =>
  Math.round((monthlyPrice * (100 - SAVE_OFFER.discountPercent)) / 100);

export const getPlan = (tier: PlanTier) => PLANS.find((p) => p.tier === tier);

/**
 * Price actually charged today, plus the crossed-out reference price.
 * Monthly uses the intro (first month) price when the plan has one;
 * yearly uses the yearly price against 12× monthly.
 */
export function getDisplayPrice(plan: PlanCardConfig, yearly: boolean) {
  if (yearly) {
    const reference = plan.monthlyPrice * 12;
    return {
      price: plan.yearlyPrice,
      strike: reference,
      isIntro: false,
      discountLabel: `Save $${reference - plan.yearlyPrice}`,
      unit: "year" as const,
    };
  }
  const intro = plan.firstMonthPrice;
  if (intro && intro < plan.monthlyPrice) {
    return {
      price: intro,
      strike: plan.monthlyPrice,
      isIntro: true,
      discountLabel: `${Math.round((1 - intro / plan.monthlyPrice) * 100)}% Off`,
      unit: "1st mo" as const,
    };
  }
  return {
    price: plan.monthlyPrice,
    strike: plan.monthlyPrice,
    isIntro: false,
    discountLabel: "",
    unit: "month" as const,
  };
}

export const ENTERPRISE_FEATURES: string[] = [
  "Custom MC Allocation",
  "Priority Ceyo SI compute lane",
  "Dedicated Infrastructure",
  "SLA Guarantees",
  "Custom API Access & Integrations",
  "Enterprise Security (SOC2-ready, GDPR & Advanced Encryption)",
  "Data Privacy & Compliance",
  "Early access to new Ceyo capabilities",
  "Advanced Analytics & Reporting",
  "Dedicated Account Manager",
  "24/7 Priority Support",
  "Priority Onboarding & Training",
  "Monthly Business Reviews",
  "Volume Discounts",
  "Custom Contract, Invoicing & Billing",
];

export const SERVICES_GUIDE: { name: string; desc: string }[] = [
  { name: "Ceyo", desc: "OpenClaw handles chat, web research, browsing, coding and Python through AgentSky." },
  { name: "Helper agents", desc: "Multi-step work can be split across helper agents with live progress in chat." },
  { name: "Agent catalogue", desc: "Browse available agents. Switching agents requires an active subscription." },
  { name: "Higgsfield Images & Video", desc: "Subscriber-only media inside chat using the configured Hypit agent. Free accounts cannot generate images or videos. Availability depends on the provider." },
  { name: "Task progress", desc: "Follow the agent's actual work, tool activity and completion status." },
  { name: "Ceyo Credits", desc: "Pro includes 1,000 Ceyo Credits every month. Chat, media and agent switching are all metered against those credits — there is no free tier." },
];

export const FAQS: { q: string; a: string }[] = [
  { q: "Do I need a subscription to use Ceyo?", a: "Yes. Ceyo is a paid product: chat, research, media and agent switching all run on the Pro plan and are metered against your Ceyo Credits." },
  {
    q: "How does the introductory first month work?",
    a: "Your first month costs $7, then Pro renews at $15 a month. Each month includes 1,000 credits. You can cancel anytime.",
  },
  {
    q: "Can I change or cancel my plan anytime?",
    a: "Yes. From Billing settings you can upgrade, downgrade or cancel anytime. Upgrades are prorated and take effect immediately; downgrades and cancellations take effect at the end of the current cycle, and you keep full access until then.",
  },
  {
    q: "What are Ceyo Credits (MC)?",
    a: "Ceyo Credits are your monthly allowance and the single currency for everything Ceyo does — chat, research, browsing, coding, images and video. Every request is metered against the real usage it costs.",
  },
  {
    q: "What happens when I run out of MC?",
    a: "Top up with a credit pack — 500, 1,200 or 3,000 credits — or wait for your monthly renewal. Nothing runs without credits.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Plan credits refresh with your subscription and do not stack month to month. Purchased credit packs stay available until you use them.",
  },
  {
    q: "Do prices include tax?",
    a: "Prices are shown excluding tax. VAT/GST is calculated at checkout based on your billing country and shown before you confirm.",
  },
  {
    q: "Do you offer refunds?",
    a: 'Yes — new paid subscriptions include a 7-day no-questions-asked refund window, provided no more than 10% of your included credits have been consumed. Credit packs are non-refundable once any credit has been spent. Failed generations are auto-refunded within minutes. Message @Torekr on Telegram and we respond within 5 business days.',
  },
  {
    q: "Is my payment secure? Which payment methods do you accept?",
    a: "All Ceyo subscription payments are processed through Kashier. Your card details never touch our servers. Kashier supports card and mobile-wallet payment methods available in your checkout.",
  },
  {
    q: "Do you offer team or enterprise plans?",
    a: "Yes. Pro includes team workspaces, and for custom MC allocation, SSO, dedicated infrastructure, custom contracts or volume discounts contact our enterprise team via the Enterprise page or on Telegram @Torekr.",
  },
];
