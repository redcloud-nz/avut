# Spec: Documentation screenshots

**Date:** 2026-09-10
**Status:** Phase 1 implemented; Phase 2 pending

Covers how screenshots are captured, stored, and rendered in the end-user
documentation (`content/docs/**`, the public `/docs` site, and the in-app
`?help=` sheet). Builds on the end-user documentation system introduced in
`docs/ideas/2026-09-10-end-user-documentation.md`.

---

## 1. Background

The docs are team-authored MDX compiled by content-collections. content-collections
compiles MDX only — it does **not** fingerprint, copy, or otherwise process
referenced assets, so a relative `![](./foo.png)` in an MDX file does not
resolve. Screenshots need their own storage and referencing story.

We expect on the order of 100 screenshots once the docs are fleshed out, several
per module, in both light and dark themes. At that volume:

- Committing binaries to git is rejected — WebP cannot be delta-compressed, so
  every re-capture writes the whole set into history permanently.
- git-LFS would work but adds a Vercel project setting (without it `public/`
  images deploy as pointer text), a contributor setup step, and GitHub LFS
  bandwidth cost on CI clones.
- Screenshots are regenerable build output, not source. They belong in object
  storage, not the repo.

Branch-fidelity in preview deployments (a PR's preview showing that PR's
screenshots) is explicitly **not** a requirement for end-user docs.

---

## 2. Storage

### 2.1 Blobs → Vercel Blob

Images live in a Vercel Blob store, uploaded by the capture script:

```ts
import { put } from "@vercel/blob";

await put(`docs-screenshots/${id}${theme === "dark" ? "-dark" : ""}.webp`, buffer, {
  access: "public",
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "image/webp",
});
```

- `addRandomSuffix: false` + `allowOverwrite: true` → deterministic pathname,
  stable public URL, overwrite in place on re-capture.
- Public URLs are CDN-cached with a long TTL. Overwriting a pathname can take a
  few minutes to propagate — acceptable for docs. If it ever matters, the index
  (§2.2) can carry a `?v=<contentHash>` suffix on the URL.
- Write access is the `BLOB_READ_WRITE_TOKEN` env var — capture script only.
  Nothing at runtime needs a token; the app renders public URLs.

### 2.2 Index → git

The capture script writes a single generated file committed to the repo:

`src/components/docs/screenshots.generated.json`

```jsonc
{
  "i3/issue-list": {
    "light": {
      "url": "https://<store>.public.blob.vercel-storage.com/docs-screenshots/i3/issue-list.webp",
      "width": 1280,
      "height": 812,
    },
    "dark": {
      "url": "https://<store>.public.blob.vercel-storage.com/docs-screenshots/i3/issue-list-dark.webp",
      "width": 1280,
      "height": 812,
    },
    "alt": "The I3 issue list showing items currently issued out",
    "capturedAt": "2026-09-10T00:00:00.000Z",
  },
}
```

- Text, diffable, ~5 KB for 100 entries.
- Supplies width/height (no layout shift) and the resolved URL to the
  `<Screenshot>` component.
- `alt` originates in the manifest (§4.1), not the MDX, so it is captured and
  reviewed alongside the spec of each screenshot. The MDX `<Screenshot>` call
  may override it.
- Never hand-edited — regenerated wholesale by the capture script.

---

## 3. Rendering: the `<Screenshot>` component

Added to `docsMdxComponents` in `src/components/docs/mdx-components.tsx`, so it
is available in both the `/docs` pages and the `?help=` sheet.

```mdx
<Screenshot id="i3/issue-list" caption="Items currently issued out" />
```

| Prop      | Type     | Notes                                                                           |
| --------- | -------- | ------------------------------------------------------------------------------- |
| `id`      | `string` | Required. Key into `screenshots.generated.json`. Unknown id → build-time error. |
| `caption` | `string` | Optional `<figcaption>`.                                                        |
| `alt`     | `string` | Optional override of the index's `alt`.                                         |

Behaviour:

- Renders a `<figure>` with a bordered/rounded frame, the `<img>` (`loading="lazy"`,
  explicit `width`/`height` from the index), and the optional caption.
- Light/dark: render both sources, swap with CSS (`hidden dark:block` /
  `block dark:hidden`) so it follows the app theme with no JS. If an id has only
  a `light` entry, use it for both.
- Click-to-zoom: clicking opens the image full-size in a shared `Dialog`.
  Important in the `?help=` sheet, which is only `sm:max-w-lg` wide.
- Responsive down to ~380px (help sheet on a narrow viewport).
- Plain Markdown `![]()` images are **not** supported in docs MDX — add an `img`
  override that renders a build-time warning, or document that authors must use
  `<Screenshot>`.

The component reads the index via a static import, so a missing id or a stale
index fails `next build` rather than shipping a broken image.

---

## 4. Capture

`scripts/docs-screenshots/` — run on demand locally, or as a
manually-dispatched GitHub Action. **Never** part of the Vercel build (needs a
browser, a running app, and a seeded database).

### 4.1 Manifest

`scripts/docs-screenshots/manifest.ts` — the list of screenshots to capture:

```ts
interface ScreenshotSpec {
  id: string; // "i3/issue-list"
  route: string; // "/orgs/<demo-slug>/i3"
  role?: OrgRole; // impersonate a user with this role; default owner
  selector?: string; // capture just this element; default full page
  themes?: ("light" | "dark")[]; // default both
  viewport?: { width: number; height: number }; // default { width: 1280, height: 900 }
  mask?: string[]; // locators to blur (volatile content)
  alt: string; // written into the index
}
```

