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
only (no subscription ladder for now).

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
  deliberately not one-time payments or usage/wallet billing. The wallet + metered
  overage half builds on Stripe Billing directly: **Meters** for usage events,
  **Credit Grants** for both the expiring monthly allowance and the non-expiring
  top-up balance, Checkout/PaymentIntent for the top-up purchase.
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
