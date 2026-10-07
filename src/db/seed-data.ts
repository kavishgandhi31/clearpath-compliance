import type { Flag } from "../check/types";
import type { Channel, Product, Source, approvedTexts, decisions, demoPages, rules, users } from "./schema";

const allProducts = ["personal_loan", "credit_card", "mortgage"] as const;
const allChannels = ["email", "social_post", "web_page"] as const;
const allSources = ["clearpath", "affiliate"] as const;

export const seedUsers: (typeof users.$inferInsert)[] = [
  { name: "Marketer", email: "marketer@clearpath.example", role: "submitter" },
  { name: "Partner Manager", email: "partner.manager@clearpath.example", role: "submitter" },
  { name: "Reviewer", email: "reviewer@clearpath.example", role: "reviewer" },
];

export const seedApprovedTexts: (typeof approvedTexts.$inferInsert)[] = [
  {
    id: "personal_loan_terms",
    name: "Personal loan terms",
    text: "APRs range from 7.99% to 35.99%. Loan terms from 24 to 60 months. An origination fee of up to 8% may apply. All loans subject to credit approval.",
  },
  {
    id: "credit_card_intro_apr",
    name: "Credit card intro APR",
    text: "0% intro APR on purchases for 15 months from account opening. After that, a variable APR of 20.24%–29.24% applies, based on your creditworthiness. Annual fee: $0.",
  },
  {
    id: "prequalification_disclaimer",
    name: "Prequalification disclaimer",
    text: "Checking your rate won't affect your credit score. Prequalification is not a commitment to lend. Final approval requires a full credit review.",
  },
  {
    id: "mortgage_payment_example",
    name: "Mortgage payment example",
    text: "The $1,299 monthly payment is principal and interest on a $215,500, 30-year fixed-rate loan at 6.050% interest (6.182% APR). Payment does not include taxes and insurance; actual payment will be greater. Rates subject to change. Subject to credit approval.",
  },
  {
    id: "mortgage_licensing_line",
    name: "Mortgage licensing line",
    text: "ClearPath Financial, NMLS #9990001. Equal Housing Opportunity.",
  },
  {
    id: "affiliate_disclosure",
    name: "Affiliate disclosure",
    text: "Advertiser disclosure: we may receive compensation from ClearPath Financial when you apply through links on this page.",
  },
  {
    id: "email_footer",
    name: "Email footer",
    text: "You're receiving this because you signed up for updates from ClearPath Financial. Unsubscribe. ClearPath Financial, 100 Market Street, Suite 400, Columbus, OH 43215.",
  },
];

export function approvedText(id: string) {
  return seedApprovedTexts.find((t) => t.id === id)!.text;
}

