# Glossary for the end-user documentation system

**Project:** avut
**Date:** 2026-09-11 (time not tracked)
**Source:** brainstorm session

## Idea

A flat A–Z glossary page at `/docs/glossary`, backed by a plain TypeScript
registry of terms (not a content-collections MDX collection), paired with a
`<KeyTerms>` component that individual doc pages opt into via a `keyTerms: [...]`
frontmatter array. Each doc page shows short definitions for the terms it
lists, each linking to the term's full entry on the glossary page. This is a
follow-on to the not-yet-built
[end-user documentation](2026-09-10-end-user-documentation.md) idea and depends
on it landing first.

## Context / motivation

The parent documentation-system idea establishes MDX docs, a public `/docs`
site, and a contextual `?help=` dialog, but has no mechanism for defining
AVUT's domain vocabulary (I3, PPE templates, skill packages, D4H-specific
terms, org/module concepts) in one place. Without a glossary, either every doc
page re-explains terms inline (repetitive, inconsistent wording) or terms go
unexplained (bad for new admins and rank-and-file users). A glossary page plus
a lightweight per-page "Key terms" callout solves both: one canonical
definition per term, reusable anywhere.

## Options considered

### Storage: plain TS registry (chosen) vs content-collections collection

A glossary entry is a short piece of structured data (term, two definition
strings, optional tags/links) — not a document that benefits from MDX's
component embedding. A plain TS module (e.g. `src/lib/glossary.ts`) is simpler
to author, type, and validate than round-tripping through content-collections'
MDX pipeline for something that's really just data. Trade-off: glossary
entries don't automatically flow into the MiniSearch index the parent idea
builds for MDX pages — deferred (see Open questions).

### `keyTerms` wiring: frontmatter array (chosen) vs auto-extraction

Each doc page's frontmatter lists which glossary slugs are relevant
(`keyTerms: ["i3", "ppe-template"]`); `<KeyTerms>` looks them up and renders
short definitions. Rejected auto-scanning page body text for known terms —
fragile (false positives on common words, awkward inside code blocks), and a
step up in complexity that's better deferred to the inline-assist idea below
if it's ever built. Frontmatter population is expected to be AI-assisted (a
pass over each page's content suggesting relevant `keyTerms`), not hand-curated
from a blank slate.

### Glossary page layout: flat A–Z (chosen) vs grouped by module

A flat alphabetical list with an optional `module` badge per entry, rather
than sectioning the page by `ModuleId`. Many useful terms (Organization, Role,
Skill Package) are cross-cutting and don't belong to one module; forcing them
into module sections would need an awkward "General" catch-all. A badge keeps
the module association visible without organizing the whole page around it.

### Definitions: short + long (chosen)

Two definition strings per entry: `shortDefinition` (shown inline in
`<KeyTerms>`) and `longDefinition` (shown on the full glossary page). Plain
strings for v1 — no markdown/rich content support, to keep the registry a
clean data structure rather than something that needs its own renderer.
Revisit only if a definition genuinely needs a link or emphasis.

### Related terms: `relatedTerms` slug array (chosen)

Each entry can list related entries' slugs; the full glossary page renders
these as a "See also" list per term. Not surfaced in `<KeyTerms>` — that stays
short-definition-only to avoid ballooning a page with several key terms into
a wall of cross-links.

### Inline assist (hover/click tooltips on running text) — deferred to v2

Auto-linking glossary terms wherever they appear in doc body text (not just
curated Key Terms boxes) was on the table from the start but explicitly
deferred. It's the fiddliest piece — term matching, avoiding false positives,
avoiding double-linking inside code blocks/headings — and doesn't block v1's
value (a browsable glossary + curated per-page call-outs).

## Open questions

1. **CI validation of slugs** — `keyTerms` (in MDX frontmatter) and
   `relatedTerms` (in the registry) are free-standing slug strings; a typo
   currently fails silently (broken link / missing render) rather than
   erroring. Agreed a check is needed — likely a zod schema with a `.refine()`
   over the whole registry (all `relatedTerms` resolve to real entries) plus a
   vitest test that walks the content-collections output and checks every
   page's `keyTerms` against the registry. Exact mechanism not designed yet.
2. **Glossary search** — glossary entries aren't part of the parent idea's
   MiniSearch index (that indexes MDX pages). Explicitly deferred; revisit
   once the glossary has enough entries that "isn't in the main search" is a
   real problem.
3. **Anchor/slug scheme** — `/docs/glossary#slug` was assumed for linking to
   a specific entry; not yet confirmed the eventual glossary page will render
   entries with matching `id` attributes, or exactly how `<KeyTerms>` builds
   that link (needs the parent idea's `/docs` route to exist first).
4. **Where the registry lives in the module structure** — `src/lib/glossary.ts`
   was suggested by analogy with `src/lib/modules.ts`, not settled.

## Notes

- Hard dependency: the parent
  [end-user documentation](2026-09-10-end-user-documentation.md) idea must
  land first — this needs its `/docs/[[...slug]]` route, MDX frontmatter
  conventions, and `ModuleId` taxonomy to badge entries against.
- Proposed registry shape:
  ```ts
  type GlossaryEntry = {
    slug: string;
    term: string;
    shortDefinition: string; // shown in <KeyTerms>
    longDefinition: string; // shown on /docs/glossary
    module?: ModuleId; // optional badge
    relatedTerms?: string[]; // slugs of other entries, "See also"
  };
  ```
- `<KeyTerms>` component: reads a page's frontmatter `keyTerms: string[]`,
  looks each slug up in the registry, renders `term` + `shortDefinition`,
  links to `/docs/glossary#slug`.
- Full glossary page: A–Z listing of every entry, module badge, long
  definition, and a "See also" list from `relatedTerms`.
- Authoring workflow: frontmatter `keyTerms` arrays are expected to be
  populated by an AI pass over each doc page rather than written by hand from
  scratch.
