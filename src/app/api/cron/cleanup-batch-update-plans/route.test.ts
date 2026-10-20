/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
    env: { CRON_SECRET: "s3cret" as string | undefined },
    cleanup: vi.fn(),
}));

vi.mock("@/server/env", () => ({ serverEnv: mocks.env }));
vi.mock("@/server/cron/cleanup-batch-update-plans", () => ({
    cleanupBatchUpdatePlans: mocks.cleanup,
}));

function request(authorization?: string) {
    return new Request("http://localhost/api/cron/cleanup-batch-update-plans", {
        headers: authorization ? { authorization } : {},
    });
}

describe("GET /api/cron/cleanup-batch-update-plans", () => {
    beforeEach(() => {
        mocks.env.CRON_SECRET = "s3cret";
        mocks.cleanup.mockReset().mockResolvedValue({ failed: 1, deleted: 2 });
    });

    it("refuses a missing bearer", async () => {
        expect((await GET(request())).status).toBe(401);
        expect(mocks.cleanup).not.toHaveBeenCalled();
    });

    it("refuses a wrong bearer", async () => {
        expect((await GET(request("Bearer nope"))).status).toBe(401);
        expect(mocks.cleanup).not.toHaveBeenCalled();
    });

    it("refuses everything while CRON_SECRET is unset", async () => {
        mocks.env.CRON_SECRET = undefined;
        expect((await GET(request("Bearer undefined"))).status).toBe(401);
    });

    it("runs the cleanup with the right bearer", async () => {
        const res = await GET(request("Bearer s3cret"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ failed: 1, deleted: 2 });
    });
});