export const seedRules: (typeof rules.$inferInsert)[] = [
  {
    id: "payment_terms_need_apr",
    name: "Payment terms need APR",
    aiInstruction:
      "If the ad states a payment amount, the number of payments or the loan length, a down payment, or a dollar amount of interest or fees, it must also show the APR and the repayment terms. If the rate can increase, the ad must say so. A mortgage ad that shows a payment must say the payment doesn't include taxes and insurance.",
    products: ["personal_loan", "mortgage"],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "Truth in Lending Act (Reg Z)",
  },
  {
    id: "rates_stated_as_apr",
    name: "Rates stated as APR",
    aiInstruction:
      "Any interest rate in the ad must be stated as an APR, and the APR must not be shown less prominently than any other rate.",
    products: [...allProducts],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "Reg Z",
  },
  {
    id: "intro_rate_details",
    name: "Intro rate details",
    aiInstruction:
      "An introductory rate must be labeled \"intro\", say how long it lasts, and state the rate that applies after it ends.",
    products: ["credit_card"],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "Reg Z",
  },
  {
    id: "no_guaranteed_approval",
    name: "No guaranteed approval",
    bannedPhrases: ["guaranteed approval", "no credit check", "everyone qualifies"],
    aiInstruction:
      "The ad must not claim or imply, in any wording, that approval is guaranteed, that there is no credit check, or that everyone qualifies.",
    products: [...allProducts],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "Deceptive-practices law (UDAAP)",
  },
  {
    id: "prequalification_isnt_approval",
    name: "Prequalification isn't approval",
    aiInstruction:
      "Prequalification must not be described as \"pre-approved\" or \"approved\", and the ad must say that prequalification is not a commitment to lend.",
    products: ["personal_loan", "mortgage"],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "UDAAP",
  },
  {
    id: "mortgage_licensing_line",
    name: "Mortgage licensing line",
    requiredApprovedTextId: "mortgage_licensing_line",
    products: ["mortgage"],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "State licensing law, fair housing advertising rules",
  },
  {
    id: "no_discriminatory_language",
    name: "No discriminatory language",
    aiInstruction:
      "The ad must not express a preference or limitation based on race, color, religion, national origin, sex, marital status, age, receiving public assistance, or exercising consumer credit rights. For mortgage ads, this also covers familial status and disability.",
    products: [...allProducts],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "Equal Credit Opportunity Act, Fair Housing Act",
  },
  {
    id: "no_false_no_fees",
    name: "No false \"no fees\"",
    aiInstruction:
      "The ad must not say \"no fees\", \"free\", or anything similar when fees apply to the product.",
    products: [...allProducts],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "UDAAP",
  },
  {
    id: "unproven_claims",
    name: "Unproven claims",
    aiInstruction:
      "Claims like \"lowest rates\" or \"save $500\" need proof. Flag comparative, superlative, or savings claims.",
    products: [...allProducts],
    channels: [...allChannels],
    sources: [...allSources],
    severity: "warning",
    basedOn: "UDAAP",
  },
  {
    id: "email_requirements",
    name: "Email requirements",
    aiInstruction:
      "The email must include an unsubscribe option and a physical mailing address, and the subject line must not be misleading.",
    products: [...allProducts],
    channels: ["email"],
    sources: [...allSources],
    severity: "blocker",
    basedOn: "CAN-SPAM",
  },
  {
    id: "affiliate_disclosure",
    name: "Affiliate disclosure",
    requiredApprovedTextId: "affiliate_disclosure",
    products: [...allProducts],
    channels: ["web_page"],
    sources: ["affiliate"],
    severity: "blocker",
    basedOn: "FTC endorsement rules",
  },
];

export const seedAffiliates = [
  { name: "LoanFinder", website: "https://loanfinder.example", contactEmail: "partners@loanfinder.example", owner: "Partner Manager" },
  { name: "CardCompare", website: "https://cardcompare.example", contactEmail: "affiliates@cardcompare.example", owner: "Partner Manager" },
  { name: "RateRadar", website: "https://rateradar.example", contactEmail: "team@rateradar.example", owner: "Partner Manager" },
];

export type DemoPageFields = { headline: string; body: string; showDisclosure: boolean; hiddenText: string };

export type SeedContent =
  | { kind: "text"; subject: string | null; text: string }
  | { kind: "page"; url: string; page: DemoPageFields };

type SeedVersion = {
  hoursAgo: number;
  content: SeedContent;
  flags: Flag[];
  decision?: { hoursAgo: number; decision: (typeof decisions.$inferSelect)["decision"]; comment: string | null };
};

type SeedScan =
  | { hoursAgo: number; failureReason: string }
  // flags: the check run on the live text, needed when it doesn't match the last approved version
  | { hoursAgo: number; content: SeedContent; flags?: Flag[] };

// Times are hours before the seed runs, so every Reset gives the same wait times.
export type SeedAd = {
  title: string;
  product: Product;
  channel: Channel;
  source: Source;
  affiliate: string | null;
  owner: string;
  createdHoursAgo: number;
  // defaults to the latest version's content
  draft?: SeedContent;
  draftChecks?: { hoursAgo: number; content: SeedContent; flags: Flag[] }[];
  notes?: { hoursAgo: number; ruleId: string; quote: string | null; note: string }[];
  versions?: SeedVersion[];
  scans?: SeedScan[];
};

const days = (n: number) => n * 24;

const homebuyerDraft = "Own your home for $1,299/month! You're pre-approved. Our lowest rates of the year.";

function homebuyerEmail(subject: string, opening: string): SeedContent {
  return {
    kind: "text",
    subject,
    text: [
      opening,
      approvedText("mortgage_payment_example"),
      approvedText("prequalification_disclaimer"),
      approvedText("mortgage_licensing_line"),
      approvedText("email_footer"),
    ].join("\n\n"),
  };
}

