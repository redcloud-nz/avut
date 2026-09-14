# Review: The public policy pages against New Zealand law

**Date:** 2026-09-13
**Scope:** `src/app/(public)/(marketing)/policies/terms-of-service/page.tsx` and
`.../policies/privacy/page.tsx` as they stand, read against the personal
information the app actually holds (`prisma/schema.prisma`), the third parties it
sends that information to (`package.json`, `src/server/`), and the sign-up flow
that is meant to bind users to the terms.
**Related:** [#152](https://github.com/redcloud-nz/avut/pull/152) (the rewrite this
review motivated), and the V1 issues it opened —
[#146](https://github.com/redcloud-nz/avut/issues/146),
[#147](https://github.com/redcloud-nz/avut/issues/147),
[#148](https://github.com/redcloud-nz/avut/issues/148),
[#149](https://github.com/redcloud-nz/avut/issues/149),
[#150](https://github.com/redcloud-nz/avut/issues/150),
[#151](https://github.com/redcloud-nz/avut/issues/151).
Recommendations 2 and 6 below remain open and are tracked in #147 and the
legal sign-off noted in the status block.

> **Status (2026-09-14):** both pages have since been rewritten on this branch,
> addressing recommendations 1, 3, 4, 5, 7 and 8 below. Two decisions taken after
> this review was written supersede parts of the analysis: the operating entity is
> **Alex Westphal** (Christchurch, New Zealand), not Redcloud Development Ltd,
> pending permission to use the company; and health information is now **prohibited**
> outright rather than accommodated. Recommendations 2 (legal sign-off on the
> liability clause) and 6 (clickwrap at sign-up) remain open. The findings below are
> left as written, as the snapshot that motivated the rewrite.

> **Not legal advice.** This is an engineering-side reading of the two documents
> against the statutes named below, written to brief a New Zealand tech/privacy
> lawyer rather than to replace one. Every statutory claim below is cited so it
> can be checked; the conclusions drawn from them have not been.

Statutes relied on, in the form they stood at the date above: **Privacy Act
2020** (IPPs in s 22, breach notification in Part 6, agent/principal in s 11),
**Consumer Guarantees Act 1993** (s 43), **Fair Trading Act 1986** (ss 9, 13,
26A, 46M, as amended by the Fair Trading Amendment Act 2021 in force 16 August
2022), **Contract and Commercial Law Act 2017** Part 4, **Health Information
Privacy Code 2020**.

## Bottom line

Both documents are generic boilerplate drafted without reference to what AVUT
is. The privacy policy is roughly 200 words and does not come close to meeting
IPP 3. The terms contain at least three clauses that are unenforceable or legally
risky in New Zealand — one of which, the liability exclusion, is arguably a Fair
Trading Act breach in its own right, independently of whether anyone ever tries
to rely on it.

The gap is not drafting polish. It is that neither document reflects a
multi-tenant B2B product holding personnel records for volunteer
emergency-services organisations.

## 1. The structural problem: two legal roles, one document

This is the most important finding, and most of the rest follows from it.

Under **s 11 Privacy Act 2020**, information held by an agent solely for
safekeeping or processing on behalf of another agency is deemed held by _the
principal_, not the agent. AVUT sits on both sides of that line at once:

| Data                                                                        | Who is the "agency"       | Who owes the IPP duties |
| --------------------------------------------------------------------------- | ------------------------- | ----------------------- |
| `users`, `sessions`, `accounts` — people who sign up                        | Redcloud Development Ltd  | Us                      |
| `personnel`, `team_memberships`, `skill_checks`, `notes`, `i3_issued_items` | The customer organisation | Them, with us as agent  |

The privacy policy is written as though the first row were the whole product. The
bulk of the personal information in the database is the second row — people whose
names, emails, team memberships and assessment results sit in `personnel`
(`prisma/schema.prisma:383`) and `skill_checks`, and who have never visited the
site, never read the policy, and have no relationship with us at all.

Two consequences:

- **The privacy policy is the wrong instrument for most of the data.** It should
  say plainly that for organisation-uploaded data Redcloud acts as agent under
  s 11, that the customer organisation is the agency responsible for IPP 3 notice
  and for IPP 6/7 requests, and that we assist the customer rather than dealing
  with individuals direct.
- **The terms must impose that obligation on the customer.** Nothing in the
  current ToS requires a customer to have a lawful basis for uploading personnel
  data, to have given its own people IPP 3 notice, or to handle access requests.
  There is no data processing agreement anywhere in the repo. If a customer
  uploads a roster it had no right to upload, we have no contractual protection.

Highest-value fix: an "Organisation Data" section in the ToS with a matching
section in the privacy policy.

## 2. Privacy policy, against the IPPs

### IPP 3 — what you must tell people. Fails on most limbs

IPP 3(1) requires telling the individual: the fact of collection, the purpose,
the intended recipients, **the name and address of the agency collecting and of
the agency that will hold it**, whether supply is voluntary or required, the
consequences of not supplying, and the IPP 6/7 rights of access and correction.
The policy gives a vague purpose and nothing else. In particular:

- **Neither document names Redcloud Development Ltd.** The only place the legal
  entity appears in either file is the copyright header
  (`policies/privacy/page.tsx:2`). A reader cannot tell who is collecting their
  information, who they are contracting with, or who to sue. IPP 3(1)(d) requires
  the name _and address_. Add company name, NZBN, and a New Zealand street
  address.
- **No intended recipients disclosed.** From the codebase these are at minimum
  Vercel (hosting; `@vercel/blob` for storage), the Postgres host
  (`POSTGRES_PRISMA_URL`, `src/server/prisma.ts:12`), Resend for transactional
  email (`resend` in `package.json`), and D4H where an organisation connects it.
  Named sub-processors are standard practice and IPP 3(1)(c) effectively requires
  the categories.

### IPP 2 — collection from the individual concerned. Not addressed

Both D4H sync and manual personnel entry collect information about people _from
someone other than those people_. The IPP 2(2) exceptions almost certainly cover
this — collection from the individual would prejudice the purpose, or the
information is publicly available, or the individual authorised it — but the
policy should say which. The D4H pull deserves explicit mention, since data flows
in from a third-party platform without the subject's involvement.

### IPP 7 — correction. States a GDPR right, not a New Zealand one

> "You have the right to access, correct, or **delete** your personal
> information. You can also **object to the processing** of your data in certain
> circumstances." — `policies/privacy/page.tsx:44-45`

Neither a general right to erasure nor a right to object exists under the Privacy
Act. Conversely the policy omits the right that does exist and is distinctively
local: under **IPP 7(3)**, where correction is declined the individual may require
a **statement of the correction sought** to be attached, and we must take
reasonable steps to ensure that statement travels with the information on future
use or disclosure.

That is a real operational requirement with schema implications — `Person`
(`prisma/schema.prisma:383`) and `SkillCheck` would need somewhere to carry such
a statement.

Promising a deletion right we cannot honour is worse than silence: it is a
representation we will breach the first time a customer's own retention
obligations conflict with it.

### IPP 9 — retention. Absent

Personal information must not be kept longer than required for the purposes for
which it may lawfully be used. There is no retention section in either document.

The audit-log design already makes a deliberate retention decision:
`LogEntry.userId` is `onDelete: SetNull` with `actorLabel` preserved
(`prisma/schema.prisma:286-288`), and the `scope: "system"` arm is specifically
architected to outlive the user it describes (AGENTS.md, "Audit logging"). That is
sound — an audit trail that vanishes with its subject is not an audit trail — but
it is exactly the retention-beyond-account-deletion that IPP 9 requires us to
justify and disclose. Document what survives account deletion, in what form, for
how long, and why.

### IPP 12 — cross-border. Needs care; the common mistake is over-applying it

IPP 12 restricts _disclosure_ to a foreign person or entity, and the hosting stack
is offshore. But the Privacy Commissioner's position is that sending information
to an overseas provider that merely holds or processes it **on our behalf** is not
a disclosure — s 11 treats that provider as our agent — so IPP 12 generally does
not bite for Vercel, the Postgres host, or Resend. What does apply is IPP 5: we
remain responsible for the security safeguards.

IPP 12 engages properly only where an overseas party uses the data for its **own**
purposes. So the fix is transparency plus IPP 5 diligence — state where data is
hosted, state that overseas providers act as agents under s 11, confirm the
safeguards — not a scramble for model contract clauses.

### Part 6 — breach notification. Absent, and carries an offence

Since December 2020 a **notifiable privacy breach**, being one it is reasonable to
believe has caused or is likely to cause serious harm, must be notified to the
Privacy Commissioner and to affected individuals as soon as practicable. Failing
to notify the Commissioner is an offence carrying a fine up to $10,000.

Because we are an agent for customer data, the terms must also allocate this: we
notify the customer within a fixed window, the customer notifies OPC and its own
people. Without that clause a breach becomes a two-party argument during the worst
week of the year.

### Complaints — no pathway

Standard New Zealand practice is to name a privacy officer contact and to tell
people they may complain to the Office of the Privacy Commissioner. **Section 201**
requires an agency to appoint a privacy officer; naming them costs nothing and
signals competence.

### Undisclosed: system-admin impersonation

`src/server/auth-log-hooks.ts` and `LogEntry.impersonatorId`
(`prisma/schema.prisma:289-290`) show that system administrators can assume
another user's session, and therefore view customer organisation data through that
user's own eyes. This is disclosed nowhere.

It is a legitimate support feature and logging it was the right call, but it needs
a line in the privacy policy and in the ToS, ideally with the assurance that it is
logged and auditable. Undisclosed staff access is what turns a minor incident into
a trust-destroying one.

### A risk the free-text fields create

`Person.properties` is untyped JSON, `Note` is rich text, and `tags` is an open
string array. Customers will put things there we did not anticipate — medical
restrictions, fitness-for-duty notes, incident details. If any customer is a
health agency, the **Health Information Privacy Code 2020** applies to that
information in place of the IPPs, with stricter rules.

The acceptable-use clause should either prohibit health and other sensitive
information in free-text fields, or we accept the HIPC may apply and build to it.
Given the SAR/USAR-adjacent user base, worth raising early rather than
discovering later.

## 3. Terms of Service, and the enforceability problems

### Clause 6, limitation of liability — unenforceable against many customers

Under **s 43 Consumer Guarantees Act 1993** you cannot contract out of the
consumer guarantees. The narrow s 43(2) exception requires that the services be
supplied _and acquired_ in trade, that both parties are in trade, that the
exclusion is agreed in writing, and that it is fair and reasonable. The clause
satisfies none of these — and critically, **we cannot assume customers are in
trade**. A volunteer SAR group or an incorporated society acquiring a tool for
non-commercial use is very likely not acquiring it in trade, so the guarantees
apply in full and the exclusion is void against them.

Worse, **s 13(i) Fair Trading Act 1986** makes it an offence to make a false or
misleading representation concerning the existence or effect of any guarantee,
right or remedy. A blanket "we shall not be liable" put to a consumer who in fact
holds non-excludable CGA rights is itself capable of being misleading conduct, and
the Commerce Commission has acted on this pattern. The fix is a clause that
expressly preserves CGA rights where they apply and caps liability only so far as
the law permits.

The cap is also drafted as "the amount you paid us, **if any**". On a free tier
that is a cap of zero — a total exclusion wearing a cap's clothing.

### Clauses 5 and 2, termination and unilateral variation — likely unfair terms

Since 16 August 2022 the **s 26A FTA** unfair contract terms regime covers not
only standard form consumer contracts but **small trade contracts**, those with a
relationship value under $250,000 per annum. Essentially every AVUT customer falls
into one category or the other, so the regime applies whether or not we think of
ourselves as B2B. Two clauses map onto the illustrative examples in **s 46M(2)**:

- **Termination** — "at any time, without notice … or for any other reason"
  (`terms-of-service/page.tsx:49-51`) is a term permitting one party but not the
  other to terminate. With no data export right on termination, the practical
  effect is that a customer can lose access to its entire personnel and assessment
  history without warning or recourse. That is a significant imbalance not
  reasonably necessary to protect our legitimate interests.
- **Variation** — "we will notify you of any changes by posting the new terms on
  this page" with continued use as acceptance (`terms-of-service/page.tsx:31-33`)
  is a term permitting one party but not the other to vary. Silent posting is not
  notice, and at general contract law it is doubtful a variation is effected at
  all.

Fix both by narrowing: terminate for material breach on notice with a cure period,
reserve immediate suspension for genuine security or unlawful-use grounds, give a
defined data export window (say 30 days) after termination, and notify material
variations by email with a stated effective date.

### Formation — browsewrap, not clickwrap

"By accessing or using our services, you agree to be bound"
(`terms-of-service/page.tsx:25-27`) is the weakest form of assent, and
`src/components/auth/sign-up.tsx` contains no reference to the terms at all — the
only links anywhere are in `src/components/nav/public-footer.tsx:26-31`. If we
ever need to enforce these terms, showing incorporation by notice will be hard.

Cheap to fix with machinery we already have: a required checkbox at sign-up, with
acceptance recorded through `ctx.logEvent` carrying the terms version and
timestamp. **Part 4 of the Contract and Commercial Law Act 2017** supports
electronic assent, so a logged tick-box gives a clean evidential record.

### Substantive gaps

The terms never say what the service _is_, what it costs, what availability is
promised, who owns customer data, what licence we take over it, or what happens to
it at exit. For a SaaS agreement holding an organisation's operational personnel
records, data ownership and exit rights are the clauses a customer's own lawyer
looks for first.

Also missing: warranty disclaimer, indemnity, third-party service disclaimer (we
should not be liable for D4H's availability or data accuracy), experimental
features (the TanStack DB collections are flagged experimental in AGENTS.md),
force majeure, assignment, severability, no-waiver, notices, and a jurisdiction
clause. Clause 7 picks New Zealand law but is silent on **forum** — add exclusive
jurisdiction of the New Zealand courts. Note that a governing-law clause cannot
oust CGA or FTA protections for New Zealand customers regardless.

### The open-source question

AVUT is MIT-licensed, but the terms do not address the relationship between the
MIT licence on the code and the terms governing the hosted service at avut.nz. One
clause distinguishing them stops anyone arguing the MIT grant carries obligations
into the service.

## 4. What is fine — do not over-correct

Worth stating explicitly, because the reflexive instinct is to import GDPR
practice that New Zealand law does not require:

- **No cookie banner is needed.** New Zealand has no ePrivacy-equivalent consent
  requirement. Cookies engage the Privacy Act only insofar as they involve
  personal information, and our session cookies are strictly necessary for
  authentication. Disclose them in the policy; do not add a consent wall.
- **No DPIA obligation.** Privacy impact assessments are recommended OPC practice,
  not a statutory requirement.
- **Choosing New Zealand law is correct** for a NZ company serving NZ emergency
  services. Just add the forum.
- **D4H token handling is genuinely good.** AES-256-GCM with a per-operation
  random IV and an authentication tag (`src/server/encrypt.ts:18`) is a proper
  IPP 5 safeguard for third-party credentials. Say so in the policy — specific,
  verifiable security statements are worth far more than "appropriate technical
  and organizational measures", which is close to meaningless and, if it ever
  proved untrue, is itself a **s 9 FTA** misleading-conduct exposure.
- **The audit log is a compliance asset.** Immutable, actor-attributed,
  batch-correlated, surviving user deletion in anonymised form. Most small SaaS
  products cannot demonstrate who accessed what. Lean on it in the policy rather
  than leaving it invisible.

## 5. Small but concrete

**Rendering bug in the ToS contact line.** At
`src/app/(public)/(marketing)/policies/terms-of-service/page.tsx:70-71`, JSX
strips the trailing whitespace-with-newline between the text and the `<a>`, so the
page currently renders:

> please contact us atsupport@avut.nz

Fix with an explicit `{" "}` after "at".

Minor, but they add up on a page whose whole job is to look credible:

- The dates disagree in value and format — ToS "January 1, 2025"
  (`terms-of-service/page.tsx:18`), privacy "12 April, 2025" with a stray comma
  (`privacy/page.tsx:18`).
- The privacy policy uses US spelling ("organizational",
  `privacy/page.tsx:39`) against the NZ spelling used throughout the rest of
  the repo.
- The privacy policy has no "changes to this policy" section at all.
- `Argus` is described in AGENTS.md as a centred card layout for auth and form
  pages; it is an odd fit for long-form legal prose. A presentation call, not a
  legal one.

## Recommendations, in order

1. **Name the legal entity and address** in both documents. Cheapest fix, and
   IPP 3(1)(d) requires it outright. Minutes.
2. **Rewrite the liability clause** to preserve CGA rights. This is the one with
   active FTA exposure today. Needs legal sign-off.
3. **Add the agent/agency split** to both documents, with customer obligations for
   IPP 3 notice and IPP 6/7 requests. Needs legal sign-off; the technical facts
   are in §1 above.
4. **Rebuild the privacy policy against IPP 3** — recipients, sub-processors,
   retention, breach notification, complaints pathway, admin impersonation, D4H
   inflow. A day's drafting once §1 is settled.
5. **Narrow termination and variation** out of s 26A risk, and add a data export
   window. The export window is also an engineering task.
6. **Add clickwrap at sign-up**, logged via `ctx.logEvent`. Half a day, no legal
   input needed beyond the final wording.
7. **Fill the ToS gaps** — service description, data ownership, exit, D4H
   disclaimer, jurisdiction, boilerplate.
8. **Decide the sensitive-information question** — prohibit health information in
   free-text fields, or build for the HIPC. A product decision, wanted before the
   customer base grows.

Items 1, 2 and 5 are the ones worth not leaving in production. Item 8 is the one
worth deciding early, because retrofitting the HIPC is far more expensive than
designing for it.

Taking this to a New Zealand tech/privacy lawyer as a brief, rather than a blank
page, should cut the cost of the redraft substantially.
