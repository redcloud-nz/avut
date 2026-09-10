# UI component playground

**Project:** avut
**Date:** 2026-09-11 16:20
**Source:** brainstorm session

## Idea

A flag-gated area at `/orgs/[slug]/playground` for exercising UI components in
isolation against the real app runtime — session, current org, tRPC, query
client, nav shell. The index page lists one route per component
(`/orgs/[slug]/playground/person-picker`, …); each subpage is a live sandbox with
bespoke controls that twiddle props/state, nothing persisted. Gated by a single
global boolean feature flag (`playgroundFlag`), on in dev, off elsewhere until
flipped. Not a registry module and not linked from anywhere — you reach the index
by URL, then navigate within it via a contextual sidebar.

## Context / motivation

- Wanting to just play with components, and to run design reviews and demos,
  without wiring a half-built component into a real page behind real data.
- The decisive constraint: the first target component is the **person picker**,
  which needs `useOrganization()`, an org-scoped tRPC people query, and probably
  behaves differently outside org context. A top-level `/playground` route can't
  provide that without mocking, which defeats the purpose. Being under
  `/orgs/[slug]/…` isn't ceremony — it's the whole value.
- There's already an ad-hoc precedent: the scratch convention
  (`orgs/[slug]/system/scratch/<task>/`, gitignored except README) for throwaway
  visual tests. This is the durable, structured version.
- No Storybook / Ladle / Histoire in the repo, and adding one wouldn't give you
  the live org/auth/tRPC context that the interesting components need.

## Options considered

- **Full module** (new `OrganizationModuleId`, `Modules` entry,
  `OrganizationSettings.modules` gate, nav switcher icon) — rejected as too heavy;
  don't want per-org opt-in or a first-class nav presence.
- **Sub-route under the existing `system` area**
  (`/orgs/[slug]/system/playground`) — viable and lighter on the route tree, but
  `/orgs/[slug]/playground` is cleaner and the `system` area carries its own
  connotations. Chose the top-level org path.
- **Top-level `/playground` (flag only, no org)** — rejected: no org/auth/tRPC
  context, so the components worth testing can't render for real.
- **Just formalize the scratch convention** (index + shared harness over
  `system/scratch/`) — rejected: still gitignored throwaway pages; wanted checked-in
  routes that ship behind the flag for demos from a real deployment.
- **Curated stories (Storybook-style, scenarios checked in per component)** vs.
  **live sandbox (pick a component, twiddle controls, nothing persisted)** — chose
  live sandbox.
- **Generic prop-introspection engine** vs. **bespoke controls per page** — chose
  bespoke; each subpage is a hand-written `page.tsx` with its own control panel.
- **Access when the flag is on**: any signed-in org member (stated preference) vs.
  also gating on the `system-admin` role in production (recommended as the safer
  default, since the flag is then the only thing between a plain member and
  whatever a playground page renders — e.g. the person-picker page exposes the
  org's full people list). Left as an open question.

## Open questions

- **Access gate**: flag-only (any org member) or flag + `system-admin` role in
  production? Flag-only is simpler and matches the stated intent; the role gate is
  safer once a playground page renders something a plain member shouldn't see.
  Middle option: flag-only on the layout, individual pages add their own
  `<Protect>` where needed.
- **"On in dev" mechanism**: rely on setting the flag's value in the Vercel
  `development` environment (`vercel flags enable playground-module --environment
development`), matching how the existing module flags are described, or add a
  `decide: () => process.env.NODE_ENV === "development" ? true : undefined` so it's
  true locally with zero platform setup. Existing flags in `src/lib/flags.ts` use
  neither — they're pure `defaultValue: false` + platform.
- **Flag key name**: `playground-module` (consistent with `i3-module`,
  `notes-module`) even though it isn't a registry module, or just `playground`.
- **Seed set beyond `person-picker`**: leave at one page to start, or also stub
  buttons / toasts / combobox / date pickers.
- **Contextual sidebar source**: derive from `playground/_registry.ts` (one nav
  item per entry). Confirmed the sidebar in question is the in-playground
  contextual one, not the top-level switcher.

## Notes

Concrete entry points:

- `src/lib/flags.ts` — add `playgroundFlag = flag<boolean>({ key: "...",
adapter: vercelAdapter(), defaultValue: false, description, options:
booleanOptions })`. Exact copy of the three existing module flags.
- `src/app/(authenticated)/orgs/[slug]/playground/layout.tsx` — mirror
  `notes/layout.tsx`: `if (!(await playgroundFlag())) notFound();` then
  `return <ModuleSidebar scope="organization">{children}</ModuleSidebar>`. Omit
  the `settings.modules.*.enabled` check — not a settings-gated module. Still call
  `requireOrganization(slug)` for the access check.
- The contextual sidebar is whatever `children` the layout passes into
  `ModuleSidebar` (`src/components/nav/module-sidebar.tsx`). Playground passes a
  nav list built from the registry.
- `src/lib/modules.ts` — **not touched.** No `OrganizationModuleId`, no `Modules`
  entry. That's what keeps it out of `ModuleListMenu` (the top switcher) and the
  dashboard, satisfying "not linked from anywhere."
- `src/app/(authenticated)/orgs/[slug]/playground/_registry.ts` — typed
  `{ slug: string; title: string; description: string }[]`, drives the index page
  and the contextual sidebar.
- `src/app/(authenticated)/orgs/[slug]/playground/_components/harness.tsx` — shared
  frame: viewport-width switcher, light/dark toggle, reset, and a slot for the
  page's own control panel. A plain local component, not a codenamed `blocks/`
  entry (this is dev tooling, not product layout).
- `src/app/(authenticated)/orgs/[slug]/playground/page.tsx` — index, maps the
  registry.
- `src/app/(authenticated)/orgs/[slug]/playground/person-picker/page.tsx` — first
  sandbox.
- Run `npx next typegen` after adding the pages (new `page.tsx` files) so
  `route()` / typed routes resolve.
- Existing `resolveModuleFlags` / `OrganizationProvider` `moduleFlags` plumbing is
  irrelevant here — playground's layout evaluates its own flag directly.
- Ships to real deployments behind the flag, so demos can run from a preview or
  prod URL once the flag is enabled there.
