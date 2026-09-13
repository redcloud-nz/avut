---
name: avut-doc-screenshots
description: Use when capturing, re-capturing, or adding product screenshots to the end-user documentation (content/docs/**, the /docs site, the in-app ?help= sheet) or the marketing home page — covers which browser tool to use, how to get a clean frame, the standard sizes, uploading to Vercel Blob, and wiring the <Screenshot> into MDX
---

# Capture documentation screenshots

## Overview

Docs screenshots are **not** committed to the repo. They live in a Vercel Blob store; git carries
only `src/lib/screenshots.generated.json`, an index mapping a screenshot `id` to its public URL,
intrinsic size, and alt text. MDX references an id via `<Screenshot id="…" />`.

The design and the reasoning behind every rule here is in
[`docs/specs/docs-screenshots.md`](../../../docs/specs/docs-screenshots.md) — read it if something
below seems arbitrary. This skill is the operational loop: Phase 1 is manual capture, so a human or
agent drives a browser and runs the upload helper. Phase 2 (a Playwright script + `manifest.ts`)
isn't built yet; when it is, it should encode exactly what follows.

**The loop:** pick id and size → drive the browser → capture PNG → `npm run screenshot` → reference
in MDX → verify → clean up.

## Prerequisites

1. **A running local dev server.** Check with the user before starting one — they usually have one
   up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`.
2. **The `SCREENSHOTS_READ_WRITE_TOKEN`** in `.env.local` (the `npm run screenshot` script loads it).
   This is a *dedicated* Blob store — not `BLOB_READ_WRITE_TOKEN`, which belongs to another store.
3. **A demo account** (below).

### Demo data — update this block when `seed:demo` is rewritten

<!-- SEED-DEPENDENT: everything in this section comes from prisma/seed-demo.ts -->

| | |
| --- | --- |
| Organization | `Erehwon Response Team` — slug **`demo`**, so URLs are `/orgs/demo/…` (note the spelling: *Erehwon*) |
| Accounts | `owner@demo.avut.nz`, `assessor@demo.avut.nz`, `member@demo.avut.nz` |
| Password | `erehwon-demo` (the `DEMO_SEED_PASSWORD` default in `prisma/seed-demo.ts`) |

Personnel are synthetic (`@demo.avut.nz`), so there is nothing to redact. **Never** shoot the other
orgs — `Christchurch CDEM` and `NZRT Steering Group` hold real-looking data.

## Step 1 — Choose the id, the rung, and the viewport

`id` must match `^[a-z0-9-]+(/[a-z0-9-]+)*$` and is conventionally `<module>/<thing>`, e.g.
`skill-track/session-skills`. It becomes the Blob pathname, so it is effectively permanent —
re-uploading the same id overwrites in place and keeps every existing MDX reference working.

Sizes are fixed by the spec (§4.1). The short version:

| What you're shooting | Size |
| --- | --- |
| A dialog, form, card, single panel or toolbar | element crop, ≤ 500px wide |
| A table with its toolbar, a page header, one report card | element crop, ≤ 768px wide |
| A whole page on desktop | **1280 × 800**, sidebar collapsed |
| A whole page on a phone | **390 × 844** |

Two rules that are easy to get wrong:

- **A page capture keeps the whole frame.** Never trim it down to where the content happens to stop.
  Two page shots in the same doc should be the same size, and a page whose content runs past the
  fold should look like it does in the app, scrollbar and all.
- **Capture at DPR 1.** `upload.ts` records intrinsic pixel dimensions and `<Screenshot>` treats them
  as CSS px, so a 2× capture of a 500px card would be stored as `width: 1000` and then rendered 768px
  wide — a 1.5× upscale.

Light mode only for now; `<Screenshot>` falls back to the light source when there's no dark variant.

## Step 2 — Use the DevTools MCP, not claude-in-chrome

**Use `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`.** The claude-in-chrome tools return
**JPEG** and paint a **mouse cursor into the frame** — both disqualifying for docs. The DevTools MCP
gives PNG, no cursor, and can capture a single element by `uid`.

```
new_page          → opens a page in its own Chrome (separate profile; you will sign in again)
resize_page       → sets the VIEWPORT, not the window
take_screenshot   → format: "png", optional uid, filePath
```

Set the viewport and then **verify it**, because window size ≠ viewport and a DPR of 2 would silently
break the sizing rules:

```js
// evaluate_script
() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio })
// expect exactly { iw: 1280, ih: 800, dpr: 1 }
```

## Step 3 — Sign in as the demo user, do NOT impersonate

```js
// evaluate_script
async () => {
  localStorage.setItem("theme", "light");
  await window.avut.signIn({ email: "owner@demo.avut.nz", password: "erehwon-demo" });
}
```

Impersonating (`window.avut.impersonateUser`) puts a **yellow "You are impersonating…" banner across
the top of every page**, which ruins every capture. Sign in directly as the account whose role you
need — that is what the three demo accounts are for. See [avut-test-in-browser](../avut-test-in-browser/SKILL.md)
for the `window.avut` API in general.

## Step 4 — Clean the frame

After each **hard** navigation, inject:

```js
// evaluate_script
() => {
  let s = document.getElementById("avut-shot-css");
  if (!s) { s = document.createElement("style"); s.id = "avut-shot-css"; document.head.appendChild(s); }
  s.textContent = `nextjs-portal{display:none!important}
*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}`;
}
```

- `nextjs-portal` is the Next dev-indicator badge — it sits bottom-left, directly over the sidebar's
  user footer.
- Killing transitions/animations stops a half-finished fade landing in the frame; killing the caret
  stops a blinking cursor showing up in an autofocused input.

**The sidebar** is collapsed for desktop page shots unless the navigation is the subject. Collapse it
once per browser profile and it now sticks — the state persists via the `sidebar_state` cookie, which
the authenticated layout reads to seed `defaultOpen`. To toggle it without worrying about focus:

```js
() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }))
```

Then confirm: `document.querySelector('[data-slot="sidebar"]')?.dataset.state === "collapsed"`.

## Step 5 — Capture to a PNG

Save into **`.screenshots/`** at the repo root (gitignored). The DevTools MCP refuses to write
outside the workspace roots, so the session scratchpad is not an option.

For an **element** crop, take a snapshot to get the `uid`, then pass it — this crops exactly to the
element with no arithmetic:

```
take_snapshot   → find e.g. uid=1_2 dialog "New Session"
take_screenshot → { format: "png", uid: "1_2", filePath: ".screenshots/create-session.png" }
```

For a **page**, omit `uid` and capture the viewport as-is:

```
take_screenshot → { format: "png", filePath: ".screenshots/session-skills.png" }
```

Confirm the dimensions are what you intended before uploading:

```bash
sips -g pixelWidth -g pixelHeight .screenshots/session-skills.png
```

## Step 6 — Upload

```bash
npm run screenshot -- <id> <light.png> --alt "A description of what the screenshot shows"
```

This converts to WebP (q82), `put()`s it to Blob at a deterministic pathname, and rewrites
`src/lib/screenshots.generated.json`. Write real alt text — it is the index's copy and the default
the component uses. Never hand-edit the generated JSON.

## Step 7 — Reference it in MDX

```mdx
<Screenshot
  id="skill-track/session-skills"
  caption="Skills to be assessed in this session, grouped by package and skill group."
/>
```

`caption` is optional. Raw Markdown `![]()` is unsupported and renders a visible red error instead.

Remember the same MDX renders in **two** places — the `/docs` prose column (768px) and the in-app
`?help=` sheet (480px). There is no way to show one shot on one surface and another elsewhere.

## Step 8 — Verify

Load the page and check each image resolved at the size the index claims:

```js
// evaluate_script on /docs/<section>/<page>
async () => {
  await new Promise(r => setTimeout(r, 2500));
  return [...document.querySelectorAll("figure img")].map(i => ({
    src: i.currentSrc.split("/").pop(),
    natural: i.naturalWidth + "x" + i.naturalHeight,
    rendered: Math.round(i.getBoundingClientRect().width),
  }));
}
```

> **The Blob CDN serves the old bytes for minutes after an overwrite.** If the sizes look stale,
> that is the CDN, not the index. Reload with `ignoreCache: true`, or confirm against the origin:
> `curl -s "<url>?cb=$RANDOM" -o /tmp/x.webp && sips -g pixelWidth -g pixelHeight /tmp/x.webp`.

## Step 9 — Clean up

```bash
rm -rf .screenshots
```

Close any pages you opened. Then commit the MDX **and** `src/lib/screenshots.generated.json`
together — the index is the only record of the upload.

## Common mistakes

- Using the claude-in-chrome screenshot tools — JPEG, with a mouse cursor drawn in.
- Impersonating instead of signing in, and capturing the impersonation banner.
- Trusting `resize_window`/`resize_page` without checking `innerWidth`/`innerHeight`/`devicePixelRatio`.
- Trimming a page capture down to its content, so two shots in one doc render at different sizes.
- Forgetting the CSS injection after a hard navigation, and shipping the Next dev badge.
- Saving PNGs outside the workspace root — the DevTools MCP rejects the path.
- Believing the browser over the origin when an overwritten image looks unchanged.
- Shooting an org other than `demo`.