const lowestRatesFlag: Flag = {
  kind: "rule",
  ruleId: "unproven_claims",
  quote: "Our lowest rates of the year.",
  explanation: "A claim about rate levels that needs proof.",
  foundBy: "ai_check",
  approvedTextId: null,
};

const homebuyerDraftFlags: Flag[] = [
  {
    kind: "rule",
    ruleId: "mortgage_licensing_line",
    quote: null,
    explanation: "The mortgage licensing line is missing.",
    foundBy: "text_check",
    approvedTextId: "mortgage_licensing_line",
  },
  {
    kind: "rule",
    ruleId: "payment_terms_need_apr",
    quote: "Own your home for $1,299/month!",
    explanation: "States a monthly payment without the APR, the loan terms, or that taxes and insurance aren't included.",
    foundBy: "ai_check",
    approvedTextId: "mortgage_payment_example",
  },
  {
    kind: "rule",
    ruleId: "prequalification_isnt_approval",
    quote: "You're pre-approved.",
    explanation: "Calls the reader pre-approved before any credit review, and doesn't say prequalification isn't a commitment to lend.",
    foundBy: "ai_check",
    approvedTextId: "prequalification_disclaimer",
  },
  {
    kind: "rule",
    ruleId: "email_requirements",
    quote: null,
    explanation: "No unsubscribe option or physical mailing address.",
    foundBy: "ai_check",
    approvedTextId: "email_footer",
  },
  lowestRatesFlag,
];

const lowestRatesNote = {
  ruleId: "unproven_claims",
  quote: "Our lowest rates of the year.",
  note: "Our 30-year fixed rate is the lowest it's been since January. The rate history is in this month's pricing sheet.",
};

const lowestRatesComment = "Remove 'lowest rates of the year' unless Legal has backing.";
const withLowestRates = "Own your home for $1,299/month! See if you prequalify. Our lowest rates of the year.";
const withoutLowestRates = "Own your home for $1,299/month! See if you prequalify.";

function summerLoanEmail(opening: string): SeedContent {
  return {
    kind: "text",
    subject: "Plans for this summer?",
    text: [
      opening,
      approvedText("personal_loan_terms"),
      approvedText("prequalification_disclaimer"),
      approvedText("email_footer"),
    ].join("\n\n"),
  };
}

const summerNoCreditCheck = summerLoanEmail(
  "Home projects, travel or a big purchase: a ClearPath personal loan gives you one fixed monthly payment. See if you prequalify online. No credit check to see your rate.",
);

const noCreditCheckFlag: Flag = {
  kind: "rule",
  ruleId: "no_guaranteed_approval",
  quote: "No credit check",
  explanation: "Uses the banned phrase \"no credit check\".",
  foundBy: "text_check",
  approvedTextId: null,
};

function everydayCardPost(opening: string): SeedContent {
  return {
    kind: "text",
    subject: null,
    text: [
      opening,
      approvedText("credit_card_intro_apr"),
      "Apply at clearpath.example/everyday. Subject to credit approval.",
    ].join("\n\n"),
  };
}

const loanFinderBody = (extraSentence: string) =>
  [
    `ClearPath offers fixed-rate personal loans from $2,000 to $40,000 for home repairs, medical bills, or combining credit card balances into one monthly payment.${extraSentence} You can check your rate on ClearPath's site before you apply.`,
    approvedText("personal_loan_terms"),
    approvedText("prequalification_disclaimer"),
  ].join("\n\n");

const loanFinderV1: DemoPageFields = {
  headline: "LoanFinder review: ClearPath personal loans",
  body: loanFinderBody(" In our testing, it's the best personal loan for most people."),
  showDisclosure: true,
  hiddenText: "",
};

const loanFinderV2: DemoPageFields = { ...loanFinderV1, body: loanFinderBody("") };

const loanFinderBestFlag: Flag = {
  kind: "rule",
  ruleId: "unproven_claims",
  quote: "In our testing, it's the best personal loan for most people.",
  explanation: "A superlative claim (\"the best personal loan\") that needs proof.",
  foundBy: "ai_check",
  approvedTextId: null,
};

const cardCompareBody = (opening: string) => [opening, approvedText("credit_card_intro_apr")].join("\n\n");

