/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { fragmentShader, type GlyphClouds, type GlyphSurface } from "./glyph-background-shader";

const CLOUDS: GlyphClouds[] = ["single", "layers", "warped"];
const SURFACES: GlyphSurface[] = ["glyphs", "contours"];
const COMBINATIONS = CLOUDS.flatMap((clouds) =>
    SURFACES.map((surface) => [clouds, surface] as const),
);

/** How many times `float <name> =` is declared in the source. */
const declarations = (source: string, name: string) =>
    source.match(new RegExp(`\\bfloat ${name} =`, "g"))?.length ?? 0;

describe("fragmentShader", () => {
    // WebGL can't run under jsdom, so these check the assembly; compiling every combination was
    // checked by hand in a browser.
    it.each(COMBINATIONS)("assembles %s clouds on %s", (clouds, surface) => {
        const source = fragmentShader(clouds, surface);

        expect(source).not.toContain("${");
        expect(source).not.toMatch(/undefined|NaN/);
        expect(source.match(/void main\(\)/g)).toHaveLength(1);
        // Each part declares its outputs exactly once.
        for (const name of ["mask", "grey", "blue", "alpha", "ring", "hover"]) {
            expect(declarations(source, name), name).toBe(1);
        }
    });

    it("includes only the helpers a combination uses", () => {
        expect(fragmentShader("warped", "glyphs")).toContain("float fbm(");
        expect(fragmentShader("layers", "glyphs")).not.toContain("float fbm(");
        expect(fragmentShader("layers", "contours")).toContain("float land(");
        expect(fragmentShader("layers", "glyphs")).not.toContain("float land(");
    });

    it("samples the glyph atlas only for the glyphs surface", () => {
        expect(fragmentShader("layers", "glyphs")).toContain("texture2D(atlas");
        expect(fragmentShader("layers", "contours")).not.toContain("texture2D(atlas");
    });
});
