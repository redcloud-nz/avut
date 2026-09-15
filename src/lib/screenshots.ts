/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Read model over `screenshots.generated.json` — the committed index of
 * product screenshots used by the docs (`<Screenshot>`) and the public site
 * (`<ProductShot>`). The binaries live in Vercel Blob; this file maps a
 * screenshot `id` to its resolved public URL(s), intrinsic dimensions, and alt
 * text. It is regenerated wholesale by the capture helper
 * (`scripts/screenshots/`) and never hand-edited.
 *
 * See `docs/specs/docs-screenshots.md`.
 */

import indexJson from "./screenshots.generated.json";

/** One rendered image: a public Blob URL plus its intrinsic pixel size. */
export interface ScreenshotSource {
    url: string;
    width: number;
    height: number;
}

/** One screenshot: a light source, an optional dark source, and metadata. */
export interface ScreenshotEntry {
    light: ScreenshotSource;
    dark?: ScreenshotSource;
    alt: string;
    capturedAt: string;
}

export const screenshotIndex = indexJson as Record<string, ScreenshotEntry>;

/**
 * Look up a screenshot by id. Throws if the id is missing so a stale reference
 * is loud rather than shipping a broken image — capture it with `npm run
 * screenshot` before referencing a new `id`. Both callers are client
 * components, so this actually fails `next build` only where the caller is
 * statically rendered (`<ProductShot>` on the home page); on the dynamically-
 * rendered `/docs/*` routes (`<Screenshot>`) a bad id instead throws in the
 * browser at request time. See `docs/specs/docs-screenshots.md` for the Phase 2
 * plan to catch that case with a build-time coverage lint check.
 */
export function getScreenshot(id: string): ScreenshotEntry {
    const entry = screenshotIndex[id];
    if (!entry) {
        throw new Error(
            `Unknown screenshot "${id}". Capture it with \`npm run screenshot\`, or fix the reference. ` +
                `Known ids: ${Object.keys(screenshotIndex).join(", ") || "(none)"}.`,
        );
    }
    return entry;
}
