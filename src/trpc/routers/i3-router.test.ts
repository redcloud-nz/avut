/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { i3Router } from "./i3-router";

// i3-router reaches @/server/auth (via forms-router) at import time; the procedures under test
// only touch ctx.prisma, so stubbing server-only is enough to load the module under jsdom.
vi.mock("server-only", () => ({}));

describe("i3Router.getTemplate", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        template: I3TemplateId.create(),
        otherOrgTemplate: I3TemplateId.create(),
        user: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
        });
        await db.i3Template.create({
            data: {
                id: T.template,
                organizationId: T.org,
                name: "Helmet",
                description: "Head protection",
            },
        });
        await db.i3Template.create({
            data: {
                id: T.otherOrgTemplate,
                organizationId: T.otherOrg,
                name: "Boots",
                description: "Foot protection",
            },
        });
    });

    function makeCaller() {
        return i3Router.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                // `organizationProcedure` always folds in `organization: ["view"]`.
                permissions: { i3Template: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns the template", async () => {
        const template = await makeCaller().getTemplate({
            organizationId: T.org,
            templateId: T.template,
        });

        expect(template.id).toBe(T.template);
        expect(template.name).toBe("Helmet");
        expect(template.description).toBe("Head protection");
    });

    it("throws NOT_FOUND for an unknown template", async () => {
        await expect(
            makeCaller().getTemplate({ organizationId: T.org, templateId: I3TemplateId.create() }),
        ).rejects.toThrow(/not found/i);
    });

    // Organization scoping is the security boundary — a valid template id from another org
    // must not resolve.
    it("throws NOT_FOUND for a template in another organization", async () => {
        await expect(
            makeCaller().getTemplate({ organizationId: T.org, templateId: T.otherOrgTemplate }),
        ).rejects.toThrow(/not found/i);
    });
});
