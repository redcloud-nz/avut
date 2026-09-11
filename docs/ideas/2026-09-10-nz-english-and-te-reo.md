# NZ English now, te reo Māori later

**Project:** avut
**Date:** 2026-09-10 00:00
**Source:** brainstorm session

## Idea

The app's visible copy is currently written in American English, but the entire
target audience is New Zealand. The immediate, real goal is an en-US → en-NZ copy
correction (organisation, colour, licence, -ise, DD/MM/YYYY, NZ terminology) plus a
guardrail so it doesn't regress. Full `next-intl` internationalisation and a te reo
Māori (mi-NZ) locale are a **deferred** second phase, triggered only when someone
commits to producing and maintaining a competent te reo catalogue — half-done te reo
reads worse than none.

## Context / motivation

- Built so far in en-US by default; audience is 100% NZ (redcloud-nz — NZ SAR /
  emergency services).
- en-NZ needs **no i18n infrastructure**: there is no runtime locale switching,
  everyone gets the same strings. It is a copy-editing sweep + a lint guardrail, not
  a `next-intl` project.
- en-NZ and mi-NZ differ only in words — same date format, same NZD, same number
  grouping — so even the eventual i18n work is almost purely a message-catalogue
  problem; the `Intl`/ICU formatting machinery barely matters.
- te reo is a "nice to have" bicultural gesture, not a committed requirement.

## Options considered

**Guardrail for the en-NZ sweep:**

- **cspell (`en-GB` dictionary)** — set aside as primary. It is a spelling checker,
  not an American-spelling detector; forcing it to flag `color`/`organization` means
  dropping the US dictionary, which then flags every code identifier and needs a
  large curated allowlist. Noisy for this job. Useful as an editor aid only.
- **Custom ESLint rule** — American→British word-pair list that fires only inside
  JSX text nodes and user-facing string literals. Targets exactly the problem, few
  false positives, integrates with `npm run lint`. Cost: a rule to maintain.
  _Leaning this way._
- **Standalone CI script** — regex list of American spellings scanned over `.tsx`
  visible text. Cheapest to reason about, no editor integration.

**Locale routing (phase 2):**

- **URL prefix** (`/en-NZ/orgs/[slug]/...`, next-intl default) — set aside. Wraps
  all of `src/app/` under `app/[locale]/`, breaks every `route()` call, forces a
  `next typegen` reckoning. The SEO payoff is irrelevant for an authed internal tool.
- **No prefix, locale on the better-auth user record** (next-intl "without i18n
  routing") — preferred. Toggle on `/user-settings`, cookie fallback for public /
  auth pages that have no user yet. Far smaller diff, no route restructuring.

**String migration strategy (phase 2):**

- Big-bang extraction of every visible string to `t('key')` — set aside; large,
  invasive, only pays off once locale #2 ships.
- **Opportunistic** — new code uses `t()`, screens convert to the catalogue as they
  are touched, so the catalogue exists and grows before te reo lands. Preferred.

## Open questions

- Guardrail: custom ESLint rule vs. standalone CI script — and does it block CI or
  just warn (like the existing `ui/README.md` pre-commit warning)?
- Is there anyone lined up to produce/maintain the mi-NZ catalogue? Phase 2 has no
  trigger without this.
- Are transactional emails (`src/emails/`) in scope for the en-NZ sweep now (they
  should be — they're visible copy), and for phase-2 locale handling later?
- Phase 2: per-key en-NZ fallback for partial mi-NZ coverage — merge catalogues at
  load (spread en-NZ then mi-NZ) vs. next-intl's `getMessageFallback`.
- Does D4H terminology ("Team", etc.) need alignment with our visible labels as part
  of the sweep?

## Notes

- **Hard constraint on the sweep: only user-visible text.** Code identifiers stay
  as-is — `organization` remains everywhere in code (better-auth organization
  plugin, Prisma `Organization` model, `organizationProcedure`, `/orgs/` routes).
  Only rendered labels change ("Organization" → "Organisation"). A blind
  find/replace would be catastrophic.
- Visible strings that live in `.ts` (not `.tsx`): `src/lib/modules.ts` module
  labels, `src/lib/permissions.ts` role labels. Already centralised — good. These
  become the first catalogue keys in phase 2.
- User-authored data (org names, skill names, note bodies) is never translated — it
  is data, stays as authored.
- Pre-commit is husky → `lint-staged` (`prettier --write` only) plus a bespoke
  staged-file warning block in `.husky/pre-commit`; a spelling warning could slot in
  there the same way, or live in `npm run lint` / CI.
- Date formatting: audit for `toLocaleDateString()` with no/`en-US` locale and
  hardcoded `MM/DD` formats; standardise on NZ `dd/MM/yyyy` (date-fns is already a
  dependency).
- Phase-2 library note: `next-intl` is the right call for Next 16 App Router + heavy
  RSC. Paraglide (compile-time, tree-shaken) was the plausible lighter alternative;
  less mature ecosystem, not worth the divergence.
- Phase-2 server-scope gotcha: emails are sent from tRPC mutations / server actions
  outside a request-locale scope — they'd need `createTranslator` with an explicitly
  passed locale, not `getTranslations`.