const cardCompareV1: DemoPageFields = {
  headline: "CardCompare review: the ClearPath Everyday card",
  body: cardCompareBody("The ClearPath Everyday card is a straightforward card for everyday spending."),
  showDisclosure: true,
  hiddenText: "",
};

const cardCompareLive: DemoPageFields = {
  ...cardCompareV1,
  body: cardCompareBody("The ClearPath Everyday card is a simple card for groceries, gas and other everyday spending."),
};

const rateRadarV1: DemoPageFields = {
  headline: "RateRadar: ClearPath personal loan rates",
  body: ["A quick look at ClearPath's personal loans before you apply.", approvedText("personal_loan_terms")].join("\n\n"),
  showDisclosure: true,
  hiddenText: "",
};

const page = (url: string, fields: DemoPageFields): SeedContent => ({ kind: "page", url, page: fields });

export const seedDemoPages: (typeof demoPages.$inferInsert)[] = [
  { slug: "loanfinder", ...loanFinderV2 },
  { slug: "cardcompare", ...cardCompareLive },
];

export const seedAds: SeedAd[] = [
  {
    title: "First-time buyer email",
    product: "mortgage",
    channel: "email",
    source: "clearpath",
    affiliate: null,
    owner: "Marketer",
    createdHoursAgo: 1,
    draft: { kind: "text", subject: "Ready to buy your first home?", text: homebuyerDraft },
  },
  {
    title: "Renter outreach email",
    product: "mortgage",
    channel: "email",
    source: "clearpath",
    affiliate: null,
    owner: "Marketer",
    createdHoursAgo: 6,
    draftChecks: [
      {
        hoursAgo: 5.5,
        content: { kind: "text", subject: "Thinking about buying instead of renting?", text: homebuyerDraft },
        flags: homebuyerDraftFlags,
      },
    ],
    notes: [{ hoursAgo: 4.5, ...lowestRatesNote }],
    versions: [
      {
        hoursAgo: 4,
        content: homebuyerEmail("Thinking about buying instead of renting?", withLowestRates),
        flags: [lowestRatesFlag],
      },
    ],
  },
  {
    title: "Move-up buyer email",
    product: "mortgage",
    channel: "email",
    source: "clearpath",
    affiliate: null,
    owner: "Marketer",
    createdHoursAgo: 76,
    draftChecks: [
      { hoursAgo: 75.5, content: { kind: "text", subject: "Ready for more space?", text: homebuyerDraft }, flags: homebuyerDraftFlags },
    ],
    notes: [{ hoursAgo: 75, ...lowestRatesNote }],
    versions: [
      {
        hoursAgo: 74.5,
        content: homebuyerEmail("Ready for more space?", withLowestRates),
        flags: [lowestRatesFlag],
        decision: { hoursAgo: 22, decision: "changes_requested", comment: lowestRatesComment },
      },
    ],
  },
  {
    title: "Spring mortgage email",
    product: "mortgage",
    channel: "email",
    source: "clearpath",
    affiliate: null,
    owner: "Marketer",
    createdHoursAgo: days(40),
    draftChecks: [
      {
        hoursAgo: days(40) - 0.5,
        content: { kind: "text", subject: "Homebuying season is here", text: homebuyerDraft },
        flags: homebuyerDraftFlags,
      },
    ],
    notes: [{ hoursAgo: days(40) - 1, ...lowestRatesNote }],
    versions: [
      {
        hoursAgo: days(40) - 1.5,
        content: homebuyerEmail("Homebuying season is here", withLowestRates),
        flags: [lowestRatesFlag],
        decision: { hoursAgo: days(39), decision: "changes_requested", comment: lowestRatesComment },
      },
      {
        hoursAgo: days(38),
        content: homebuyerEmail("Homebuying season is here", withoutLowestRates),
        flags: [],
        decision: { hoursAgo: days(38) - 4, decision: "approved", comment: null },
      },
    ],
  },
  {
    title: "Summer loan email",
    product: "personal_loan",
    channel: "email",
    source: "clearpath",
    affiliate: null,
    owner: "Marketer",
    createdHoursAgo: days(75),
    draftChecks: [{ hoursAgo: 50, content: summerNoCreditCheck, flags: [noCreditCheckFlag] }],
    notes: [
      {
        hoursAgo: 49,
        ruleId: "no_guaranteed_approval",
        quote: "No credit check",
        note: "Checking your rate is a soft pull, so there's no credit check at this step.",
      },
    ],
    versions: [
      {
        hoursAgo: days(75) - 1,
        content: summerLoanEmail(
          "Home projects, travel or a big purchase: a ClearPath personal loan gives you one fixed monthly payment. See if you prequalify online.",
        ),
        flags: [],
        decision: { hoursAgo: days(74), decision: "approved", comment: null },
      },
      {
        hoursAgo: 48,
        content: summerNoCreditCheck,
        flags: [noCreditCheckFlag],
        decision: {
          hoursAgo: 26,
          decision: "rejected",
          comment:
            "'No credit check' can't appear in any ad, even with context. Every loan still needs a full credit review, and the prequalification disclaimer already covers the soft pull.",
        },
      },
    ],
  },
  {
    title: "Everyday card post",
    product: "credit_card",
    channel: "social_post",
    source: "clearpath",
    affiliate: null,
    owner: "Marketer",
    createdHoursAgo: days(30),
    versions: [
      {
        hoursAgo: days(30) - 1,
        content: everydayCardPost("Meet the ClearPath Everyday card."),
        flags: [],
        decision: { hoursAgo: days(29), decision: "approved", comment: null },
      },
      {
        hoursAgo: 30,
        content: everydayCardPost("Big purchase coming up? Spread it out with the ClearPath Everyday card."),
        flags: [],
      },
    ],
  },
  {
    title: "LoanFinder review page",
    product: "personal_loan",
    channel: "web_page",
    source: "affiliate",
    affiliate: "LoanFinder",
    owner: "Partner Manager",
    createdHoursAgo: days(35),
    draftChecks: [{ hoursAgo: days(35) - 1, content: page("/demo/loanfinder", loanFinderV1), flags: [loanFinderBestFlag] }],
    notes: [
      {
        hoursAgo: days(35) - 1.5,
        ruleId: "unproven_claims",
        quote: "In our testing, it's the best personal loan for most people.",
        note: "This is LoanFinder's own editorial opinion, not a claim ClearPath is making.",
      },
    ],
    versions: [
      {
        hoursAgo: days(35) - 2,
        content: page("/demo/loanfinder", loanFinderV1),
        flags: [loanFinderBestFlag],
        decision: {
          hoursAgo: days(34),
          decision: "changes_requested",
          comment:
            "Affiliate pages count as our advertising. Please ask LoanFinder to remove 'the best personal loan for most people'.",
        },
      },
      {
        hoursAgo: days(33) + 8,
        content: page("/demo/loanfinder", loanFinderV2),
        flags: [],
        decision: { hoursAgo: days(33), decision: "approved", comment: null },
      },
    ],
    scans: [
      { hoursAgo: days(33) - 1, content: page("/demo/loanfinder", loanFinderV2) },
      { hoursAgo: 24, content: page("/demo/loanfinder", loanFinderV2) },
    ],
  },
  {
    title: "CardCompare page",
    product: "credit_card",
    channel: "web_page",
    source: "affiliate",
    affiliate: "CardCompare",
    owner: "Partner Manager",
    createdHoursAgo: days(25),
    versions: [
      {
        hoursAgo: days(25) - 1,
        content: page("/demo/cardcompare", cardCompareV1),
        flags: [],
        decision: { hoursAgo: days(24), decision: "approved", comment: null },
      },
    ],
    scans: [
      { hoursAgo: days(24) - 1, content: page("/demo/cardcompare", cardCompareV1) },
      { hoursAgo: 72, content: page("/demo/cardcompare", cardCompareLive), flags: [] },
    ],
  },
  {
    title: "RateRadar page",
    product: "personal_loan",
    channel: "web_page",
    source: "affiliate",
    affiliate: "RateRadar",
    owner: "Partner Manager",
    createdHoursAgo: days(50),
    versions: [
      {
        hoursAgo: days(50) - 1,
        content: page("/demo/rateradar", rateRadarV1),
        flags: [],
        decision: { hoursAgo: days(49), decision: "approved", comment: null },
      },
    ],
    scans: [
      { hoursAgo: days(49) - 1, content: page("/demo/rateradar", rateRadarV1) },
      { hoursAgo: 48, failureReason: "page not found (404)" },
    ],
  },
];