The manifest is the single source of truth for what to capture — a capture
concern, kept in one auditable list rather than scattered across MDX
frontmatter. MDX authors only reference an `id` from it.

### 4.2 Coverage lint check

A check pairs the manifest against the MDX so a mismatch surfaces at lint time,
not `next build` time:

- Scan `content/docs/**/*.mdx` for `<Screenshot id="…" />`.
- Every referenced `id` must exist in `manifest.ts` → otherwise error, naming
  the file and id (the author added a `<Screenshot>` without a capture spec).
- Every `manifest.ts` `id` should be referenced by at least one MDX file →
  otherwise warn (a spec for a screenshot no doc shows — likely stale).
- Manifest `id`s must be unique, and each must be a valid Blob pathname segment
  set (`[a-z0-9-]+(/[a-z0-9-]+)*`).

Runs as its own script (`scripts/docs-screenshots/check.ts`), wired into
`npm run lint` and CI. It parses the manifest and greps the MDX only — no
browser, no database — so it is cheap enough to run on every lint.

### 4.3 Flow

1. Load the manifest.
2. Ensure the deterministic demo dataset is seeded (§4.4).
3. Start (or connect to) a local non-production build.
4. Playwright, per spec × theme:
   - `window.avut.signIn` as the admin test account, then
     `window.avut.impersonateUser` for a user holding `role` in the demo org
     (see `.claude/skills/test-in-browser`).
   - Set viewport and theme (`data-theme` / the app's theme control).
   - Navigate to `route`, wait for network idle + any known content selectors.
   - Inject CSS to disable animations/transitions.
   - Apply `mask` locators.
   - Screenshot the page or `selector` → buffer.
5. `sharp` → WebP (quality ~82), record intrinsic width/height.
6. `put()` to Vercel Blob.
7. Rewrite `screenshots.generated.json` and leave it staged for commit.

### 4.4 Determinism

Screenshots must not churn on every run. Prerequisite work on `seed:demo`:

- Fixed record IDs and a fixed reference clock (seed dates as absolute values,
  or offset from a pinned "now") so relative timestamps ("2 days ago") render
  identically.
- Stable ordering of seeded collections.
- A known demo organisation slug, and demo users for each org role.
- `mask` remains the fallback for anything that can't be pinned (avatars,
  charts with live layout).

### 4.5 CI

GitHub Action, `workflow_dispatch`:

- Postgres service container, `npm run seed:demo`.
- `npx playwright install --with-deps chromium`.
- Build + start the app, run the capture script.
- `BLOB_READ_WRITE_TOKEN` from Actions secrets.
- Commit the updated `screenshots.generated.json` back (PR or direct to branch).

---

## 5. Environment variables

| Variable                | Where                        | Purpose                        |
| ----------------------- | ---------------------------- | ------------------------------ |
| `BLOB_READ_WRITE_TOKEN` | `.env.local`, Actions secret | Capture script uploads to Blob |

The Blob store's public host is embedded in the URLs in
`screenshots.generated.json`; the runtime needs no Blob configuration.

---

## 6. Phasing

**Phase 1 — rendering, manual capture. _(implemented)_**
`<Screenshot>` component (`src/components/docs/screenshot.tsx`, wired into
`docsMdxComponents`), the `screenshots.generated.json` index +
`src/components/docs/screenshots.ts` read model, and the manual upload helper
`npm run docs:screenshot -- <id> <light> [dark] --alt "…"`
(`scripts/docs-screenshots/upload.ts` — sharp → WebP, `put()` to Blob, rewrites
the index). A raw Markdown `![]()` renders a visible "use `<Screenshot>`" error.
Still to do: hand-capture the first screenshots (needs `BLOB_READ_WRITE_TOKEN`)
and reference them from the highest-traffic docs pages.

**Phase 2 — automated capture.**
`manifest.ts`, the coverage lint check (§4.2), the Playwright capture script,
`seed:demo` determinism, the CI workflow. Justified once the doc set is large
enough that manual upkeep is painful.

---

## 7. Resolved decisions

| Question                                           | Decision                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Where do screenshot binaries live?                 | Vercel Blob, public access, deterministic pathnames, overwrite in place |
| Committed to git?                                  | No — only the generated JSON index is committed                         |
| git-LFS?                                           | No — screenshots are regenerable build output, not source               |
| Branch-versioned screenshots?                      | Not required for end-user docs; preview shows current bucket contents   |
| How does MDX reference a screenshot?               | `<Screenshot id="…" />`, keyed into the index; no raw Markdown images   |
| Where are capture instructions kept?               | One `scripts/docs-screenshots/manifest.ts` list, not MDX frontmatter    |
| Catching a `<Screenshot id>` with no capture spec? | Lint check (§4.2) greps MDX against the manifest; errors at lint time   |
| Where does `alt` text come from?                   | The capture manifest → the index; MDX may override                      |
| Light/dark handling                                | Capture both, swap with CSS, follow app theme                           |
| Does capture run in the Vercel build?              | No — on demand locally or a dispatched GitHub Action                    |
| Auth for capture                                   | `window.avut` dev tools + impersonation; non-production builds only     |
| Biggest prerequisite for Phase 2                   | Deterministic `seed:demo` (fixed IDs, clock, ordering, per-role users)  |
