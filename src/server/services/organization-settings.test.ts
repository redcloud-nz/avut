/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { DiffChange } from "@/lib/diff";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { createMockPrisma } from "@/test/create-prisma-mock";

import * as OrgSettings from "./organization-settings";

describe("OrgSettings.write", () => {
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

        await OrgSettings.write(db, orgId, next, (changes) => {
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

    it("deletes a leaf's row when it is set back to its default", async () => {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();

        await db.organization.create({
            data: { id: orgId, name: "Acme", slug: "acme", createdAt: new Date() },
        });

        const defaults = OrganizationSettings.default();
        const withI3 = (enabled: boolean): OrganizationSettings => ({
            ...defaults,
            modules: { ...defaults.modules, i3: { ...defaults.modules.i3, enabled } },
        });

        await OrgSettings.write(db, orgId, withI3(true));
        expect(
            (await db.organizationConfig.findMany({ where: { organizationId: orgId } })).map(
                (r) => r.key,
            ),
        ).toEqual(["modules.i3.enabled"]);

        const reverted = await OrgSettings.write(db, orgId, withI3(false));

        expect(await db.organizationConfig.findMany({ where: { organizationId: orgId } })).toEqual(
            [],
        );
        expect(reverted).toEqual(defaults);
    });

    it("leaves other materialised rows alone when one leaf reverts to its default", async () => {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();

        await db.organization.create({
            data: { id: orgId, name: "Acme", slug: "acme", createdAt: new Date() },
        });

        const defaults = OrganizationSettings.default();
        const settings = (i3: boolean, personnel: boolean): OrganizationSettings => ({
            ...defaults,
            modules: { ...defaults.modules, i3: { ...defaults.modules.i3, enabled: i3 } },
            personnel: { ...defaults.personnel, autoLinkOnPersonCreate: personnel },
        });

        await OrgSettings.write(db, orgId, settings(true, true));
        await OrgSettings.write(db, orgId, settings(false, true));

        const records = await db.organizationConfig.findMany({ where: { organizationId: orgId } });
        expect(records.map((r) => r.key)).toEqual(["personnel.autoLinkOnPersonCreate"]);
        expect(OrganizationSettings.fromRecords(records)).toEqual(settings(false, true));
    });

    // The personnel group is the first top-level addition since `general`/`integrations`/
    // `modules`, so this pins that a new group flattens, persists, and resolves like the rest —
    // and that both switches default off, which is the promise that no existing organization
    // changes behaviour when this ships.
    it("round-trips the personnel group and defaults it off", async () => {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();

        await db.organization.create({
            data: { id: orgId, name: "Acme", slug: "acme", createdAt: new Date() },
        });

        const defaults = OrganizationSettings.default();
        expect(defaults.personnel).toEqual({
            autoLinkOnInviteAccept: false,
            autoLinkOnPersonCreate: false,
        });

        let recorded: DiffChange[] = [];
        const settings = await OrgSettings.write(
            db,
            orgId,
            { ...defaults, personnel: { ...defaults.personnel, autoLinkOnPersonCreate: true } },
            (changes) => {
                recorded = changes;
                return db.organizationConfig.findMany({ where: { organizationId: orgId } });
            },
        );

        expect(recorded).toEqual([
            {
                type: "obj_mod",
                path: ["personnel", "autoLinkOnPersonCreate"],
                prev: false,
                curr: true,
            },
        ]);
        expect(settings.personnel.autoLinkOnPersonCreate).toBe(true);
        expect(settings.personnel.autoLinkOnInviteAccept).toBe(false);

        // Only the changed leaf is materialised; the rest still resolves from defaults.
        const records = await db.organizationConfig.findMany({ where: { organizationId: orgId } });
        expect(records.map((r) => r.key)).toEqual(["personnel.autoLinkOnPersonCreate"]);
        expect(OrganizationSettings.fromRecords(records).personnel).toEqual({
            autoLinkOnInviteAccept: false,
            autoLinkOnPersonCreate: true,
        });
    });
});
