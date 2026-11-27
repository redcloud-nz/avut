/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Export I3 bundles from the database `.env.local` points at into the self-audit demo's data
 * file, `src/components/self-audit/self-audit-demo-bundle.json`. The public demo
 * (`/forms/<org slug>/d4h-i3-self-audit/demo`) renders that file, so the demo shows real bundles' items without
 * reading any database. Read-only.
 *
 * The first bundle is what every member should have; any more are "things you might have",
 * items only some members hold (keys, access cards).
 *
 *   npm run self-audit:export                                       # the only Active bundle
 *   npm run self-audit:export -- "Responder" "Admin Security" "Other Items"
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const OUTPUT = resolve(
    import.meta.dirname,
    "../src/components/self-audit/self-audit-demo-bundle.json",
);

/** Letter sizes in order, by their normalised spelling (no spaces, upper case). */
const SIZE_RANKS = new Map(
    [
        ["XXS"],
        ["XS"],
        ["S", "SMALL"],
        ["M", "MEDIUM"],
        ["L", "LARGE"],
        ["XL"],
        ["2XL", "XXL"],
        ["3XL", "XXXL"],
        ["4XL"],
        ["5XL"],
    ].flatMap((spellings, rank) => spellings.map((spelling) => [spelling, rank] as const)),
);

/** A label's trailing letter size ("Generic (L)", "… 2 XL", "… - Small"), and the rest of it. */
function splitSize(label: string): { stem: string; rank: number } | null {
    const match = /^(.*?)[\s(-]*\(?(\d\s?XL|[A-Z]+)\)?$/i.exec(label.trim());
    if (!match) return null;
    const rank = SIZE_RANKS.get(match[2].replace(/\s/g, "").toUpperCase());
    return rank === undefined ? null : { stem: match[1].trim(), rank };
}

/**
 * Variants in the order a member reads sizes: by the label without its size, then by letter size
 * (XS < S < M < L < XL < 2XL), else numerically, so 4, 5 … 10 rather than 10, 4, 5.
 */
function compareVariantLabels(a: { label: string }, b: { label: string }): number {
    const sizeA = splitSize(a.label);
    const sizeB = splitSize(b.label);
    if (sizeA && sizeB) {
        return (
            sizeA.stem.localeCompare(sizeB.stem, undefined, { numeric: true }) ||
            sizeA.rank - sizeB.rank
        );
    }
    return a.label.localeCompare(b.label, undefined, { numeric: true });
}

async function main() {
    const [mainName, ...optionalNames] = process.argv.slice(2);
    const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL }),
    });
    try {
        const active = await prisma.i3Bundle.findMany({
            where: { status: "Active" },
            include: {
                items: {
                    include: {
                        template: { include: { d4h: true, variants: { include: { d4h: true } } } },
                    },
                },
            },
        });
        // Bundle names are unique only within an organisation: the main bundle must be the only
        // one with its name, and the "might have" bundles come from the same organisation.
        const named = (name: string, pool: typeof active) => {
            const matches = pool.filter((b) => b.name === name);
            if (matches.length !== 1) {
                throw new Error(
                    `Expected one Active bundle named "${name}", found ${matches.length}. Active bundles: ${pool.map((b) => b.name).join(", ") || "none"}.`,
                );
            }
            return matches[0];
        };
        if (!mainName && active.length !== 1) {
            throw new Error(
                `Name the main bundle. Active bundles: ${active.map((b) => b.name).join(", ") || "none"}.`,
            );
        }
        const main = mainName ? named(mainName, active) : active[0];
        const sameOrg = active.filter((b) => b.organizationId === main.organizationId);
        const optional = optionalNames.map((name) => named(name, sameOrg));

        type BundleRecord = (typeof active)[number];
        const toTemplates = (bundle: BundleRecord, isOptional: boolean) =>
            bundle.items
                .map(({ template }) => template)
                .filter((template) => template.status === "Active")
                .map((template) => ({
                    id: template.id,
                    category: template.d4h?.categoryTitle ?? "Other",
                    name: template.name,
                    variants: template.variants
                        .map((variant) => ({
                            id: variant.id,
                            label: variant.d4h
                                ? `${variant.d4h.brandTitle} ${variant.d4h.modelTitle}`
                                : variant.name,
                        }))
                        .sort(compareVariantLabels),
                    requireSN: template.d4h?.requireSN ?? false,
                    optional: isOptional,
                }));

        // A template in the main bundle stays a "should have", even if an optional bundle lists it.
        const templates = [
            ...toTemplates(main, false),
            ...optional.flatMap((bundle) => toTemplates(bundle, true)),
        ]
            .filter((template, index, all) => all.findIndex((t) => t.id === template.id) === index)
            .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
            // The demo page is public: neutral ids rather than database ones, which it doesn't need.
            .map((template, index) => ({
                ...template,
                id: `t${index + 1}`,
                variants: template.variants.map((variant, v) => ({
                    ...variant,
                    id: `t${index + 1}-v${v + 1}`,
                })),
            }));

        writeFileSync(OUTPUT, JSON.stringify({ bundleName: main.name, templates }, null, 4) + "\n");
        const optionalCount = templates.filter((t) => t.optional).length;
        console.log(
            `Wrote ${templates.length - optionalCount} templates from "${main.name}" and ${optionalCount} "might have" from ${optional.map((b) => `"${b.name}"`).join(", ") || "no other bundle"} to ${OUTPUT}`,
        );
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
