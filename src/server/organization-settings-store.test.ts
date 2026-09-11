/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { DiffChange } from "@/lib/diff";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { createMockPrisma } from "@/test/create-prisma-mock";

import { writeOrganizationSettings } from "./organization-settings-store";

describe("writeOrganizationSettings", () => {
    it("records settings changes with segmented paths", async () => {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();

        await db.organization.create({
            data: { id: orgId, name: "Acme", slug: "acme", createdAt: new Date() },
        });

        const defaults = OrganizationSettings.default();
        const next: OrganizationSettings = {
            ...defaults,
            modules: {
                ...defaults.modules,
                i3: { ...defaults.modules.i3, enabled: true },
            },
        };

        let recorded: DiffChange[] = [];

        await writeOrganizationSettings(db, orgId, next, (changes) => {
            recorded = changes;
            return db.organizationConfig.findMany({ where: { organizationId: orgId } });
        });

        expect(recorded).toEqual([
            {
                type: "obj_mod",
                path: ["modules", "i3", "enabled"],
                prev: false,
                curr: true,
            },
        ]);
    });
});
