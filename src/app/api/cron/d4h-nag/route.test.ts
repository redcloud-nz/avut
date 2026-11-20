/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
    env: { CRON_SECRET: "s3cret" as string | undefined },
    runDue: vi.fn(),
    flags: vi.fn(),
}));

vi.mock("@/server/env", () => ({ serverEnv: mocks.env }));
vi.mock("@/server/cron/d4h-nag", () => ({ runD4HNagDue: mocks.runDue }));
vi.mock("@/server/module-flags", () => ({ resolveModuleFlags: mocks.flags }));

function request(authorization = "Bearer s3cret") {
    return new Request("http://localhost/api/cron/d4h-nag", { headers: { authorization } });
}

const ORG = "org-1";

describe("GET /api/cron/d4h-nag", () => {
    beforeEach(() => {
        mocks.env.CRON_SECRET = "s3cret";
        mocks.flags.mockReset().mockResolvedValue({ "d4h-nag": true });
        mocks.runDue.mockReset().mockResolvedValue({ timedOut: 0, organizations: [], pruned: 0 });
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("refuses a wrong bearer", async () => {
        expect((await GET(request("Bearer nope"))).status).toBe(401);
        expect(mocks.runDue).not.toHaveBeenCalled();
    });

    it("does nothing while the module's flag is off", async () => {
        mocks.flags.mockResolvedValue({ "d4h-nag": false });

        const res = await GET(request());

        expect(res.status).toBe(200);
        expect(mocks.runDue).not.toHaveBeenCalled();
    });

    it("runs the tick with the flag on", async () => {
        const res = await GET(request());

        expect(res.status).toBe(200);
        expect(mocks.runDue).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when an organization failed", async () => {
        mocks.runDue.mockResolvedValue({
            timedOut: 0,
            organizations: [{ organizationId: ORG, outcome: "failed", error: "down" }],
            pruned: 0,
        });

        expect((await GET(request())).status).toBe(500);
    });

    it("returns 500 when a run failed", async () => {
        mocks.runDue.mockResolvedValue({
            timedOut: 0,
            organizations: [
                {
                    organizationId: ORG,
                    outcome: "ran",
                    runs: [{ ruleId: "rule-1", runId: "run-1", status: "Failed", error: "x" }],
                },
            ],
            pruned: 0,
        });

        expect((await GET(request())).status).toBe(500);
    });
});
