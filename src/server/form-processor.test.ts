/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it, vi } from "vitest";

import { FormInstanceId } from "@/lib/schemas/form-instance";

import { FormProcessingPipeline } from "./form-processor";

// The pipeline marks the form instance processed through the real Prisma client once every
// stage has run; stub it so nothing reaches a database.
vi.mock("@/server/prisma", () => ({
    default: { formInstance: { update: vi.fn(async () => ({})) } },
}));

describe("FormProcessingPipeline.executeWithOutput", () => {
    const pipeline = FormProcessingPipeline.builder<{ n: number }>("TestPipeline", {
        saveStatus: "None",
    })
        .stage({
            stageName: "Double",
            stageFn: async (ctx) => ({ doubled: ctx.formData.n * 2 }),
        })
        .stage({
            stageName: "Fail",
            stageFn: async (ctx) => {
                if (ctx.formData.n < 0) throw new Error("negative");
            },
        })
        .stage({
            stageName: "Label",
            stageFn: async (ctx, { doubled }) => ({ label: `n×2 = ${doubled}` }),
        })
        .build();

    it("returns the stage results and the accumulated output", async () => {
        const { results, output } = await pipeline.executeWithOutput(
            FormInstanceId.create(),
            { n: 3 },
            {},
        );

        expect(results.map((r) => [r.stageName, r.status])).toEqual([
            ["Double", "success"],
            ["Fail", "success"],
            ["Label", "success"],
        ]);
        expect(output).toEqual({ doubled: 6, label: "n×2 = 6" });
    });

    it("returns the output of the stages before an error", async () => {
        const { results, output } = await pipeline.executeWithOutput(
            FormInstanceId.create(),
            { n: -1 },
            {},
        );

        expect(results.at(-1)).toMatchObject({ stageName: "Fail", status: "error" });
        expect(output).toEqual({ doubled: -2 });
    });

    it("leaves execute returning only the stage results", async () => {
        const results = await pipeline.execute(FormInstanceId.create(), { n: 1 }, {});

        expect(results).toHaveLength(3);
        expect(results.every((r) => r.status === "success")).toBe(true);
    });
});
