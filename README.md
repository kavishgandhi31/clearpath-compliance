# clearpath-compliance
Take home project for PromptArmor

## Roles and permissions

| Role | Seeded users | Can do |
|---|---|---|
| Submitter | **Marketer**, **Partner Manager** (owns the demo affiliates) | Create ads, run the check, write notes on flags, submit, resubmit |
| Reviewer | **Reviewer** | Review queue, approve / request changes / reject, handle alerts |
| Admin | Not seeded (next step) | Edit rules and approved texts. Rules are read-only in this build. |

- The sign-in screen lists roles, not people's names. The demo has no passwords.
- Nobody can approve an ad they submitted.
- Every action checks the user's role on the server. Hiding a button is never the permission check.
- Only Admins would edit rules. Rule text goes straight into the AI's instructions, so a Reviewer shouldn't be able to weaken the rules they apply.

## Assumptions

- ClearPath runs a credit check for every product, so "guaranteed approval" is always false.
- Checking your rate uses a soft credit check, which doesn't affect the credit score.
- One Reviewer approval is enough to publish. There's no second sign-off.
- Required disclosures must use the approved wording word for word (ignoring capitalization and spacing). This is normal practice: compliance keeps approved legal text so nobody paraphrases it.
- The mortgage payment example is ClearPath's standard pre-approved example. A payment disclosure has to match the numbers in the ad, so mortgage ads use this example's $1,299 payment, as real lenders do with a few pre-approved example rates.
- Affiliates don't log in. The Partner Manager submits on their behalf.
- Affiliate ads are web pages only.
- Affiliate drafts are reviewed through a preview link or an unlisted page (a real URL that isn't linked anywhere).
- Monitored web pages are dedicated to ClearPath, not a "Top 10 lenders" list where other lenders' sections change.
- Monitored web pages show their text without needing JavaScript to run.
- Rates, fees, the license number and the address in the approved texts are made up.
- Rules are simplified versions of real US consumer finance rules. This is not legal advice.

## Threat model

The main attacker is a bad affiliate: they control the page we approve, and they can change it afterwards. The second is a random visitor on the public demo.

| What they're trying to do | How | How we stop it | What's still open |
|---|---|---|---|
| Get a bad ad through with zero flags | Hide instructions to the AI on the page | Injection checks run first: a phrase search in code, then a separate Haiku call that only answers "does this text contain instructions aimed at an AI?". If either finds something, the AI rule check is skipped and the Reviewer is told to review manually. "Guaranteed approval" and required disclosures are checked in code, so they're still caught when the AI is skipped. | An instruction worded cleverly enough to get past both the phrase search and the guard |
| Talk the Reviewer into approving | Get the AI to write a convincing explanation | Every flag that points at text in the ad shows an exact quote, verified to exist in the ad. Flags for something missing, like the mortgage licensing line, have no quote. The AI returns only a rule ID, a quote, a short explanation and an optional approved-text ID. Seriousness comes from the rule, never from the AI. Only a person can approve. | A Reviewer who trusts the AI's wording too much |
| Change the page after approval | Edit the live page | Re-scan compares the page's hash with the last approved version and opens an alert if they differ | A change made and reverted between two scans |
| Show our scanner a different page | Detect the scanner and serve it a clean page | Not stopped | Scan from multiple locations and devices |
| Hide text from our code | White text on white, JavaScript-loaded text, styles from separate files | Partly: HTML comments, hidden elements and zero-size text are pulled out as hidden text and checked like visible text | Needs a real browser engine |
| Abuse the public demo | Make our server fetch internal addresses, plant a script, run up the AI bill | Safe fetch (below), demo pages edited through fields rather than raw HTML, a monthly spend limit on the API key | — |

**Safe fetch.** Our server fetches URLs that anyone can type into a public app, so every fetch:
- allows only `http://` and `https://`
- checks the address the site name points to at the moment it connects, and refuses internal ones: private networks, cloud-internal ranges, and localhost (allowed only when the app runs in development). Because the check happens on the connection itself, a site name can't point to a safe address when checked and an internal one when fetched.
- doesn't follow redirects automatically, checks each redirect target the same way, and stops after 3
- stops after 5 seconds or 2 MB, and accepts HTML only

**Demo affiliate pages** are built from a fixed template. Their edit screen has fields (headline, body text, disclosure on/off, hidden text), not raw HTML, and whatever anyone types is shown as text, never run as code.

**Rules are read-only in this build.** Editing them is a next step, planned for an Admin role only, because rule text goes straight into the AI's instructions. Whoever can edit a rule can change what the AI is told to look for.

**Reset demo data** only exists when `DEMO_MODE` is on. It uses `TRUNCATE` because the audit log's trigger rejects `UPDATE` and `DELETE`. In production there'd be no Reset, and the app's database user wouldn't have permission to `TRUNCATE`.

## Known gaps and next steps

### Affiliate cases

| Case | In this build | Next step |
|---|---|---|
| A required update isn't published, or the affiliate refuses | Alert opens. Red if the old text now breaks a rule. The Reviewer clicks Request fix. | Escalation (pause the affiliate) |
| An optional update the affiliate decides not to publish | Alert opens. The Reviewer clicks Approve as-is on the old text. | — |
| Gap between "approved" and "published" | A gray alert that closes on the next Re-scan after the affiliate publishes (there's no daily scan in this build) | Send these to the Partner Manager instead of the Reviewer |
| Publishes before approval | Alert opens | — |
| Blocks our scanner | Shows "Couldn't check" | Tell the owner after 3 failed scans in a row |
| Changes the page often | One alert per ad, updated, not a pile | A "frequent changes" signal per affiliate |
| Takes the page down | Shows "Couldn't check: page not found" | Retire button; tell the owner after repeated failures |
| Multi-lender pages | Out of scope (pages are assumed to be dedicated to ClearPath) | Mark which section belongs to ClearPath and hash only that |
| Repeat offenders | — | Pause, and count unapproved changes per affiliate over 30 days |
| Shows our scanner a different page than customers see | Not detected | Scan from multiple locations and devices |

### Next steps

**Product**
- Image ads first, then PDFs and multi-image ads. Most real banner and social ads are images, and some violations (an APR in tiny print next to a huge "0%") are only visible in the image.
- Approval expiry and a Retire button
- Rules editor for Admins, with edits logged (each check already keeps a copy of the rules it used)
- Daily automatic scans
- A fast lane for low-risk ads (needs a compliance policy on which ads qualify)
- Clone an approved ad to make a variant, so the Reviewer only checks the difference
- "Approve with edits" for text ads
- Ad assignment once there's more than one Reviewer
- Launch dates on submissions
- Comments tied to specific lines
- Stats strip: rounds per ad, % approved first time, time to approval
- When an approved text changes (e.g. new rates), find every approved ad still using the old wording
- Monitoring affiliate emails and social posts
- Everything in the "Next step" column above

**Platform**
- Real company sign-in (SSO) and real email sending
- An affiliate self-serve portal
- Headless browser scanning (JavaScript pages, CSS-hidden text)
- Uploading large originals directly to storage, with a smaller copy for the AI
- S3 with Object Lock for record retention
- State-specific rules, two-person approval for high-risk ads, rule effective dates
- GIN indexes on the rules' products, channels and sources arrays once state-specific rules grow the table into the thousands (with 11 rules, Postgres reads the whole table in under a millisecond)
