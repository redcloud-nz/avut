/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { CableIcon, NotebookPenIcon, ShieldIcon, WrenchIcon } from "lucide-react";
import type { Route } from "next";
import { describe, expect, it } from "vitest";

import {
    deriveTeamModules,
    moduleDefHref,
    moduleHref,
    teamModules,
    type ModuleDef,
    type OrganizationModuleDef,
    type TeamModuleDef,
} from "@/lib/modules";

// Team routes don't exist as typed routes yet, so the fixtures cast their hrefs.
const teamHref = (segment: string) => (teamSlug: string) =>
    `/teams/${teamSlug}/${segment}` as Route;
const orgHref = (segment: string) => (slug: string) => `/orgs/${slug}/${segment}` as Route;

// `TeamModuleId` is `never` until the first team-only module lands, so the fixture casts its id.
const teamOnly = {
    id: "team-admin" as never,
    label: "Team Admin",
    icon: WrenchIcon,
    segment: "admin",
    alwaysOn: true,
    scope: "team",
    href: teamHref("admin"),
} satisfies TeamModuleDef;

const orgWithTeam = {
    id: "notes",
    label: "Notes",
    icon: NotebookPenIcon,
    segment: "notes",
    scope: "organization",
    href: orgHref("notes"),
    team: { href: teamHref("notes") },
} satisfies OrganizationModuleDef;

const orgWithTeamSegment = {
    id: "skill-track",
    label: "Skill Track",
    icon: ShieldIcon,
    segment: "skill-track",
    scope: "organization",
    href: orgHref("skill-track"),
    team: { segment: "skills", href: teamHref("skills") },
} satisfies OrganizationModuleDef;

const orgAlwaysOnWithTeam = {
    id: "org-admin",
    label: "Admin",
    icon: WrenchIcon,
    segment: "admin",
    alwaysOn: true,
    scope: "organization",
    href: orgHref("admin"),
    team: { href: teamHref("org-admin") },
} satisfies OrganizationModuleDef;

const orgOnly = {
    id: "d4h",
    label: "D4H",
    icon: CableIcon,
    segment: "d4h",
    scope: "organization",
    href: orgHref("d4h"),
} satisfies OrganizationModuleDef;

const userModule = {
    id: "user-notes",
    label: "Notes",
    icon: NotebookPenIcon,
    segment: "notes",
    alwaysOn: true,
    scope: "user",
    href: () => "/user/notes",
} satisfies ModuleDef;

describe("deriveTeamModules", () => {
    const derived = deriveTeamModules([
        orgWithTeam,
        orgOnly,
        teamOnly,
        userModule,
        orgWithTeamSegment,
    ]);

    it("keeps team-only modules and org modules with a team entry, in list order", () => {
        expect(derived.map((m) => m.id)).toEqual(["notes", "team-admin", "skill-track"]);
    });

    it("leaves out org modules without a team entry and other scopes", () => {
        expect(derived.map((m) => m.id)).not.toContain("d4h");
        expect(derived.map((m) => m.id)).not.toContain("user-notes");
    });

    it("normalises a team-only module as always on, with its own href", () => {
        const m = derived.find((d) => d.id === teamOnly.id)!;
        expect(m).toMatchObject({ label: "Team Admin", segment: "admin", alwaysOn: true });
        expect(m.href("rescue")).toBe("/teams/rescue/admin");
    });

    it("uses an org module's team href and falls back to its org segment", () => {
        const m = derived.find((d) => d.id === "notes")!;
        expect(m).toMatchObject({ label: "Notes", segment: "notes", alwaysOn: false });
        expect(m.href("rescue")).toBe("/teams/rescue/notes");
    });

    it("uses an org module's own team segment when it declares one", () => {
        const m = derived.find((d) => d.id === "skill-track")!;
        expect(m.segment).toBe("skills");
        expect(m.href("rescue")).toBe("/teams/rescue/skills");
    });

    it("carries an org module's alwaysOn", () => {
        expect(deriveTeamModules([orgAlwaysOnWithTeam])[0]).toMatchObject({
            id: "org-admin",
            alwaysOn: true,
        });
    });

    it("is empty on the real registry for now", () => {
        expect(teamModules).toEqual([]);
    });
});

describe("moduleDefHref", () => {
    const org = { scope: "organization", slug: "acme" } as const;
    const team = { scope: "team", slug: "rescue" } as const;

    it("gives an org module's org href in org scope and its team href in team scope", () => {
        expect(moduleDefHref(orgWithTeam, org)).toBe("/orgs/acme/notes");
        expect(moduleDefHref(orgWithTeam, team)).toBe("/teams/rescue/notes");
    });

    it("gives a team-only module's href in team scope only", () => {
        expect(moduleDefHref(teamOnly, team)).toBe("/teams/rescue/admin");
        expect(moduleDefHref(teamOnly, org)).toBeUndefined();
    });

    it("is undefined for an org module with no team entry in team scope", () => {
        expect(moduleDefHref(orgOnly, team)).toBeUndefined();
    });

    it("is undefined for a user module in either scope", () => {
        expect(moduleDefHref(userModule, org)).toBeUndefined();
        expect(moduleDefHref(userModule, team)).toBeUndefined();
    });
});

describe("moduleHref", () => {
    it("gives a registry module's org href", () => {
        expect(moduleHref("notes", { scope: "organization", slug: "acme" })).toBe(
            "/orgs/acme/notes",
        );
    });

    it("is undefined for a module that isn't in team scope", () => {
        expect(moduleHref("notes", { scope: "team", slug: "rescue" })).toBeUndefined();
    });

    it("is undefined for an org module with no page, and for a non-org module in org scope", () => {
        expect(moduleHref("forms", { scope: "organization", slug: "acme" })).toBeUndefined();
        expect(moduleHref("user-notes", { scope: "organization", slug: "acme" })).toBeUndefined();
    });
});
