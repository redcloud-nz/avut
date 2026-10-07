/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Coverage check between `<HelpButton id="…">` call sites and the help cards in
 * `content/help/**`: every id names a card, and every card is used.
 */

import { globSync, readFileSync } from "node:fs";
import { allHelpCards } from "content-collections";
import { describe, expect, it } from "vitest";

/** Every `.tsx` under `src/` that renders a `<HelpButton>`, with the literal ids it passes. */
function helpButtonUsages(): { file: string; usages: number; ids: string[] }[] {
    return globSync("src/**/*.tsx")
        .map((file) => {
            const source = readFileSync(file, "utf8");
            return {
                file,
                // `\s` after the name skips backticked mentions in comments.
                usages: source.match(/<HelpButton\s/g)?.length ?? 0,
                ids: [...source.matchAll(/<HelpButton\s+id="([^"]*)"/g)].map((m) => m[1]),
            };
        })
        .filter((f) => f.usages > 0);
}

describe("help cards", () => {
    const files = helpButtonUsages();
    const cardIds = new Set(allHelpCards.map((card) => card.id));

    it("finds HelpButton call sites", () => {
        expect(files.length).toBeGreaterThan(0);
    });

    it("gives every HelpButton a literal id", () => {
        for (const { file, usages, ids } of files) {
            expect(ids.length, `${file}: a <HelpButton> has no literal id="…"`).toBe(usages);
        }
    });

    it("resolves every HelpButton id to a card", () => {
        for (const { file, ids } of files) {
            for (const id of ids) {
                expect(cardIds.has(id), `${file}: no help card "${id}" in content/help`).toBe(true);
            }
        }
    });

    it("uses every card", () => {
        const used = new Set(files.flatMap((f) => f.ids));
        for (const card of allHelpCards) {
            expect(
                used.has(card.id),
                `content/help/${card._meta.filePath} is not used by any <HelpButton>`,
            ).toBe(true);
        }
    });
});
