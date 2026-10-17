/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { allDocs, allHelpCards } from "content-collections";
import { describe, expect, it } from "vitest";

import {
    glossaryBySlug,
    glossaryEntries,
    visibleGlossaryEntries,
    type GlossaryEntry,
} from "@/lib/glossary";

describe("glossary", () => {
    it("has no duplicate slugs", () => {
        const slugs = glossaryEntries.map((e) => e.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("resolves every relatedTerms slug to a real entry", () => {
        for (const entry of glossaryEntries) {
            for (const related of entry.relatedTerms ?? []) {
                expect(
                    glossaryBySlug.has(related),
                    `"${entry.slug}".relatedTerms references unknown slug "${related}"`,
                ).toBe(true);
            }
        }
    });

    it("resolves every doc's keyTerms slug to a real entry", () => {
        for (const doc of allDocs) {
            for (const term of doc.keyTerms) {
                expect(
                    glossaryBySlug.has(term),
                    `${doc._meta.path}: keyTerms references unknown slug "${term}"`,
                ).toBe(true);
            }
        }
    });

    it("resolves every help card's keyTerms slug to a real entry", () => {
        for (const card of allHelpCards) {
            for (const term of card.keyTerms) {
                expect(
                    glossaryBySlug.has(term),
                    `content/help/${card._meta.filePath}: keyTerms references unknown slug "${term}"`,
                ).toBe(true);
            }
        }
    });
});

describe("visibleGlossaryEntries", () => {
    const entry = (slug: string, extra: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
        slug,
        term: slug,
        shortDefinition: "",
        longDefinition: "",
        ...extra,
    });

    it("keeps an entry with no modules", () => {
        const result = visibleGlossaryEntries([entry("plain")], new Set(["i3"]));
        expect(result.map((e) => e.slug)).toEqual(["plain"]);
    });

    it("drops an entry whose only module is hidden", () => {
        const result = visibleGlossaryEntries(
            [entry("plain"), entry("i3-only", { modules: ["i3"] })],
            new Set(["i3"]),
        );
        expect(result.map((e) => e.slug)).toEqual(["plain"]);
    });

    it("keeps an entry with a visible module, badged with only the visible one", () => {
        const result = visibleGlossaryEntries(
            [entry("mixed", { modules: ["skill-track", "skill-package-builder"] })],
            new Set(["skill-package-builder"]),
        );
        expect(result).toHaveLength(1);
        expect(result[0].modules).toEqual(["skill-track"]);
    });

    it("removes relatedTerms slugs that point at a dropped entry", () => {
        const result = visibleGlossaryEntries(
            [
                entry("d4h", { relatedTerms: ["ppe-template", "person"] }),
                entry("person"),
                entry("ppe-template", { modules: ["i3"] }),
            ],
            new Set(["i3"]),
        );
        expect(result.find((e) => e.slug === "d4h")?.relatedTerms).toEqual(["person"]);
    });
});
