/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it, vi } from "vitest";

import type { DiffChange } from "@/lib/diff";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
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
                notes: { ...defaults.modules.notes, enabled: true },
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
                path: ["modules", "notes", "enabled"],
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
        const withNotes = (enabled: boolean): OrganizationSettings => ({
            ...defaults,
            modules: { ...defaults.modules, notes: { ...defaults.modules.notes, enabled } },
        });

        await OrgSettings.write(db, orgId, withNotes(true));
        expect(
            (await db.organizationConfig.findMany({ where: { organizationId: orgId } })).map(
                (r) => r.key,
            ),
        ).toEqual(["modules.notes.enabled"]);

        const reverted = await OrgSettings.write(db, orgId, withNotes(false));

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
        const settings = (notes: boolean, personnel: boolean): OrganizationSettings => ({
            ...defaults,
            modules: {
                ...defaults.modules,
                notes: { ...defaults.modules.notes, enabled: notes },
            },
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

// `notify` holds the first array leaves in any settings tree, which `writeWith` has to compare
// by value rather than by reference, and the first record keys, which it has to delete when they
// drop out of the next settings.
describe("OrgSettings.writeSlice modules.d4h-i3.notify", () => {
    const person1 = PersonId.create();
    const person2 = PersonId.create();
    const team1 = TeamId.create();
    const team2 = TeamId.create();

    type Notify = OrganizationSettings["modules"]["d4h-i3"]["notify"];

    async function seededOrg(notify: Notify) {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();

        await db.organization.create({
            data: { id: orgId, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await OrgSettings.writeSlice(db, orgId, ["modules", "d4h-i3"], { notify });

        return { db, orgId };
    }

    async function notifyRowKeys(db: ReturnType<typeof createMockPrisma>, orgId: string) {
        const rows = await db.organizationConfig.findMany({ where: { organizationId: orgId } });
        return rows
            .map((row) => row.key)
            .filter((key) => key.startsWith("modules.d4h-i3.notify."))
            .sort();
    }

    it("records a change per team without throwing", async () => {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();
        await db.organization.create({
            data: { id: orgId, name: "Acme", slug: "acme", createdAt: new Date() },
        });

        let recorded: DiffChange[] = [];
        await OrgSettings.writeSlice(
            db,
            orgId,
            ["modules", "d4h-i3"],
            { notify: { org: [], teams: { [team1]: [person1, person2], [team2]: [person2] } } },
            (changes) => {
                recorded = changes;
                return db.organizationConfig.findMany({ where: { organizationId: orgId } });
            },
        );

        expect(recorded).toEqual([
            {
                type: "obj_add",
                path: ["modules", "d4h-i3", "notify", "teams", team1],
                curr: [person1, person2],
            },
            {
                type: "obj_add",
                path: ["modules", "d4h-i3", "notify", "teams", team2],
                curr: [person2],
            },
        ]);
    });

    it("leaves a removed team gone after a re-read", async () => {
        const { db, orgId } = await seededOrg({
            org: [person1],
            teams: { [team1]: [person1], [team2]: [person2] },
        });

        await OrgSettings.writeSlice(db, orgId, ["modules", "d4h-i3"], {
            notify: { org: [person1], teams: { [team2]: [person2] } },
        });

        const reread = await OrgSettings.read(db, orgId);
        expect(reread.modules["d4h-i3"].notify.teams).toEqual({ [team2]: [person2] });
        expect(await notifyRowKeys(db, orgId)).toEqual(
            ["modules.d4h-i3.notify.org", `modules.d4h-i3.notify.teams.${team2}`].sort(),
        );
    });

    it("writes no notify rows when an unrelated d4h-i3 field is saved", async () => {
        const { db, orgId } = await seededOrg({
            org: [person1],
            teams: { [team1]: [person1] },
        });

        const upsert = vi.spyOn(db.organizationConfig, "upsert");
        const deleteMany = vi.spyOn(db.organizationConfig, "deleteMany");

        await OrgSettings.writeSlice(db, orgId, ["modules", "d4h-i3"], { storage: "AVUT" });

        const upsertedKeys = upsert.mock.calls.map(([args]) => args.where.organizationId_key?.key);
        expect(upsertedKeys).toEqual(["modules.d4h-i3.storage"]);
        expect(deleteMany).not.toHaveBeenCalled();
        expect(await notifyRowKeys(db, orgId)).toEqual(
            ["modules.d4h-i3.notify.org", `modules.d4h-i3.notify.teams.${team1}`].sort(),
        );
    });

    it("deletes the org list's row when it is saved back to []", async () => {
        const { db, orgId } = await seededOrg({ org: [person1, person2], teams: {} });
        expect(await notifyRowKeys(db, orgId)).toEqual(["modules.d4h-i3.notify.org"]);

        const settings = await OrgSettings.writeSlice(db, orgId, ["modules", "d4h-i3"], {
            notify: { org: [], teams: {} },
        });

        expect(await notifyRowKeys(db, orgId)).toEqual([]);
        expect(settings.modules["d4h-i3"].notify).toEqual({ org: [], teams: {} });
    });
});
