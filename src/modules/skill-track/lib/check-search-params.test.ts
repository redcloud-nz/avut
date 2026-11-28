/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { TeamId } from "@/lib/schemas/team";

import {
    CHECK_SEARCH_PAGE_SIZE,
    checkSearchFilters,
    checkSearchInput,
    checkSearchPage,
    type CheckSearchParams,
} from "./check-search-params";

const empty: CheckSearchParams = {
    person: null,
    assessor: null,
    skill: null,
    session: null,
    result: null,
    from: null,
    to: null,
    page: 1,
};

describe("checkSearchFilters", () => {
    it("is empty when no param is set", () => {
        expect(checkSearchFilters(empty)).toEqual({});
    });

    it("maps every valid param to its filter", () => {
        const person = PersonId.create();
        const assessor = PersonId.create();
        const skill = SkillId.create();
        const session = SkillCheckSessionId.create();

        expect(
            checkSearchFilters({
                ...empty,
                person,
                assessor,
                skill,
                session,
                result: "Pass",
                from: "2026-01-01",
                to: "2026-01-31",
            }),
        ).toEqual({
            assesseeId: person,
            assessorId: assessor,
            skillId: skill,
            sessionId: session,
            result: "Pass",
            from: "2026-01-01",
            to: "2026-01-31",
        });
    });

    it("keeps session=none as the no-session filter", () => {
        expect(checkSearchFilters({ ...empty, session: "none" })).toEqual({ sessionId: "none" });
    });

    it("drops mangled ids and dates", () => {
        expect(
            checkSearchFilters({
                ...empty,
                person: "xyz",
                skill: "not-an-id",
                session: "nope",
                from: "2026-13-01",
                to: "yesterday",
            }),
        ).toEqual({});
    });
});

describe("checkSearchPage", () => {
    it("keeps a page of 1 or more", () => {
        expect(checkSearchPage(1)).toBe(1);
        expect(checkSearchPage(7)).toBe(7);
    });

    it.each([0, -1, 1e20, Number.NaN])("treats %s as page 1", (page) => {
        expect(checkSearchPage(page)).toBe(1);
    });
});

describe("checkSearchInput", () => {
    const organizationId = OrganizationId.create();
    const skillId = SkillId.create();

    it("builds the filters and page from the params alone without a teamId", () => {
        expect(checkSearchInput(organizationId, { ...empty, skill: skillId, page: 2 })).toEqual({
            organizationId,
            filters: { skillId },
            page: 2,
            pageSize: CHECK_SEARCH_PAGE_SIZE,
        });
    });

    it("adds the teamId to the filters", () => {
        const teamId = TeamId.create();

        expect(checkSearchInput(organizationId, { ...empty, skill: skillId }, teamId)).toEqual({
            organizationId,
            filters: { skillId, teamId },
            page: 1,
            pageSize: CHECK_SEARCH_PAGE_SIZE,
        });
    });
});
