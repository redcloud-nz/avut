/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { allDocs, allHelpCards } from "content-collections";
import { describe, expect, it } from "vitest";

import { glossaryBySlug, glossaryEntries } from "@/lib/glossary";

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
