# Billing accounts, tiers, and prepaid wallets

**Project:** avut
**Date:** 2026-09-10 20:51
**Source:** brainstorm session

## Idea

Introduce a `BillingAccount` as a new first-class entity, keyed by exactly one of
an organization or a user (a "personal account" acting outside any org) — the same
one-of union shape as `ctx.logEvent` and the `organization | user | system`
`ModuleScope` work in #92. Each billing account carries a **subscription tier**
(free by default) and a **prepaid credit wallet**. Tiers are mostly a patronage
model: the paid tier's headline value is priority/weight on feature requests, with
an included monthly AI/storage allowance as a secondary sweetener. Metered usage
(AI tokens, file storage) burns the monthly allowance first, then the prepaid
wallet; when both hit zero the cost-bearing feature is disabled until top-up. The
free tier keeps all core modules forever. Personal accounts get free tier + wallet
only (no subscription ladder for now). Leaning toward **Option B** for payments:
Stripe processes only the flat subscription and one-time top-up purchases; the
allowance, wallet balance and usage ledger live in Postgres and gate synchronously.

## Context / motivation

AVUT is greenfield commercially — no billing relationship exists today. Planned
features (file storage beyond a floor, AI integration) will incur non-negligible
per-org and per-user costs to us. Customers are small volunteer/emergency-response
orgs and individuals, not companies with procurement — so the billing model has to
be low-friction, low-risk, and must not gate core functionality or produce
surprise invoices. Personal (non-org) use is explicitly in scope: an individual
using AI on their personal notes should be able to pay for it without an org.

## Options considered

- **Prepaid credit wallet (chosen, as the overage mechanism).** Top up (e.g.
  NZD 20), usage burns the balance down, feature stops at zero. No card required
  until a user wants to spend, no debt/collections, no bill-shock disputes. Worst
  case is "AI disabled until you top up".
- **Postpaid metered billing / card on file, invoice monthly (set aside).** Fits a
  company with an AP department, not this user base. Forces a card before first
  use; we carry unpaid-invoice risk; enables run-up-then-dispute.
- **Subscription tiers (kept, as patronage + allowance).** Free tier = all core
  modules. Paid tier(s) primarily buy priority on feature requests + an included
  monthly AI/storage allowance. Framing is honestly "sponsor the project + louder
  roadmap voice", usage allowance secondary. "Priority" likely = a triage/label
  commitment on GitHub issues, tying into the existing `draft-feature` / `gh`
  issue workflow.
- **Flat "AI enabled for this org" subscription regardless of volume (set aside).**
  Doesn't cover our variable cost exposure; no natural fit for personal use.
- **Roll unused allowance over (set aside).** Standard model chosen instead:
  monthly allowance is use-it-or-lose-it and resets each cycle; top-up credit is
  money, never expires, lives in the wallet. Burn order: allowance → wallet → stop.
- **Plan as a field on `OrganizationSettings` (set aside).** Personal accounts have
  no `OrganizationSettings`, so plan lives on `BillingAccount` instead. The
  existing `OrganizationSettings.modules` toggles stay as-is; a tier may later
  influence module availability but they're separate concerns.
- **Payment rails: Stripe (chosen).** better-auth's Stripe plugin handles the
  subscription half (customer per org/user, plan management, webhook lifecycle) but
  deliberately not one-time payments or usage/wallet billing.
