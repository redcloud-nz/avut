/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HWhoami, fetchD4HWhoamiCached, getD4HFetchClient } from "@/server/d4h-api/client";
import { sendEmail } from "@/server/email";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import { I3IssueItemsFormProcessor } from "./processor";
import { I3IssueItemsFormData } from "./schema";

const TEAM_ID = 7;

/** The resolved token `getConfiguredD4HAccessToken` hands back. */
const accessToken = { id: "token-1", serverCode: "us", token: "secret" };

/** A whoami for a member of the recipient team, with or without `Equipment.CREATE`. */
function whoami(canCreate: boolean) {
    return {
        account: { id: 1, resourceType: "Account" },
        members: [
            {
                id: 11,
                resourceType: "Member",
                hasAccess: true,
                name: "Issuer",
                owner: { id: TEAM_ID, resourceType: "Team", title: "Team" },
                permissions: { Equipment: { CREATE: canCreate } },
            },
        ],
    };
}

// `vi.hoisted` because the client mock's factory below refers to it.
const POST = vi.hoisted(() => vi.fn());

// The pipeline marks the form instance processed through the real Prisma client once every
// stage has run; stub it so nothing reaches a database.
vi.mock("@/server/prisma", () => ({
    default: { formInstance: { update: vi.fn(async () => ({})) } },
}));

vi.mock("@/server/d4h-access-token", () => ({
    getConfiguredD4HAccessToken: vi.fn(),
}));

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HWhoami: vi.fn(),
    fetchD4HWhoamiCached: vi.fn(),
    getD4HFetchClient: vi.fn(() => ({ POST })),
}));

vi.mock("@/server/email", () => ({
    NoReplyEmailAddress: "no-reply@example.test",
    sendEmail: vi.fn(async () => {}),
}));

describe("I3IssueItemsFormProcessor", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        template: I3TemplateId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.i3Template.create({
            data: {
                id: T.template,
                organizationId: T.org,
                name: "Helmet",
                description: "",
                d4h: {
                    create: {
                        categoryId: 100,
                        categoryTitle: "PPE",
                        kindId: 200,
                        kindTitle: "Helmet",
                        outputRefFormat: "",
                        requireSN: false,
                    },
                },
            },
        });
    });

    beforeEach(() => {
        vi.mocked(getConfiguredD4HAccessToken).mockResolvedValue(accessToken as never);
        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(true) as never);
        POST.mockReset();
        POST.mockResolvedValue({ response: new Response(null, { status: 201 }) });
    });

    function formData(itemCount: number): I3IssueItemsFormData {
        const item = {
            template: { id: T.template, name: "Helmet" },
            variant: null,
            serialNumber: null,
        };
        return I3IssueItemsFormData.schema.parse({
            recipient: { id: 42, teamId: TEAM_ID, name: "John Smith" },
            items: Array.from({ length: itemCount }, () => item),
            comments: "",
        });
    }

    function execute(itemCount: number) {
        const ctx = createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user, name: "Issuer" },
            prisma: db,
        });
        return I3IssueItemsFormProcessor.execute(FormInstanceId.create(), formData(itemCount), ctx);
    }

    /** The `savedToD4H` prop the notification email was rendered with. */
    function emailedSavedToD4H() {
        expect(sendEmail).toHaveBeenCalledOnce();
        const { react } = vi.mocked(sendEmail).mock.calls[0][0];
        return (react as { props: { savedToD4H: unknown } }).props.savedToD4H;
    }

    it("reports savedToD4H: true when every create succeeds", async () => {
        const results = await execute(3);

        expect(results.every((r) => r.status !== "error")).toBe(true);
        expect(POST).toHaveBeenCalledTimes(3);
        expect(emailedSavedToD4H()).toBe(true);
    });

    it("keeps going past a failed POST and names how many of the items failed", async () => {
        POST.mockResolvedValueOnce({ response: new Response(null, { status: 201 }) })
            .mockResolvedValueOnce({ response: new Response(null, { status: 422 }) })
            .mockResolvedValueOnce({ response: new Response(null, { status: 201 }) });

        await execute(3);

        expect(POST).toHaveBeenCalledTimes(3);
        expect(emailedSavedToD4H()).toEqual({
            reason: "failing to record 1 of 3 items (first error: 422)",
            partial: true,
        });
    });

    it("counts a POST that throws as a failure, with its message as the error", async () => {
        POST.mockRejectedValueOnce(new Error("fetch failed"));

        await execute(2);

        expect(POST).toHaveBeenCalledTimes(2);
        expect(emailedSavedToD4H()).toEqual({
            reason: "failing to record 1 of 2 items (first error: fetch failed)",
            partial: true,
        });
    });

    it("isn't partial when every POST fails", async () => {
        POST.mockResolvedValue({ response: new Response(null, { status: 403 }) });

        await execute(2);

        expect(emailedSavedToD4H()).toEqual({
            reason: "failing to record 2 of 2 items (first error: 403)",
            partial: false,
        });
    });

    it("makes no POST without Equipment.CREATE on the recipient team", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(false) as never);

        const results = await execute(2);

        expect(POST).not.toHaveBeenCalled();
        expect(results.find((r) => r.stageName === "CreateEquipmentInD4H")?.status).toBe("skipped");
        expect(emailedSavedToD4H()).toEqual({ reason: "insufficient permissions" });
    });

    it("stops at CheckD4HAccessToken when the integration is disabled", async () => {
        vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
            new Error("D4H integration is not enabled for this organisation."),
        );

        const results = await execute(1);

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ stageName: "CheckD4HAccessToken", status: "error" });
        expect(fetchD4HWhoami).not.toHaveBeenCalled();
        expect(getD4HFetchClient).not.toHaveBeenCalled();
        expect(POST).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("reads whoami uncached, with the resolved token", async () => {
        await execute(1);

        expect(fetchD4HWhoami).toHaveBeenCalledWith(accessToken);
        expect(fetchD4HWhoamiCached).not.toHaveBeenCalled();
    });
});
