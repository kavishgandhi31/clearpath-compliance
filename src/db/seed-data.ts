import type { approvedTexts, rules, users } from "./schema";

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
