/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "@/lib/errors";
import { JacketInterestData, JacketInterestSubmission } from "@/lib/schemas/jacket-interest";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as PublicForms from "./public-forms";

const answer = JacketInterestData.parse({
    team: "NZ-RT11",
    name: "Sam Sample",
    interest: "yes",
    fit: "ladies",
    size: "M",
    notes: 'Prefers "longer" sleeves, please',
});

describe("JacketInterestData", () => {
    it("accepts a Yes with a fit and one of its sizes", () => {
        expect(JacketInterestData.safeParse(answer).success).toBe(true);
    });

    it("rejects a Yes with a size the fit doesn't come in", () => {
        // Ladies' stop at 2XL.
        const result = JacketInterestData.safeParse({ ...answer, size: "3XL" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["size"]);
    });

    it("blanks fit and size on a No", () => {
        expect(JacketInterestData.parse({ ...answer, interest: "no" })).toMatchObject({
            fit: "",
            size: "",
        });
    });

    it("rejects an unknown team and a blank name", () => {
        expect(JacketInterestData.safeParse({ ...answer, team: "NZ-RT99" }).success).toBe(false);
        expect(JacketInterestData.safeParse({ ...answer, name: "  " }).success).toBe(false);
    });

    it("needs the honeypot field on a submission", () => {
        expect(JacketInterestSubmission.safeParse({ answer }).success).toBe(false);
    });
});

describe("PublicForms jacket interest", () => {
    const T = {
        org: OrganizationId.create(),
        other: OrganizationId.create(),
        admin: UserId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: {
                id: T.org,
                name: "Christchurch CDEM",
                slug: "chch-cdem",
                createdAt: new Date(),
            },
        });
        await db.organization.create({
            data: { id: T.other, name: "Elsewhere", slug: "elsewhere", createdAt: new Date() },
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    const orgCtx = (organizationId: OrganizationId) =>
        createOrganizationMockContext({
            organizationId,
            user: { id: T.admin },
            permissions: {},
            prisma: db,
        });

    it("stores an answer as a Submitted form instance with no user, and logs it", async () => {
        await PublicForms.submitJacketInterest({ prisma: db }, { answer, website: "" });

        const stored = await db.formInstance.findMany({ where: { organizationId: T.org } });
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
            formKey: "chch-soft-shell-jacket",
            userId: null,
            formStatus: "Submitted",
            formData: answer,
        });

        const log = await db.logEntry.findMany({ where: { objectId: stored[0].id } });
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({ action: "Create", objectType: "FormInstance" });
    });

    it("drops an answer with the honeypot filled in", async () => {
        const before = await db.formInstance.count();
        await PublicForms.submitJacketInterest({ prisma: db }, { answer, website: "spam" });
        expect(await db.formInstance.count()).toBe(before);
    });

    it("stores in the override organisation when PUBLIC_FORMS_ORGANIZATION_SLUG is set", async () => {
        vi.stubEnv("PUBLIC_FORMS_ORGANIZATION_SLUG", "elsewhere");
        await PublicForms.submitJacketInterest({ prisma: db }, { answer, website: "" });
        expect(await db.formInstance.count({ where: { organizationId: T.other } })).toBe(1);
    });

    it("refuses when the form's organisation doesn't exist", async () => {
        vi.stubEnv("PUBLIC_FORMS_ORGANIZATION_SLUG", "nowhere");
        await expect(
            PublicForms.submitJacketInterest({ prisma: db }, { answer, website: "" }),
        ).rejects.toBeInstanceOf(NotConfiguredError);
    });

    it("lists only the organisation's own answers", async () => {
        const rows = await PublicForms.listJacketInterest(orgCtx(T.org));
        expect(rows).toHaveLength(1);
        expect(rows[0].answer).toEqual(answer);
    });

    it("writes CSV with a header and quoted cells", async () => {
        const csv = PublicForms.jacketInterestCsv(
            await PublicForms.listJacketInterest(orgCtx(T.org)),
        );
        const [header, row] = csv.trimEnd().split("\r\n");
        expect(header).toBe("Submitted,Team,Name,Would use one,Fit,Size,Comments");
        expect(row).toContain(
            `NZ-RT11,Sam Sample,Yes,Ladies',M,"Prefers ""longer"" sleeves, please"`,
        );
    });

    it("keeps an older answer whose size or team has since left the lists", async () => {
        await db.formInstance.create({
            data: {
                id: "oldAnswer0000001",
                formKey: "chch-soft-shell-jacket",
                organizationId: T.org,
                userId: null,
                formStatus: "Submitted",
                formData: { ...answer, team: "NZ-RT99", fit: "mens", size: "5XL" },
            },
        });
        const rows = await PublicForms.listJacketInterest(orgCtx(T.org));
        expect(rows.map((row) => row.answer.size)).toContain("5XL");
    });
});
