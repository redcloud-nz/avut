/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Phase 1 manual screenshot helper (see docs/specs/docs-screenshots.md §6).
 *
 *   npm run docs:screenshot -- <id> <light-image> [dark-image] --alt "description"
 *
 * Converts the given PNG/JPEG/WebP file(s) to WebP, uploads them to Vercel Blob
 * at a deterministic pathname, and rewrites
 * `src/components/docs/screenshots.generated.json` with the resulting entry.
 * Requires SCREENSHOTS_READ_WRITE_TOKEN (loaded from .env.local by the npm script).
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";
import sharp from "sharp";

const INDEX_PATH = path.join(process.cwd(), "src/components/docs/screenshots.generated.json");

const ID_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;

// The screenshots Blob store's RW token. This is a dedicated store — prefer its
// store-specific token and don't reach for the default BLOB_READ_WRITE_TOKEN,
// which belongs to a different store. The runtime never needs this — upload only.
const BLOB_TOKEN = process.env.SCREENSHOTS_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;

interface ScreenshotSource {
    url: string;
    width: number;
    height: number;
}
interface ScreenshotEntry {
    light: ScreenshotSource;
    dark?: ScreenshotSource;
    alt: string;
    capturedAt: string;
}

function parseArgs(argv: string[]) {
    const positional: string[] = [];
    let alt: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--alt") {
            alt = argv[++i];
        } else {
            positional.push(argv[i]);
        }
    }
    const [id, lightPath, darkPath] = positional;
    return { id, lightPath, darkPath, alt };
}

async function uploadOne(
    id: string,
    file: string,
    variant: "light" | "dark",
): Promise<ScreenshotSource> {
    const input = await readFile(file);
    const webp = sharp(input).webp({ quality: 82 });
    const buffer = await webp.toBuffer();
    const { width, height } = await sharp(buffer).metadata();
    if (!width || !height) throw new Error(`Could not read dimensions of ${file}`);

    const pathname = `docs-screenshots/${id}${variant === "dark" ? "-dark" : ""}.webp`;
    const blob = await put(pathname, buffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/webp",
        token: BLOB_TOKEN,
    });
    console.log(`  ${variant}: ${blob.url} (${width}×${height})`);
    return { url: blob.url, width, height };
}

async function main() {
    const { id, lightPath, darkPath, alt } = parseArgs(process.argv.slice(2));

    if (!id || !lightPath) {
        console.error(
            'Usage: npm run docs:screenshot -- <id> <light-image> [dark-image] --alt "description"',
        );
        process.exit(1);
    }
    if (!ID_PATTERN.test(id)) {
        console.error(`Invalid id "${id}" — must match ${ID_PATTERN}`);
        process.exit(1);
    }
    if (!BLOB_TOKEN) {
        console.error("No Blob token — set SCREENSHOTS_READ_WRITE_TOKEN in .env.local.");
        process.exit(1);
    }

    const index: Record<string, ScreenshotEntry> = JSON.parse(await readFile(INDEX_PATH, "utf8"));

    console.log(`Uploading screenshot "${id}"…`);
    const light = await uploadOne(id, lightPath, "light");
    const dark = darkPath ? await uploadOne(id, darkPath, "dark") : undefined;

    index[id] = {
        light,
        ...(dark ? { dark } : {}),
        alt: alt ?? index[id]?.alt ?? "",
        capturedAt: new Date().toISOString(),
    };
    if (!index[id].alt) {
        console.warn('  ⚠ no alt text — pass --alt "description"');
    }

    const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(INDEX_PATH, JSON.stringify(sorted, null, 2) + "\n");
    console.log(`Wrote ${path.relative(process.cwd(), INDEX_PATH)} — stage & commit it.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
