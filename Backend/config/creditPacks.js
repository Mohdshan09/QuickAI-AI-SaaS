// Credit-pack definitions (spec §5-6). The application database is authoritative for
// pack pricing/credits — these are the canonical configs that scripts/seedCreditPacks.js
// upserts into the `credit_packs` table, and that admins may later edit in the DB.
// Pricing is configuration, not business logic (spec §7): price is whole INR, credits is
// granted once when a purchase of the pack is CONFIRMED.
//
// Phase 6 ships three packs (spec §5). A top-up is one-time credits, never a subscription.

export const PACK_KEYS = {
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
};

export const CREDIT_PACKS = {
  SMALL: {
    key: "SMALL",
    // Sized to a multiple of 6 (= LCM of the Match=2 / Tailor=3 costs) so it maps
    // cleanly to "3 Match Scores or 2 Tailored Resumes" with no odd leftover.
    name: "6 Credits",
    description: "A small top-up for occasional use.",
    credits: 6,
    price: 9,
    currency: "INR",
    isActive: true,
  },
  MEDIUM: {
    key: "MEDIUM",
    name: "12 Credits",
    description: "Our most popular top-up.",
    credits: 12,
    price: 99,
    currency: "INR",
    isActive: true,
  },
  LARGE: {
    key: "LARGE",
    name: "30 Credits",
    description: "Best value for heavy users.",
    credits: 30,
    price: 199,
    currency: "INR",
    isActive: true,
  },
};

export const isKnownPack = (key) =>
  Object.prototype.hasOwnProperty.call(CREDIT_PACKS, key);
