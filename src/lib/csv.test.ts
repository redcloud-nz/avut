/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { csvCell } from "./csv";

describe("csvCell", () => {
    it("keeps a spreadsheet from reading an answer as a formula", () => {
        expect(csvCell("=1+1")).toBe("'=1+1");
        expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
        expect(csvCell("+64 21 000")).toBe("'+64 21 000");
        expect(csvCell("-1")).toBe("'-1");
        expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    });

    it("leaves ordinary text alone", () => {
        expect(csvCell("Sam Sample")).toBe("Sam Sample");
        expect(csvCell("")).toBe("");
    });
});
