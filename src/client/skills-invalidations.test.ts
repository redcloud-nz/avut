/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillPackageId } from "@/lib/schemas/skill-package";

import { skillsInvalidations } from "./skills-invalidations";

describe("skillsInvalidations", () => {
    const organizationId = OrganizationId.create();
    const skillCheckSessionId = SkillCheckSessionId.create();
    const skillPackageId = SkillPackageId.create();

    it("createSession, deleteSession, and updateSession each invalidate only the session list", () => {
        const expected = [
            [["skills", "listSessions"], { input: { organizationId }, type: "query" }],
        ];

        expect(
            skillsInvalidations
                .createSession({
                    organizationId,
                    skillCheckSessionId,
                    create: {},
                } as never)
                .map((f) => f.queryKey),
        ).toEqual(expected);
        expect(
            skillsInvalidations
                .deleteSession({ organizationId, skillCheckSessionId } as never)
                .map((f) => f.queryKey),
        ).toEqual(expected);
        expect(
            skillsInvalidations
                .updateSession({ organizationId, skillCheckSessionId, update: {} } as never)
                .map((f) => f.queryKey),
        ).toEqual(expected);
    });

    it("subscribeToPackage and unsubscribeFromPackage each invalidate only the package list", () => {
        const expected = [
            [["skills", "listPackages"], { input: { organizationId }, type: "query" }],
        ];

        expect(
            skillsInvalidations
                .subscribeToPackage({ organizationId, skillPackageId } as never)
                .map((f) => f.queryKey),
        ).toEqual(expected);
        expect(
            skillsInvalidations
                .unsubscribeFromPackage({ organizationId, skillPackageId } as never)
                .map((f) => f.queryKey),
        ).toEqual(expected);
    });

    it("updateSessionSkills invalidates the session list and the all-assessees list", () => {
        const filters = skillsInvalidations.updateSessionSkills({
            organizationId,
            skillCheckSessionId,
            addedSkillIds: [],
            removedSkillIds: [],
        } as never);

        expect(filters.map((f) => f.queryKey)).toEqual([
            [["skills", "listSessions"], { input: { organizationId }, type: "query" }],
            [
                ["skills", "listSessionAssessees"],
                {
                    input: {
                        organizationId,
                        sessionId: skillCheckSessionId,
                        scope: "all",
                    },
                    type: "query",
                },
            ],
        ]);
    });

    it("updateSessionAssessees invalidates the session list and the all-assessees list", () => {
        const filters = skillsInvalidations.updateSessionAssessees({
            organizationId,
            skillCheckSessionId,
            addedPersonIds: [],
            removedPersonIds: [],
        } as never);

        expect(filters.map((f) => f.queryKey)).toEqual([
            [["skills", "listSessions"], { input: { organizationId }, type: "query" }],
            [
                ["skills", "listSessionAssessees"],
                {
                    input: {
                        organizationId,
                        sessionId: skillCheckSessionId,
                        scope: "all",
                    },
                    type: "query",
                },
            ],
        ]);
    });
});
