---
name: update-ui-readme
description: Regenerate src/components/ui/README.md, the component catalogue for src/components/ui/. Trigger when the user types /update-ui-readme, or when a pre-commit warning flags that ui/*.tsx changed without a matching README.md update.
effort: medium
manual: true
---

# Update UI Component Catalogue

`src/components/ui/README.md` is a hand-curated but agent-maintained catalogue of every component in `src/components/ui/` — one line per component describing what it is and when to use it, split into "Radix/shadcn primitives" and "Custom/composite components", plus a "Notable families" section for components that are meant to be used together. Its purpose is to let agents pick the right primitive without opening every file. This skill regenerates it from current source.

## Step 1 — List current components

List all files directly in `src/components/ui/` (not subdirectories). Diff this against the files already documented in the existing `README.md` — note any added, removed, or renamed files.

## Step 2 — Read every component file

Read the full contents of every `.tsx` file in `src/components/ui/`. For each file, determine:

- **Exported component name(s)** — the main exports, not every sub-export (e.g. summarize `Card, CardHeader, CardContent, etc.` rather than listing all ten).
- **Purpose** — a single line under ~15 words: what it does and when to use it over alternatives.
- **Category** — a thin wrapper around a radix-ui primitive ("Radix/shadcn primitives"), vs a custom/composite component built from other `ui/` primitives or from scratch ("Custom/composite components").
- **Relationships** — whether it's built on, or built from, other files in `ui/` (e.g. `searchable-select.tsx` combines `command.tsx` + `popover.tsx`; `password-input.tsx` builds on `input-group.tsx`).

If this is a large batch, delegate the read-and-summarize pass to a general-purpose subagent to keep it out of the main context — the same approach used to build the original catalogue.

## Step 3 — Write the file

Rewrite `src/components/ui/README.md` in place, preserving its existing structure:

1. A one-line intro describing the file's purpose (already present — keep or lightly adjust).
2. `## Radix/shadcn primitives` — a markdown table: `File | Exports | Purpose`.
3. `## Custom/composite components` — same table format.
4. `## Notable families` — bullet points calling out components meant to be used together, or built on top of one another.

Keep descriptions terse — purpose and when-to-use, not a prop list (TypeScript already gives agents accurate signatures on demand). Alphabetical order within each section, matching the existing file.

## Step 4 — Report

Summarize what changed: components added, removed, or whose description changed meaningfully. If nothing changed since the last version, say so — don't rewrite the file for a no-op.