- **Stripe as system of record — Meters + Credit Grants (Option A, set aside for
  v1).** Metered subscription items, usage reported via the Meter Events API, the
  monthly allowance as an expiring credit grant and the top-up as a non-expiring
  one. Stripe produces correct usage invoices + Stripe Tax on everything, but it's
  two sources of truth to reconcile (Stripe grants _and_ a local counter, since
  grants only apply at invoice finalisation and can't gate in real time), hits the
  "100 unused credit grants per customer" cap, and sails close to Stripe's
  "billing credits can't be stored value" prohibited-use line.
- **Local ledger, Stripe for payments only (Option B — leaning).** Stripe handles
  exactly two taxable events: the flat monthly subscription (better-auth plugin,
  licensed price) and one-time top-up purchases (Stripe Checkout in `payment`
  mode). Allowance, wallet balance and an append-only usage ledger all live in
  Postgres; a `billingProcedure()` wrapper gates synchronously; a monthly cron
  resets the allowance. GST is cleaner — charged at credit purchase and on the
  subscription, with usage-consumption not a separate taxable supply — so no
  usage-based tax invoices at all. Migrate B → A later if Stripe should own usage
  invoicing. See "Integration sketch" below.
- **Vercel Marketplace for payments (rejected — nothing there).** Marketplace is
  storage/observability/CMS; no payment-processor resale, no native billing
  product.

## Open questions

- **Free-tier AI/storage:** some small free AI allowance, a time-boxed trial, or
  none at all? Needs a cost model for AI before deciding. Storage: what's the free
  floor (GB)?
- **"Priority feature requests" — how is it actually honoured and made visible?**
  Label + stated triage SLA on GitHub issues? A private roadmap vote? Keep it soft
  or make it semi-contractual?
- **Metering implementation.** AI = event-based (token counts per call). Storage =
  a gauge (GB-month), needs periodic measurement/snapshotting of per-account blob
  usage. Where does the usage ledger live — a Prisma table, Stripe Meters as the
  source of truth, or both (local ledger + push to Stripe)?
- **Who can manage billing?** Presumably org `owner` only — likely a new
  permission in `src/lib/permissions.ts` (e.g. `billing: ["read", "manage"]`).
  Personal account = the user themselves.
- **Enforcement point.** How does a cost-bearing tRPC procedure check "does this
  billing account have balance" before doing the work, and how is the check kept
  cheap? A `billingProcedure()` wrapper analogous to `organizationProcedure()`?
- **What happens to in-flight/committed usage when balance hits zero mid-operation**
  (e.g. a long AI job)? Hard stop, allow a small negative, or reserve credit up
  front?
- **Personal account lifecycle** — does deleting a user with wallet balance forfeit
  it? Refunds policy generally?
- **NZ GST.** Confirmed in scope: GST-registered, tax receipts/invoices for
  top-ups and subscriptions, GST shown on Stripe invoices, handling
  overseas/non-GST customers.
- Do paid **personal** subscriptions ever make sense later, or is personal
  permanently free-tier + wallet?
- **Stripe "stored value" prohibited use** — a prepaid balance for our own PAYG
  service is the approved case, but terms/framing need care: credits must not look
  like a gift card or be refundable-on-demand as cash.
- **better-auth plugin: per-user _and_ per-org subscriptions in one install** —
  confirm `referenceId` + `authorizeReference` cleanly support both.
- **AI cost estimation vs actual** — reserve-and-true-up so a near-empty wallet
  can't go materially negative on a single call.
- **NZ GST registration threshold** — check whether early revenue even requires
  registration yet.

## Integration sketch (Stripe, Option B)

**Entity mapping.** `BillingAccount` (one per org, one per personal account) ↔ one
Stripe Customer. The better-auth Stripe plugin adds `stripeCustomerId` to `user`
and `organization` plus a `subscription` table; subscriptions carry a `referenceId`
(user id _or_ organization id) so per-user and per-org subscriptions coexist in one
install. `BillingAccount` is our table — points at whichever entity, holds
`stripeCustomerId`, `tier`, `allowanceRemaining`, `walletBalanceCents`.

**Two layers.** Stripe = money layer (real payments, receipts, GST). Postgres =
enforcement layer. Stripe credit grants apply only at invoice finalisation, so they
can't be the real-time "is there balance" gate — that check must be a local
counter regardless of which option.

**Local state.** `BillingAccount.allowanceRemaining`, `walletBalanceCents`, and an
append-only `UsageLedgerEntry` table (debit per AI call / storage snapshot; credit
per top-up). Consumption burns allowance first, then wallet.

**Flows:**

- _Subscribe:_ `authClient.subscription.upgrade()` → Stripe Checkout →
  `checkout.session.completed` → plugin updates `subscription`; our
  `onSubscriptionCreated` hook sets `tier` + seeds `allowanceRemaining`
  (`ctx.logEvent` in a `$transaction`).
- _Top up:_ custom tRPC mutation opens a Stripe Checkout session (`mode: "payment"`,
  line item "AVUT credit NZD 20", Stripe Tax on) → `checkout.session.completed`
  (distinguished by metadata) → transaction: `walletBalanceCents +=`, write ledger
  credit, `ctx.logEvent`.
- _Consume:_ `billingProcedure()` pre-checks `allowanceRemaining + walletBalanceCents
  > estimatedCost`; after the provider call returns real token counts, a
transaction writes the debit, decrements allowance-then-wallet, `ctx.logEvent`.
  > Long calls: reserve an estimate up front, true up after.
- _Monthly reset:_ Vercel Cron → handler iterates billing accounts, resets
  `allowanceRemaining`, one ledger entry each. Unattended → open a `LogBatch` with
  an `Operations`-registry `operationKey` for provenance.

**Webhooks.** One endpoint. The plugin consumes the subscription events via its
handler; pass the rest through `onEvent` — top-up `checkout.session.completed`,
`invoice.payment_failed` (→ drop paid tier to free). Verify signature with
`stripeWebhookSecret`. Every state change → `ctx.logEvent` in `$transaction`.

## Notes

- Union shape precedent: `ctx.logEvent` one-of `organizationId | ownerId |
scope: "system"` (see AGENTS.md "Audit logging"); `ModuleScope` in
  `src/lib/modules.ts`; pseudo global-org / Personal Account work in issue #92 and
  PR #84 (see `[[project-pseudo-global-org]]`).
- `BillingAccount` should be created lazily or alongside org creation / user
  signup — every org and every user needs exactly one.
- Module gating today: `OrganizationSettings.modules` keyed by `ModuleId`,
  `configurableModuleIds` in `src/lib/modules.ts`. AI/storage would likely be new
  cost-gated capabilities rather than modules per se.
- Pair every wallet mutation (top-up, burn, allowance reset) with `ctx.logEvent`
  inside `ctx.prisma.$transaction([...])` per
  `docs/patterns/transactional-writes.md`. A monthly allowance-reset cron is an
  unattended run → needs a `LogBatch` for provenance (see AGENTS.md).
- better-auth Stripe plugin: <https://better-auth.com/docs/plugins/stripe>
- Stripe primitives to evaluate: Meters, Credit Grants / Billing Credits,
  usage-based pricing, Checkout for one-time top-ups.
- Existing issue workflow for the "priority feature request" benefit: the
  `draft-feature` skill and `gh` sub-issues convention (`[[reference-gh-sub-issues]]`).
- Consider a `system-admin` surface for viewing/adjusting any billing account
  (grants, comps for volunteer orgs, refunds).
