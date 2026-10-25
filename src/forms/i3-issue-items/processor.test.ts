/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { I3TemplateVariantId } from "@/lib/schemas/i3-template-variant";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HWhoami, fetchD4HWhoamiCached, getD4HFetchClient } from "@/server/d4h-api/client";
import { sendEmail } from "@/server/email";
import { getD4HTeamFitContext } from "@/server/services/i3-templates";
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

const ORG_ID = 500;
const OTHER_TEAM_ID = 8;

/** A catalogue record owned by D4H team `teamId`, or by the recipient team's organisation. */
function record(id: number, teamId?: number) {
    return {
        id,
        title: `Record ${id}`,
        owner: teamId
            ? { resourceType: "Team", id: teamId }
            : { resourceType: "Organisation", id: ORG_ID },
    };
}

/**
 * The recipient team's fit context: the template's category (100) and kind (200), and the
 * variant's brand (300) and model (400), all organisation-owned unless given a team owner.
 */
function fitContext(owners: { kindTeam?: number; modelTeam?: number } = {}) {
    return {
        team: { id: TEAM_ID, title: "Rescue Team A", owner: { id: ORG_ID } },
        catalogue: {
            categories: [record(100)],
            kinds: [record(200, owners.kindTeam)],
            brands: [record(300)],
            models: [record(400, owners.modelTeam)],
        },
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

vi.mock("@/server/services/i3-templates", () => ({
    getD4HTeamFitContext: vi.fn(),
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
        variant: I3TemplateVariantId.create(),
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
                variants: {
                    create: {
                        id: T.variant,
                        name: "Large",
                        d4h: {
                            create: {
                                brandId: 300,
                                brandTitle: "Brand",
                                modelId: 400,
                                modelTitle: "Model",
                            },
                        },
                    },
                },
            },
        });
    });

    beforeEach(() => {
        vi.mocked(getConfiguredD4HAccessToken).mockResolvedValue(accessToken as never);
        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(true) as never);
        vi.mocked(getD4HTeamFitContext).mockResolvedValue(fitContext() as never);
        POST.mockReset();
        POST.mockResolvedValue({ response: new Response(null, { status: 201 }) });
    });

    function formData(itemCount: number, withVariant: boolean): I3IssueItemsFormData {
        const item = {
            template: { id: T.template, name: "Helmet" },
            variant: withVariant ? { id: T.variant, name: "Large" } : null,
            serialNumber: null,
        };
        return I3IssueItemsFormData.schema.parse({
            recipient: { id: 42, teamId: TEAM_ID, name: "John Smith" },
            items: Array.from({ length: itemCount }, () => item),
            comments: "",
        });
    }

    function execute(itemCount: number, withVariant = false) {
        const ctx = createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user, name: "Issuer" },
            prisma: db,
        });
        return I3IssueItemsFormProcessor.execute(
            FormInstanceId.create(),
            formData(itemCount, withVariant),
            ctx,
        );
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

    it("checks fit against the recipient's team and creates a fitting variant", async () => {
        const results = await execute(1, true);

        expect(results.every((r) => r.status !== "error")).toBe(true);
        expect(getD4HTeamFitContext).toHaveBeenCalledWith(expect.anything(), {
            accessToken,
            teamId: TEAM_ID,
        });
        expect(POST).toHaveBeenCalledOnce();
    });

    it("refuses a template whose D4H records belong to another team", async () => {
        vi.mocked(getD4HTeamFitContext).mockResolvedValue(
            fitContext({ kindTeam: OTHER_TEAM_ID }) as never,
        );

        const results = await execute(2);

        const last = results.at(-1);
        expect(last).toMatchObject({ stageName: "CheckTemplateFit", status: "error" });
        expect(last?.status === "error" && last.error.message).toBe(
            `"Helmet" can't be issued to Rescue Team A: its D4H records aren't owned by Rescue Team A or its D4H organisation.`,
        );
        expect(POST).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("refuses a variant whose D4H records belong to another team", async () => {
        vi.mocked(getD4HTeamFitContext).mockResolvedValue(
            fitContext({ modelTeam: OTHER_TEAM_ID }) as never,
        );

        const results = await execute(1, true);

        const last = results.at(-1);
        expect(last).toMatchObject({ stageName: "CheckTemplateFit", status: "error" });
        expect(last?.status === "error" && last.error.message).toBe(
            `"Helmet (Large)" can't be issued to Rescue Team A: its D4H records aren't owned by Rescue Team A or its D4H organisation.`,
        );
        expect(POST).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
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

    it("refuses up front without Equipment.CREATE on the recipient team", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(false) as never);

        const results = await execute(2);

        const last = results.at(-1);
        expect(last).toMatchObject({ stageName: "CheckPermissions", status: "error" });
        expect(last?.status === "error" && last.error).toBeInstanceOf(ForbiddenError);
        expect(last?.status === "error" && last.error.message).toBe(
            "You need D4H's Equipment CREATE permission on Team to do this.",
        );
        expect(POST).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
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
